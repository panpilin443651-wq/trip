/**
 * ทดสอบตรรกะของโฟลว์แนะนำเที่ยว — ค้นหา กรองอำเภอ และสร้างโปรแกรมเที่ยว
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-explore-flow.mts
 *
 * สำคัญเพราะการสร้างโปรแกรมเขียนกิจกรรมหลายรายการรวดเดียว ถ้าเวลาซ้อนกัน
 * หรือเรียงผิด ผู้ใช้ต้องมานั่งแก้ทีละอันซึ่งเสียเวลากว่ากรอกเองตั้งแต่แรก
 */
import { PROVINCES } from "@/data/provinces";
import { districtsOf } from "@/data/districts";
import { addMinutesToTime, timeToMinutes } from "@/lib/format";
import type { SuggestedPlace } from "@/data/provinces";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const pbi = PROVINCES.find((p) => p.name === "เพชรบุรี")!;

console.log("ข้อมูลพื้นที่ทดลอง — อำเภอบ้านแหลม");
const banLaem = pbi.places.filter((p) => p.district === "บ้านแหลม");
check("มีสถานที่ในบ้านแหลม 7 แห่ง", banLaem.length === 7, String(banLaem.length));
check("บ้านแหลมเป็นอำเภอจริงของเพชรบุรี", districtsOf("เพชรบุรี").includes("บ้านแหลม"));
check("ทุกแห่งมีพิกัด", banLaem.every((p) => p.lat !== 0 && p.lng !== 0));
check(
  "พิกัดอยู่ในกรอบอำเภอ",
  banLaem.every((p) => p.lat > 13.0 && p.lat < 13.31 && p.lng > 99.9 && p.lng < 100.12),
);
check("ไม่มี id ซ้ำกับที่อื่นในจังหวัด", new Set(pbi.places.map((p) => p.id)).size === pbi.places.length);
check("ติดดาวไว้ 3 แห่ง ไม่ใช่ทั้งหมด", banLaem.filter((p) => p.featured).length === 3);

/** กรองแบบเดียวกับหน้าแนะนำเที่ยว */
function filterPlaces(all: SuggestedPlace[], district: string, query: string) {
  const byDistrict = district ? all.filter((p) => p.district === district) : all;
  const q = query.trim().toLowerCase();
  const matched = q
    ? byDistrict.filter((p) =>
        [p.name, p.tag, p.description].some((f) => f.toLowerCase().includes(q)),
      )
    : byDistrict;
  return [...matched].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
}

console.log("\nขั้นที่ 1-2 — ค้นหาและกรองอำเภอ");
check("กรองอำเภอได้", filterPlaces(pbi.places, "บ้านแหลม", "").length === 7);
check('ค้น "ดูนก" เจอปากทะเล', filterPlaces(pbi.places, "บ้านแหลม", "ดูนก")[0]?.name === "ปากทะเล");
check('ค้น "นาเกลือ" เจอ', filterPlaces(pbi.places, "บ้านแหลม", "นาเกลือ").length > 0);
check('ค้น "วัด" เจอ 2 แห่ง', filterPlaces(pbi.places, "บ้านแหลม", "วัด").length === 2);
check("ค้นคำที่ไม่มี ได้ลิสต์ว่าง", filterPlaces(pbi.places, "บ้านแหลม", "สกีรีสอร์ต").length === 0);
const sorted = filterPlaces(pbi.places, "บ้านแหลม", "");
check("ที่ติดดาวถูกดันขึ้นบนสุด", sorted.slice(0, 3).every((p) => p.featured));
check("ค้นข้ามอำเภอได้ด้วยการไม่ระบุอำเภอ", filterPlaces(pbi.places, "", "ชายหาด").length >= 2);

/** สร้างโปรแกรมแบบเดียวกับ buildProgram */
function buildProgram(chosen: SuggestedPlace[], start: string) {
  let t = start;
  return chosen.map((place) => {
    const row = { name: place.name, startTime: t, durationMin: place.durationMin };
    t = addMinutesToTime(t, place.durationMin + 30);
    return row;
  });
}

