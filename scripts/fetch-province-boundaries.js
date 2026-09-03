/**
 * ดึงรูปหลายเหลี่ยมขอบเขต 77 จังหวัดจาก OpenStreetMap เก็บไว้ใช้แบ่งจุดเข้าจังหวัด
 *
 * ใช้: node scripts/fetch-province-boundaries.js [ไฟล์ผลลัพธ์.json]
 *
 * มีขอบเขตแล้วจะเช็กได้ในเครื่องว่าพิกัดหนึ่งอยู่จังหวัดไหน โดยไม่ต้องยิง API
 * ทีละจุด ซึ่งเดิมต้อง reverse geocode 334 ครั้งใช้เวลา 6 นาที และทำกับ
 * หลายพันจุดไม่ไหว
 *
 * ลดจำนวนจุดของเส้นขอบลงก่อนเก็บ เพราะรายละเอียดระดับเมตรไม่จำเป็น
 * สำหรับงานบอกว่า "จุดนี้อยู่จังหวัดไหน" และไฟล์เต็มใหญ่หลายสิบเมกะไบต์
 */
const fs = require("fs");

const OUT = process.argv[2] || "province-boundaries.json";
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * เก็บจุดทุก ๆ ระยะนี้ (องศา) ราว 33 เมตร
 *
 * เคยตั้ง 0.005 (~550 ม.) แล้วขอบเขตจังหวัดเล็ก ๆ แถบชายฝั่งเพี้ยนจนจุดใน
 * จังหวัดตัวเองตกนอกเขต — สมุทรสงครามทั้งจังหวัดเหลือเส้นขอบแค่ 141 จุด
 */
const SIMPLIFY_STEP = 0.0003;

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
 * ลดจุดบนเส้นขอบ — เก็บจุดแรก จุดสุดท้าย และจุดที่ห่างจากจุดที่เก็บล่าสุด
 * เกินระยะที่ตั้งไว้ พอสำหรับบอกว่าอยู่ในหรือนอกรูป
 */
function simplify(points) {
  if (points.length <= 3) return points;
  const out = [points[0]];
  for (const p of points.slice(1, -1)) {
    const last = out[out.length - 1];
    if (
      Math.abs(p[0] - last[0]) > SIMPLIFY_STEP ||
      Math.abs(p[1] - last[1]) > SIMPLIFY_STEP
    ) {
      out.push(p);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

(async () => {
  // ISO3166-2 ขึ้นต้น TH- คือจังหวัดของไทย ใช้กรองแทนการเทียบชื่อ
  // ซึ่งสะกดไม่ตรงกันหลายจังหวัด
  const query = `[out:json][timeout:600];
rel["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^TH-"];
out geom;`;

  console.log("ดึงขอบเขตจังหวัด (ก้อนใหญ่ ใช้เวลาสักพัก)…");
  const data = await overpass(query);
  const rels = data.elements ?? [];
  console.log(`ได้ ${rels.length} จังหวัด`);

  const provinces = [];
  for (const rel of rels) {
    const tags = rel.tags ?? {};
    const name = tags["name:th"] || tags.name || "";
    if (!name) continue;

    // relation ของขอบเขตประกอบด้วยเส้นย่อยหลายสิบเส้นที่ต่อกันเป็นวง
    // เก็บไว้แยกเส้นแบบนี้ได้เลย ไม่ต้องต่อวงเอง เพราะ ray casting
    // ที่ scripts/geo-provinces.js ใช้ ไม่สนลำดับของเส้น ขอแค่ได้ขอบครบ
    const rings = [];
    for (const member of rel.members ?? []) {
      if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
      if (member.role !== "outer" && member.role !== "") continue;
      const ring = simplify(member.geometry.map((g) => [g.lon, g.lat]));
      if (ring.length >= 3) rings.push(ring);
    }
    if (rings.length === 0) continue;

    // กรอบสี่เหลี่ยมล้อมรูป ใช้คัดออกเร็ว ๆ ก่อนคำนวณ point-in-polygon
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }

    provinces.push({
      name: name.replace(/^จังหวัด/, "").trim(),
      iso: tags["ISO3166-2"] ?? "",
      bbox: [minLng, minLat, maxLng, maxLat],
      rings,
    });
    console.log(
      `  ${name}: ${rings.length} เส้น / ${rings.reduce((n, r) => n + r.length, 0)} จุด`,
    );
  }

  fs.writeFileSync(OUT, JSON.stringify(provinces));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\nเขียน ${provinces.length} จังหวัดลง ${OUT} (${mb} MB)`);
})();
