/**
 * คัดสถานที่จาก OSM แบ่งเข้าจังหวัด แล้วเขียนเป็น src/data/osm-places.ts
 *
 * ใช้: node scripts/build-attractions.js <attractions.json> <boundaries.json>
 *
 * แบ่งจังหวัดด้วยขอบเขตจริงในเครื่อง (scripts/geo-provinces.js) ไม่ใช่
 * reverse geocode ทีละจุด เพราะมีหลายพันจุดและ Nominatim จำกัด 1 คำขอต่อวินาที
 */
const fs = require("fs");
const path = require("path");
const { prepare, provinceAt } = require("./geo-provinces.js");

const ATTRACTIONS = process.argv[2];
const BOUNDARIES = process.argv[3];
const DIR = "src/data/provinces";
const OUT = "src/data/osm-places.ts";

/** เก็บจังหวัดละไม่เกินเท่านี้ พอให้เลือกโดยไม่ต้องเลื่อนจนเบื่อ */
const MAX_PER_PROVINCE = 40;

function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

/** ประเภทที่จะโชว์ให้ผู้ใช้เห็น เรียงตามความน่าไปเที่ยว */
const KINDS = [
  { test: (t) => t.natural === "waterfall" || t.waterway === "waterfall", label: "น้ำตก", emoji: "💦", rank: 95 },
  { test: (t) => t.natural === "beach", label: "ชายหาด", emoji: "🏖️", rank: 94 },
  { test: (t) => t.boundary === "national_park", label: "อุทยานแห่งชาติ", emoji: "🌲", rank: 93 },
  { test: (t) => t.tourism === "viewpoint", label: "จุดชมวิว", emoji: "🌄", rank: 90 },
  { test: (t) => t.natural === "hot_spring", label: "น้ำพุร้อน", emoji: "♨️", rank: 88 },
  { test: (t) => t.natural === "cave_entrance", label: "ถ้ำ", emoji: "🕳️", rank: 86 },
  { test: (t) => t.tourism === "museum", label: "พิพิธภัณฑ์", emoji: "🏛️", rank: 85 },
  { test: (t) => t.amenity === "place_of_worship", label: "วัด", emoji: "🛕", rank: 84 },
  { test: (t) => t.historic === "archaeological_site" || t.historic === "ruins", label: "โบราณสถาน", emoji: "🏯", rank: 82 },
  { test: (t) => t.tourism === "theme_park", label: "สวนสนุก", emoji: "🎡", rank: 80 },
  { test: (t) => t.tourism === "zoo" || t.tourism === "aquarium", label: "สวนสัตว์/อควาเรียม", emoji: "🐘", rank: 78 },
  { test: (t) => t.natural === "peak", label: "ยอดเขา", emoji: "⛰️", rank: 76 },
  { test: (t) => t.leisure === "nature_reserve", label: "เขตอนุรักษ์", emoji: "🌿", rank: 74 },
  { test: (t) => t.tourism === "gallery", label: "แกลเลอรี", emoji: "🖼️", rank: 72 },
  { test: (t) => t.tourism === "attraction", label: "ที่เที่ยว", emoji: "📍", rank: 70 },
  { test: (t) => t.leisure === "park", label: "สวนสาธารณะ", emoji: "🌳", rank: 60 },
  { test: (t) => Boolean(t.historic), label: "ประวัติศาสตร์", emoji: "🏛️", rank: 65 },
];

function classify(row) {
  return KINDS.find((k) => k.test(row)) ?? null;
}

/**
 * ชื่อที่ไม่ควรเอาเข้ารายการ
 *
 * OSM มีสิ่งปลูกสร้างของชุมชนติดแท็กสวนสาธารณะหรือประวัติศาสตร์อยู่เยอะ
 * เช่น "ศาลาประชาคม หมู่ 4" ซึ่งไม่ใช่ที่ที่นักท่องเที่ยวจะไป
 */
const JUNK = /ศาลาประชาคม|ศาลาเอนกประสงค์|ศาลาอเนกประสงค์|หมู่ ?[0-9]|อบต[.]|เทศบาล|โรงเรียน|โรงพยาบาล|สถานีอนามัย|ที่ทำการ|สำนักงาน|ประปา|สหกรณ์|^ตู้|^ป้าย|ที่จอดรถ|ห้องน้ำ|จุดพัก|ลานกีฬา|สนามกีฬา|^คณะ|มหาวิทยาลัย|วิทยาลัย|^อาคาร|^น้ำพุร้อน$|^น้ำตก$|^ถ้ำ$|^วัด$|^เขื่อน$|^สวนสาธารณะ$|^เขตป่าสงวนแห่งชาติ$|^เขตรักษาพันธุ์สัตว์ป่า$|^ป่าชุมชน$|^อุทยานแห่งชาติ$|^จุดชมวิว$|^ศาลเจ้า$|^สุสาน$/;

function isWeakName(name) {
  const n = name.trim();
  if (n.length < 4) return true;
  // ชื่ออังกฤษล้วนมักซ้ำกับรายการภาษาไทยของที่เดียวกัน
  if (!/[฀-๿]/.test(n)) return true;
  if (/^(ศาลา|ป้าย|จุดชมวิว|ที่จอดรถ|ห้องน้ำ|ซุ้ม)$/.test(n)) return true;
  if (JUNK.test(n)) return true;
  return false;
}

const R = 6371000;
function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

