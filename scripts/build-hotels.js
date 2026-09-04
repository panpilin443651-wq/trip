/**
 * คัดโรงแรม/รีสอร์ตจาก OSM แบ่งเข้าจังหวัด แล้วเขียนเป็น src/data/osm-hotels.ts
 *
 * ใช้: node scripts/build-hotels.js <hotels.json> <boundaries.json>
 *
 * แบ่งจังหวัดด้วยขอบเขตจริงในเครื่อง (scripts/geo-provinces.js) เหมือน
 * build-restaurants.js ไม่ใช่ reverse geocode ทีละจุด
 *
 * อำเภอเติมทีหลังด้วย scripts/fill-osm-districts.js
 */
const fs = require("fs");
const { prepare, provinceAt } = require("./geo-provinces.js");

const INPUT = process.argv[2];
const BOUNDARIES = process.argv[3];
const OUT = "src/data/osm-hotels.ts";

/** เก็บจังหวัดละไม่เกินเท่านี้ พอให้เลือกโดยไม่ต้องเลื่อนจนเบื่อ */
const MAX_PER_PROVINCE = 25;

/**
 * ชื่อที่ไม่ควรเอาเข้ารายการ
 *
 * OSM มีที่พักที่ใส่ชื่อไว้แค่ประเภท ("โรงแรม", "Hotel") ซึ่งบอกอะไรไม่ได้เลย
 * และมีบ้านพักของหน่วยงานราชการติดมาด้วย ซึ่งคนทั่วไปจองไม่ได้
 */
const JUNK =
  /^(โรงแรม|รีสอร์ต|รีสอร์ท|ที่พัก|hotel|resort|guest ?house)$|บ้านพักรับรอง|บ้านพักข้าราชการ|เรือนรับรอง|สโมสร|ค่ายทหาร|เรือนจำ/i;

/**
 * ชื่อที่เป็นเขตปกครอง ไม่ใช่ชื่อที่พัก
 *
 * เจอของจริง — มีคนแท็ก "อำเภอแก่งกระจาน" ไว้เป็น tourism=hotel
 * ถ้าไม่กรองจะโผล่ในรายการที่พักโดยไม่มีอะไรบอกว่าผิด
 */
const ADMIN_NAME = /^(อำเภอ|ตำบล|จังหวัด|เขต|แขวง|หมู่บ้าน)/;

function isWeakName(name) {
  const n = name.trim();
  if (n.length < 4) return true;
  if (JUNK.test(n)) return true;
  if (ADMIN_NAME.test(n)) return true;
  return false;
}

/**
 * แยกโรงแรมกับรีสอร์ตจากชื่อ ไม่ใช่จากแท็กอย่างเดียว
 *
 * แท็ก tourism=resort แทบไม่มีใครใช้ในไทย (ภูเก็ตกับเชียงใหม่ได้ 0 แห่ง)
 * ที่พักที่คนเรียกว่ารีสอร์ตถูกแท็กเป็น hotel แล้วใส่คำว่ารีสอร์ทไว้ในชื่อ
 * ถ้าดูแค่แท็ก ปุ่มกรอง "รีสอร์ต" จะว่างเปล่าจนไม่มีประโยชน์
 */
function isResort(row) {
  if (row.tourism === "resort") return true;
  return /รีสอร์[ตท]|resort/i.test(row.name);
}

/**
 * แปลงแท็ก stars ของ OSM เป็นตัวเลข 1-5
 *
 * OSM เขียนได้หลายแบบ — "4", "4S" (superior), "4.5", "3-4"
 * เอาเลขตัวแรกที่อ่านได้พอ ค่าที่หลุดช่วง 1-5 ทิ้งไปเพราะเป็นข้อมูลผิด
 */
function starLevel(raw) {
  const match = String(raw).match(/\d(\.\d)?/);
  if (!match) return 0;
  const value = Math.round(Number(match[0]));
  return value >= 1 && value <= 5 ? value : 0;
}

