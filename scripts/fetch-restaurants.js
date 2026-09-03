/**
 * ดึงร้านอาหารและคาเฟ่ทั่วประเทศจาก OpenStreetMap
 *
 * ใช้: node scripts/fetch-restaurants.js [ไฟล์ผลลัพธ์.json]
 *
 * ไทยมีร้านอาหารใน OSM เป็นหลายหมื่นแห่ง ถ้าเอามาหมดรายการจะท่วมไปด้วย
 * ร้านข้าวแกงข้างทางจนหาร้านที่ตั้งใจไปกินไม่เจอ จึงยิงเฉพาะร้านที่มีร่องรอย
 * ว่าเป็นร้านที่มีตัวตนจริงจัง — มีเว็บ มีเบอร์โทร มีเวลาเปิดปิด หรือมีคนเขียนถึง
 * ใน Wikipedia/Wikidata
 *
 * ยิงทั้งประเทศทีเดียวต่อกลุ่ม ไม่ยิงรายจังหวัด เพราะ 77 คำขอติด rate limit
 * ของ Overpass (เหตุผลเดียวกับ fetch-attractions.js)
 *
 * ยังไม่แบ่งจังหวัดในขั้นนี้ ปล่อยให้ build-restaurants.js ทำด้วยขอบเขตจริง
 */
const fs = require("fs");

const OUT = process.argv[2] || "restaurants.json";
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

/**
 * แต่ละกลุ่มยิงแยกกัน เพราะรวมเป็นคำขอเดียวแล้ว Overpass มักหมดเวลา
 *
 * เงื่อนไขคัดร้านอยู่ในตัว filter เลย ไม่ได้ดึงมาหมดแล้วค่อยกรองในเครื่อง
 * เพราะดึงหมดคือหลายแสนรายการ ซึ่ง Overpass จะตัดกลางคันก่อน
 */
const GROUPS = [
  {
    label: "ร้านที่มีคนเขียนถึง",
    filters: [
      `["amenity"~"^(restaurant|cafe)$"]["name"]["wikidata"]`,
      `["amenity"~"^(restaurant|cafe)$"]["name"]["wikipedia"]`,
    ],
  },
  {
    label: "ร้านที่มีเว็บไซต์",
    filters: [
      `["amenity"~"^(restaurant|cafe)$"]["name"]["website"]`,
      `["amenity"~"^(restaurant|cafe)$"]["name"]["contact:website"]`,
    ],
  },
  {
    label: "คาเฟ่ที่บอกเวลาเปิดปิด",
    filters: [`["amenity"="cafe"]["name"]["opening_hours"]`],
  },
  {
    label: "ร้านอาหารที่บอกเวลาเปิดปิดและประเภทอาหาร",
    filters: [
      `["amenity"="restaurant"]["name"]["opening_hours"]["cuisine"]`,
    ],
  },
];

/**
 * กรองด้วยขอบเขตประเทศไทย ไม่ใช่แค่กรอบสี่เหลี่ยม
 * กรอบสี่เหลี่ยมกินพื้นที่เมียนมา ลาว กัมพูชา และมาเลเซียเข้ามาด้วย
 */
function buildQuery(filters) {
  const body = filters
    .flatMap((f) => [
      `  node${f}(${TH})(area.th);`,
      `  way${f}(${TH})(area.th);`,
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
          amenity: tags.amenity ?? "",
          cuisine: tags.cuisine ?? "",
          openingHours: tags.opening_hours ?? "",
          hasWebsite: Boolean(tags.website || tags["contact:website"]),
          hasPhone: Boolean(tags.phone || tags["contact:phone"]),
          outdoor: tags.outdoor_seating === "yes",
          vegetarian: tags["diet:vegetarian"] === "yes",
          notable: Boolean(tags.wikidata || tags.wikipedia),
        };
      })
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));

    console.log(`   ได้ ${got.length} ร้าน`);
    rows.push(...got);
    await sleep(5000);
  }

  // ร้านเดียวกันมักมาทั้งแบบ node และ way ตัดด้วยชื่อ + พิกัดหยาบ
  const seen = new Set();
  const unique = rows.filter((r) => {
    const key = `${r.name}@${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT, JSON.stringify(unique));
  console.log(
    `\nรวม ${unique.length} ร้าน (ตัดซ้ำจาก ${rows.length}) เขียนลง ${OUT}`,
  );
})();
