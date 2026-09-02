/**
 * ค่าเชื่อมต่อ Gemini API
 *
 * ต่างจาก Supabase anon key ตรงที่คีย์นี้ไม่มี Row Level Security คุ้มกัน
 * ใครได้ไปก็ยิงจนโควตาหมดได้ จึงต้องไม่ขึ้นต้นด้วย NEXT_PUBLIC_
 * และไฟล์นี้ต้อง import จากฝั่งเซิร์ฟเวอร์เท่านั้น
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

/**
 * รุ่นที่ลองเป็นตัวแรก
 *
 * Google ปลดรุ่นเก่าออกจากผู้ใช้ใหม่เรื่อย ๆ — คีย์ที่ออกใหม่เรียก
 * gemini-2.5-flash ไม่ได้แล้ว ได้ 404 พร้อมข้อความแนะให้ใช้ 3.6 แทน
 * ถ้าค่านี้ใช้ไม่ได้ ระบบจะไปหารุ่นที่ใช้ได้เองจาก ListModels
 */
export const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * ล้างชื่อรุ่นที่รับมาจาก env ให้อยู่ในรูปที่ Gemini รับได้
 *
 * ค่าที่ตั้งผ่านหน้าเว็บของ Vercel ติดอะไรมาด้วยได้ง่ายมาก — เครื่องหมายคำพูด
 * ที่ก๊อปมาด้วย ช่องว่าง ขึ้นบรรทัดใหม่ หรือคำนำหน้า "models/" ที่เห็นในเอกสาร
 * ทั้งหมดนี้ทำให้ Gemini ตอบว่า unexpected model name format
 * ถ้าล้างแล้วยังผิดรูปอยู่ ให้ถือว่าไม่ได้ตั้ง แล้วใช้ค่าเริ่มต้นแทน
 */
export function normalizeModel(raw: string | undefined): string {
  const cleaned = (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(new RegExp("^models/"), "")
    .trim();
  return /^[a-zA-Z0-9._-]+$/.test(cleaned) ? cleaned : "";
}

export const GEMINI_MODEL =
  normalizeModel(process.env.GEMINI_MODEL) || DEFAULT_MODEL;

/** ยังไม่ได้ตั้ง env — ใช้แสดงวิธีตั้งค่าแทนที่จะพังเงียบ ๆ */
export const isGeminiConfigured = GEMINI_API_KEY.length > 20;
