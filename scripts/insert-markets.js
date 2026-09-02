/**
 * รวมผลค้นตลาด/ถนนคนเดินจากสองทาง แล้วแทรกเข้าไฟล์ข้อมูลจังหวัด
 *
 * ใช้: node scripts/insert-markets.js <walking.json> <picked-markets.json>
 *
 * ลำดับความสำคัญ
 *   1. ผลจากการค้นชื่อประเภทตรง ๆ (ถนนคนเดิน/ตลาดน้ำ/ตลาดโต้รุ่ง) — ตรงที่คนไปเที่ยว
 *   2. ผลจากแท็ก amenity=marketplace เฉพาะที่เป็นตลาดนัด/ตลาดเก่า
 *      ตลาดสดประจำเมืองไม่เอา เพราะไม่ใช่ที่ที่คนไปเที่ยว
 * ทุกจุดผ่าน reverse geocode ยืนยันจังหวัดมาแล้วจากขั้นก่อนหน้า
 */
const fs = require("fs");
const path = require("path");

const WALKING = process.argv[2];
const PICKED = process.argv[3];
const DIR = "src/data/provinces";

function loadProvinceFile(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const body = src
    .replace(/^import[\s\S]*?;\s*$/m, "")
    .replace(/export const \w+: Province\[\] =/, "module.exports =");
  const module = { exports: null };
  new Function("module", body)(module);
  return module.exports;
}

const PRESET = {
  ถนนคนเดิน: {
    emoji: "🚶",
    tag: "ถนนคนเดิน",
    durationMin: 120,
    description: "ถนนคนเดินใจกลางเมือง มีของกิน งานฝีมือ และดนตรีเปิดหมวก",
    bestTime: "เย็นถึงค่ำ ราว 17:00–22:00 น.",
    tip: "เปิดเฉพาะบางวันในสัปดาห์ เช็กวันก่อนไปและเผื่อเวลาหาที่จอดรถ",
  },
  ตลาดน้ำ: {
    emoji: "🛶",
    tag: "ตลาดน้ำ",
    durationMin: 120,
    description: "ตลาดน้ำริมคลอง มีเรือขายของกินและของฝากตามริมน้ำ",
    bestTime: "เช้าถึงบ่าย คึกคักที่สุดวันเสาร์–อาทิตย์",
    tip: "หลายแห่งเปิดเฉพาะวันหยุด เช็กวันเปิดก่อนออกเดินทาง",
  },
  ไนท์บาซาร์: {
    emoji: "🌃",
    tag: "ตลาดกลางคืน",
    durationMin: 90,
    description: "ตลาดกลางคืน รวมของกินและของฝากไว้ในที่เดียว",
    bestTime: "ค่ำ ราว 18:00–23:00 น.",
    tip: "ไปช่วงหัวค่ำจะยังไม่แน่นและของยังครบ",
  },
  ตลาดโต้รุ่ง: {
    emoji: "🌃",
    tag: "ตลาดกลางคืน",
    durationMin: 75,
    description: "ตลาดโต้รุ่งของเมือง เปิดตั้งแต่ค่ำยันดึก เน้นของกิน",
    bestTime: "ค่ำเป็นต้นไป",
    tip: "ร้านส่วนใหญ่รับเงินสด และคนแน่นสุดช่วงสองทุ่ม",
  },
  ตลาดนัด: {
    emoji: "🛍️",
    tag: "ตลาดนัด",
    durationMin: 75,
    description: "ตลาดนัดประจำเมือง มีทั้งของกิน ของใช้ และของฝากพื้นถิ่น",
    bestTime: "ตามวันนัดของแต่ละแห่ง",
    tip: "ตลาดนัดเปิดเฉพาะบางวัน เช็กวันนัดก่อนไปจะไม่เสียเที่ยว",
  },
  ตลาดเก่า: {
    emoji: "🏮",
    tag: "ตลาดเก่า",
    durationMin: 90,
    description: "ตลาดเก่าในย่านชุมชนดั้งเดิม มีอาคารไม้และร้านรุ่นเก่าให้เดินชม",
    bestTime: "สาย ๆ ถึงบ่าย",
    tip: "หลายแห่งคึกคักเฉพาะวันหยุด วันธรรมดาอาจปิดหลายร้าน",
  },
};