console.log("\nขั้นที่ 5 — สร้างโปรแกรมเที่ยว");
const program = buildProgram(sorted.slice(0, 4), "09:00");
check("ได้ครบ 4 จุด", program.length === 4);
check("จุดแรกเริ่ม 09:00", program[0].startTime === "09:00");
const overlaps = program.filter((row, i) => {
  const next = program[i + 1];
  if (!next) return false;
  return timeToMinutes(next.startTime) < timeToMinutes(row.startTime) + row.durationMin;
});
check("ไม่มีเวลาซ้อนทับกัน", overlaps.length === 0, overlaps.map((o) => o.name).join(", "));
const gaps = program.slice(1).map((row, i) =>
  timeToMinutes(row.startTime) - timeToMinutes(program[i].startTime) - program[i].durationMin,
);
check("เผื่อเวลาเดินทางจุดละ 30 นาที", gaps.every((g) => g === 30), gaps.join(","));
check("เวลาเรียงจากน้อยไปมาก",
  program.every((r, i) => i === 0 || timeToMinutes(r.startTime) > timeToMinutes(program[i - 1].startTime)));
check("โปรแกรมว่างไม่พัง", buildProgram([], "09:00").length === 0);


/* ── ข้อมูล OSM ที่เติมอำเภอแล้ว ─────────────────────────────────── */
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";

console.log("\nชุดข้อมูล OpenStreetMap หลังเติมอำเภอ");
const allPlaces = Object.entries(OSM_PLACES);
const allFood = Object.entries(OSM_RESTAURANTS);
const flatPlaces = allPlaces.flatMap(([, v]) => v);
const flatFood = allFood.flatMap(([, v]) => v);

check(
  "ที่เที่ยวมีอำเภอเกิน 98%",
  flatPlaces.filter((p) => p.district).length / flatPlaces.length > 0.98,
);
check(
  "ร้านอาหารมีอำเภอเกิน 98%",
  flatFood.filter((r) => r.district).length / flatFood.length > 0.98,
);

/** อำเภอที่เติมมาต้องอยู่ในทะเบียนของจังหวัดนั้นเสมอ ไม่งั้นหน้าเว็บกรองไม่เจอ */
let mismatched = 0;
for (const [prov, list] of [...allPlaces, ...allFood]) {
  const valid = new Set(districtsOf(prov));
  for (const row of list) if (row.district && !valid.has(row.district)) mismatched += 1;
}
check("อำเภอทุกตัวตรงกับทะเบียนของจังหวัดนั้น", mismatched === 0, String(mismatched));

check("มีวัดในชุดข้อมูล", flatPlaces.filter((p) => p.kind === "วัด").length > 200);
check("มีคาเฟ่ในชุดข้อมูล", flatFood.filter((r) => r.kind === "คาเฟ่").length > 200);
check("มีร้านอาหารในชุดข้อมูล", flatFood.filter((r) => r.kind === "ร้านอาหาร").length > 200);

console.log("\nจังหวัดที่แก้ให้ถูกแล้ว (เคยถูกจัดผิดจังหวัด)");
const ayutthaya = (OSM_PLACES["พระนครศรีอยุธยา"] ?? []).map((p) => p.name);
check("พระราชวังบางปะอินอยู่อยุธยา", ayutthaya.includes("พระราชวังบางปะอิน"));
check(
  "ไม่เหลืออยู่ปทุมธานี",
  !(OSM_PLACES["ปทุมธานี"] ?? []).some((p) => p.name === "พระราชวังบางปะอิน"),
);
const huahin = (OSM_RESTAURANTS["ประจวบคีรีขันธ์"] ?? []).filter(
  (r) => r.district === "หัวหิน",
);
check("ร้านหัวหินย้ายมาประจวบฯ แล้ว", huahin.length > 0, String(huahin.length));

console.log(`\nรวมทั้งไฟล์: ผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
