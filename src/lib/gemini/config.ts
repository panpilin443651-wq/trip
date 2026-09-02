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
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/** ยังไม่ได้ตั้ง env — ใช้แสดงวิธีตั้งค่าแทนที่จะพังเงียบ ๆ */
export const isGeminiConfigured = GEMINI_API_KEY.length > 20;
