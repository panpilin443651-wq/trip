/**
 * ทดสอบการค้นสถานที่ให้ผู้ช่วยแนะนำเที่ยว
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-explore-retrieval.mts
 *
 * โจทย์ตั้งต้นคือคำถามที่โครงสร้าง จังหวัด → อำเภอ ตอบไม่ได้
 *   บางแสน  ต่ำกว่าอำเภอ
 *   โคราช   ชื่อเล่น
 *   เขาใหญ่ คร่อมสองจังหวัด
 * ถ้าสามเคสนี้พัง ฟีเจอร์ทั้งอันไม่มีเหตุผลให้มีอยู่
 */
import { DISTRICTS } from "@/data/districts";
import { PROVINCES } from "@/data/provinces";
import {
  INDEX_SIZE,
  keywords,
  matchPlacesInAnswer,
  retrieve,
  type PlaceRow,
} from "@/lib/explore-retrieval";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const provincesOf = (rows: PlaceRow[]) => new Set(rows.map((r) => r.province));
const namesOf = (rows: PlaceRow[]) => rows.map((r) => r.name);

console.log("\nข้อมูลตั้งต้น");
check(`อ่านครบทุกชุด (${INDEX_SIZE} รายการ)`, INDEX_SIZE > 5000);

console.log("\nเคสที่คร่อมหลายจังหวัด — เขาใหญ่");
{
  const { rows, matchedByName } = retrieve("เขาใหญ่มีที่เที่ยวอะไรบ้าง");
  const provinces = provincesOf(rows);
  check("รู้ว่าเจอชื่อสถานที่ในคำถาม", matchedByName);
  check("ได้ฝั่งนครราชสีมา", provinces.has("นครราชสีมา"));
  check("ได้ฝั่งปราจีนบุรีด้วย", provinces.has("ปราจีนบุรี"), [...provinces].join(","));
  check(
    "ได้อุทยานแห่งชาติเขาใหญ่",
    namesOf(rows).some((n) => n.includes("อุทยานแห่งชาติเขาใหญ่")),
  );
  // ขั้นขยายอำเภอ — ที่เที่ยวรอบเขาใหญ่ส่วนใหญ่ไม่มีคำว่าเขาใหญ่ในชื่อ
  // ถ้าจับแต่ชื่อจะได้แค่ไม่กี่แห่ง คำตอบจะบางจนไม่มีประโยชน์
  const nearby = rows.filter(
    (r) => r.district === "ปากช่อง" && !r.name.includes("เขาใหญ่"),
  );
  check(`ดึงเพื่อนบ้านในปากช่องที่ไม่มีคำว่าเขาใหญ่ในชื่อ (${nearby.length} แห่ง)`,
    nearby.length >= 3, namesOf(rows).slice(0, 5).join(" / "));
}

console.log("\nเคสต่ำกว่าอำเภอ — บางแสน");
{
  const { rows } = retrieve("บางแสนกินอะไรดี");
  check("ได้ชลบุรี", provincesOf(rows).has("ชลบุรี"));
  check(
    "ได้อำเภอเมืองชลบุรี",
    rows.some((r) => r.province === "ชลบุรี" && r.district === "เมืองชลบุรี"),
  );
  check(
    "มีร้านอาหาร/คาเฟ่ติดมาด้วย",
    rows.some((r) => r.category === "food"),
  );
}

console.log("\nเคสชื่อเล่น — โคราช");
{
  const { rows } = retrieve("โคราชมีที่พักแนะนำไหม");
  check("ได้นครราชสีมา", provincesOf(rows).has("นครราชสีมา"));
  check(
    "มีที่พักติดมาด้วย",
    rows.some((r) => r.category === "accommodation"),
  );
}

console.log("\nคำถามที่ไม่มีชื่อสถานที่ — ต้องใช้จังหวัดที่เลือกบนหน้า");
{
  const { rows, matchedByName } = retrieve("มีอะไรน่ากินบ้าง", {
    province: "เพชรบุรี",
    district: "ชะอำ",
  });
  check("รู้ว่าไม่เจอชื่อในคำถาม", !matchedByName);
  check("ได้เพชรบุรีทั้งหมด", [...provincesOf(rows)].every((p) => p === "เพชรบุรี"));
  check("จำกัดอยู่ในอำเภอชะอำ", rows.every((r) => r.district === "ชะอำ"));
  check("เอาร้านขึ้นก่อนเพราะถามเรื่องกิน", rows[0]?.category === "food",
    rows[0]?.name);
}
{
  // ไม่มีทั้งชื่อในคำถามและไม่ได้เลือกจังหวัด — ต้องไม่ล่ม
  const { rows } = retrieve("สวัสดี");
  check("คำถามที่ไม่เกี่ยวอะไรเลยคืนรายการว่างโดยไม่ล่ม", rows.length === 0);
}