(async () => {
  if (!INPUT || !BOUNDARIES) {
    console.error(
      "ใช้: node scripts/build-hotels.js <hotels.json> <boundaries.json>",
    );
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const boundaries = prepare(JSON.parse(fs.readFileSync(BOUNDARIES, "utf8")));
  console.log(`อ่านมา ${rows.length} แห่ง · ขอบเขต ${boundaries.length} จังหวัด`);

  const byProvince = new Map();
  let weak = 0;
  let noProvince = 0;

  for (const row of rows) {
    if (isWeakName(row.name)) {
      weak += 1;
      continue;
    }
    const province = provinceAt(boundaries, row.lng, row.lat);
    if (!province) {
      noProvince += 1;
      continue;
    }

    const resort = isResort(row);
    const stars = starLevel(row.stars);

    /*
     * จัดอันดับจากร่องรอยว่าที่พักมีตัวตนจริงจังแค่ไหน
     * มีคนเขียนถึงใน Wikipedia สำคัญที่สุด รองมาคือจำนวนดาวและเว็บไซต์
     * จำนวนดาวคูณ 12 เพื่อให้ 5 ดาวชนะที่มีแค่เว็บกับเบอร์โทรได้
     */
    const rank =
      (row.notable ? 100 : 0) +
      stars * 12 +
      (row.hasWebsite ? 20 : 0) +
      (row.hasPhone ? 10 : 0) +
      (row.hasPool ? 5 : 0) +
      (row.hasBreakfast ? 3 : 0);

    if (!byProvince.has(province)) byProvince.set(province, []);
    byProvince.get(province).push({
      id: row.osmId,
      name: row.name.trim(),
      kind: resort ? "รีสอร์ต" : "โรงแรม",
      emoji: resort ? "🏝️" : "🏨",
      stars,
      lat: Number(row.lat.toFixed(5)),
      lng: Number(row.lng.toFixed(5)),
      notable: row.notable,
      district: "",
      rank,
    });
  }

  console.log(
    `ตัดออก — ชื่อใช้ไม่ได้ ${weak} · นอกเขตจังหวัด ${noProvince}`,
  );

  const result = {};
  for (const [province, list] of byProvince) {
    const seen = new Set();
    const unique = list
      .filter((p) => !seen.has(p.name) && seen.add(p.name))
      .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "th"));

    // สลับโรงแรมกับรีสอร์ตขึ้นมาทีละอย่าง ไม่งั้นจังหวัดชายทะเลจะเป็นรีสอร์ต
    // ยาวเป็นแถบ ส่วนจังหวัดในเมืองจะเป็นโรงแรมล้วน
    const resorts = unique.filter((p) => p.kind === "รีสอร์ต");
    const hotels = unique.filter((p) => p.kind !== "รีสอร์ต");
    const picked = [];
    while (picked.length < MAX_PER_PROVINCE && (resorts.length || hotels.length)) {
      if (hotels.length) picked.push(hotels.shift());
      if (picked.length >= MAX_PER_PROVINCE) break;
      if (resorts.length) picked.push(resorts.shift());
    }

    result[province] = picked.map(({ rank, ...keep }) => keep);
  }

  const counts = Object.values(result).map((l) => l.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const provinceCount = Object.keys(result).length;
  const thin = Object.entries(result)
    .filter(([, l]) => l.length < 5)
    .map(([n, l]) => `${n} (${l.length})`);

  console.log(
    `\nได้ ${total} แห่ง ใน ${provinceCount} จังหวัด ` +
      `(เฉลี่ย ${(total / provinceCount).toFixed(1)} ต่อจังหวัด)`,
  );
  if (thin.length) console.log(`ได้น้อยกว่า 5: ${thin.join(", ")}`);

  const header = `/**
 * โรงแรมและรีสอร์ตจาก OpenStreetMap แบ่งเข้าจังหวัดด้วยขอบเขตการปกครองจริง
 *
 * สร้างด้วย scripts/build-hotels.js — อย่าแก้ด้วยมือ
 * อำเภอเติมด้วย scripts/fill-osm-districts.js
 *
 * คัดเฉพาะที่พักที่มีร่องรอยว่ามีตัวตนจริงจัง (มีเว็บ เบอร์โทร จำนวนดาว
 * หรือมีคนเขียนถึงใน Wikipedia) และตัดชื่อที่บอกแค่ประเภทกับบ้านพักของ
 * หน่วยงานราชการออก เพราะคนทั่วไปจองไม่ได้
 *
 * ไม่มีราคา เพราะ OSM ไม่ได้เก็บ และราคาที่พักเปลี่ยนตามวันจนเก็บไว้ไม่มีความหมาย
 * ทุกแถวจึงมีลิงก์ไป Google Maps ให้ไปดูราคาและรีวิวต่อ
 *
 * ต้องเสิร์ฟผ่าน /api/hotels ไม่ import เข้า client component ตรง ๆ
 * ไม่งั้นจะติดไปกับ bundle ที่ผู้ใช้มือถือต้องโหลดทุกครั้ง
 */

export interface OsmHotel {
  id: string;
  name: string;
  /** โรงแรม หรือ รีสอร์ต */
  kind: string;
  emoji: string;
  /** จำนวนดาวตามที่ OSM ระบุ 0 = ไม่ได้ระบุ */
  stars: number;
  lat: number;
  lng: number;
  /** มีหน้า Wikipedia หรือ Wikidata */
  notable: boolean;
  /**
   * อำเภอ/เขต เติมด้วย scripts/fill-osm-districts.js
   * ว่างได้ ถ้าหาไม่เจอจากขอบเขตการปกครอง
   */
  district: string;
}

export const OSM_HOTELS: Record<string, OsmHotel[]> = `;

  fs.writeFileSync(OUT, `${header}${JSON.stringify(result, null, 1)};\n`);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`\nเขียน ${OUT} (${kb} KB)`);
})();
