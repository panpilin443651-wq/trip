/**
 * ดึงสถานที่ท่องเที่ยวทั่วประเทศจาก OpenStreetMap
 *
 * ใช้: node scripts/fetch-attractions.js [ไฟล์ผลลัพธ์.json]
 *
 * ยิงทั้งประเทศทีเดียวต่อกลุ่มแท็ก ไม่ยิงรายจังหวัด เพราะยิง 77 ครั้ง
 * ติด rate limit ของ Overpass จนช้ามาก (เคยได้แค่ 8 จังหวัดใน 8 นาที)
 * ส่วนคำขอเดียวทั้งประเทศด้วยแท็กที่มีดัชนีคืนมาเป็นพันรายการได้สบาย
 *
 * ยังไม่แบ่งจังหวัดในขั้นนี้ ปล่อยให้ build-attractions.js ทำด้วยขอบเขตจริง
 */
const fs = require("fs");

const OUT = process.argv[2] || "attractions.json";
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
        signal: AbortSignal.timeout(600_000),
      });
      const text = await res.text();
      if (text.trim().startsWith("{")) return JSON.parse(text);
      console.log("  ", host.split("/")[2], res.status, text.slice(0, 100));
      if (res.status === 429) await sleep(20_000);
    } catch (e) {
      console.log("  ", host.split("/")[2], "ERR", String(e.message).slice(0, 60));
    }
  }
  if (attempt < 3) {
    console.log("   รอ 40 วินาทีแล้วลองใหม่ (ครั้งที่", attempt + 2, ")");
    await sleep(40_000);
    return overpass(query, attempt + 1);
  }
  throw new Error("Overpass ใช้ไม่ได้ทุก mirror");
}

/** แต่ละกลุ่มยิงแยกกัน เพราะรวมเป็นคำขอเดียวแล้ว Overpass มักหมดเวลา */
const GROUPS = [
  {
    label: "ที่เที่ยวหลัก",
    filters: [
      `["tourism"~"^(attraction|museum|viewpoint|theme_park|zoo|aquarium|gallery)$"]["name"]`,
    ],
  },
  {
    label: "ธรรมชาติ",
    filters: [
      `["natural"~"^(waterfall|beach|peak|cave_entrance|hot_spring)$"]["name"]`,
      `["waterway"="waterfall"]["name"]`,
    ],
  },
  {
    label: "ประวัติศาสตร์",
    filters: [`["historic"]["name"]`],
  },
  {
    label: "สวนและอุทยาน",
    filters: [
      `["leisure"~"^(park|nature_reserve)$"]["name"]`,
      `["boundary"="national_park"]["name"]`,
    ],
  },
  {
    // วัดในไทยมีเป็นหมื่น เอาเฉพาะที่มีคนเขียนถึงใน Wikipedia/Wikidata
    // ไม่งั้นรายการจะท่วมไปด้วยวัดประจำหมู่บ้านจนหาที่ดังไม่เจอ
    label: "วัดที่มีคนเขียนถึง",
    filters: [
      `["amenity"="place_of_worship"]["name"]["wikidata"]`,
      `["amenity"="place_of_worship"]["name"]["wikipedia"]`,
    ],
  },
];

/**
 * กรองด้วยขอบเขตประเทศไทย ไม่ใช่แค่กรอบสี่เหลี่ยม
 *
 * กรอบสี่เหลี่ยมกินพื้นที่เมียนมา ลาว กัมพูชา และมาเลเซียเข้ามาด้วย
 * พอเอาไปแบ่งเข้าจังหวัดทีหลังจะแยกไม่ออกว่าจุดอยู่ฝั่งไหนของชายแดน
 * (เคยได้ "มะลิวัลย์" ในเขตตะนาวศรีของเมียนมามาโผล่ในระนอง)
 * ยังใส่ bbox ไว้ด้วยเพราะช่วยให้ Overpass คัดผลได้เร็วขึ้นมาก
 */
function buildQuery(filters) {
  const body = filters
    .flatMap((f) => [
      `  node${f}(${TH})(area.th);`,
      `  way${f}(${TH})(area.th);`,
      `  relation${f}(${TH})(area.th);`,
    ])
    .join("\n");
  return (
    `[out:json][timeout:900];\n` +
    `area["ISO3166-1"="TH"][admin_level=2]->.th;\n` +
    `(\n${body}\n);\nout center tags;`
  );
}

(async () => {
  const rows = [];

  for (const group of GROUPS) {
    console.log(`\n[${group.label}]`);
    let data;
    try {
      data = await overpass(buildQuery(group.filters));
    } catch (e) {
      console.log(`   ! ข้ามกลุ่มนี้: ${e.message}`);
      continue;
    }

    const got = (data.elements ?? [])
      .map((el) => {
        const tags = el.tags ?? {};
        return {
          osmId: `${el.type[0]}${el.id}`,
          name: tags["name:th"] || tags.name || "",
          nameEn: tags["name:en"] ?? "",
          lat: el.lat ?? el.center?.lat,
          lng: el.lon ?? el.center?.lon,
          // เก็บแท็กที่ใช้จัดหมวดและจัดอันดับเท่านั้น
          tourism: tags.tourism ?? "",
          natural: tags.natural ?? "",
          historic: tags.historic ?? "",
          leisure: tags.leisure ?? "",
          amenity: tags.amenity ?? "",
          boundary: tags.boundary ?? "",
          notable: Boolean(tags.wikidata || tags.wikipedia),
        };
      })
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));

    console.log(`   ได้ ${got.length} แห่ง`);
    rows.push(...got);
    await sleep(5000);
  }

  // node/way/relation ของที่เดียวกันมักมาซ้ำ ตัดด้วยชื่อ + พิกัดหยาบ
  const seen = new Set();
  const unique = rows.filter((r) => {
    const key = `${r.name}@${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify(unique));
  console.log(
    `\nรวม ${unique.length} แห่ง (ตัดซ้ำจาก ${rows.length}) เขียนลง ${OUT}`,
  );
})();
