/**
 * ทดสอบการรวมข้อมูลแนะนำของการ์ด "แนะนำสำหรับทริปนี้"
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-trip-suggestions.mts
 *
 * การ์ดนี้รวมสี่แหล่งที่หน้าตาข้อมูลไม่เหมือนกันเลย (ที่คัดเอง, OSM ที่เที่ยว,
 * ร้านอาหาร, ที่พัก) ถ้าแมปผิดจะได้หมวดผิด เวลาผิด หรือหมวดงบผิด
 * โดยที่หน้าเว็บยังดูปกติดี
 */
import { PROVINCE_BY_NAME } from "@/data/provinces";
import { groupCounts, scopedRows } from "@/lib/district-groups";
import {
  buildSuggestionRows,
  byPlanDistricts,
  SUGGESTION_GROUPS,
  type SuggestionRow,
} from "@/lib/trip-suggestions";
import { activityFill } from "@/lib/activity-search";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const byName = (rows: SuggestionRow[], name: string) =>
  rows.find((r) => r.name === name);

const osm = (id: string, name: string, kind: string, district = "ชะอำ") => ({
  id,
  name,
  kind,
  emoji: "📍",
  lat: 12.8,
  lng: 99.9,
  notable: false,
  district,
});

const food = (id: string, name: string, kind: string, cuisine: string | null) => ({
  id,
  name,
  kind,
  cuisine,
  lat: 12.8,
  lng: 99.9,
  mapsUrl: `https://maps.example/${id}`,
  openingHours: null,
  notable: false,
  district: "ชะอำ",
});

const stay = (id: string, name: string, kind: string, stars = 0) => ({
  id,
  name,
  kind,
  stars,
  lat: 12.8,
  lng: 99.9,
  mapsUrl: `https://maps.example/${id}`,
  notable: false,
  district: "ชะอำ",
});

const P = "เพชรบุรี";
const province = PROVINCE_BY_NAME.get(P);
if (!province) throw new Error("ไม่เจอจังหวัดเพชรบุรีในข้อมูลที่คัดเอง");

console.log("\nแยกหมวดให้ถูก");
{
  const rows = buildSuggestionRows({
    curated: [],
    osmPlaces: {
      [P]: [
        osm("p1", "วัดใหญ่สุวรรณาราม", "วัด"),
        osm("p2", "น้ำตกแก่งกระจาน", "น้ำตก"),
      ],
    },
    restaurants: {
      [P]: [
        food("f1", "ร้านข้าวแกงป้าอ้วน", "ร้านอาหาร", "อาหารตามสั่ง"),
        food("f2", "ล้อรางคาเฟ่", "คาเฟ่", null),
      ],
    },
    hotels: {
      [P]: [stay("h1", "โรงแรมทดสอบ", "โรงแรม", 4), stay("h2", "รีสอร์ตริมเล", "รีสอร์ต")],
    },
  });

  check("วัดแยกออกจากที่เที่ยว", byName(rows, "วัดใหญ่สุวรรณาราม")?.group === "วัด");
  check("ที่เที่ยวอื่นอยู่หมวดสถานที่", byName(rows, "น้ำตกแก่งกระจาน")?.group === "สถานที่");
  check("ร้านอาหารเข้าหมวดร้านอาหาร", byName(rows, "ร้านข้าวแกงป้าอ้วน")?.group === "ร้านอาหาร");
  check("คาเฟ่เข้าหมวดคาเฟ่", byName(rows, "ล้อรางคาเฟ่")?.group === "คาเฟ่");
  // โรงแรมกับรีสอร์ตรวมเป็นปุ่มเดียว ไม่งั้นแถวปุ่มจะเป็น 8 อันจนล้นบนมือถือ
  check("โรงแรมกับรีสอร์ตรวมเป็นที่พักปุ่มเดียว",
    byName(rows, "โรงแรมทดสอบ")?.group === "ที่พัก" &&
      byName(rows, "รีสอร์ตริมเล")?.group === "ที่พัก");
  check("ประเภทจริงยังบอกในบรรทัดย่อย",
    byName(rows, "โรงแรมทดสอบ")?.hint === "โรงแรม ระดับ 4 ดาว",
    byName(rows, "โรงแรมทดสอบ")?.hint);
}

console.log("\nค่าที่ใช้ตอนกดใส่แผน");
{
  const rows = buildSuggestionRows({
    curated: [],
    osmPlaces: { [P]: [osm("p1", "วัดทดสอบ", "วัด")] },
    restaurants: { [P]: [food("f1", "ร้านทดสอบ", "ร้านอาหาร", null)] },
    hotels: { [P]: [stay("h1", "ที่พักทดสอบ", "โรงแรม")] },
  });
  const fill = (name: string) => byName(rows, name)?.fill;

  check("ที่พักเผื่อไว้ 12 ชั่วโมง", fill("ที่พักทดสอบ")?.durationMin === 720);
  check("ที่พักลงหมวดงบ accommodation", fill("ที่พักทดสอบ")?.category === "accommodation");
  check("ร้านอาหาร 1 ชั่วโมง หมวด food",
    fill("ร้านทดสอบ")?.durationMin === 60 && fill("ร้านทดสอบ")?.category === "food");
  check("ที่เที่ยว 1 ชั่วโมงครึ่ง หมวด attraction",
    fill("วัดทดสอบ")?.durationMin === 90 && fill("วัดทดสอบ")?.category === "attraction");
  check("ทุกแถวพกพิกัดไปด้วย",
    rows.every((r) => r.fill.lat !== undefined && r.fill.lng !== undefined));
}

