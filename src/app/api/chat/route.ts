import { NextResponse } from "next/server";
import { BUILD_SHA, BUILD_TIME } from "@/lib/build-info";
import { guardChatRequest, parseMessages } from "@/lib/chat/guard";
import { buildSystemPrompt } from "@/lib/chat/knowledge";
import { retrieve } from "@/lib/explore-retrieval";
import { streamGemini } from "@/lib/gemini/chat-stream";
import { readUpstreamError } from "@/lib/gemini/errors";
import {
  GEMINI_API_KEY,
  isGeminiConfigured,
  normalizeModel,
} from "@/lib/gemini/config";
import { candidateModels, pickModel } from "@/lib/gemini/models";
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

export async function POST(request: Request) {
  const blocked = await guardChatRequest();
  if (blocked) return blocked;

  let body: {
    messages?: unknown;
    tripSummary?: unknown;
    province?: unknown;
    district?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = parseMessages(body.messages, MAX_HISTORY);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const tripSummary =
    typeof body.tripSummary === "string"
      ? body.tripSummary.slice(0, MAX_SUMMARY_CHARS)
      : "";

  /*
   * ค้นสถานที่จริงจากคำถามล่าสุดก่อน แล้วยัดเข้า prompt
   *
   * ค้นจากคำถามล่าสุดเท่านั้น ไม่รวมทั้งบทสนทนา ไม่งั้นคำถามแรกจะลากผลของมัน
   * ติดมาทุกครั้งที่ถามต่อ · ถ้าคำถามไม่ได้ถามถึงที่ไหน retrieve จะคืนรายการว่าง
   * แล้วส่วนแนะนำสถานที่จะไม่ถูกต่อเข้า prompt เลย
   */
  const question = parsed.messages.at(-1)?.text ?? "";
  const found = retrieve(question.slice(0, MAX_CHARS_PER_MESSAGE), {
    province: typeof body.province === "string" ? body.province : "",
    district: typeof body.district === "string" ? body.district : "",
  });

  return streamGemini({
    systemPrompt: buildSystemPrompt(tripSummary, found.context),
    messages: parsed.messages,
    maxCharsPerMessage: MAX_CHARS_PER_MESSAGE,
    label: "chat",
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
