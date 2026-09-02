/**
 * เลือกตลาด/ถนนคนเดินให้จังหวัดที่ยังไม่มี แล้วสร้างบล็อกข้อมูลให้พร้อมวาง
 *
 * ใช้: node scripts/build-markets.js <markets-th.json> <ไฟล์ผลลัพธ์.json>
 *
 * ตัวเลือกมาจาก OpenStreetMap ทั้งชื่อและพิกัด แล้วต้องผ่าน reverse geocode
 * ยืนยันจังหวัดก่อนถึงจะใช้ ไม่งั้นตลาดของจังหวัดข้าง ๆ จะหลุดเข้ามา
 * ซึ่งเป็นบั๊กเดียวกับที่กำลังแก้อยู่พอดี
 */
const fs = require("fs");
const path = require("path");

const IN = process.argv[2];
const OUT = process.argv[3] || "picked-markets.json";
const DIR = "src/data/provinces";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "travel-planner-data-build/1.0" };

function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

const R = 6371;
function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ตลาดที่คนไปเที่ยวมาก่อนตลาดสดประจำหมู่บ้าน */
const KINDS = [
  {
    test: /ตลาดน้ำ/,
    score: 100,
    emoji: "🛶",
    tag: "ตลาดน้ำ",
    durationMin: 120,
    description: "ตลาดน้ำริมคลอง มีเรือขายของกินและของฝากตามริมน้ำ",
    bestTime: "เช้าถึงบ่าย ส่วนใหญ่คึกคักช่วงเสาร์–อาทิตย์",
    tip: "หลายแห่งเปิดเฉพาะวันหยุด เช็กวันเปิดก่อนออกเดินทาง",
  },
  {
    test: /ถนนคนเดิน|Walking Street/i,
    score: 95,
    emoji: "🚶",
    tag: "ถนนคนเดิน",
    durationMin: 120,
    description: "ถนนคนเดินใจกลางเมือง มีของกิน งานฝีมือ และดนตรีเปิดหมวก",
    bestTime: "เย็นถึงค่ำ ประมาณ 17:00–22:00 น.",
    tip: "เปิดเฉพาะบางวันในสัปดาห์ เช็กวันก่อนไป และเผื่อเวลาหาที่จอดรถ",
  },
  {
    test: /ไนท์บาซาร์|ไนท์มาร์เก็ต|ตลาดกลางคืน|ตลาดโต้รุ่ง/,
    score: 90,
    emoji: "🌃",
    tag: "ตลาดกลางคืน",
    durationMin: 90,
    description: "ตลาดกลางคืน รวมของกินและของฝากไว้ในที่เดียว",
    bestTime: "ค่ำ ประมาณ 18:00–23:00 น.",
    tip: "ไปช่วงหัวค่ำจะยังไม่แน่นและของยังครบ",
  },
  {
    test: /ตลาดร้อยปี|ตลาดโบราณ|ตลาดเก่า|กาดกองต้า/,
    score: 85,
    emoji: "🏮",
    tag: "ตลาดเก่า",
    durationMin: 90,
    description: "ตลาดเก่าในย่านชุมชนดั้งเดิม มีอาคารไม้และร้านรุ่นเก่าให้เดินชม",
    bestTime: "สาย ๆ ถึงบ่าย",
    tip: "หลายแห่งคึกคักเฉพาะวันหยุด วันธรรมดาอาจปิดหลายร้าน",
  },
  {
    test: /ตลาดนัด/,
    score: 70,
    emoji: "🛍️",
    tag: "ตลาดนัด",
    durationMin: 75,
    description: "ตลาดนัดประจำเมือง มีทั้งของกิน ของใช้ และของฝากพื้นถิ่น",
    bestTime: "ตามวันนัดของแต่ละแห่ง",
    tip: "ตลาดนัดเปิดเฉพาะบางวัน เช็กวันนัดก่อนไปจะไม่เสียเที่ยว",
  },
  {
    test: /ตลาด|กาด/,
    score: 50,
    emoji: "🧺",
    tag: "ตลาด",
    durationMin: 60,
    description: "ตลาดในตัวเมือง แวะหาของกินเช้าและของฝากพื้นถิ่นได้",
    bestTime: "เช้า ของสดและของกินครบที่สุด",
    tip: "พกเงินสดไปด้วย ร้านเล็ก ๆ หลายร้านยังไม่รับโอน",
  },
];

