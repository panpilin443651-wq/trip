import { NextResponse } from "next/server";
import { buildExplorePrompt } from "@/lib/chat/explore-prompt";
import { guardChatRequest, parseMessages } from "@/lib/chat/guard";
import { retrieve } from "@/lib/explore-retrieval";
import { streamGemini } from "@/lib/gemini/chat-stream";

/**
 * ผู้ช่วยแนะนำที่เที่ยว — ค้นสถานที่จริงก่อน แล้วให้ Gemini เรียบเรียง
 *
 * ต่างจาก /api/chat ตรงที่อันนั้นตอบเรื่องวิธีใช้เว็บและสรุปทริปที่ผู้ใช้กรอกไว้
 * ส่วนอันนี้ตอบว่า "ไปไหนดี" โดยอ้างจากสถานที่ 5,208 แห่งในฐานข้อมูล
 * จึงถามได้ลึกกว่าที่หน้าเว็บเลือกได้ — บางแสน (ระดับตำบล) โคราช (ชื่อเล่น)
 * หรือเขาใหญ่ (คร่อมสองจังหวัด)
 */

/** ช่องนี้เป็นเครื่องมือค้นหา ไม่ใช่บทสนทนายาว ประวัติสั้นกว่าช่องทั่วไปได้ */
const MAX_HISTORY = 12;
const MAX_CHARS_PER_MESSAGE = 2000;

export async function POST(request: Request) {
  const blocked = await guardChatRequest();
  if (blocked) return blocked;

  let body: { messages?: unknown; province?: unknown; district?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = parseMessages(body.messages, MAX_HISTORY);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const province = typeof body.province === "string" ? body.province : "";
  const district = typeof body.district === "string" ? body.district : "";

  // ค้นจากคำถามล่าสุดเท่านั้น ไม่รวมทั้งบทสนทนา
  // ถ้าเอาข้อความเก่ามารวมด้วย คำถามแรกจะลากผลของมันติดมาทุกครั้งที่ถามต่อ
  const question = parsed.messages.at(-1)?.text ?? "";
  const found = retrieve(question.slice(0, MAX_CHARS_PER_MESSAGE), {
    province,
    district,
  });

  /*
   * ไม่ส่งรายการสถานที่กลับไปพร้อมคำตอบ
   *
   * เคยจะแนบไปทาง header แต่ชื่อไทย 40 แห่งพอเข้ารหัสแล้วโตเป็นหลักหมื่นไบต์
   * ซึ่งชน max-http-header-size ของ Node ที่ 16 KB ส่วนการยัดลง body ก็ทำไม่ได้
   * เพราะ body เป็นสตรีมข้อความล้วนที่แสดงทีละก้อนระหว่างพิมพ์
   * ฝั่งเบราว์เซอร์จึงไปขอที่ /api/explore-chat/places ตอนคำตอบจบแทน
   */
  return streamGemini({
    systemPrompt: buildExplorePrompt(found.context, { province, district }),
    messages: parsed.messages,
    maxCharsPerMessage: MAX_CHARS_PER_MESSAGE,
    label: "explore-chat",
  });
}
