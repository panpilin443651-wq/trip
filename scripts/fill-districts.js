/**
 * เติมฟิลด์ district ให้ทุกสถานที่ใน src/data/provinces/*.ts
 * ด้วยการ reverse geocode พิกัดกับ Nominatim
 *
 * ใช้: node scripts/fill-districts.js src/data/provinces/north.ts
 * เติมเฉพาะรายการที่ยังไม่มี district (รันซ้ำได้ ไม่ยิงซ้ำของเดิม)
 */
const fs = require("fs");

const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").split("\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * รายชื่ออำเภอจริงของแต่ละจังหวัด ใช้ตรวจผลที่ได้จาก Nominatim
 * จำเป็นเพราะจุดที่อยู่ติดชายแดนมักคืนชื่อเขตปกครองของประเทศเพื่อนบ้านมา
 * เช่น บ้านรักไทย (แม่ฮ่องสอน) เคยได้ "จังหวัดล้างเค้อ" ของเมียนมา
 */
const districtSource = fs.readFileSync("src/data/districts.ts", "utf8");
const DISTRICTS = JSON.parse(
  districtSource.slice(
    districtSource.indexOf("{"),
    districtSource.lastIndexOf("};") + 1,
  ),
);

/** เก็บบล็อกสถานที่ที่ยังไม่มี district พร้อมพิกัดและบรรทัดที่จะแทรก */
const targets = [];
let provinceName = "";
let placeName = "";
let lat = null;
let lng = null;
let nameLine = -1;

lines.forEach((line, i) => {
  let m = /^    name: "(.+)",$/.exec(line);
  if (m) {
    provinceName = m[1];
    return;
  }
  m = /^        name: "(.+)",$/.exec(line);
  if (m) {
    placeName = m[1];
    nameLine = i;
    lat = lng = null;
    return;
  }
  m = /^        lat: ([\d.-]+),$/.exec(line);
  if (m) lat = Number(m[1]);
  m = /^        lng: ([\d.-]+),$/.exec(line);
  if (m) {
    lng = Number(m[1]);
    // มี district อยู่แล้วไม่ต้องยิงซ้ำ
    const hasDistrict = lines
      .slice(nameLine, i + 6)
      .some((l) => /^        district:/.test(l));
    if (!hasDistrict && lat !== null) {
      targets.push({ name: placeName, province: provinceName, lat, lng, afterLine: i });
    }
  }
});

(async () => {
  if (targets.length === 0) {
    console.log(file, "— ครบแล้ว ไม่มีอะไรต้องเติม");
    return;
  }
  console.log(file, "— ต้องเติม", targets.length, "รายการ");

  const results = new Map();
  let ok = 0;

  for (const t of targets) {
    const url =
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2" +
      `&lat=${t.lat}&lon=${t.lng}&zoom=10`;
    let district = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "travel-planner-data-build/1.0",
          "Accept-Language": "th",
        },
        signal: AbortSignal.timeout(15000),
      });
      const json = await res.json();
      const a = json.address ?? {};
      // county = อำเภอ, suburb = เขต (กรุงเทพฯ)
      district = a.county || a.suburb || a.city_district || "";
    } catch {
      district = "";
    }

    // ตัดคำนำหน้าออกให้ตรงกับรายชื่อใน districts.ts
    district = district.replace(/^(อำเภอ|เขต)\s*/, "").trim();

    // ต้องเป็นอำเภอของจังหวัดนั้นจริง ไม่งั้นทิ้ง
    const valid = DISTRICTS[t.province] ?? [];
    if (district && !valid.includes(district)) {
      console.log(`  (นอกจังหวัด ทิ้ง: ${district}) <- ${t.name}`);
      district = "";
    }

    if (district) ok += 1;
    results.set(t.afterLine, district);
    console.log(`  ${district || "(ไม่พบ)"}  <- ${t.name}`);
    await sleep(1200);
  }

  // แทรกจากล่างขึ้นบน เพื่อไม่ให้เลขบรรทัดขยับ
  const sorted = [...results.entries()].sort((a, b) => b[0] - a[0]);
  for (const [line, district] of sorted) {
    if (!district) continue;
    lines.splice(line + 1, 0, `        district: "${district}",`);
  }

  fs.writeFileSync(file, lines.join("\n"));
  console.log(`เติมสำเร็จ ${ok}/${targets.length}`);
})();
