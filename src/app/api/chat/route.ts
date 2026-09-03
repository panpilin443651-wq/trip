import { NextResponse } from "next/server";
import { BUILD_SHA, BUILD_TIME } from "@/lib/build-info";
import { buildSystemPrompt } from "@/lib/chat/knowledge";
import type { ChatRole } from "@/lib/chat/types";
import {
  GEMINI_API_KEY,
  isGeminiConfigured,
  normalizeModel,
} from "@/lib/gemini/config";
import {
  candidateModels,
  pickModel,
  rememberModel,
} from "@/lib/gemini/models";
import { geminiTextStream } from "@/lib/gemini/sse";
import { createClient } from "@/lib/supabase/server";

/**
 * ผู้ช่วย AI — ส่งคำถามต่อไปที่ Gemini แล้วสตรีมคำตอบกลับ
 *
 * ต้องทำฝั่งเซิร์ฟเวอร์เพราะ API key ของ Gemini ไม่มี Row Level Security
 * คุ้มกันแบบ anon key ของ Supabase ใครได้คีย์ไปก็ยิงจนโควตาหมดได้
 */

/** ประวัติยาวกว่านี้ไม่ได้ช่วยให้ตอบดีขึ้น แต่กินโควตาต่อคำขอ */
const MAX_HISTORY = 30;
const MAX_CHARS_PER_MESSAGE = 2000;
const MAX_SUMMARY_CHARS = 12_000;

interface IncomingMessage {
  role: ChatRole;
  text: string;
}

/**
 * ดึงข้อความผิดพลาดจริงที่ Google ส่งมา
 *
 * ต้องเอามาโชว์ด้วยเสมอ เพราะรหัสสถานะเดียวกันมาได้จากหลายสาเหตุมาก
 * โดยเฉพาะ 400 ที่เป็นได้ทั้งคีย์ผิด รูปแบบคำขอผิด และรุ่นไม่รองรับฟีเจอร์
 * ถ้าเดาเองจะพาไปแก้ผิดจุด
 */
async function readUpstreamError(res: Response): Promise<string> {
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
function upstreamHint(status: number, detail: string): string {
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

export async function POST(request: Request) {
  // กันคนที่ไม่ได้ล็อกอินยิงจนโควตาหมด (proxy.ts กันไว้อีกชั้นแล้ว)
  //
  // ครอบ try ไว้เพราะถ้ายังไม่ได้ตั้ง env ของ Supabase ตัว createClient จะโยน
  // ทำให้ได้ 500 แทนที่จะเป็นข้อความที่บอกได้ว่าต้องทำอะไร
  // ถือว่ายังไม่ล็อกอินไว้ก่อน เหมือนที่ proxy.ts ทำตอน Supabase ล่ม
  let user = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  }

  if (!isGeminiConfigured) {
    return NextResponse.json(
      {
        error:
          "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — ดูวิธีตั้งค่าได้ใน README",
      },
      { status: 503 },
    );
  }

  let body: { messages?: unknown; tripSummary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter(
      (m): m is IncomingMessage =>
        !!m &&
        typeof m === "object" &&
        typeof (m as IncomingMessage).text === "string" &&
        ((m as IncomingMessage).role === "user" ||
          (m as IncomingMessage).role === "model"),
    )
    .slice(-MAX_HISTORY);

  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return NextResponse.json(
      { error: "ต้องมีคำถามจากผู้ใช้อย่างน้อยหนึ่งข้อความ" },
      { status: 400 },
    );
  }

  const tripSummary =
    typeof body.tripSummary === "string"
      ? body.tripSummary.slice(0, MAX_SUMMARY_CHARS)
      : "";

  const payload = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(tripSummary) }],
    },
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, MAX_CHARS_PER_MESSAGE) }],
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
      `[chat] Gemini ${upstream.status} model=${JSON.stringify(model)}: ${detail}`,
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

  const stream = geminiTextStream(upstream.body);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * หน้าตรวจการตั้งค่า — เปิด /api/chat ในเบราว์เซอร์ตอนล็อกอินอยู่
 *
 * มีไว้เพราะเวลาเจอ error จากฝั่ง Google เราเดาไม่ออกว่าค่าจริงบนเซิร์ฟเวอร์
 * เป็นอะไร ดูตรงนี้ทีเดียวจบ ไม่ต้องไล่ถามกันไปมา
 * ไม่คืนตัวคีย์ออกมา บอกแค่ว่ามีหรือไม่และยาวเท่าไร
 */
export async function GET() {
  let user = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  }

  const raw = process.env.GEMINI_MODEL;
  const model = pickModel();
  const candidates = await candidateModels();

  // ยิงจริงหนึ่งครั้งด้วยคำถามสั้นที่สุด จะได้รู้ว่าเรียกได้จริงไหม
  let test: { ok: boolean; status: number; message?: string };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 2000 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    test = res.ok
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, message: await readUpstreamError(res) };
  } catch (e) {
    test = { ok: false, status: 0, message: String(e).slice(0, 200) };
  }

  return NextResponse.json({
    // เช็กเวอร์ชันจากที่เดียวกับที่เช็กเรื่อง Gemini จะได้ไม่ต้องเปิดหลายที่
    buildSha: BUILD_SHA,
    buildTime: BUILD_TIME,
    keyMissing: !isGeminiConfigured,
    keyLength: GEMINI_API_KEY.length,
    envModelRaw: raw === undefined ? null : raw,
    envModelCleaned: raw === undefined ? null : normalizeModel(raw),
    modelInUse: model,
    candidatesTop: candidates.slice(0, 6),
    candidateCount: candidates.length,
    testCall: test,
  });
}