/** ชื่อสั้นหรือกำกวมให้ต่อชื่อจังหวัด คนอ่านจะได้รู้ว่าที่ไหน */
function cleanName(name, kind, province) {
  let n = name.replace(/\s+/g, " ").trim();
  // ชื่อใน OSM บางแห่งพิมพ์ตกหล่น ตัดส่วนที่อ่านไม่ออกทิ้ง
  n = n.replace(/\s*เทศบ้นเทิง\s*/g, " ").trim();
  if (!n.includes(province) && n.replace(kind, "").trim().length < 4) {
    return `${kind}${province}`;
  }
  return n;
}

const provinces = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
  .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

const walking = JSON.parse(fs.readFileSync(WALKING, "utf8"));
const picked = JSON.parse(fs.readFileSync(PICKED, "utf8"));

const chosen = {};
for (const province of provinces) {
  const w = walking[province.id];
  if (w) {
    chosen[province.id] = { ...w, source: "ค้นชื่อประเภท" };
    continue;
  }
  const m = picked[province.id];
  if (!m) continue;
  const kind = /ตลาดน้ำ/.test(m.name)
    ? "ตลาดน้ำ"
    : /ถนนคนเดิน/.test(m.name)
      ? "ถนนคนเดิน"
      : /ไนท์|ตลาดโต้รุ่ง|กลางคืน/.test(m.name)
        ? "ตลาดโต้รุ่ง"
        : /ตลาดร้อยปี|ตลาดโบราณ|ตลาดเก่า|กาด/.test(m.name)
          ? "ตลาดเก่า"
          : /ตลาดนัด/.test(m.name)
            ? "ตลาดนัด"
            : null;
  // ตลาดสดประจำเมืองไม่ใช่ที่เที่ยว ข้ามไป
  if (!kind) continue;
  chosen[province.id] = { ...m, kind, source: "แท็ก marketplace" };
}

console.log(`จะเพิ่ม ${Object.keys(chosen).length} จังหวัด\n`);

let inserted = 0;
for (const file of [...new Set(provinces.map((p) => p.file))]) {
  const p = `${DIR}/${file}`;
  let lines = fs.readFileSync(p, "utf8").split("\n");
  let changed = false;

  for (const province of provinces.filter((x) => x.file === file)) {
    const item = chosen[province.id];
    if (!item) continue;

    const short = province.name.replace(/\s*\(.*\)/, "");
    const preset = PRESET[item.kind];
    const name = cleanName(item.name, item.kind, short);
    const id = `${province.id.slice(0, 3)}-market`;

    // หาอาร์เรย์ places ของจังหวัดนี้ แล้วแทรกก่อนวงเล็บปิด
    const at = lines.findIndex((l) => l.trim() === `name: "${province.name}",`);
    if (at === -1) {
      console.log(`  !! หา ${province.name} ไม่เจอ`);
      continue;
    }
    let open = at;
    while (open < lines.length && lines[open].trim() !== "places: [") open += 1;
    let close = open;
    let depth = 0;
    for (let i = open; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (t.endsWith("[")) depth += 1;
      if (t === "]," || t === "]") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }

    const block = [
      "      {",
      `        id: "${id}",`,
      `        name: "${name}",`,
      `        emoji: "${preset.emoji}",`,
      `        tag: "${preset.tag}",`,
      `        description: "${preset.description}",`,
      `        lat: ${item.lat},`,
      `        lng: ${item.lng},`,
      ...(item.district ? [`        district: "${item.district}",`] : []),
      `        durationMin: ${preset.durationMin},`,
      "        fee: 0,",
      `        bestTime: "${preset.bestTime}",`,
      `        tip: "${preset.tip}",`,
      "      },",
    ];

    lines.splice(close, 0, ...block);
    changed = true;
    inserted += 1;
    console.log(`  + ${short}: ${name} (${preset.tag})`);
  }

  if (changed) fs.writeFileSync(p, lines.join("\n"));
}

console.log(`\nแทรกไป ${inserted} รายการ`);
