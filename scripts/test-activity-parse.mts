/**
 * ทดสอบการอ่านราคาและระยะเวลาของกิจกรรมแนะนำ
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-activity-parse.mts
 *
 * ข้อมูลกิจกรรมเขียนไว้ให้คนอ่าน ("ครึ่งวัน–เต็มวัน") แต่การใส่ลงแผนต้องการ
 * ตัวเลข ถ้าแปลงพลาดจะได้กิจกรรมที่กินเวลาทั้งวันหรือราคาผิดไปหลายเท่า
 * โดยที่ไม่มีอะไรฟ้อง
 */
import { PROVINCES } from "@/data/provinces";
import { parseDurationMin, parsePriceTHB } from "@/lib/activity-parse";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const eq = (label: string, got: number, want: number) =>
  check(`${label} = ${want}`, got === want, `(ได้ ${got})`);

console.log("\nระยะเวลาที่มีตัวเลข");
eq('"1 ชั่วโมง"', parseDurationMin("1 ชั่วโมง"), 60);
eq('"1–2 ชั่วโมง" เอากลางช่วง', parseDurationMin("1–2 ชั่วโมง"), 90);
eq('"2–3 ชั่วโมง"', parseDurationMin("2–3 ชั่วโมง"), 150);
eq('"6–8 ชั่วโมง"', parseDurationMin("6–8 ชั่วโมง"), 420);
eq('"30–60 นาที" อ่านหน่วยนาที', parseDurationMin("30–60 นาที"), 45);
eq('"1.5–2 ชั่วโมง" ทศนิยม', parseDurationMin("1.5–2 ชั่วโมง"), 105);
eq('"1–1.5 ชั่วโมง" ปัดเป็นช่วง 15 นาที', parseDurationMin("1–1.5 ชั่วโมง"), 75);

console.log("\nระยะเวลาที่เขียนเป็นคำ");
eq('"ครึ่งวัน"', parseDurationMin("ครึ่งวัน"), 240);
eq('"เต็มวัน"', parseDurationMin("เต็มวัน"), 480);
eq('"ครึ่งคืน"', parseDurationMin("ครึ่งคืน"), 240);
eq('"ครึ่งวัน–เต็มวัน" เอากลางช่วง', parseDurationMin("ครึ่งวัน–เต็มวัน"), 360);
eq('"ครึ่งวัน–ทั้งคืน"', parseDurationMin("ครึ่งวัน–ทั้งคืน"), 360);

console.log("\nระยะเวลา — ขอบและของเสีย");
eq("ข้อความว่างใช้ค่าตั้งต้น", parseDurationMin(""), 120);
eq("อ่านไม่ออกใช้ค่าตั้งต้น", parseDurationMin("แล้วแต่ใจ"), 120);
eq("ยาวเกินหนึ่งวันถูกตัดที่ 12 ชั่วโมง", parseDurationMin("3 วัน"), 720);
eq("สั้นมากยังได้อย่างน้อย 15 นาที", parseDurationMin("1 นาที"), 15);
// วงเล็บมักมีตัวเลขที่ไม่ใช่ระยะเวลาปนมา
eq("ไม่นับตัวเลขในวงเล็บ", parseDurationMin("2 ชั่วโมง (รอบ 14.00 น.)"), 120);

console.log("\nราคา");
eq('"150–400 บาท/คน" เอากลางช่วง', parsePriceTHB("150–400 บาท/คน"), 280);
eq('"400–600 บาท/ลำ"', parsePriceTHB("400–600 บาท/ลำ"), 500);
eq('"800–1,500 บาท/คน" มีเครื่องหมายคั่นหลักพัน', parsePriceTHB("800–1,500 บาท/คน"), 1150);
eq('"ฟรี" เป็นศูนย์', parsePriceTHB("ฟรี"), 0);
eq('"ฟรี–100 บาท" นับฟรีเป็นขอบล่าง', parsePriceTHB("ฟรี–100 บาท (ค่าเข้าบางหลัง)"), 50);
eq('"ฟรี–4,000 บาท (แล้วแต่งาน)"', parsePriceTHB("ฟรี–4,000 บาท (แล้วแต่งาน)"), 2000);
eq("ไม่มีตัวเลขเลยเป็นศูนย์", parsePriceTHB("แล้วแต่ร้าน"), 0);
eq("ข้อความว่างเป็นศูนย์", parsePriceTHB(""), 0);

console.log("\nลองกับข้อมูลจริงทั้ง 164 กิจกรรม");
{
  const acts = PROVINCES.flatMap((p) => p.activities);
  check(`อ่านมาครบ (${acts.length} กิจกรรม)`, acts.length > 100);

  const durations = acts.map((a) => parseDurationMin(a.duration));
  check(
    "ทุกกิจกรรมได้ระยะเวลาอยู่ในช่วง 15-720 นาที",
    durations.every((d) => d >= 15 && d <= 720),
  );
  check(
    "ทุกค่าเป็นจำนวนเต็มลงตัวช่วง 15 นาที",
    durations.every((d) => Number.isInteger(d) && d % 15 === 0),
  );

  // ถ้าค่าตั้งต้นถูกใช้เยอะแปลว่าอ่านรูปแบบส่วนใหญ่ไม่ออก
  const fellBack = acts.filter(
    (a) => parseDurationMin(a.duration) === 120 && !/2 ชั่วโมง|1–3|90–150/.test(a.duration),
  );
  check(
    `ใช้ค่าตั้งต้นน้อยกว่า 5% (${fellBack.length}/${acts.length})`,
    fellBack.length / acts.length < 0.05,
    fellBack.slice(0, 5).map((a) => a.duration).join(" | "),
  );

  const prices = acts.map((a) => parsePriceTHB(a.price));
  check("ไม่มีราคาติดลบ", prices.every((p) => p >= 0));
  check(
    "ไม่มีราคาเกินหลักหมื่น",
    prices.every((p) => p <= 10_000),
    String(Math.max(...prices)),
  );
  /*
   * ราคา 0 ต้องมาจากกิจกรรมที่ไม่มีราคาจริง ๆ เท่านั้น
   *
   * เช็กแบบนี้แทนการนับสัดส่วน เพราะตอนแรกเขียนว่า "ต้องน้อยกว่า 10%" แล้วไม่ผ่าน
   * ที่ 16% พอไล่ดูของจริงพบว่าทั้ง 26 รายการเขียนว่า "ฟรี" หรือ "แล้วแต่ซื้อ"
   * — ตัวอ่านถูกแล้ว เกณฑ์ต่างหากที่ผิด การนับสัดส่วนจึงวัดผิดเรื่อง
   */
  const wrongZero = acts.filter(
    (a) => parsePriceTHB(a.price) === 0 && /\d/.test(a.price.replace(/\([^)]*\)/g, "")),
  );
  check(
    "ราคา 0 เกิดเฉพาะกับกิจกรรมที่ไม่มีตัวเลขราคาเลย",
    wrongZero.length === 0,
    wrongZero.map((a) => a.price).join(" | "),
  );
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
