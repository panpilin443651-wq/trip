/**
 * หาพิกัดละเอียดให้สถานที่ที่พิกัดถูกปัดเศษหยาบ
 *
 * ใช้: node scripts/refine-coords.js <ไฟล์ผลลัพธ์.json>
 *
 * ทศนิยม 1 ตำแหน่งคลาดเคลื่อนได้ราว 11 กม. ซึ่งพอจะเลยข้ามอำเภอหรือ
 * ข้ามจังหวัดไปเลย ทำให้หมุดบนแผนที่ผิดที่และรายการแนะนำดูไม่น่าเชื่อถือ
 *
 * ทุกพิกัดที่ได้ต้องผ่าน reverse geocode ยืนยันว่ายังอยู่ในจังหวัดเดิม
 * ไม่ผ่านก็ไม่แตะ ปล่อยของเดิมไว้แล้วรายงานให้ไปดูเอง
 */
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || "refined-coords.json";
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

function decimals(n) {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

async function search(q) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4` +
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
  return a.province ?? a.state ?? a.city ?? a.county ?? "";
}

/** ชื่อในข้อมูลมักมีวงเล็บขยายความ ซึ่งทำให้ค้นไม่เจอ */
function variants(place, province) {
  const bare = place.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const inside = place.name.match(/\(([^)]+)\)/)?.[1]?.trim();
  const list = [
    `${place.name} ${province}`,
    bare !== place.name ? `${bare} ${province}` : null,
    inside ? `${inside} ${province}` : null,
    place.district ? `${bare} ${place.district} ${province}` : null,
  ];
  return [...new Set(list.filter(Boolean))];
}

(async () => {
  const provinces = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
    .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

  const targets = [];
  for (const province of provinces) {
    for (const place of province.places) {
      if (Math.min(decimals(place.lat), decimals(place.lng)) <= 2) {
        targets.push({ province, place });
      }
    }
  }
  console.log(`ต้องหาพิกัดใหม่ ${targets.length} จุด\n`);

  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  let ok = 0;
  let fail = 0;

  for (const { province, place } of targets) {
    if (out[place.id]) {
      ok += 1;
      continue;
    }
    const want = province.name.replace(/\s*\(.*\)/, "");
    let found = null;

    for (const q of variants(place, want)) {
      if (found) break;
      let hits = [];
      try {
        hits = await search(q);
      } catch {
        /* ลองคำถัดไป */
      }
      await sleep(1100);

      for (const hit of hits) {
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        let got = "";
        try {
          got = await reverse(lat, lng);
        } catch {
          /* ข้าม */
        }
        await sleep(1100);
        if (got.includes(want)) {
          found = {
            lat: Number(lat.toFixed(4)),
            lng: Number(lng.toFixed(4)),
            province: got,
            label: hit.display_name.split(",").slice(0, 2).join(",").trim(),
            query: q,
          };
          break;
        }
      }
    }

    if (found) {
      ok += 1;
      out[place.id] = found;
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
      console.log(
        `✓ ${place.name} — ${want}  [${found.lat}, ${found.lng}]  ${found.label}`,
      );
    } else {
      fail += 1;
      console.log(`✗ ${place.name} — ${want}  (ยืนยันไม่ได้ ปล่อยของเดิมไว้)`);
    }
  }

  console.log(`\nได้พิกัดใหม่ ${ok} · ยืนยันไม่ได้ ${fail}`);
})();