console.log("\nคำถามที่ไม่เกี่ยวกับสถานที่ ต้องไม่ลากสถานที่เข้า prompt");
{
  /*
   * ผู้ช่วยเหลือตัวเดียวที่ตอบทั้งเรื่องที่เที่ยวและเรื่องใช้งานเว็บ
   * ถ้าค้นสถานที่ให้ทุกคำถาม "งบเหลือเท่าไร" จะลากสถานที่ 40 แห่งเข้า prompt
   * เปลืองโควตาและล่อให้ผู้ช่วยพูดถึงที่เที่ยวทั้งที่ไม่มีใครถาม
   */
  const noPlaces = [
    "งบเหลือเท่าไร",
    "เพิ่มรูปความทรงจำยังไง", // เคยไปตรงกับ "บ้านแห่งความทรงจำ" เต็ม 9 ตัวอักษร
    "เว็บนี้ทำอะไรได้บ้าง",
    "ช่วยดูแผนวันแรกให้หน่อย",
    "ส่งออกไฟล์ยังไง",
    "เปลี่ยนธีมมืดยังไง",
    "ตั้งงบยังไง",
    "สวัสดี",
  ];
  for (const q of noPlaces) {
    // ส่งจังหวัดไปด้วย เพราะของจริงหน้าเว็บส่งจังหวัดของทริปมาเสมอ
    const { rows } = retrieve(q, { province: "เพชรบุรี" });
    check(`"${q}" ไม่ได้สถานที่`, rows.length === 0, namesOf(rows).slice(0, 3).join(","));
  }

  // แต่คำถามเรื่องที่เที่ยวต้องยังได้เหมือนเดิม รวมถึงที่พิมพ์มาสั้น ๆ
  const wantPlaces = [
    "เขาใหญ่",
    "แนะนำเขาใหญ่หน่อย",
    "มีอะไรน่ากินบ้าง",
    "อยากไปขอนแก่น",
  ];
  for (const q of wantPlaces) {
    const { rows } = retrieve(q, { province: "เพชรบุรี" });
    check(`"${q}" ยังได้สถานที่`, rows.length > 0);
  }
}

console.log("\nการตัดคำถามต้องไม่ทำชื่อเขตปกครองพัง");
{
  // เจอของจริง — "มา" ทำ "นครราชสีมา" เหลือ "นครราชสี", "ขอ" ทำ "ขอนแก่น" เหลือ "นแก่น"
  const damagedProvinces = PROVINCES.filter(
    (p) => keywords(p.name).join("") !== p.name,
  );
  check(
    `ชื่อจังหวัดที่โดนตัดต้องมีแต่ที่ยาว >= 4 (${damagedProvinces.length} จังหวัด)`,
    damagedProvinces.every((p) => p.name.length >= 4),
    damagedProvinces.map((p) => p.name).join(","),
  );

  // ยาว >= 4 เทียบกับคำถามดิบได้ จึงยังค้นเจอแม้การตัดคำจะทำชื่อพัง
  for (const [q, want] of [
    ["เที่ยวพิมาย", "นครราชสีมา"],
    ["น่านมีอะไรน่าเที่ยว", "น่าน"],
    ["อยากไปขอนแก่น", "ขอนแก่น"],
    ["เที่ยวนครราชสีมา", "นครราชสีมา"],
  ] as const) {
    const { rows } = retrieve(q);
    check(`"${q}" ได้ ${want}`, provincesOf(rows).has(want),
      [...provincesOf(rows)].slice(0, 3).join(","));
  }
}

