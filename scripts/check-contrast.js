/**
 * ตรวจ contrast ของชุดสีในธีม ตามเกณฑ์ WCAG 2.1
 *
 * ใช้: node scripts/check-contrast.js
 *
 * อ่านค่าจริงจาก src/app/globals.css ไม่ได้ก๊อปค่ามาไว้ในนี้ จะได้จับได้เวลาพิมพ์ผิด
 * ตรวจทั้งโหมดเข้ม (@theme) และโหมดพิมพ์ (@media print) เพราะทั้งสองชุดต้องอ่านออก
 *
 * คู่สีที่ตรวจคือคู่ที่ใช้จริงในเว็บเท่านั้น ไม่ได้ไล่ทุกคู่ที่เป็นไปได้
 * เพิ่มคู่ใหม่ที่นี่เมื่อมีการจับคู่สีแบบใหม่ในหน้าจอ
 */
const fs = require("fs");

const CSS = "src/app/globals.css";

/** เกณฑ์ WCAG: ตัวอักษรปกติ 4.5:1 — องค์ประกอบที่ไม่ใช่ตัวอักษร 3:1 */
const TEXT = 4.5;
const UI = 3;

/**
 * คู่สีที่ใช้จริง — [คำอธิบาย, สีหน้า, สีพื้น, เกณฑ์]
 *
 * ชื่อโทเคนตรงกับที่ประกาศใน globals.css (ตัด --color- ออก)
 */
const PAIRS = [
  ["ตัวอักษรหลักบนพื้นหน้า", "ink", "canvas", TEXT],
  ["ตัวอักษรหลักบนการ์ด", "ink", "card", TEXT],
  ["ตัวอักษรรองบนพื้นหน้า", "muted", "canvas", TEXT],
  ["ตัวอักษรรองบนการ์ด", "muted", "card", TEXT],
  ["ตัวอักษรจางบนพื้นหน้า", "faint", "canvas", TEXT],
  ["ตัวอักษรจางบนการ์ด", "faint", "card", TEXT],
  ["ลิงก์/ไอคอน brand บนพื้นหน้า", "brand", "canvas", TEXT],
  ["ลิงก์/ไอคอน brand บนการ์ด", "brand", "card", TEXT],
  ["ตัวอักษรบนปุ่มหลัก", "canvas", "brand", TEXT],
  ["ตัวอักษรบนปุ่มหลักตอน hover", "canvas", "brand-dark", TEXT],
  ["ตัวอักษรบนพื้น brand อ่อน", "ink", "brand-soft", TEXT],
  ["เมนู active (ตัวอักษรบนพื้นอ่อน)", "brand", "brand-soft", TEXT],
  ["ตัวอักษรเน้นบนพื้นหน้า", "accent", "canvas", TEXT],
  ["ตัวอักษรเน้นบนการ์ด", "accent", "card", TEXT],
  ["ป้ายเน้น (ตัวอักษรบนพื้นอ่อน)", "accent", "accent-soft", TEXT],
  ["ตัวเลขในวงกลมลำดับ", "canvas", "accent-fill", TEXT],
  ["สถานะสำเร็จบนพื้นหน้า", "ok", "canvas", TEXT],
  ["สถานะสำเร็จบนการ์ด", "ok", "card", TEXT],
  ["ป้ายสถานะสำเร็จ", "ok", "ok-soft", TEXT],
  ["สถานะเตือนบนพื้นหน้า", "warn", "canvas", TEXT],
  ["สถานะเตือนบนการ์ด", "warn", "card", TEXT],
  ["ป้ายสถานะเตือน", "warn", "warn-soft", TEXT],
  ["สถานะผิดพลาดบนพื้นหน้า", "danger", "canvas", TEXT],
  ["สถานะผิดพลาดบนการ์ด", "danger", "card", TEXT],
  ["ป้ายสถานะผิดพลาด", "danger", "danger-soft", TEXT],
  ["ตัวอักษรบนปุ่มลบ", "canvas", "danger", TEXT],
];

/**
 * ดึงค่าโทเคนออกจาก CSS
 *
 * โหมดสว่างกับโหมดพิมพ์ประกาศทับเฉพาะบางตัว ตัวที่ไม่ได้ประกาศให้ตกทอดมาจาก
 * โหมดเข้ม เหมือนที่เบราว์เซอร์ทำ
 */
function readTokens(css) {
  const grab = (block) => {
    const found = {};
    for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g))
      found[m[1]] = m[2].toLowerCase();
    return found;
  };

  const lightStart = css.indexOf(':root[data-theme="light"]');
  const printStart = css.indexOf("@media print");
  if (lightStart < 0 || printStart < 0)
    throw new Error("หาบล็อกโหมดสว่างหรือโหมดพิมพ์ใน globals.css ไม่เจอ");

  const dark = grab(css.slice(css.indexOf("@theme"), lightStart));
  const light = { ...dark, ...grab(css.slice(lightStart, printStart)) };
  const print = { ...dark, ...grab(css.slice(printStart)) };
  return { dark, light, print };
}

const luminance = (hex) => {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function check(label, tokens) {
  console.log(`\n${label}`);
  let failed = 0;
  for (const [name, fg, bg, min] of PAIRS) {
    const a = tokens[fg];
    const b = tokens[bg];
    if (!a || !b) {
      console.log(`  ✗ ${name} — ไม่มีโทเคน ${a ? bg : fg}`);
      failed += 1;
      continue;
    }
    const value = ratio(a, b);
    const pass = value >= min;
    if (!pass) failed += 1;
    console.log(
      `  ${pass ? "✓" : "✗"} ${name.padEnd(32)} ${value.toFixed(2).padStart(5)}:1` +
        `  (ต้องได้ ${min}) ${fg} บน ${bg}`,
    );
  }
  return failed;
}

const themes = readTokens(fs.readFileSync(CSS, "utf8"));
const failed =
  check("โหมดมืด (หน้าจอ)", themes.dark) +
  check("โหมดสว่าง (หน้าจอ)", themes.light) +
  check("โหมดพิมพ์ PDF", themes.print);

console.log(
  `\n${failed === 0 ? "ผ่านทั้งหมด" : `ไม่ผ่าน ${failed} คู่`} ` +
    `จาก ${PAIRS.length * 3} คู่`,
);
process.exit(failed === 0 ? 0 : 1);
