import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/chat/knowledge";
import type { ChatRole } from "@/lib/chat/types";
import { GEMINI_API_KEY, isGeminiConfigured } from "@/lib/gemini/config";
import {
  discoverModel,
  listUsableModels,
  pickModel,
  rankModels,
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

/** แปลรหัสข้อผิดพลาดของ Gemini เป็นข้อความที่บอกได้ว่าต้องทำอะไรต่อ */
function upstreamMessage(status: number): string {
  if (status === 429) {
    return "โควตาฟรีของ Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่";
  }
  if (status === 400 || status === 403) {
    return "API key ใช้ไม่ได้ — ตรวจค่า GEMINI_API_KEY อีกครั้ง";
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
    system_instruction: {
      parts: [{ text: buildSystemPrompt(tripSummary) }],
    },
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text.slice(0, MAX_CHARS_PER_MESSAGE) }],
    })),
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200,
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

  let model = pickModel();
  let upstream: Response;
  try {
    upstream = await callGemini(model);

    // 404 = คีย์ใบนี้ไม่มีรุ่นนั้น คีย์แต่ละใบเห็นรุ่นไม่เท่ากันและ Google
    // ก็สับเปลี่ยนรุ่นในชั้นฟรีอยู่เรื่อย ๆ จึงไปถามมาว่ามีอะไรให้ใช้แล้วลองใหม่
    // แทนที่จะให้ผู้ใช้ไปนั่งไล่เดาชื่อรุ่นเอง ผลที่ได้จำไว้ทั้ง instance
    if (upstream.status === 404) {
      const fallback = await discoverModel();
      if (fallback && fallback !== model) {
        model = fallback;
        upstream = await callGemini(model);
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
    if (upstream.status === 404) {
      const usable = rankModels(await listUsableModels());
      return NextResponse.json(
        {
          error:
            usable.length > 0
              ? `คีย์นี้ใช้รุ่น "${model}" ไม่ได้ ลองตั้ง GEMINI_MODEL เป็น ` +
                `"${usable[0]}" (รุ่นที่ใช้ได้: ${usable.slice(0, 6).join(", ")})`
              : `ไม่พบรุ่น "${model}" และถามรายชื่อรุ่นที่ใช้ได้ไม่สำเร็จ — ` +
                `ตรวจว่า GEMINI_API_KEY ถูกต้อง และเปิดใช้ Generative Language API แล้ว`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: upstreamMessage(upstream.status) },
      { status: 502 },
    );
  }

  const stream = geminiTextStream(upstream.body);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
