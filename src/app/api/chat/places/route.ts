import { NextResponse } from "next/server";
import { guardChatRequest } from "@/lib/chat/guard";
import {
  matchPlacesInAnswer,
  retrieve,
  type PlaceRow,
} from "@/lib/explore-retrieval";

/**
 * หาสถานที่ที่ผู้ช่วยพูดถึงในคำตอบ เพื่อขึ้นเป็นปุ่ม "ใส่ในแผน"
 *
 * แยกเป็นอีกเส้นทางเพราะคำตอบสตรีมมาทีละก้อน จะรู้ว่าพูดถึงที่ไหนบ้าง
 * ก็ต่อเมื่อพิมพ์จบแล้ว และรายชื่อภาษาไทยใหญ่เกินกว่าจะยัดกลับไปทาง header ได้
 *
 * ค้นซ้ำด้วยคำถามเดิม (retrieve เป็นฟังก์ชันบริสุทธิ์บนข้อมูลนิ่ง ผลจึงเหมือนเดิมเป๊ะ)
 * แล้วเทียบกับคำตอบ ใช้เวลาไม่กี่มิลลิวินาที ไม่ได้เรียก Gemini ซ้ำ
 *
 * ผลพลอยได้ที่สำคัญ — ปุ่มขึ้นได้เฉพาะที่ที่มีอยู่จริงในฐานข้อมูลเท่านั้น
 * ถ้าผู้ช่วยแต่งชื่อขึ้นมาจากความรู้ทั่วไป จะไม่มีปุ่มให้กด
 */

/** คำตอบยาวกว่านี้ไม่มี ตัดกันคนยิงข้อความใหญ่ ๆ มาให้ไล่เทียบเล่น */
const MAX_ANSWER_CHARS = 20_000;

export interface PlacePicks {
  places: PlaceRow[];
}

export async function POST(request: Request) {
  const blocked = await guardChatRequest();
  if (blocked) return blocked;

  let body: {
    question?: unknown;
    answer?: unknown;
    province?: unknown;
    district?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  const answer =
    typeof body.answer === "string" ? body.answer.slice(0, MAX_ANSWER_CHARS) : "";
  if (!question || !answer) {
    return NextResponse.json({ places: [] } satisfies PlacePicks);
  }

  const found = retrieve(question, {
    province: typeof body.province === "string" ? body.province : "",
    district: typeof body.district === "string" ? body.district : "",
  });

  return NextResponse.json(
    { places: matchPlacesInAnswer(answer, found.rows) } satisfies PlacePicks,
    { headers: { "Cache-Control": "no-store" } },
  );
}
