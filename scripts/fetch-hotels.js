/**
 * ดึงโรงแรมและรีสอร์ตทั่วประเทศจาก OpenStreetMap
 *
 * ใช้: node scripts/fetch-hotels.js [ไฟล์ผลลัพธ์.json]
 *
 * เหตุผลและวิธีเหมือน fetch-restaurants.js ทุกอย่าง — ไทยมีที่พักใน OSM
 * เป็นหมื่นแห่ง ถ้าเอามาหมดรายการจะท่วมไปด้วยเกสต์เฮาส์ริมทางที่ไม่มีข้อมูลอะไรเลย
 * จึงยิงเฉพาะที่พักที่มีร่องรอยว่ามีตัวตนจริงจัง — มีเว็บ มีเบอร์โทร มีจำนวนดาว
 * หรือมีคนเขียนถึงใน Wikipedia/Wikidata
 *
 * ยิงทั้งประเทศทีเดียวต่อกลุ่ม ไม่ยิงรายจังหวัด เพราะ 77 คำขอติด rate limit
 * ยังไม่แบ่งจังหวัดในขั้นนี้ ปล่อยให้ build-hotels.js ทำด้วยขอบเขตจริง
 */
const fs = require("fs");

const OUT = process.argv[2] || "hotels.json";
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
 * เอาเฉพาะ tourism=hotel กับ resort
 *
 * ไม่เอา guest_house, hostel, motel เพราะผู้ใช้ขอ "โรงแรม/รีสอร์ตชื่อดัง"
 * และสามประเภทนั้นใน OSM ของไทยส่วนใหญ่เป็นที่พักเล็กที่ไม่มีข้อมูลอะไรเลย
 */
const GROUPS = [
  {
    label: "ที่พักที่มีคนเขียนถึง",
    filters: [
      `["tourism"~"^(hotel|resort)$"]["name"]["wikidata"]`,
      `["tourism"~"^(hotel|resort)$"]["name"]["wikipedia"]`,
    ],
  },
  {
    label: "ที่พักที่มีจำนวนดาว",
    filters: [`["tourism"~"^(hotel|resort)$"]["name"]["stars"]`],
  },
  {
    label: "ที่พักที่มีเว็บไซต์",
    filters: [
      `["tourism"~"^(hotel|resort)$"]["name"]["website"]`,
      `["tourism"~"^(hotel|resort)$"]["name"]["contact:website"]`,
    ],
  },
  {
    label: "ที่พักที่มีเบอร์โทร",
    filters: [
      `["tourism"~"^(hotel|resort)$"]["name"]["phone"]`,
      `["tourism"~"^(hotel|resort)$"]["name"]["contact:phone"]`,
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
          tourism: tags.tourism ?? "",
          // จำนวนดาวใน OSM เขียนได้หลายแบบ ("4", "4S", "4.5") เก็บดิบไว้ก่อน
          stars: tags.stars ?? "",
          hasWebsite: Boolean(tags.website || tags["contact:website"]),
          hasPhone: Boolean(tags.phone || tags["contact:phone"]),
          hasBreakfast: tags.breakfast === "yes",
          hasPool: tags["swimming_pool"] === "yes" || tags.leisure === "swimming_pool",
          notable: Boolean(tags.wikidata || tags.wikipedia),
        };
      })
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng));

    console.log(`   ได้ ${got.length} แห่ง`);
    rows.push(...got);
    await sleep(5000);
  }

  // ที่พักเดียวกันมักมาทั้งแบบ node และ way ตัดด้วยชื่อ + พิกัดหยาบ
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
