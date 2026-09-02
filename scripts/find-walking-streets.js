/**
 * ค้นถนนคนเดิน ตลาดน้ำ และตลาดกลางคืนของแต่ละจังหวัดแบบเจาะจงชื่อ
 *
 * ใช้: node scripts/find-walking-streets.js <ไฟล์ผลลัพธ์.json>
 *
 * ดึงจากแท็ก amenity=marketplace อย่างเดียวได้ตลาดสดประจำเมืองมาเยอะ
 * ซึ่งไม่ใช่ที่ที่คนไปเที่ยว จึงค้นด้วยชื่อประเภทที่ต้องการตรง ๆ อีกทาง
 * ทุกผลต้องผ่าน reverse geocode ยืนยันจังหวัดก่อนใช้
 */
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || "walking-streets.json";
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

/** เรียงตามความน่าไปเที่ยว ถนนคนเดินกับตลาดน้ำมาก่อน */
const KINDS = ["ถนนคนเดิน", "ตลาดน้ำ", "ไนท์บาซาร์", "ตลาดโต้รุ่ง", "กาดกองต้า"];

async function search(q) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3` +
    `&countrycodes=th&accept-language=th&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const provinces = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
    .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

  const MARKET_RE = /ตลาด|ถนนคนเดิน|ไนท์|กาด|บาซาร์|Walking/i;
  const need = provinces.filter(
    (p) =>
      !p.places.some((pl) => MARKET_RE.test(pl.name) || MARKET_RE.test(pl.tag)),
  );
  console.log(`ค้นให้ ${need.length} จังหวัด\n`);

  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

  for (const province of need) {
    if (out[province.id] !== undefined) continue;
    const want = province.name.replace(/\s*\(.*\)/, "");
    let chosen = null;

    for (const kind of KINDS) {
      if (chosen) break;
      let hits = [];
      try {
        hits = await search(`${kind} ${want}`);
      } catch {
        /* ลองประเภทถัดไป */
      }
      await sleep(1100);

      for (const hit of hits) {
        const name = (hit.name || hit.display_name.split(",")[0]).trim();
        // ผลที่ไม่มีคำว่าประเภทที่ค้นอยู่ในชื่อ มักเป็นที่อื่นที่พ้องเสียง
        if (!name.includes(kind)) continue;
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        let got = { province: "", district: "" };
        try {
          got = await reverse(lat, lng);
        } catch {
          /* ข้าม */
        }
        await sleep(1100);
        if (got.province.includes(want)) {
          chosen = {
            name,
            kind,
            lat: Number(lat.toFixed(4)),
            lng: Number(lng.toFixed(4)),
            district: got.district,
          };
          break;
        }
      }
    }

    out[province.id] = chosen;
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(
      `${province.name}: ${chosen ? `${chosen.name} [${chosen.kind}] (${chosen.district || "-"})` : "—"}`,
    );
  }

  const found = Object.values(out).filter(Boolean).length;
  console.log(`\nยืนยันได้ ${found}/${need.length} จังหวัด`);
})();
