/**
 * ตรวจข้อมูลโรงแรม/รีสอร์ตที่สร้างไว้
 *
 * ใช้: node scripts/validate-hotels.js
 *
 * ตรวจแบบเดียวกับ validate-restaurants.js เพราะข้อมูลชุดนี้สร้างด้วยวิธีเดียวกัน
 * และพลาดได้แบบเดียวกัน
 */
const fs = require("fs");

const FILE = "src/data/osm-hotels.ts";
const text = fs.readFileSync(FILE, "utf8");
const marker = "export const OSM_HOTELS: Record<string, OsmHotel[]> = ";
const data = JSON.parse(text.slice(text.indexOf(marker) + marker.length).replace(/;\s*$/, ""));

const districtsText = fs.readFileSync("src/data/districts.ts", "utf8");
const dMarker = "export const DISTRICTS: Record<string, string[]> = ";
const dBody = districtsText.slice(districtsText.indexOf(dMarker) + dMarker.length);
const DISTRICTS = JSON.parse(`${dBody.slice(0, dBody.indexOf("\n};"))}\n}`);

const rows = Object.entries(data).flatMap(([province, list]) =>
  list.map((h) => ({ ...h, province })),
);

let failed = 0;
const check = (label, bad, sample = (x) => x.name) => {
  if (bad.length === 0) {
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label} — ${bad.length} รายการ: ${bad.slice(0, 3).map(sample).join(" · ")}`);
  }
};

check("ทุกแห่งมีชื่อและไอดี", rows.filter((h) => !h.name || !h.id));
check("ทุกแห่งมีประเภทและ emoji", rows.filter((h) => !h.kind || !h.emoji));
check(
  "ประเภทเป็นโรงแรมหรือรีสอร์ตเท่านั้น",
  rows.filter((h) => h.kind !== "โรงแรม" && h.kind !== "รีสอร์ต"),
);
check("จำนวนดาวอยู่ในช่วง 0-5", rows.filter((h) => !(h.stars >= 0 && h.stars <= 5)));
check(
  "พิกัดอยู่ในกรอบประเทศไทย",
  rows.filter((h) => h.lat < 5.5 || h.lat > 20.5 || h.lng < 97.3 || h.lng > 105.7),
);
check(
  "อำเภอตรงกับทะเบียนของจังหวัดนั้น",
  rows.filter((h) => h.district && !(DISTRICTS[h.province] ?? []).includes(h.district)),
  (h) => `${h.province}/${h.district}`,
);

const dupes = [];
for (const [province, list] of Object.entries(data)) {
  const seen = new Set();
  for (const h of list) {
    if (seen.has(h.name)) dupes.push({ name: `${province}: ${h.name}` });
    seen.add(h.name);
  }
}
check("ไม่มีชื่อซ้ำในจังหวัดเดียวกัน", dupes);

const noDistrict = rows.filter((h) => !h.district).length;
const notable = rows.filter((h) => h.notable).length;
const withStars = rows.filter((h) => h.stars > 0).length;
console.log(
  `\nℹ️  ${rows.length} แห่ง ใน ${Object.keys(data).length} จังหวัด · ` +
    `ระบุอำเภอแล้ว ${rows.length - noDistrict} · มีดาว ${withStars} · มีหน้า Wikipedia ${notable}`,
);

console.log(failed === 0 ? "\n✓ ไม่พบปัญหา" : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