function kindOf(name) {
  return KINDS.find((k) => k.test.test(name)) ?? null;
}

function isWeak(name) {
  const n = name.trim();
  if (n.length < 7) return true;
  if (/^(ตลาดนัด|ตลาด|ตลาดสด|ตลาดเช้า|ตลาดเย็น)$/.test(n)) return true;
  if (/^[A-Za-z0-9°.\s'&-]+$/.test(n)) return true;
  if (/ร้าน|โรงพยาบาล|ปั๊ม|สหกรณ์|โรงเรียน|บริษัท|หจก|อบต|เทศบาลตำบล/.test(n))
    return true;
  return false;
}

/** id ที่ไม่ชนกับของเดิม สร้างจากรหัสจังหวัด */
function makeId(provinceId, index) {
  const short = provinceId.slice(0, 3);
  return `${short}-market-${index}`;
}

async function reverse(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10` +
    `&lat=${lat}&lon=${lng}&accept-language=th`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const a = (await res.json()).address ?? {};
  return {
    province: a.province ?? a.state ?? a.city ?? a.county ?? "",
    district: (a.county ?? a.city_district ?? a.suburb ?? "").replace(
      /^อำเภอ|^เขต/,
      "",
    ),
  };
}

(async () => {
  const all = JSON.parse(fs.readFileSync(IN, "utf8"));
  const provinces = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
    .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

  const MARKET_RE = /ตลาด|ถนนคนเดิน|ไนท์|กาด|บาซาร์|Walking/i;
  const need = provinces.filter(
    (p) => !p.places.some((pl) => MARKET_RE.test(pl.name) || MARKET_RE.test(pl.tag)),
  );
  console.log(`จังหวัดที่ยังไม่มีตลาด/ถนนคนเดิน: ${need.length}\n`);

  const picked = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

  for (const province of need) {
    if (picked[province.id]) continue;
    const want = province.name.replace(/\s*\(.*\)/, "");

    const candidates = all
      .filter((m) => !isWeak(m.name) && kindOf(m.name))
      .map((m) => ({ ...m, dist: haversine(m, province.center) }))
      .filter((m) => m.dist < 70)
      // ชื่อเอ่ยถึงจังหวัดอื่น = ของจังหวัดอื่นแน่ ๆ ตัดก่อนยิง API
      .filter((m) =>
        provinces.every(
          (p) =>
            p.name === province.name ||
            !m.name.includes(p.name.replace(/\s*\(.*\)/, "")),
        ),
      )
      .sort(
        (a, b) => kindOf(b.name).score - kindOf(a.name).score || a.dist - b.dist,
      )
      .slice(0, 6);

    let chosen = null;
    for (const c of candidates) {
      try {
        const got = await reverse(c.lat, c.lng);
        await sleep(1100);
        if (got.province.includes(want)) {
          chosen = { ...c, district: got.district };
          break;
        }
      } catch {
        await sleep(1100);
      }
    }

    picked[province.id] = chosen
      ? {
          ...chosen,
          lat: Number(chosen.lat.toFixed(4)),
          lng: Number(chosen.lng.toFixed(4)),
        }
      : null;
    fs.writeFileSync(OUT, JSON.stringify(picked, null, 1));
    console.log(
      `${province.name}: ${chosen ? `${chosen.name} (${chosen.district || "-"})` : "— ไม่พบที่ยืนยันได้ —"}`,
    );
  }

  // สร้างบล็อกข้อมูลพร้อมวาง
  const blocks = {};
  for (const province of provinces) {
    const m = picked[province.id];
    if (!m) continue;
    const kind = kindOf(m.name);
    blocks[province.id] = {
      file: province.file,
      block: {
        id: makeId(province.id, 1),
        name: m.name,
        emoji: kind.emoji,
        tag: kind.tag,
        description: kind.description,
        lat: m.lat,
        lng: m.lng,
        district: m.district || undefined,
        durationMin: kind.durationMin,
        fee: 0,
        bestTime: m.opening ? `เวลาเปิดตามป้าย: ${m.opening}` : kind.bestTime,
        tip: kind.tip,
      },
    };
  }
  fs.writeFileSync(OUT.replace(/\.json$/, "-blocks.json"), JSON.stringify(blocks, null, 1));
  const found = Object.keys(blocks).length;
  console.log(`\nสร้างบล็อกได้ ${found} จังหวัด · ไม่พบ ${need.length - found}`);
})();