console.log("\nคำบอกประเภทต้องไม่ไปตรงกับชื่อสถานที่");
{
  // "ที่พัก" เคยไปตรงกับ "อาคารที่พัก สก.ทอ." ที่ชะอำ ตอนถามถึงโคราช
  const { rows } = retrieve("โคราชมีที่พักแนะนำไหม");
  check(
    "ถามถึงโคราชแล้วไม่หลุดไปเพชรบุรี",
    !provincesOf(rows).has("เพชรบุรี"),
    [...provincesOf(rows)].join(","),
  );
  // "น่ากิน" เคยไปตรงกับ "เขากินนอน" ที่พิษณุโลก
  const wide = retrieve("มีอะไรน่ากินบ้าง", { province: "เพชรบุรี" });
  check(
    "ถามกว้าง ๆ แล้วไม่หลุดไปพิษณุโลก",
    !provincesOf(wide.rows).has("พิษณุโลก"),
  );
}

console.log("\nขนาดของผลลัพธ์");
{
  const { rows, context } = retrieve("เที่ยวกรุงเทพ");
  check(`ไม่เกิน 40 แถว (ได้ ${rows.length})`, rows.length <= 40);
  check(
    "ไม่มีชื่อซ้ำในจังหวัดเดียวกัน",
    new Set(rows.map((r) => `${r.name}::${r.province}`)).size === rows.length,
  );
  check(`context ไม่เกิน 6000 ตัวอักษร (ได้ ${context.length})`, context.length <= 6000);
  check("ทุกบรรทัดใน context บอกจังหวัด", context.split("\n").every((l) => l.includes("จ.")));
}

console.log("\nจับชื่อสถานที่จากคำตอบเพื่อทำปุ่มใส่แผน");
{
  const rows: PlaceRow[] = [
    { name: "เขาใหญ่", province: "นครราชสีมา", district: "ปากช่อง", kind: "ภูเขา", category: "attraction", notable: true, lat: 1, lng: 1 },
    { name: "เขาใหญ่อาร์ตมิวเซียม", province: "นครราชสีมา", district: "ปากช่อง", kind: "พิพิธภัณฑ์", category: "attraction", notable: false, lat: 2, lng: 2 },
    { name: "หาดชะอำ", province: "เพชรบุรี", district: "ชะอำ", kind: "ชายหาด", category: "attraction", notable: true, lat: 3, lng: 3 },
  ];

  const one = matchPlacesInAnswer("แนะนำเขาใหญ่อาร์ตมิวเซียม ที่ปากช่องครับ", rows);
  check("จับชื่อยาวก่อน ไม่ตัดเป็นชื่อสั้นที่ซ้อนอยู่",
    one.length === 1 && one[0].name === "เขาใหญ่อาร์ตมิวเซียม",
    namesOf(one).join(","));

  const two = matchPlacesInAnswer("ไปหาดชะอำก่อน แล้วค่อยขึ้นเขาใหญ่", rows);
  check("จับได้หลายแห่ง", two.length === 2);
  check("เรียงตามลำดับที่โผล่ในคำตอบ", two[0].name === "หาดชะอำ", namesOf(two).join(","));

  const none = matchPlacesInAnswer("แนะนำร้านลับริมโขงที่ไม่มีในฐานข้อมูล", rows);
  check("ชื่อที่โมเดลแต่งเองไม่ขึ้นเป็นปุ่ม", none.length === 0, namesOf(none).join(","));

  const many = matchPlacesInAnswer(
    rows.map((r) => r.name).join(" ") + " " + rows.map((r) => r.name).join(" "),
    rows,
  );
  check("ที่เดียวกันไม่ขึ้นซ้ำสองปุ่ม", many.length === 3, namesOf(many).join(","));

  check("คำตอบว่างไม่ได้ปุ่ม", matchPlacesInAnswer("", rows).length === 0);
  check("จำกัดจำนวนปุ่มได้", matchPlacesInAnswer("หาดชะอำ เขาใหญ่", rows, 1).length === 1);
}

console.log("\nอำเภอชื่อสั้นที่พิมพ์มาเดี่ยว ๆ");
{
  // "คง" กับ "พล" สั้นกว่าเกณฑ์เทียบกับคำถามดิบ ต้องพึ่งการพิมพ์มาเป็นคำเดี่ยว
  check("อ.คง มีอยู่จริงในข้อมูล", (DISTRICTS["นครราชสีมา"] ?? []).includes("คง"));
  const { rows } = retrieve("คง");
  check("พิมพ์ \"คง\" เดี่ยว ๆ แล้วได้นครราชสีมา", provincesOf(rows).has("นครราชสีมา"),
    [...provincesOf(rows)].join(","));
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
