/**
 * ตรวจว่าสถานที่แนะนำแต่ละจุดอยู่ในจังหวัดของตัวเองจริงไหม
 *
 * ใช้ 2 ชั้น
 *   1. อำเภอที่เติมไว้ (จาก scripts/fill-districts.js) ต้องเป็นอำเภอของ
 *      จังหวัดนั้นจริง เทียบกับ src/data/districts.ts
 *   2. ระยะจากศูนย์กลางจังหวัด ไกลผิดปกติ = น่าสงสัย
 *   3. ชื่อหรือคำอธิบายเอ่ยถึงจังหวัดอื่นโดยไม่เอ่ยถึงจังหวัดตัวเอง
 *
 * ใช้: node scripts/validate-provinces.js
 */
const fs = require("fs");
const path = require("path");

const DIR = "src/data/provinces";

/** โหลดไฟล์ข้อมูลจังหวัดที่เป็น object literal ล้วน ๆ มาเป็นค่าจริง */
function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

const districtSource = fs.readFileSync("src/data/districts.ts", "utf8");
const DISTRICTS = JSON.parse(
  districtSource.slice(
    districtSource.indexOf("{"),
    districtSource.lastIndexOf("};") + 1,
  ),
);

const R = 6371;
function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts");

const provinces = files.flatMap((f) =>
  loadProvinceFile(f).map((p) => ({ ...p, file: f })),
);

const ALL_NAMES = provinces.map((p) => p.name);
/** ชื่อจังหวัดแบบสั้นที่ใช้เอ่ยถึงกันจริง ๆ ในคำบรรยาย */
const SHORT = {
  กรุงเทพมหานคร: ["กรุงเทพ", "บางกอก"],
  พระนครศรีอยุธยา: ["อยุธยา"],
  นครราชสีมา: ["โคราช"],
  สมุทรปราการ: ["ปากน้ำ"],
};

let districtIssues = 0;
let farIssues = 0;
let textIssues = 0;
let checked = 0;

const DIST_LIMIT = Number(process.env.LIMIT || 130);

console.log("=== 1. อำเภอไม่ตรงกับจังหวัด ===");
for (const province of provinces) {
  const valid = DISTRICTS[province.name] ?? [];
  for (const place of province.places) {
    checked += 1;
    if (!place.district) {
      districtIssues += 1;
      console.log(`  [ไม่มีอำเภอ] ${place.name} — ${province.name}`);
    } else if (valid.length > 0 && !valid.includes(place.district)) {
      districtIssues += 1;
      console.log(
        `  [ผิดจังหวัด] ${place.name} — ระบุไว้ใน ${province.name} แต่อำเภอ "${place.district}" ไม่ใช่ของจังหวัดนี้`,
      );
    }
  }
}
if (districtIssues === 0) console.log("  (ไม่พบ)");

console.log(`\n=== 2. ห่างศูนย์กลางจังหวัดเกิน ${DIST_LIMIT} กม. ===`);
for (const province of provinces) {
  for (const place of province.places) {
    const d = haversine(place, province.center);
    if (d > DIST_LIMIT) {
      farIssues += 1;
      console.log(
        `  ${place.name} — ${province.name} ห่าง ${d.toFixed(0)} กม. [${place.lat}, ${place.lng}]`,
      );
    }
  }
}
if (farIssues === 0) console.log("  (ไม่พบ)");

console.log("\n=== 3. ข้อความเอ่ยถึงจังหวัดอื่น ===");
for (const province of provinces) {
  const own = [province.name, ...(SHORT[province.name] ?? [])];
  for (const place of province.places) {
    const text = `${place.name} ${place.description} ${place.tip}`;
    if (own.some((n) => text.includes(n))) continue;
    const others = ALL_NAMES.filter(
      (n) => n !== province.name && text.includes(n),
    );
    if (others.length > 0) {
      textIssues += 1;
      console.log(
        `  ${place.name} — อยู่ใน ${province.name} แต่ข้อความพูดถึง ${others.join(", ")}`,
      );
    }
  }
}
if (textIssues === 0) console.log("  (ไม่พบ)");

console.log(
  `\nตรวจ ${checked} สถานที่ / ${provinces.length} จังหวัด — อำเภอผิด ${districtIssues} · ไกลผิดปกติ ${farIssues} · ข้อความน่าสงสัย ${textIssues}`,
);