console.log("\nลิงก์ Google Maps");
{
  const rows = buildSuggestionRows({
    curated: [province],
    osmPlaces: { [P]: [osm("p1", "วัดทดสอบ", "วัด")] },
    restaurants: {},
    hotels: {},
  });
  const withCoords = rows.filter((r) => r.group !== "กิจกรรม");
  check(`ทุกแถวที่เป็นสถานที่มีลิงก์แผนที่ (${withCoords.length} แถว)`,
    withCoords.every((r) => r.mapsUrl !== null && r.mapsUrl.includes("google.com/maps")));

  // กิจกรรมเป็นสิ่งที่ทำ ไม่ใช่ที่ที่ไป ถ้าฝืนทำลิงก์ด้วยชื่อจังหวัดจะพาไปผิดที่
  const acts = rows.filter((r) => r.group === "กิจกรรม");
  check(`กิจกรรมไม่มีลิงก์แผนที่ (${acts.length} แถว)`, acts.length > 0 && acts.every((r) => r.mapsUrl === null));

  // สถานที่ที่คัดเองมีพิกัดอยู่แล้ว เดิมไม่เคยมีลิงก์ทั้งที่ข้อมูลพร้อม
  const curated = rows.filter((r) => r.key.startsWith("c-") && r.group === "สถานที่");
  check(`สถานที่ที่คัดเองก็มีลิงก์ด้วย (${curated.length} แถว)`,
    curated.length > 0 && curated.every((r) => r.mapsUrl !== null));
}

console.log("\nชื่อซ้ำข้ามแหล่ง");
{
  const first = province.places[0];
  const rows = buildSuggestionRows({
    curated: [province],
    // ที่ที่คัดไว้เองมักมีใน OSM ด้วย ถ้าไม่ตัดจะขึ้นสองแถวติดกัน
    osmPlaces: { [P]: [osm("dup", first.name, "ที่เที่ยว")] },
    restaurants: {},
    hotels: {},
  });
  const same = rows.filter((r) => r.name === first.name);
  check(`"${first.name}" เหลือแถวเดียว`, same.length === 1, `ได้ ${same.length}`);
  // ของที่คัดเองมีคำอธิบาย เคล็ดลับ ค่าเข้า และเวลาที่ควรเผื่อ ส่วน OSM มีแค่ชื่อ
  check("ของที่คัดเองชนะ", same[0]?.key.startsWith("c-"), same[0]?.key);

  const keys = rows.map((r) => `${r.name}::${r.province}`);
  check("ไม่มีชื่อซ้ำในจังหวัดเดียวกันเลย", new Set(keys).size === keys.length);
}

console.log("\nปุ่มกรองต้องไม่โกหก");
{
  const rows = buildSuggestionRows({
    curated: [province],
    osmPlaces: { [P]: [osm("p1", "วัดทดสอบ", "วัด"), osm("p2", "ถ้ำทดสอบ", "ถ้ำ")] },
    restaurants: { [P]: [food("f1", "ร้านทดสอบ", "ร้านอาหาร", null)] },
    hotels: { [P]: [stay("h1", "ที่พักทดสอบ", "โรงแรม")] },
  });

  for (const g of SUGGESTION_GROUPS) {
    const shown = scopedRows(rows, null, g).length;
    const count = groupCounts(rows, null, g).scoped;
    check(`หมวด "${g}" ตัวเลขบนปุ่มตรงกับรายการที่ได้เห็น (${count})`, count === shown);
  }
  check("หมวดทั้งหมดได้ครบทุกแถว", scopedRows(rows, null, "ทั้งหมด").length === rows.length);
}

console.log("\nค้นหา");
{
  const rows = buildSuggestionRows({
    curated: [],
    osmPlaces: {},
    restaurants: { [P]: [food("f1", "ร้านทดสอบ", "ร้านอาหาร", "ก๋วยเตี๋ยว")] },
    hotels: {},
  });
  const hay = byName(rows, "ร้านทดสอบ")?.haystack ?? "";
  // คนมักจำประเภทอาหารได้มากกว่าชื่อร้าน คำค้นจึงต้องกวาดถึงข้อมูลรองด้วย
  check("ข้อความที่เอาไปค้นรวมประเภทอาหาร", hay.includes("ก๋วยเตี๋ยว"), hay);
  check("และรวมชื่อจังหวัด", hay.includes("เพชรบุรี"));
}

