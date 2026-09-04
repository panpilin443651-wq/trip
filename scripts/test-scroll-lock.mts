import fs from "node:fs";
/**
 * ทดสอบการล็อกการเลื่อนหน้าเวลามีกล่องซ้อนกัน
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-scroll-lock.mts
 *
 * บั๊กเดิม: แต่ละกล่องจำค่า overflow ตอนตัวเองเปิด พอปิดสลับลำดับกัน
 * ค่าจะค้างเป็น hidden ทั้งหน้าเลื่อนไม่ได้จนกว่าจะรีเฟรช
 * เกิดจริงเมื่อป๊อปอัปเตือนเกินงบเด้งทับกล่องที่เปิดอยู่ก่อน
 */
let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

/** จำลอง document.body.style.overflow */
let bodyOverflow = "";

/* ── วิธีเดิม: ต่างคนต่างจำค่าของตัวเอง ───────────────────────── */
function oldLock() {
  const previous = bodyOverflow;
  bodyOverflow = "hidden";
  return () => {
    bodyOverflow = previous;
  };
}

/* ── วิธีใหม่: นับจำนวนผู้ถือ ────────────────────────────────── */
let lockCount = 0;
let savedOverflow = "";
function newLock() {
  if (lockCount === 0) {
    savedOverflow = bodyOverflow;
    bodyOverflow = "hidden";
  }
  lockCount += 1;
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) bodyOverflow = savedOverflow;
  };
}

console.log("ยืนยันว่าบั๊กเดิมมีจริง");
bodyOverflow = "";
{
  const closeA = oldLock(); // กล่อง ก เปิด
  const closeB = oldLock(); // กล่อง ข เด้งทับ
  closeA(); // ก ปิดก่อน
  closeB(); // ข ปิดตาม
  check("วิธีเดิมทำให้ค้างเป็น hidden", bodyOverflow === "hidden", bodyOverflow);
}

console.log("\nวิธีใหม่ — เปิดปิดตามลำดับปกติ");
bodyOverflow = "";
lockCount = 0;
{
  const close = newLock();
  check("เปิดแล้วล็อก", bodyOverflow === "hidden");
  close();
  check("ปิดแล้วคืนค่า", bodyOverflow === "", bodyOverflow);
}

console.log("\nวิธีใหม่ — ซ้อนกันแล้วปิดสลับลำดับ (เคสที่พัง)");
bodyOverflow = "";
lockCount = 0;
{
  const closeA = newLock();
  const closeB = newLock();
  closeA();
  check("ปิดตัวแรกแล้วยังล็อกอยู่ เพราะอีกตัวยังเปิด", bodyOverflow === "hidden");
  closeB();
  check("ปิดครบแล้วเลื่อนได้", bodyOverflow === "", bodyOverflow);
}

console.log("\nวิธีใหม่ — ซ้อนสามชั้น");
bodyOverflow = "";
lockCount = 0;
{
  const closes = [newLock(), newLock(), newLock()];
  closes[1]();
  closes[0]();
  check("เหลือตัวเดียวยังล็อก", bodyOverflow === "hidden");
  closes[2]();
  check("ปิดครบแล้วเลื่อนได้", bodyOverflow === "", bodyOverflow);
}

console.log("\nวิธีใหม่ — เผลอปิดซ้ำ ต้องไม่ทำให้ตัวนับติดลบ");
bodyOverflow = "";
lockCount = 0;
{
  const close = newLock();
  close();
  close();
  check("ตัวนับไม่ติดลบ", lockCount === 0, String(lockCount));
  const again = newLock();
  check("เปิดใหม่ยังล็อกได้ปกติ", bodyOverflow === "hidden");
  again();
  check("ปิดแล้วคืนค่าได้ปกติ", bodyOverflow === "", bodyOverflow);
}

console.log("\nวิธีใหม่ — หน้าที่ล็อกไว้ก่อนอยู่แล้ว ต้องคืนค่าเดิมไม่ใช่ค่าว่าง");
bodyOverflow = "hidden";
lockCount = 0;
{
  const close = newLock();
  close();
  check("คืนเป็น hidden ตามเดิม", bodyOverflow === "hidden", bodyOverflow);
}

console.log("\nตาข่ายกันพลาด — ปลดล็อกทั้งหมดตอนเปลี่ยนหน้า");

/** เลียนแบบ releaseAllScrollLocks */
function releaseAll() {
  if (lockCount === 0) return;
  lockCount = 0;
  bodyOverflow = savedOverflow;
}

bodyOverflow = "";
lockCount = 0;
{
  newLock();
  newLock();
  releaseAll();
  check("ล็อกค้างอยู่สองชั้นก็เคลียร์หมด", bodyOverflow === "" && lockCount === 0);
  const close = newLock();
  check("หลังเคลียร์แล้วยังล็อกใหม่ได้", bodyOverflow === "hidden");
  close();
  check("ปิดแล้วคืนค่าได้ปกติ", bodyOverflow === "", bodyOverflow);
}

bodyOverflow = "";
lockCount = 0;
{
  releaseAll();
  check("เรียกตอนไม่มีล็อกอยู่ ไม่ทำอะไรเสียหาย", bodyOverflow === "" && lockCount === 0);
}

console.log("\nกล่องโมดัลต้องยิงไปวางที่ body");

/*
 * ตัวที่มี backdrop-filter จะกลายเป็นกรอบอ้างอิงของลูกที่เป็น position: fixed
 * ตามสเปก แถบบนกับแถบเมนูล่างใช้ backdrop-blur อยู่ทั้งคู่ กล่องที่ถูกเรียก
 * จากในนั้นจึงไปยึดกับแถบแทนที่จะเต็มจอ ถ้าไม่ยิงออกไปที่ body
 *
 * เคยพังจริง — กดโปรไฟล์แล้วเนื้อหาล้นออกนอกจอ กดทริปของฉันแล้วไปทับการ์ด
 */
const overlay = fs.readFileSync("src/components/ui/overlay.tsx", "utf8");
check("Sheet ใช้ createPortal", overlay.includes("createPortal("));
check("ยิงไปที่ document.body", overlay.includes("document.body"));
check(
  "กันกรณีไม่มี document (ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์)",
  overlay.includes('typeof document === "undefined"'),
);

// ยืนยันว่าเหตุที่ต้องใช้ portal ยังอยู่จริง ไม่ใช่กันไว้เปล่า ๆ
const topBar = fs.readFileSync("src/components/TopBar.tsx", "utf8");
const appNav = fs.readFileSync("src/components/AppNav.tsx", "utf8");
check(
  "แถบบนหรือแถบเมนูล่างยังใช้ backdrop-blur อยู่",
  topBar.includes("backdrop-blur") || appNav.includes("backdrop-blur"),
);
check(
  "แถบบนยังเรียกกล่องที่ใช้ Sheet อยู่",
  topBar.includes("ProfileMenu") || topBar.includes("TripSwitcher"),
);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
