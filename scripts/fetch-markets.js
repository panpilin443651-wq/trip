/**
 * ดึงตลาด ถนนคนเดิน และตลาดน้ำของแต่ละจังหวัดจาก OpenStreetMap (Overpass)
 *
 * ใช้: node scripts/fetch-markets.js [ไฟล์ผลลัพธ์.json]
 * เก็บผลไว้ในไฟล์ json รันซ้ำจะข้ามจังหวัดที่ดึงแล้ว
 *
 * ดึงจาก OSM แทนที่จะพิมพ์เอง เพราะได้ทั้งชื่อจริงและพิกัดจริงมาพร้อมกัน
 * การพิมพ์พิกัดเองเคยทำให้ได้เลขที่ผิดจังหวัดมาแล้ว
 */
const fs = require("fs");
const path = require("path");

const DIR = "src/data/provinces";
const OUT = process.argv[2] || "markets.json";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
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

async function overpass(query, attempt = 0) {
  for (const host of MIRRORS) {
    try {
      const res = await fetch(host, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "travel-planner-data-build/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180000),
      });
      const text = await res.text();
      if (text.trim().startsWith("{")) return JSON.parse(text);
      console.log("  ", host.split("/")[2], res.status, text.slice(0, 60));
      if (res.status === 429) await sleep(20000);
    } catch (e) {
      console.log("  ", host.split("/")[2], "ERR", e.message.slice(0, 50));
    }
  }
  if (attempt < 3) {
    console.log("   รอ 30 วินาทีแล้วลองใหม่ (ครั้งที่", attempt + 2, ")");
    await sleep(30000);
    return overpass(query, attempt + 1);
  }
  throw new Error("Overpass ใช้ไม่ได้ทุก mirror");
}

/**
 * ค้นในกรอบสี่เหลี่ยมรอบศูนย์กลางจังหวัดแทนการใช้ area ของเขตปกครอง
 * เพราะ area ต้องพึ่งชื่อที่ตรงเป๊ะ ซึ่งหลายจังหวัดใน OSM สะกดไม่เหมือนกัน
 * ผลที่ได้ต้องเอาไป reverse geocode ยืนยันจังหวัดอีกทีอยู่แล้ว
 */
function buildQuery(center, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = [
    (center.lat - dLat).toFixed(4),
    (center.lng - dLng).toFixed(4),
    (center.lat + dLat).toFixed(4),
    (center.lng + dLng).toFixed(4),
  ].join(",");

  return `[out:json][timeout:90];
(
  node["amenity"="marketplace"]["name"](${bbox});
  way["amenity"="marketplace"]["name"](${bbox});
  node["name"~"ตลาดน้ำ|ถนนคนเดิน|ไนท์บาซาร์|ไนท์มาร์เก็ต|กาดกองต้า|ตลาดโบราณ|ตลาดร้อยปี"](${bbox});
  way["name"~"ตลาดน้ำ|ถนนคนเดิน|ไนท์บาซาร์|ไนท์มาร์เก็ต|กาดกองต้า|ตลาดโบราณ|ตลาดร้อยปี"](${bbox});
);
out center tags 60;`;
}

/** ตลาดที่นักท่องเที่ยวสนใจมาก่อนตลาดสดทั่วไป */
function scoreName(name) {
  if (/ตลาดน้ำ/.test(name)) return 100;
  if (/ถนนคนเดิน/.test(name)) return 95;
  if (/ไนท์บาซาร์|ไนท์มาร์เก็ต|ตลาดกลางคืน/.test(name)) return 90;
  if (/ตลาดร้อยปี|ตลาดโบราณ|ตลาดเก่า|กาดกองต้า/.test(name)) return 85;
  if (/ตลาดนัด/.test(name)) return 70;
  if (/ตลาดโต้รุ่ง/.test(name)) return 65;
  if (/ตลาดสด/.test(name)) return 30;
  if (/ตลาด|กาด/.test(name)) return 50;
  return 10;
}

(async () => {
  const provinces = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts")
    .flatMap((f) => loadProvinceFile(f).map((p) => ({ ...p, file: f })));

  const cache = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, "utf8"))
    : {};

  for (const province of provinces) {
    if (cache[province.id]) continue;
    console.log(`${province.name}…`);
    try {
      const data = await overpass(buildQuery(province.center, 45));
      const rows = (data.elements ?? [])
        .map((el) => ({
          name: el.tags?.name ?? "",
          lat: el.lat ?? el.center?.lat,
          lng: el.lon ?? el.center?.lon,
          amenity: el.tags?.amenity ?? "",
          opening: el.tags?.opening_hours ?? "",
        }))
        .filter((r) => r.name && r.lat && r.lng)
        .map((r) => ({ ...r, score: scoreName(r.name) }))
        .sort((a, b) => b.score - a.score);

      // ตัดชื่อซ้ำ เก็บ 8 อันดับแรกไว้ให้เลือก
      const seen = new Set();
      cache[province.id] = rows
        .filter((r) => !seen.has(r.name) && seen.add(r.name))
        .slice(0, 8);

      console.log(
        `   ${cache[province.id].length} แห่ง: ${cache[province.id]
          .slice(0, 3)
          .map((r) => r.name)
          .join(" / ")}`,
      );
      fs.writeFileSync(OUT, JSON.stringify(cache, null, 1));
    } catch (e) {
      console.log(`   ! ${province.name}: ${e.message}`);
    }
    await sleep(8000);
  }

  const total = Object.values(cache).reduce((n, list) => n + list.length, 0);
  console.log(`\nได้ ${total} แห่ง จาก ${Object.keys(cache).length} จังหวัด`);
})();
