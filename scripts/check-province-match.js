/**
 * ตรวจว่าพิกัดของสถานที่แนะนำแต่ละจุดตกอยู่ในจังหวัดที่ระบุไว้จริงไหม
 * ด้วยการ reverse geocode กับ Nominatim แล้วเทียบชื่อจังหวัดที่ได้กลับมา
 *
 * ใช้: node scripts/check-province-match.js [ไฟล์ผลลัพธ์.json]
 * เก็บผลไว้ในไฟล์ json รันซ้ำจะข้ามจุดที่ตรวจไปแล้ว (Nominatim จำกัด 1 req/s)
 */
const fs = require("fs");
const path = require("path");

const DIR = "src/data/provinces";
const OUT = process.argv[2] || "province-check.json";
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

const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

/** ชื่อที่ Nominatim คืนมาต่างจากชื่อที่เราใช้ ถือว่าตรงกัน */
const ALIASES = {
  กรุงเทพมหานคร: ["กรุงเทพมหานคร", "Bangkok"],
  "ประจวบคีรีขันธ์ (หัวหิน)": ["ประจวบคีรีขันธ์"],
};

async function reverse(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=10&accept-language=th`;
  const res = await fetch(url, {
    headers: { "User-Agent": "travel-planner-data-check/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const a = data.address ?? {};
  return a.province ?? a.state ?? a.city ?? a.county ?? "";
}

(async () => {
  const targets = provinces.flatMap((province) =>
    province.places.map((place) => ({ province, place })),
  );
  console.log(`ตรวจ ${targets.length} จุด (ที่ยังไม่เคยตรวจ: ${
    targets.filter(({ place }) => !cache[place.id]).length
  })`);

  let done = 0;
  for (const { province, place } of targets) {
    done += 1;
    if (cache[place.id]) continue;
    try {
      const got = await reverse(place.lat, place.lng);
      cache[place.id] = { name: place.name, expect: province.name, got };
      fs.writeFileSync(OUT, JSON.stringify(cache, null, 1));
    } catch (err) {
      console.log(`  ! ${place.name}: ${err.message}`);
    }
    if (done % 25 === 0) console.log(`  …${done}/${targets.length}`);
    await sleep(1100);
  }

  console.log("\n=== พิกัดตกในจังหวัดอื่น ===");
  let bad = 0;
  for (const { province, place } of targets) {
    const row = cache[place.id];
    if (!row || !row.got) continue;
    const ok = (ALIASES[province.name] ?? [province.name]).some(
      (n) => row.got.includes(n) || n.includes(row.got),
    );
    if (!ok) {
      bad += 1;
      console.log(
        `  ${place.id}  ${place.name}\n      ระบุ: ${province.name}   จริง: ${row.got}   [${place.lat}, ${place.lng}]`,
      );
    }
  }
  console.log(bad ? `\nไม่ตรง ${bad} จุด` : "\nตรงทุกจุด");
})();