console.log("\nกิจกรรมอ่านเวลาและราคาจากข้อความได้แล้ว");
{
  // activityFill เคยตั้ง 120 นาทีตายตัวพร้อมคอมเมนต์ว่าแปลงไม่ได้
  // ซึ่งไม่จริงตั้งแต่มี lib/activity-parse
  const fill = activityFill(P, {
    id: "x",
    name: "ทดสอบ",
    emoji: "🎯",
    description: "",
    price: "150–400 บาท/คน",
    duration: "ครึ่งวัน",
    prepare: "",
  });
  check("ครึ่งวัน = 240 นาที ไม่ใช่ 120", fill.durationMin === 240, String(fill.durationMin));
  check("อ่านราคากลางช่วงได้", fill.cost === 280, String(fill.cost));
}

console.log("\nขอบเขตอำเภอตามแพลนการเที่ยว");
{
  const rows = buildSuggestionRows({
    curated: [province],
    osmPlaces: {
      [P]: [
        osm("p1", "วัดในชะอำ", "วัด", "ชะอำ"),
        osm("p2", "วัดในบ้านแหลม", "วัด", "บ้านแหลม"),
      ],
    },
    restaurants: { [P]: [food("f1", "ร้านในชะอำ", "ร้านอาหาร", null)] },
    hotels: {},
  });

  // ไม่ได้เจาะอำเภอไว้ = ไม่กรอง
  check("แพลนไม่ได้เจาะอำเภอ ได้ทั้งจังหวัด", byPlanDistricts({}) === null);
  check("อาเรย์ว่างก็ถือว่าไม่ได้เจาะ", byPlanDistricts({ [P]: [] }) === null);

  const only = byPlanDistricts({ [P]: ["ชะอำ"] });
  const temples = scopedRows(rows, only, "วัด");
  check("เจาะ อ.ชะอำ แล้วได้เฉพาะวัดในชะอำ",
    temples.length === 1 && temples[0].name === "วัดในชะอำ",
    temples.map((r) => r.name).join(","));

  /*
   * กิจกรรมไม่มีอำเภอโดยธรรมชาติ เพราะเป็นสิ่งที่ทำ ไม่ใช่ที่ที่ไป
   * ถ้ากรองแบบเข้มงวดจะหายหมดทันทีที่เจาะอำเภอ ซึ่งไม่ใช่สิ่งที่ผู้ใช้ตั้งใจ
   */
  const acts = scopedRows(rows, only, "กิจกรรม");
  check(`เจาะอำเภอแล้วกิจกรรมยังอยู่ครบ (${acts.length} รายการ)`, acts.length > 0);

  /*
   * หมวดที่อำเภอนั้นไม่มีของ ต้องว่างจริง ไม่ใช่แอบถอยไปทั้งจังหวัด
   * นี่คือสิ่งที่ผู้ใช้แจ้งว่า "ยังเป็นการแสดงผลแบบทั้งจังหวัดอยู่"
   */
  const inBanLaem = byPlanDistricts({ [P]: ["บ้านแหลม"] });
  const foodThere = groupCounts(rows, inBanLaem, "ร้านอาหาร");
  check("บ้านแหลมไม่มีร้าน จึงว่างจริง", foodThere.scoped === 0);
  check("แต่รู้ว่าทั้งจังหวัดมี จึงเสนอปุ่มขยายได้", foodThere.province === 1);

  // ชื่ออำเภอซ้ำข้ามจังหวัดได้ ("เมือง..." มีทุกจังหวัด) จึงต้องเทียบเป็นคู่
  const wrongProvince = byPlanDistricts({ เชียงใหม่: ["ชะอำ"] });
  check("อำเภอของคนละจังหวัดไม่ถูกนับเข้ามา",
    scopedRows(rows, wrongProvince, "วัด").length === 0);

  // ปุ่มยังต้องบอกจำนวนที่กดแล้วได้เห็นจริง แม้ตอนเจาะอำเภอ
  let lying = 0;
  for (const g of SUGGESTION_GROUPS) {
    if (groupCounts(rows, only, g).scoped !== scopedRows(rows, only, g).length) {
      lying += 1;
    }
  }
  check("ตอนเจาะอำเภอ ปุ่มก็ยังไม่โกหก", lying === 0, `ผิด ${lying} หมวด`);
}

console.log("\nขอบและของว่าง");
{
  const empty = buildSuggestionRows({
    curated: [],
    osmPlaces: {},
    restaurants: {},
    hotels: {},
  });
  check("ไม่มีข้อมูลเลยได้รายการว่างโดยไม่ล่ม", empty.length === 0);
  check("หมวดที่ไม่มีของนับเป็น 0", groupCounts(empty, null, "วัด").scoped === 0);

  const many = buildSuggestionRows({
    curated: [province],
    osmPlaces: {},
    restaurants: {},
    hotels: {},
  });
  check("ที่ติดดาวถูกดันขึ้นบนสุด",
    many.length > 1 && !many.some((r, i) => i > 0 && r.notable && !many[i - 1].notable));
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
