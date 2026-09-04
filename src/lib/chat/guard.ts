import { NextResponse } from "next/server";
import type { GeminiMessage } from "@/lib/gemini/chat-stream";
import { isGeminiConfigured } from "@/lib/gemini/config";
import { createClient } from "@/lib/supabase/server";

/**
 * ด่านที่ทุกช่องแชทต้องผ่านเหมือนกัน — ต้องล็อกอิน และต้องตั้งคีย์ไว้แล้ว
 *
 * แยกมาไว้ที่เดียวเพราะมีสองเส้นทางที่ใช้ชุดนี้ (/api/chat กับ /api/explore-chat)
 * ถ้าวันหนึ่งเพิ่มการจำกัดจำนวนคำถามต่อคน จะได้เพิ่มที่เดียวแล้วคุมได้ทั้งสองช่อง
 */

/** คืน Response ถ้าไม่ผ่าน คืน null ถ้าผ่าน */
export async function guardChatRequest(): Promise<Response | null> {
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
      { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY — ดูวิธีตั้งค่าได้ใน README" },
      { status: 503 },
    );
  }

  return null;
}

/**
 * คัดเฉพาะข้อความที่มีรูปแบบถูกต้อง แล้วตัดให้เหลือประวัติล่าสุด
 * คืน error เป็นข้อความไทยถ้าใช้ไม่ได้
 */
export function parseMessages(
  raw: unknown,
  maxHistory: number,
): { messages: GeminiMessage[] } | { error: string } {
  const incoming = Array.isArray(raw) ? raw : [];
  const messages = incoming
    .filter(
      (m): m is GeminiMessage =>
        !!m &&
        typeof m === "object" &&
        typeof (m as GeminiMessage).text === "string" &&
        ((m as GeminiMessage).role === "user" ||
          (m as GeminiMessage).role === "model"),
    )
    .slice(-maxHistory);

  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return { error: "ต้องมีคำถามจากผู้ใช้อย่างน้อยหนึ่งข้อความ" };
  }
  return { messages };
}
