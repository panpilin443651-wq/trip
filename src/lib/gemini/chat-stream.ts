import { NextResponse } from "next/server";
import { GEMINI_API_KEY } from "./config";
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
 * ดึงข้อความผิดพลาดจริงที่ Google ส่งมา
 *
 * ต้องเอามาโชว์ด้วยเสมอ เพราะรหัสสถานะเดียวกันมาได้จากหลายสาเหตุมาก
 * โดยเฉพาะ 400 ที่เป็นได้ทั้งคีย์ผิด รูปแบบคำขอผิด และรุ่นไม่รองรับฟีเจอร์
 * ถ้าเดาเองจะพาไปแก้ผิดจุด
 */
export async function readUpstreamError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const data = JSON.parse(text) as {
      error?: { message?: string; status?: string };
    };
    const detail = data.error?.message?.trim();
    if (detail) return detail;
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

/** คำแนะนำตามรหัสสถานะ ใช้คู่กับข้อความจริงจาก Google เสมอ */
export function upstreamHint(status: number, detail: string): string {
  if (status === 429) {
    return "โควตาฟรีของ Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่";
  }
  if (status === 503) {
    return "รุ่นที่ใช้อยู่มีคนใช้แน่นชั่วคราว รอสักครู่แล้วลองใหม่";
  }
  if (status === 403) {
    return "คีย์ไม่มีสิทธิ์เรียก — ตรวจว่าเปิดใช้ Generative Language API แล้ว และคีย์ไม่ได้ถูกจำกัดโดเมน/IP";
  }
  if (status === 400) {
    // 400 มาได้หลายทาง แยกด้วยข้อความที่ Google ส่งมา
    if (/API key not valid|API_KEY_INVALID/i.test(detail)) {
      return "API key ไม่ถูกต้อง — คัดลอกคีย์จาก Google AI Studio มาใหม่";
    }
    if (/model name format|GenerateContentRequest.model/i.test(detail)) {
      return (
        "ชื่อรุ่นผิดรูป — ถ้าตั้ง GEMINI_MODEL ไว้ ให้ลบทิ้งแล้ว redeploy " +
        "(แอปหารุ่นที่ใช้ได้เอง) หรือใส่แค่ชื่อล้วน ๆ เช่น gemini-3.6-flash " +
        "ห้ามมีเครื่องหมายคำพูด ช่องว่าง หรือคำนำหน้า models/"
      );
    }
    return "คำขอถูกปฏิเสธ";
  }
  return "ผู้ช่วยไม่ตอบสนอง ลองใหม่อีกครั้ง";
}

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
        signal: AbortSignal.timeout(30_000),
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
      for (const candidate of candidates.slice(0, 4)) {
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
  } catch {
    return NextResponse.json(
      { error: "ต่อกับผู้ช่วยไม่ได้ — ตรวจการเชื่อมต่ออินเทอร์เน็ต" },
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