(async () => {
  const rows = JSON.parse(fs.readFileSync(ATTRACTIONS, "utf8"));
  const boundaries = prepare(JSON.parse(fs.readFileSync(BOUNDARIES, "utf8")));
  console.log(`อ่านมา ${rows.length} แห่ง · ขอบเขต ${boundaries.length} จังหวัด`);

  const provinces = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
    .flatMap((f) => loadProvinceFile(f));
  const known = new Map(provinces.map((p) => [p.name, p]));

  const byProvince = new Map();
  let noProvince = 0;
  let weak = 0;
  let unclassified = 0;
  let duplicate = 0;

  for (const row of rows) {
    if (isWeakName(row.name)) {
      weak += 1;
      continue;
    }
    const kind = classify(row);
    if (!kind) {
      unclassified += 1;
      continue;
    }
    const province = provinceAt(boundaries, row.lng, row.lat);
    if (!province || !known.has(province)) {
      noProvince += 1;
      continue;
    }

    // ซ้ำกับที่คัดไว้แล้ว — เทียบทั้งชื่อและระยะห่าง เพราะชื่อสะกดต่างกันได้
    const curated = known.get(province).places;
    const same = curated.some(
      (p) =>
        p.name === row.name.trim() ||
        metres(p, { lat: row.lat, lng: row.lng }) < 200,
    );
    if (same) {
      duplicate += 1;
      continue;
    }

    if (!byProvince.has(province)) byProvince.set(province, []);
    byProvince.get(province).push({
      id: row.osmId,
      name: row.name.trim(),
      kind: kind.label,
      emoji: kind.emoji,
      lat: Number(row.lat.toFixed(5)),
      lng: Number(row.lng.toFixed(5)),
      notable: row.notable,
      rank: kind.rank + (row.notable ? 100 : 0),
    });
  }

  console.log(
    `ตัดออก — ชื่อใช้ไม่ได้ ${weak} · จัดประเภทไม่ได้ ${unclassified} · ` +
      `นอกเขตจังหวัด ${noProvince} · ซ้ำกับที่คัดไว้ ${duplicate}`,
  );

  const result = {};
  for (const [province, list] of byProvince) {
    // ชื่อซ้ำในจังหวัดเดียวกันเก็บอันเดียวพอ
    const seen = new Set();
    const unique = list.filter((p) => !seen.has(p.name) && seen.add(p.name));

    // จัดกลุ่มตามประเภทแล้วหยิบสลับกันไปทีละประเภท
    //
    // ถ้าเรียงตามคะแนนตรง ๆ หัวรายการจะเป็นประเภทเดียวกันยาวเป็นแถบ
    // เชียงใหม่เคยขึ้นอุทยานแห่งชาติติดกัน 8 รายการ ทั้งที่คนเปิดดู
    // อยากเห็นว่าจังหวัดนี้มีอะไรให้เลือกบ้าง ไม่ใช่มีอุทยานกี่แห่ง
    const groups = new Map();
    for (const item of unique.sort(
      (a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "th"),
    )) {
      if (!groups.has(item.kind)) groups.set(item.kind, []);
      groups.get(item.kind).push(item);
    }

    const picked = [];
    const queues = [...groups.values()];
    while (picked.length < MAX_PER_PROVINCE) {
      let added = false;
      for (const queue of queues) {
        if (queue.length === 0) continue;
        picked.push(queue.shift());
        added = true;
        if (picked.length >= MAX_PER_PROVINCE) break;
      }
      if (!added) break;
    }

    result[province] = picked.map(({ rank, ...keep }) => keep);
  }

  const counts = Object.values(result).map((l) => l.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const thin = Object.entries(result)
    .filter(([, l]) => l.length < 10)
    .map(([n, l]) => `${n} (${l.length})`);
  const missing = provinces
    .map((p) => p.name)
    .filter((n) => !result[n] || result[n].length === 0);

  console.log(
    `\nได้ ${total} แห่ง ใน ${Object.keys(result).length} จังหวัด ` +
      `(เฉลี่ย ${(total / Object.keys(result).length).toFixed(1)} ต่อจังหวัด)`,
  );
  if (missing.length) console.log(`ไม่มีเลย: ${missing.join(", ")}`);
  if (thin.length) console.log(`ได้น้อยกว่า 10: ${thin.join(", ")}`);

  const header = `/**
 * สถานที่ท่องเที่ยวจาก OpenStreetMap แบ่งเข้าจังหวัดด้วยขอบเขตการปกครองจริง
 *
 * สร้างด้วย scripts/build-attractions.js — อย่าแก้ด้วยมือ
 * ใช้เสริมจากสถานที่ที่คัดไว้เองใน src/data/provinces/ ซึ่งมีคำอธิบาย
 * เวลาที่ควรเผื่อ และค่าเข้าครบกว่า แต่มีแค่จังหวัดละ 4-8 แห่ง
 *
 * ชุดนี้ไม่มีคำอธิบายและค่าเข้า เพราะ OSM ไม่ได้เก็บไว้
 * และต้องเสิร์ฟผ่าน /api/places ไม่ import เข้า client component ตรง ๆ
 * ไม่งั้นจะติดไปกับ bundle ที่ผู้ใช้มือถือต้องโหลดทุกครั้ง
 */

export interface OsmPlace {
  id: string;
  name: string;
  /** ประเภทแบบอ่านง่าย เช่น น้ำตก วัด พิพิธภัณฑ์ */
  kind: string;
  emoji: string;
  lat: number;
  lng: number;
  /** มีหน้า Wikipedia หรือ Wikidata — ใช้เป็นสัญญาณว่าเป็นที่ที่คนรู้จัก */
  notable: boolean;
}

export const OSM_PLACES: Record<string, OsmPlace[]> = `;

  fs.writeFileSync(OUT, `${header}${JSON.stringify(result, null, 1)};\n`);
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`\nเขียน ${OUT} (${kb} KB)`);
})();
