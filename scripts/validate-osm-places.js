/**
 * ตรวจข้อมูล src/data/osm-places.ts ที่สร้างจาก OpenStreetMap
 *
 * ใช้: node scripts/validate-osm-places.js
 * ออกด้วยรหัส 1 ถ้ามีข้อผิดพลาดที่ต้องแก้
 */
const fs = require("fs");
const path = require("path");

const DIR = "src/data/provinces";

function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

const source = fs.readFileSync("src/data/osm-places.ts", "utf8");
const OSM = JSON.parse(source.match(/= (\{[\s\S]*\});/)[1]);

const provinces = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
  .flatMap((f) => loadProvinceFile(f));

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const all = Object.values(OSM).flat();
const counts = Object.values(OSM).map((l) => l.length);

console.log(
  `ข้อมูล ${all.length} แห่ง ใน ${Object.keys(OSM).length} จังหวัด ` +
    `(เฉลี่ย ${(all.length / Object.keys(OSM).length).toFixed(1)} ต่อจังหวัด)\n`,
);

// 1. ครบทุกจังหวัด
const missing = provinces.map((p) => p.name).filter((n) => !OSM[n]?.length);
check("ทุกจังหวัดมีอย่างน้อย 1 แห่ง", missing.length === 0, missing.join(", "));

// 2. ชื่อจังหวัดต้องตรงกับที่ใช้ในแอป ไม่งั้น /api/places จะหาไม่เจอ
const known = new Set(provinces.map((p) => p.name));
const unknown = Object.keys(OSM).filter((n) => !known.has(n));
check("ชื่อจังหวัดตรงกับข้อมูลหลัก", unknown.length === 0, unknown.join(", "));

// 3. ชื่อสถานที่ต้องใช้ได้
check(
  "ทุกแห่งมีชื่อ",
  all.every((p) => typeof p.name === "string" && p.name.trim().length >= 4),
);
check(
  "ทุกแห่งมีประเภทและ emoji",
  all.every((p) => p.kind && p.emoji),
);

// 4. ไม่มีชื่อซ้ำในจังหวัดเดียวกัน
const dupes = [];
for (const [province, list] of Object.entries(OSM)) {
  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.name)) dupes.push(`${province}: ${p.name}`);
    seen.add(p.name);
  }
}
check("ไม่มีชื่อซ้ำในจังหวัดเดียวกัน", dupes.length === 0, dupes.slice(0, 5).join(" · "));

// 5. พิกัดต้องอยู่ในกรอบประเทศไทย
const outside = all.filter(
  (p) => p.lat < 5.5 || p.lat > 20.6 || p.lng < 97.3 || p.lng > 105.7,
);
check("พิกัดอยู่ในกรอบประเทศไทย", outside.length === 0, `${outside.length} จุด`);

// 6. ต้องไม่ซ้ำกับสถานที่ที่คัดไว้เอง ไม่งั้นรายการจะโชว์ที่เดียวกันสองบรรทัด
const curatedNames = new Set(
  provinces.flatMap((p) => p.places.map((pl) => `${p.name}|${pl.name}`)),
);
const overlap = Object.entries(OSM).flatMap(([province, list]) =>
  list.filter((p) => curatedNames.has(`${province}|${p.name}`)).map((p) => p.name),
);
check("ไม่ซ้ำกับสถานที่ที่คัดไว้เอง", overlap.length === 0, overlap.slice(0, 5).join(" · "));

// 7. หัวรายการต้องมีหลายประเภท ไม่ใช่ประเภทเดียวเรียงกันยาว
const monotone = Object.entries(OSM)
  .filter(([, list]) => list.length >= 6)
  .filter(([, list]) => new Set(list.slice(0, 6).map((p) => p.kind)).size < 3)
  .map(([n]) => n);
check(
  "6 แถวแรกของแต่ละจังหวัดมีอย่างน้อย 3 ประเภท",
  monotone.length === 0,
  monotone.slice(0, 5).join(", "),
);

// รายงานเฉย ๆ ไม่ถือว่าผิด — OSM บางจังหวัดยังมีคนกรอกน้อยจริง ๆ
const thin = Object.entries(OSM)
  .filter(([, l]) => l.length < 10)
  .map(([n, l]) => `${n} (${l.length})`);
if (thin.length) console.log(`\nℹ️  จังหวัดที่ได้น้อยกว่า 10 แห่ง: ${thin.join(", ")}`);
console.log(
  `ℹ️  มีหน้า Wikipedia/Wikidata ${all.filter((p) => p.notable).length} แห่ง ` +
    `· มากสุด ${Math.max(...counts)} แห่งต่อจังหวัด`,
);

console.log(failures === 0 ? "\nผ่านทั้งหมด" : `\nไม่ผ่าน ${failures} ข้อ`);
process.exit(failures === 0 ? 0 : 1);
