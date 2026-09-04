import { NextResponse } from "next/server";
import { GEMINI_API_KEY } from "./config";
import {
  describeFetchError,
  readUpstreamError,
  upstreamHint,
} from "./errors";
import { candidateModels, pickModel, rememberModel } from "./models";
import { geminiTextStream } from "./sse";

/**
 * ยิงคำถามไป Gemini แล้วสตรีมคำตอบกลับเป็นข้อความล้วน
 *
 * แยกออกมาจาก /api/chat เพราะตอนนี้มีสองช่องที่ต้องใช้ตรรกะชุดนี้
 * (ผู้ช่วยทั่วไป กับ ผู้ช่วยแนะนำที่เที่ยว) และช่วงนี้เป็นส่วนที่พังบ่อยที่สุด
 * — รุ่นถูกปลด โควตาเต็ม คีย์ผิด ถ้าปล่อยให้มีสองสำเนา วันหนึ่งจะแก้ที่เดียว
 * แล้วอีกที่ค้างของเก่าไว้ เหมือนที่เคยเจอกับชุดสีที่ก๊อปไว้หลายไฟล์
 */

export interface GeminiMessage {
  role: "user" | "model";
  text: string;
}

/**
 * งบเวลารวมของทุกครั้งที่ยิงไปหา Gemini ในคำขอเดียว
 *
 * ต้องคุมยอดรวม ไม่ใช่คุมทีละครั้ง เพราะตอนรุ่นหลักใช้ไม่ได้จะไล่ยิงรุ่นสำรอง
 * ต่ออีกหลายครั้ง ถ้าให้แต่ละครั้งมีเวลา 30 วินาทีของตัวเอง ยอดรวมจะพุ่งไป
 * เกินสองนาที ซึ่งนานกว่าที่ Vercel ยอมให้ฟังก์ชันทำงาน (Hobby 10 วินาที)
 * แพลตฟอร์มจะฆ่าฟังก์ชันทิ้งก่อน แล้วผู้ใช้จะได้หน้า error ของ Vercel
 * แทนข้อความที่เราเขียนไว้ ซึ่งบอกอะไรไม่ได้เลย
 */
const TOTAL_BUDGET_MS = 25_000;
/** ครั้งเดียวไม่ควรกินงบทั้งหมด เผื่อไว้ให้รุ่นสำรองได้ลองบ้าง */
const PER_CALL_MS = 15_000;
/** ลองรุ่นสำรองกี่ตัว — แต่ละตัวกินเวลาไป-กลับเต็ม ๆ หนึ่งรอบ */
const MAX_CANDIDATES = 2;

export interface StreamOptions {
  systemPrompt: string;
  messages: GeminiMessage[];
  maxCharsPerMessage: number;
  /** ใส่ในบรรทัด log ให้รู้ว่ามาจากช่องไหน */
  label: string;
  /** header เพิ่มเติมที่แนบไปกับคำตอบตอนสำเร็จ */
  headers?: Record<string, string>;
}

/**
 * คืน Response ที่พร้อมส่งกลับให้เบราว์เซอร์
 * สำเร็จ = สตรีมข้อความล้วน, ล้มเหลว = JSON ที่มี error เป็นภาษาไทย
 */
export async function streamGemini(options: StreamOptions): Promise<Response> {
  const payload = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: options.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, options.maxCharsPerMessage) }],
    })),
    generationConfig: {
      temperature: 0.6,
      // รุ่นใหม่คิดก่อนตอบ โทเคนช่วงคิดก็นับรวมในนี้ด้วย
      // ตั้งไว้ 1200 เคยทำให้เจอ MAX_TOKENS ตั้งแต่คำตอบสั้น ๆ
      maxOutputTokens: 4000,
    },
  };

  const startedAt = Date.now();
  const timeLeft = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  /** ยิงไปที่รุ่นหนึ่ง ๆ — แยกออกมาเพราะต้องเรียกซ้ำตอนหารุ่นสำรอง */
  async function callGemini(model: string): Promise<Response> {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(payload),
        // เหลือเท่าไรก็ใช้เท่านั้น จะได้ไม่ทะลุงบรวม
        signal: AbortSignal.timeout(Math.max(1_000, Math.min(PER_CALL_MS, timeLeft()))),
      },
    );
  }

  /** สถานะที่ลองรุ่นอื่นแล้วอาจผ่าน — รุ่นถูกปลด หรือรุ่นนั้นคนใช้แน่นอยู่ */
  const worthRetrying = (status: number) => status === 404 || status === 503;

  let model = pickModel();
  let upstream: Response;
  try {
    upstream = await callGemini(model);

    // รุ่นที่ตั้งไว้ใช้ไม่ได้ ให้ไล่ลองรุ่นอื่นที่คีย์นี้มี
    //
    // ต้องยิงจริงทีละตัว เช็กจากรายชื่ออย่างเดียวไม่พอ เพราะรุ่นที่ Google
    // ปิดรับผู้ใช้ใหม่แล้วยังโผล่ใน ListModels อยู่ แต่ตอบ 404 เวลาเรียกจริง
    if (worthRetrying(upstream.status)) {
      const candidates = (await candidateModels()).filter((m) => m !== model);
      for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
        // หมดงบแล้วหยุดลอง ปล่อยให้ตอบด้วยผลของรุ่นล่าสุดดีกว่าโดนฆ่ากลางคัน
        if (timeLeft() < 3_000) break;
        const next = await callGemini(candidate);
        if (next.ok) {
          model = candidate;
          upstream = next;
          rememberModel(candidate);
          break;
        }
        // เจอสาเหตุอื่นที่ไม่ใช่เรื่องรุ่น ลองต่อไปก็ไม่ช่วย
        if (!worthRetrying(next.status)) {
          upstream = next;
          break;
        }
      }
    }
  } catch (error) {
    const { hint, detail } = describeFetchError(error);
    // log ไว้ให้ตามดูใน Vercel ได้ เผื่อผู้ใช้ส่งภาพหน้าจอมาไม่ครบ
    console.error(
      `[${options.label}] ต่อ Gemini ไม่ได้ model=${JSON.stringify(model)} ` +
        `ใช้เวลา ${Date.now() - startedAt}ms: ${detail}`,
    );
    return NextResponse.json(
      {
        error:
          `${hint} — รายละเอียด: ${detail} ` +
          `[รุ่นที่ส่งไป: ${JSON.stringify(model)}]`,
      },
      { status: 504 },
    );
  }

  // ต้องเช็กก่อนเริ่มสตรีม เพราะพอสตรีมแล้วเปลี่ยนสถานะไม่ได้
  if (!upstream.ok || !upstream.body) {
    const detail = await readUpstreamError(upstream);
    const hint = upstreamHint(upstream.status, detail);
    // log ไว้ให้ตามดูใน Vercel ได้ เผื่อผู้ใช้ส่งภาพหน้าจอมาไม่ครบ
    console.error(
      `[${options.label}] Gemini ${upstream.status} model=${JSON.stringify(model)}: ${detail}`,
    );
    return NextResponse.json(
      {
        // ใส่ชื่อรุ่นแบบ JSON เพื่อให้เห็นช่องว่างหรือขึ้นบรรทัดใหม่ที่ติดมา
        error:
          (detail ? `${hint} — Google บอกว่า: ${detail}` : hint) +
          ` [รุ่นที่ส่งไป: ${JSON.stringify(model)}]`,
      },
      { status: 502 },
    );
  }

  rememberModel(model);

  return new Response(geminiTextStream(upstream.body), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...options.headers,
    },
  });
}
