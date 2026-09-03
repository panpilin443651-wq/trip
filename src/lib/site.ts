/**
 * ที่อยู่ของเว็บ ใช้ทำลิงก์แบบเต็มใน Open Graph
 *
 * แอปแชตอย่าง LINE ต้องการ og:image เป็น URL เต็ม ถ้าเป็นพาธสั้น ๆ
 * จะดึงรูปไม่ได้และการ์ดพรีวิวจะไม่ขึ้น Next สร้าง URL เต็มให้เองจาก metadataBase
 *
 * บน Vercel มี VERCEL_PROJECT_PRODUCTION_URL ให้อยู่แล้ว ไม่ต้องตั้งเพิ่ม
 * (ใช้ตัวนี้ ไม่ใช่ VERCEL_URL ซึ่งเปลี่ยนทุก deployment จนแคชพรีวิวเพี้ยน)
 * ถ้าใช้โดเมนของตัวเองให้ตั้ง NEXT_PUBLIC_SITE_URL ทับ
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
