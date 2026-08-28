/**
 * ค่าเชื่อมต่อ Supabase
 *
 * anon key ออกแบบมาให้เปิดเผยในฝั่งเบราว์เซอร์ได้ ความปลอดภัยจริง
 * อยู่ที่ Row Level Security ในฐานข้อมูล ไม่ใช่การซ่อนคีย์
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** ยังไม่ได้ตั้ง env — ใช้แสดงหน้าบอกวิธีตั้งค่าแทนที่จะพังเงียบ ๆ */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
