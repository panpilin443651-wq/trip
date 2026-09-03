/**
 * ข้อมูลว่าเว็บที่กำลังรันอยู่มาจากโค้ดชุดไหน
 *
 * มีไว้ตอบคำถาม "แก้แล้วทำไมยังไม่เห็น" ให้จบในครั้งเดียว — เทียบเลขที่โชว์
 * กับ commit ล่าสุดบน GitHub ถ้าไม่ตรงแปลว่ายังไม่ได้ deploy ไม่ใช่โค้ดผิด
 *
 * ต้องอ่านฝั่งเซิร์ฟเวอร์เท่านั้น Next แทนค่าตัวแปรให้ตอน build เฉพาะตัวที่
 * ขึ้นต้นด้วย NEXT_PUBLIC_ ถ้า import เข้า client component จะได้ค่าว่าง
 */

/** Vercel ใส่ตัวแปรนี้ให้เองตอน build ไม่ต้องไปตั้งเพิ่ม */
export const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";

/** เวลาที่ build ก้อนนี้ — รันในเครื่องจะเป็นเวลาที่เปิดเซิร์ฟเวอร์ */
export const BUILD_TIME = new Date().toISOString();

/** true เมื่อรันในเครื่อง ไม่ได้มาจากการ deploy */
export const IS_LOCAL_BUILD = BUILD_SHA === "dev";
