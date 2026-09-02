/**
 * ค่าเชื่อมต่อ Gemini API
 *
 * ต่างจาก Supabase anon key ตรงที่คีย์นี้ไม่มี Row Level Security คุ้มกัน
 * ใครได้ไปก็ยิงจนโควตาหมดได้ จึงต้องไม่ขึ้นต้นด้วย NEXT_PUBLIC_
 * และไฟล์นี้ต้อง import จากฝั่งเซิร์ฟเวอร์เท่านั้น
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

/** เปลี่ยนรุ่นได้ทาง env เผื่อรุ่นที่ตั้งไว้ถูกปลดจากชั้นฟรี */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** ยังไม่ได้ตั้ง env — ใช้แสดงวิธีตั้งค่าแทนที่จะพังเงียบ ๆ */
export const isGeminiConfigured = GEMINI_API_KEY.length > 20;
