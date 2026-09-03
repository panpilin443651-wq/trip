/**
 * ตรวจ src/data/osm-restaurants.ts ว่าใช้ได้จริง
 *
 * ใช้: node scripts/validate-restaurants.js
 *
 * ข้อมูลชุดนี้สร้างอัตโนมัติจาก OSM จึงต้องมีตัวตรวจ ไม่งั้นข้อผิดพลาด
 * แบบพิกัดหลุดประเทศหรือร้านเชนที่หลุดตัวกรองจะไปโผล่ให้ผู้ใช้เห็นเอง
 */
const fs = require("fs");

const FILE = "src/data/osm-restaurants.ts";

/** กรอบประเทศไทยแบบหลวม ๆ พอจับพิกัดที่หลุดออกนอกประเทศ */
const TH = { latMin: 5.5, latMax: 20.6, lngMin: 97.3, lngMax: 105.7 };

/** เชนที่ไม่ควรหลุดตัวกรองใน build-restaurants.js มาได้ */
const CHAIN =
  /(McDonald|KFC|Burger King|Pizza Hut|Subway|Starbucks|Amazon|Swensen|Sizzler|MK |Yayoi|Fuji|Dunkin|Krispy Kreme|Bonchon|Oishi|อินทนิล|เอ็มเค|ยาโยอิ)/i;

function load() {
  const src = fs.readFileSync(FILE, "utf8");
  const body = src.slice(src.indexOf("= {") + 2, src.lastIndexOf(";"));
  return JSON.parse(body);
}

const data = load();
const problems = [];
const ids = new Map();
let total = 0;
let cafes = 0;
let notable = 0;

for (const [province, list] of Object.entries(data)) {
  if (!Array.isArray(list)) {
    problems.push(`${province}: ไม่ใช่รายการ`);
    continue;
  }
  total += list.length;

  const names = new Set();
  for (const r of list) {
    if (!r.name || !String(r.name).trim()) {
      problems.push(`${province}: มีร้านที่ชื่อว่าง`);
    }
    if (names.has(r.name)) {
      problems.push(`${province}: ชื่อซ้ำ "${r.name}"`);
    }
    names.add(r.name);

    if (
      !(r.lat >= TH.latMin && r.lat <= TH.latMax) ||
      !(r.lng >= TH.lngMin && r.lng <= TH.lngMax)
    ) {
      problems.push(`${province}: "${r.name}" พิกัดนอกไทย ${r.lat},${r.lng}`);
    }
    if (r.kind !== "ร้านอาหาร" && r.kind !== "คาเฟ่") {
      problems.push(`${province}: "${r.name}" ประเภทแปลก "${r.kind}"`);
    }
    if (CHAIN.test(r.name)) {
      problems.push(`${province}: "${r.name}" เป็นร้านเชน ควรถูกกรองออก`);
    }

    ids.set(r.id, (ids.get(r.id) ?? 0) + 1);
    if (r.kind === "คาเฟ่") cafes += 1;
    if (r.notable) notable += 1;
  }
}

for (const [id, count] of ids) {
  if (count > 1) problems.push(`id ซ้ำ ${count} ครั้ง: ${id}`);
}

const provinces = Object.keys(data).length;
const thin = Object.entries(data)
  .filter(([, l]) => l.length < 5)
  .map(([n, l]) => `${n} (${l.length})`);

console.log(
  `${total} ร้าน ใน ${provinces} จังหวัด · คาเฟ่ ${cafes} · ` +
    `ร้านอาหาร ${total - cafes} · มีคนเขียนถึง ${notable}`,
);
if (thin.length) console.log(`ได้น้อยกว่า 5: ${thin.join(", ")}`);

if (problems.length === 0) {
  console.log("\n✓ ไม่พบปัญหา");
  process.exit(0);
}

console.log(`\n✗ พบ ${problems.length} ปัญหา`);
for (const p of problems.slice(0, 40)) console.log("  " + p);
process.exit(1);
