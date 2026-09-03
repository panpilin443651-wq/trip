/**
 * ทดสอบการคิดค่าน้ำมัน
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-fuel.mts
 */
import { estimateFuel, isDriving, VEHICLES, DEFAULT_KM_PER_LITRE, DEFAULT_FUEL_PRICE } from "@/lib/fuel";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, e = "") => c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

console.log("คิดค่าน้ำมัน");
// 300 กม. เก๋ง 15 กม./ลิตร ราคา 35 บาท ขาเดียว = 20 ลิตร = 700 บาท
let r = estimateFuel(300_000, 15, 35, false);
check("300 กม. → 20 ลิตร", Math.abs(r.litres - 20) < 1e-9, String(r.litres));
check("300 กม. → 700 บาท", Math.abs(r.cost - 700) < 1e-9, String(r.cost));
check("ระยะทางถูก", r.distanceKm === 300);

r = estimateFuel(300_000, 15, 35, true);
check("ไป-กลับ คูณสอง", r.distanceKm === 600 && Math.abs(r.cost - 1400) < 1e-9, `${r.distanceKm} / ${r.cost}`);

console.log("\nกันค่าพัง");
r = estimateFuel(300_000, 0, 35, false);
check("กม./ลิตร = 0 ใช้ค่าตั้งต้นแทน ไม่ได้ Infinity",
  Number.isFinite(r.cost) && Math.abs(r.litres - 300 / DEFAULT_KM_PER_LITRE) < 1e-9, String(r.cost));
r = estimateFuel(300_000, 15, 0, false);
check("ราคา = 0 ใช้ค่าตั้งต้นแทน", Math.abs(r.cost - 20 * DEFAULT_FUEL_PRICE) < 1e-9, String(r.cost));
r = estimateFuel(-500, 15, 35, false);
check("ระยะติดลบ → 0", r.distanceKm === 0 && r.cost === 0);
r = estimateFuel(300_000, -5, -5, false);
check("ค่าติดลบทั้งคู่ ยังคืนเลขบวก", r.cost > 0 && Number.isFinite(r.cost), String(r.cost));

console.log("\nรู้ว่าขับรถเองไหม");
check("car = ขับเอง", isDriving("car"));
check("motorcycle = ขับเอง", isDriving("motorcycle"));
check("van = ขับเอง", isDriving("van"));
check("plane ไม่ใช่", !isDriving("plane"));
check("train ไม่ใช่", !isDriving("train"));
check("undefined ไม่ใช่", !isDriving(undefined));
check("ค่าว่างไม่ใช่", !isDriving(""));

console.log("\nข้อมูลรถ");
check("ทุกคันมีอัตราสิ้นเปลืองเป็นบวก", VEHICLES.every(v => v.kmPerLitre > 0));
check("ไอดีไม่ซ้ำ", new Set(VEHICLES.map(v => v.id)).size === VEHICLES.length);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
