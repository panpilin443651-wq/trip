/**
 * เลือกว่าจะส่งค่าโหมดคิดก่อนตอบแบบไหนให้แต่ละรุ่น
 *
 * เรื่องมีอยู่ว่า — รุ่นใหม่คิดเงียบ ๆ ก่อนแล้วค่อยพ่นคำตอบ ระหว่างคิดไม่มี
 * ข้อมูลออกมาสักไบต์ การสตรีมจึงไม่ช่วยอะไร ผู้ใช้เห็นหน้าจอค้างจนหมดเวลา
 * (เจอจริงกับ gemini-3.6-flash ทั้งที่ prompt แค่ราว 2,500 โทเคน)
 *
 * ทางแก้คือส่ง thinkingConfig ไปปิด แต่ **ไม่ใช่ทุกรุ่นรับค่านี้** และรุ่นที่
 * ไม่รับก็ตอบแค่ "Request contains an invalid argument." ซึ่งไม่ได้บอกเลยว่า
 * ฟิลด์ไหนผิด จะดักด้วยข้อความไม่ได้ ต้องลองแล้วจำเอา
 *
 * จึงไล่ลองเป็นขั้น ๆ แล้วจำไว้ว่ารุ่นนี้รับแบบไหน ครั้งต่อ ๆ ไปจะยิงถูกตั้งแต่
 * ครั้งแรก การลองผิดจึงเสียเวลาแค่ครั้งเดียวต่อรุ่น และ 400 ตอบกลับเร็วมาก
 * เพราะยังไม่ทันได้สร้างคำตอบ
 */

/** งบคิดที่จะส่งไป — `null` แปลว่าไม่ส่งฟิลด์นี้เลย ปล่อยให้รุ่นคิดตามใจ */
export type ThinkingBudget = number | null;

/**
 * ลำดับที่จะไล่ลอง เรียงจากเร็วสุดไปช้าสุด
 *
 * 0    ปิดสนิท เร็วที่สุด รุ่น flash ส่วนใหญ่รับได้
 * 128  คิดนิดเดียว เผื่อรุ่นที่บังคับให้คิดอย่างน้อยเท่าไรสักหน่อย
 * null ไม่ส่งเลย ช้าแต่ใช้ได้แน่ เป็นตาข่ายรับสุดท้าย
 */
export const THINKING_LADDER: ThinkingBudget[] = [0, 128, null];

/**
 * จำว่ารุ่นไหนรับแบบไหน อยู่ในหน่วยความจำของอินสแตนซ์เท่านั้น
 * เซิร์ฟเวอร์รีสตาร์ตแล้วเริ่มลองใหม่ ซึ่งเสียแค่รอบเดียวจึงไม่คุ้มจะเก็บถาวร
 */
const known = new Map<string, ThinkingBudget>();

/** ค่าที่ควรใช้กับรุ่นนี้ — ยังไม่เคยลองก็เริ่มจากขั้นแรก */
export function preferredThinking(model: string): ThinkingBudget {
  const seen = known.get(model);
  return seen === undefined ? THINKING_LADDER[0] : seen;
}

export function rememberThinking(model: string, budget: ThinkingBudget): void {
  known.set(model, budget);
}

/**
 * ขั้นถัดไปที่ควรลอง คืน `undefined` เมื่อไล่ครบแล้ว
 *
 * ไล่จากตำแหน่งในลำดับ ไม่ใช่จากค่าที่ส่งมา เพื่อให้ค่าที่ไม่อยู่ในลำดับ
 * (ถ้าวันหนึ่งมีใครส่งเลขอื่นเข้ามา) ตกไปที่ขั้นสุดท้ายแทนที่จะวนไม่จบ
 */
export function nextThinking(
  current: ThinkingBudget,
): ThinkingBudget | undefined {
  const at = THINKING_LADDER.indexOf(current);
  if (at < 0) return undefined;
  return at + 1 < THINKING_LADDER.length ? THINKING_LADDER[at + 1] : undefined;
}

/** ส่วนของ generationConfig ที่เกี่ยวกับโหมดคิด */
export function thinkingConfigFor(
  budget: ThinkingBudget,
): Record<string, unknown> {
  return budget === null ? {} : { thinkingConfig: { thinkingBudget: budget } };
}

/** ให้เทสต์ล้างค่าที่จำไว้ระหว่างเคส */
export function resetThinkingMemory(): void {
  known.clear();
}
