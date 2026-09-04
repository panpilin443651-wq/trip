/**
 * ดึงขอบเขตอำเภอ (admin_level=6) ของทั้งประเทศจาก OpenStreetMap
 *
 * ใช้: node scripts/fetch-district-boundaries.js district-boundaries.json
 *
 * ทำไมต้องมี — ชุดข้อมูล osm-places.ts กับ osm-restaurants.ts รู้แค่ว่าอยู่
 * จังหวัดไหน ไม่รู้อำเภอ พอหน้าแนะนำเที่ยวให้เลือกอำเภอแล้วจึงกรองไม่ได้
 * มีไฟล์นี้แล้วเอาไปหาอำเภอของทุกจุดในเครื่องได้เลย ไม่ต้อง reverse geocode
 * ทีละจุดซึ่งจำกัด 1 คำขอ/วินาที (4,000 จุด = ชั่วโมงกว่า)
 *
 * ยิงทีละจังหวัด ไม่ยิงรวดเดียวทั้งประเทศ เพราะทั้งประเทศมี 928 อำเภอ
 * ประเมินจากเพชรบุรี (8 อำเภอ = 1.5 MB) แล้วรวดเดียวจะราว 170 MB
 * ซึ่งเสี่ยง timeout และเป็นภาระกับเซิร์ฟเวอร์สาธารณะเกินไป
 */
const fs = require("fs");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** ~33 เมตร เท่ากับที่ใช้กับขอบเขตจังหวัด หยาบกว่านี้อำเภอเล็ก ๆ จะเพี้ยน */
const SIMPLIFY_STEP = 0.0003;

/** เว้นระยะระหว่างจังหวัด Overpass ติด rate limit ง่ายมาก */
const DELAY_MS = 2500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, attempt = 0) {
  for (const mirror of MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: { "User-Agent": "travel-planner/1.0 (data build)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(180_000),
      });
      if (res.status === 429 || res.status === 504) continue;
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // ลองมิเรอร์ถัดไป
    }
  }
  if (attempt < 3) {
    const wait = 15_000 * (attempt + 1);
    console.log(`    ติดคิว รอ ${wait / 1000} วิแล้วลองใหม่…`);
    await sleep(wait);
    return overpass(query, attempt + 1);
  }
  return null;
}

/**
 * ลดจำนวนจุดโดยเก็บจุดที่ห่างจากจุดก่อนหน้าเกินระยะที่กำหนด
 * ปลายเส้นต้องเก็บไว้เสมอ ไม่งั้นเส้นขาดแล้ว ray casting นับผิด
 */
function simplify(points) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  for (const point of points.slice(1, -1)) {
    const last = out[out.length - 1];
    if (
      Math.abs(point[0] - last[0]) >= SIMPLIFY_STEP ||
      Math.abs(point[1] - last[1]) >= SIMPLIFY_STEP
    ) {
      out.push(point);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** แปลง relation ของ OSM เป็นรูปแบบที่ geo-districts.js ใช้ */
function toShape(rel, province) {
  const tags = rel.tags ?? {};
  const raw = tags["name:th"] || tags.name || "";
  if (!raw) return null;

  // เก็บเส้นย่อยแยกกัน ไม่ต้องต่อเป็นวง เพราะ ray casting ไม่สนลำดับ
  const rings = [];
  for (const member of rel.members ?? []) {
    if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
    if (member.role !== "outer" && member.role !== "") continue;
    const ring = simplify(member.geometry.map((g) => [g.lon, g.lat]));
    if (ring.length >= 3) rings.push(ring);
  }
  if (rings.length === 0) return null;

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  return {
    province,
    // OSM ใช้ "อำเภอบ้านแหลม" / "เขตบางรัก" ส่วน districts.ts เก็บชื่อเปล่า
    name: raw.replace(/^(อำเภอ|เขต)\s*/, "").trim(),
    bbox: [minLng, minLat, maxLng, maxLat],
    rings,
  };
}

(async () => {
  const outFile = process.argv[2];
  if (!outFile) {
    console.error("ใช้: node scripts/fetch-district-boundaries.js <ไฟล์ผลลัพธ์.json>");
    process.exit(1);
  }

  // ขั้นแรก — เอารายชื่อจังหวัดพร้อมรหัส ISO มาก่อน (เบา ขอแค่ tags)
  // ใช้รหัส ISO แทนชื่อเพราะชื่อจังหวัดใน OSM สะกดไม่ตรงกับในแอปหลายจังหวัด
  console.log("ขั้นที่ 1 — รายชื่อจังหวัดพร้อมรหัส ISO");
  const provinceData = await overpass(
    `[out:json][timeout:120];
rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^TH-"];
out tags;`,
  );
  if (!provinceData) {
    console.error("ดึงรายชื่อจังหวัดไม่สำเร็จ");
    process.exit(1);
  }

  const provinces = (provinceData.elements ?? [])
    .map((rel) => ({
      iso: rel.tags?.["ISO3166-2"] ?? "",
      name: (rel.tags?.["name:th"] || rel.tags?.name || "")
        .replace(/^จังหวัด/, "")
        .trim(),
    }))
    .filter((p) => p.iso && p.name);

  console.log(`  ได้ ${provinces.length} จังหวัด\n`);

  console.log("ขั้นที่ 2 — ขอบเขตอำเภอทีละจังหวัด");
  const districts = [];
  const failed = [];

  for (const [index, province] of provinces.entries()) {
    const data = await overpass(
      `[out:json][timeout:180];
area["ISO3166-2"="${province.iso}"][admin_level=4]->.p;
rel(area.p)["boundary"="administrative"]["admin_level"="6"];
out geom;`,
    );

    const rels = (data?.elements ?? []).filter((e) => e.type === "relation");
    const shapes = rels
      .map((rel) => toShape(rel, province.name))
      .filter(Boolean);

    if (shapes.length === 0) failed.push(province.name);
    districts.push(...shapes);

    const points = shapes.reduce(
      (n, s) => n + s.rings.reduce((m, r) => m + r.length, 0),
      0,
    );
    console.log(
      `  [${index + 1}/${provinces.length}] ${province.name}: ` +
        `${shapes.length} อำเภอ / ${points.toLocaleString()} จุด`,
    );

    if (index < provinces.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(outFile, JSON.stringify(districts));
  const size = fs.statSync(outFile).size;
  console.log(
    `\n✓ เขียน ${districts.length} อำเภอ ลง ${outFile} ` +
      `(${(size / 1048576).toFixed(1)} MB)`,
  );
  if (failed.length > 0) {
    console.log(`⚠️ ไม่ได้ข้อมูลของ ${failed.length} จังหวัด: ${failed.join(", ")}`);
  }
})();
