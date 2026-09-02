/**
 * ดึงตลาดและถนนคนเดินทั่วประเทศจาก OpenStreetMap ในคำขอเดียว
 *
 * ใช้: node scripts/fetch-markets-th.js [ไฟล์ผลลัพธ์.json]
 *
 * ยิงรายจังหวัด 77 ครั้งแล้วติด rate limit ของ Overpass จนช้ามาก
 * จึงยิงทีเดียวทั้งประเทศด้วยแท็กที่มีดัชนี (amenity/highway) แทน
 * แล้วค่อยมาแบ่งเข้าจังหวัดในเครื่อง
 */
const fs = require("fs");

const OUT = process.argv[2] || "markets-th.json";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TH = "5.5,97.3,20.5,105.7";

async function overpass(query, attempt = 0) {
  for (const host of MIRRORS) {
    try {
      console.log("  ยิงไปที่", host.split("/")[2], "…");
      const res = await fetch(host, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "travel-planner-data-build/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(300000),
      });
      const text = await res.text();
      if (text.trim().startsWith("{")) return JSON.parse(text);
      console.log("  ", host.split("/")[2], res.status, text.slice(0, 80));
      if (res.status === 429) await sleep(20000);
    } catch (e) {
      console.log("  ", host.split("/")[2], "ERR", e.message.slice(0, 60));
    }
  }
  if (attempt < 3) {
    console.log("   รอ 40 วินาทีแล้วลองใหม่ (ครั้งที่", attempt + 2, ")");
    await sleep(40000);
    return overpass(query, attempt + 1);
  }
  throw new Error("Overpass ใช้ไม่ได้ทุก mirror");
}

const QUERIES = [
  // ตลาดทุกแบบ รวมตลาดน้ำ ซึ่งส่วนใหญ่ติดแท็กนี้
  {
    label: "amenity=marketplace",
    q: `[out:json][timeout:300];
(
  node["amenity"="marketplace"]["name"](${TH});
  way["amenity"="marketplace"]["name"](${TH});
);
out center tags;`,
  },
  // ถนนคนเดินมักเป็นถนนคนเดินจริง ๆ ในผังถนน ไม่ได้ติดแท็กตลาด
  {
    label: "highway=pedestrian ชื่อมีถนนคนเดิน",
    q: `[out:json][timeout:300];
(
  way["highway"="pedestrian"]["name"~"ถนนคนเดิน|คนเดิน|Walking Street"](${TH});
  node["tourism"="attraction"]["name"~"ถนนคนเดิน|ตลาดน้ำ|ไนท์บาซาร์"](${TH});
  way["tourism"="attraction"]["name"~"ถนนคนเดิน|ตลาดน้ำ|ไนท์บาซาร์"](${TH});
);
out center tags;`,
  },
];

(async () => {
  const rows = [];
  for (const { label, q } of QUERIES) {
    console.log(`\n[${label}]`);
    const data = await overpass(q);
    const got = (data.elements ?? [])
      .map((el) => ({
        name: el.tags?.name ?? "",
        lat: el.lat ?? el.center?.lat,
        lng: el.lon ?? el.center?.lon,
        opening: el.tags?.opening_hours ?? "",
      }))
      .filter((r) => r.name && r.lat && r.lng);
    console.log(`   ได้ ${got.length} แห่ง`);
    rows.push(...got);
    await sleep(5000);
  }

  // ตัดชื่อ+พิกัดซ้ำ (way กับ node ของที่เดียวกันมักมาคู่)
  const seen = new Set();
  const unique = rows.filter((r) => {
    const key = `${r.name}@${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify(unique, null, 1));
  console.log(`\nรวม ${unique.length} แห่ง เขียนลง ${OUT}`);
})();
