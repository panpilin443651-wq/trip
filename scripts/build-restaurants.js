/**
 * คัดร้านอาหาร/คาเฟ่จาก OSM แบ่งเข้าจังหวัด แล้วเขียนเป็น src/data/osm-restaurants.ts
 *
 * ใช้: node scripts/build-restaurants.js <restaurants.json> <boundaries.json>
 *
 * แบ่งจังหวัดด้วยขอบเขตจริงในเครื่อง (scripts/geo-provinces.js) เหมือน
 * build-attractions.js ไม่ใช่ reverse geocode ทีละจุด
 */
const fs = require("fs");
const { prepare, provinceAt } = require("./geo-provinces.js");

const INPUT = process.argv[2];
const BOUNDARIES = process.argv[3];
const OUT = "src/data/osm-restaurants.ts";

/** เก็บจังหวัดละไม่เกินเท่านี้ พอให้เลือกโดยไม่ต้องเลื่อนจนเบื่อ */
const MAX_PER_PROVINCE = 30;

/**
 * แปลงค่าแท็ก cuisine ของ OSM เป็นคำไทย
 *
 * OSM เก็บเป็นภาษาอังกฤษและใส่หลายค่าคั่นด้วย ; เอาค่าแรกที่แปลได้พอ
 */
const CUISINE = {
  thai: "อาหารไทย",
  noodle: "ก๋วยเตี๋ยว",
  seafood: "อาหารทะเล",
  japanese: "อาหารญี่ปุ่น",
  sushi: "ซูชิ",
  ramen: "ราเมง",
  korean: "อาหารเกาหลี",
  chinese: "อาหารจีน",
  italian: "อาหารอิตาเลียน",
  pizza: "พิซซ่า",
  american: "อาหารอเมริกัน",
  burger: "เบอร์เกอร์",
  steak_house: "สเต๊ก",
  indian: "อาหารอินเดีย",
  vietnamese: "อาหารเวียดนาม",
  international: "อาหารนานาชาติ",
  asian: "อาหารเอเชีย",
  barbecue: "ปิ้งย่าง",
  bbq: "ปิ้งย่าง",
  vegetarian: "มังสวิรัติ",
  vegan: "วีแกน",
  coffee_shop: "กาแฟ",
  cake: "เค้ก",
  dessert: "ของหวาน",
  ice_cream: "ไอศกรีม",
  bakery: "เบเกอรี",
  breakfast: "อาหารเช้า",
  fish: "อาหารทะเล",
  local: "อาหารพื้นเมือง",
};

function cuisineLabel(raw) {
  for (const part of String(raw).split(";")) {
    const key = part.trim().toLowerCase();
    if (CUISINE[key]) return CUISINE[key];
  }
  return "";
}

/**
 * ชื่อที่ไม่ควรเอาเข้ารายการ
 *
 * OSM มีร้านในโรงอาหารและร้านสาขาของเชนติดมาเยอะ ซึ่งไม่ใช่ร้านที่คนตั้งใจ
 * เดินทางไปกิน และชื่อซ้ำกันทั้งประเทศจนรายการดูรก
 */
const JUNK =
  /^(ร้านอาหาร|ร้านกาแฟ|คาเฟ่|ร้าน|โรงอาหาร|ศูนย์อาหาร|ฟู้ดคอร์ท)$|โรงอาหาร|ศูนย์อาหาร|โรงพยาบาล|โรงเรียน|มหาวิทยาลัย|สหกรณ์|ปั๊ม|ปตท|7-ELEVEN|เซเว่น/i;

/** เชนที่มีทุกห้าง ไม่ใช่จุดหมายของทริป */
const CHAIN =
  /(McDonald|KFC|Burger King|Pizza (Hut|Company)|Subway|Starbucks|Amazon|Dairy Queen|Swensen|Sizzler|MK |Yayoi|Fuji|Chester|Texas Chicken|Auntie Anne|Dunkin|Krispy Kreme|Bonchon|Sukishi|Shabushi|Oishi|CoCo Ichibanya|True Coffee|Inthanin|Punthai|กาแฟพันธุ์ไทย|อินทนิล|เอ็มเค|ยาโยอิ|ฟูจิ|สเวนเซ่น|ซิซซ์เล่อร์)/i;

function isWeakName(name) {
  const n = name.trim();
  if (n.length < 3) return true;
  if (JUNK.test(n)) return true;
  if (CHAIN.test(n)) return true;
  return false;
}

