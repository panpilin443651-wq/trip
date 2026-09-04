/**
 * ตรวจว่าคอมโพเนนต์ที่เรียก useTrip() อยู่ภายใน <TripProvider> จริง
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-provider-scope.mts
 *
 * เขียนเพราะเคยพลาดมาแล้ว — ย้ายตัวสลับแผนเข้าไปไว้ในแถบข้าง ซึ่งตอนนั้น
 * ถูกเรนเดอร์อยู่นอก provider ผลคือ useTrip() โยน error แล้วทั้งเว็บจอขาว
 * เข้าไม่ได้เลย ทั้ง tsc, eslint และ npm run build ผ่านหมดเพราะเป็น error
 * ตอนรัน ไม่ใช่ตอนแปลโค้ด และหน้าในกลุ่ม (app) ต้องล็อกอินจึงไม่ถูก prerender
 */
import fs from "node:fs";
import path from "node:path";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const SRC = "src";

/** ไล่หาไฟล์ .tsx/.ts ทั้งหมดใต้ src */
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = walk(SRC);
const read = (f: string) => fs.readFileSync(f, "utf8");

/** ชื่อคอมโพเนนต์ที่ export จากไฟล์ที่เรียก useTrip() โดยตรง */
const usesTrip = new Set<string>();
for (const file of files) {
  const text = read(file);
  if (!/\buseTrip\s*\(/.test(text)) continue;
  for (const m of text.matchAll(/export function (\w+)/g)) usesTrip.add(m[1]);
}

console.log("คอมโพเนนต์ที่เรียก useTrip() โดยตรง");
check("หาเจออย่างน้อย 5 ตัว", usesTrip.size >= 5, `เจอ ${usesTrip.size}`);
console.log("  " + [...usesTrip].sort().join(", "));

/*
 * ตรวจ layout ของกลุ่ม (app) — ทุกอย่างที่เรนเดอร์ในนั้นต้องอยู่ใต้ TripProvider
 * เทียบด้วยตำแหน่งของแท็กเปิด/ปิดในไฟล์ ซึ่งพอสำหรับ layout ที่เป็น JSX ตรง ๆ
 */
const layoutPath = "src/app/(app)/layout.tsx";
const layout = read(layoutPath);

const open = layout.indexOf("<TripProvider");
const close = layout.indexOf("</TripProvider>");

console.log("\nlayout ของกลุ่ม (app)");
check("มี <TripProvider>", open >= 0 && close > open);

/** แท็กที่เรนเดอร์ใน layout และต้องอยู่ใต้ provider */
const mustBeInside = [
  "<SideNav",
  "<BottomNav",
  "<TopBar",
  "<BudgetAlert",
  "<ChatWidget",
  "<SyncStatus",
  "{children}",
];

for (const tag of mustBeInside) {
  const at = layout.indexOf(tag);
  check(
    `${tag} อยู่ใต้ TripProvider`,
    at > open && at < close,
    at < 0 ? "ไม่พบแท็กนี้ใน layout" : `ตำแหน่ง ${at} · provider ${open}-${close}`,
  );
}

/*
 * ไล่ต่ออีกชั้น — คอมโพเนนต์ที่ layout เรนเดอร์ อาจไปเรียกตัวที่ใช้ useTrip อีกที
 * เช่น SideNav เรนเดอร์ TripSwitcher ซึ่งเป็นตัวที่พังจริงในรอบก่อน
 */
console.log("\nคอมโพเนนต์ที่แถบเมนูเรนเดอร์ต่ออีกชั้น");
const navText = read("src/components/AppNav.tsx");
// เทียบด้วย includes ไม่ใช้ regex เพราะ escape ในเทมเพลตพลาดง่ายและพลาดแบบเงียบ
// (เคยเขียนคลาสตัวอักษรแล้ว backslash หาย กลายเป็นเช็กไม่เจออะไรเลยแต่เทสต์ยังเขียว)
const nested = [...usesTrip].filter((name) => navText.includes(`<${name}`));
console.log(
  "  " + (nested.length ? nested.join(", ") : "(ไม่มี)"),
);
check(
  "ตัวที่แถบเมนูเรนเดอร์ต่อ ก็ยังอยู่ใต้ provider เพราะแถบเมนูอยู่ใต้ provider",
  layout.indexOf("<SideNav") > open && layout.indexOf("<SideNav") < close,
);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
