/**
 * คัดตลาด/ถนนคนเดินที่ดึงมาจาก OSM แล้วยืนยันจังหวัดด้วย Nominatim
 *
 * ใช้: node scripts/pick-markets.js <markets.json> <picked.json>
 *
 * ต้องยืนยันจังหวัดทีละจุด เพราะ Overpass ค้นในกรอบสี่เหลี่ยมรอบศูนย์กลาง
 * จังหวัด ซึ่งกินพื้นที่จังหวัดข้างเคียงไปด้วย ถ้าไม่ยืนยันจะได้
 * "ถนนคนเดินพิษณุโลก" ไปโผล่ในสุโขทัย ซึ่งเป็นบั๊กเดียวกับที่กำลังแก้อยู่
 */
const fs = require("fs");
const path = require("path");

const IN = process.argv[2];
const OUT = process.argv[3] || "picked-markets.json";
const DIR = "src/data/provinces";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

const provinces = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
  .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

const PROVINCE_NAMES = provinces.map((p) => p.name.replace(/\s*\(.*\)/, ""));

/** ชื่อที่ไม่คุ้มใส่ในรายการแนะนำ — ตลาดสดในหมู่บ้านหรือชื่อร้านเดี่ยว ๆ */
function isWeak(name) {
  if (name.trim().length < 6) return true;
  if (/^ตลาดนัด$|^ตลาด$|^ตลาดสด/.test(name.trim())) return true;
  if (/^[A-Za-z0-9°.\s]+$/.test(name.trim())) return true;
  if (/ร้าน|โรงพยาบาล|ปั๊ม|หมู่บ้าน|สหกรณ์/.test(name)) return true;
  return false;
}

async function reverse(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=10&accept-language=th`;
  const res = await fetch(url, {
    headers: { "User-Agent": "travel-planner-data-build/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const a = (await res.json()).address ?? {};
  return a.province ?? a.state ?? a.city ?? a.county ?? "";
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(IN, "utf8"));
  const picked = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

  for (const province of provinces) {
    if (picked[province.id]) continue;
    const own = province.name.replace(/\s*\(.*\)/, "");
    const candidates = (raw[province.id] ?? [])
      .filter((row) => !isWeak(row.name))
      // ชื่อเอ่ยถึงจังหวัดอื่น = ไม่ใช่ของจังหวัดนี้แน่ ๆ ตัดทิ้งก่อนยิง API
      .filter(
        (row) =>
          !PROVINCE_NAMES.some((n) => n !== own && row.name.includes(n)),
      )
      .slice(0, 4);

    const confirmed = [];
    for (const row of candidates) {
      if (confirmed.length >= 2) break;
      try {
        const got = await reverse(row.lat, row.lng);
        if (got.includes(own) || own.includes(got)) {
          confirmed.push({ ...row, verified: got });
        }
      } catch (e) {
        console.log(`   ! ${row.name}: ${e.message}`);
      }
      await sleep(1100);
    }

    picked[province.id] = confirmed;
    fs.writeFileSync(OUT, JSON.stringify(picked, null, 1));
    console.log(
      `${province.name}: ${confirmed.length ? confirmed.map((c) => c.name).join(" / ") : "— ไม่พบที่ยืนยันได้ —"}`,
    );
  }

  const total = Object.values(picked).reduce((n, l) => n + l.length, 0);
  const empty = Object.entries(picked).filter(([, l]) => l.length === 0).length;
  console.log(`\nยืนยันได้ ${total} แห่ง · ไม่มีเลย ${empty} จังหวัด`);
})();