(async () => {
  if (!INPUT || !BOUNDARIES) {
    console.error(
      "ใช้: node scripts/build-restaurants.js <restaurants.json> <boundaries.json>",
    );
    process.exit(1);
  }

  const rows = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const boundaries = prepare(JSON.parse(fs.readFileSync(BOUNDARIES, "utf8")));
  console.log(`อ่านมา ${rows.length} ร้าน · ขอบเขต ${boundaries.length} จังหวัด`);

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

    const isCafe = row.amenity === "cafe";
    const cuisine = cuisineLabel(row.cuisine);

    // จัดอันดับจากร่องรอยว่าร้านมีตัวตนจริงจังแค่ไหน
    // มีคนเขียนถึงใน Wikipedia สำคัญที่สุด รองมาคือมีเว็บและเบอร์โทร
    const rank =
      (row.notable ? 100 : 0) +
      (row.hasWebsite ? 20 : 0) +
      (row.hasPhone ? 10 : 0) +
      (row.openingHours ? 8 : 0) +
      (cuisine ? 5 : 0);

    if (!byProvince.has(province)) byProvince.set(province, []);
    byProvince.get(province).push({
      id: row.osmId,
      name: row.name.trim(),
      kind: isCafe ? "คาเฟ่" : "ร้านอาหาร",
      emoji: isCafe ? "☕" : "🍽️",
      cuisine,
      lat: Number(row.lat.toFixed(5)),
      lng: Number(row.lng.toFixed(5)),
      openingHours: row.openingHours || "",
      notable: row.notable,
      rank,
    });
  }

  console.log(
    `ตัดออก — ชื่อใช้ไม่ได้/เป็นเชน ${weak} · นอกเขตจังหวัด ${noProvince}`,
  );

  const result = {};
  for (const [province, list] of byProvince) {
    const seen = new Set();
    const unique = list
      .filter((p) => !seen.has(p.name) && seen.add(p.name))
      .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "th"));

    // สลับคาเฟ่กับร้านอาหารขึ้นมาทีละอย่าง ไม่งั้นหัวรายการจะเป็นคาเฟ่ยาว
    // เป็นแถบ (คาเฟ่มักใส่ opening_hours ครบกว่าจึงได้คะแนนสูงกว่า)
    const cafes = unique.filter((p) => p.kind === "คาเฟ่");
    const meals = unique.filter((p) => p.kind !== "คาเฟ่");
    const picked = [];
    while (picked.length < MAX_PER_PROVINCE && (cafes.length || meals.length)) {
      if (meals.length) picked.push(meals.shift());
      if (picked.length >= MAX_PER_PROVINCE) break;
      if (cafes.length) picked.push(cafes.shift());
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
    `\nได้ ${total} ร้าน ใน ${provinceCount} จังหวัด ` +
      `(เฉลี่ย ${(total / provinceCount).toFixed(1)} ต่อจังหวัด)`,
  );
  if (thin.length) console.log(`ได้น้อยกว่า 5: ${thin.join(", ")}`);

  const header = `/**
 * ร้านอาหารและคาเฟ่จาก OpenStreetMap แบ่งเข้าจังหวัดด้วยขอบเขตการปกครองจริง
 *
 * สร้างด้วย scripts/build-restaurants.js — อย่าแก้ด้วยมือ
 *
 * คัดเฉพาะร้านที่มีร่องรอยว่ามีตัวตนจริงจัง (มีเว็บ เบอร์โทร เวลาเปิดปิด
 * หรือมีคนเขียนถึงใน Wikipedia) และตัดร้านเชนที่มีทุกห้างออก เพราะไม่ใช่
 * จุดหมายของทริป
 *
 * ต้องเสิร์ฟผ่าน /api/restaurants ไม่ import เข้า client component ตรง ๆ
 * ไม่งั้นจะติดไปกับ bundle ที่ผู้ใช้มือถือต้องโหลดทุกครั้ง
 */

export interface OsmRestaurant {
  id: string;
  name: string;
  /** ร้านอาหาร หรือ คาเฟ่ */
  kind: string;
  emoji: string;
  /** ประเภทอาหารเป็นคำไทย ว่างได้ถ้า OSM ไม่ได้ระบุ */
  cuisine: string;
  lat: number;
  lng: number;
  /** เวลาเปิดปิดตามรูปแบบของ OSM ว่างได้ */
  openingHours: string;
  /** มีหน้า Wikipedia หรือ Wikidata */
  notable: boolean;
}

export const OSM_RESTAURANTS: Record<string, OsmRestaurant[]> = `;

  fs.writeFileSync(OUT, `${header}${JSON.stringify(result, null, 1)};\n`);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`\nเขียน ${OUT} (${kb} KB)`);
})();
