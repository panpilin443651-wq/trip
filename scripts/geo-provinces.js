/**
 * บอกว่าพิกัดหนึ่งอยู่จังหวัดไหน จากขอบเขตที่ดึงไว้ด้วย
 * scripts/fetch-province-boundaries.js
 *
 * ใช้แทนการ reverse geocode ทีละจุด ซึ่งช้าเกินไปเมื่อมีหลายพันจุด
 */

/**
 * จุดอยู่ในเขตของจังหวัดไหม — ray casting บนเส้นขอบทุกเส้นรวมกัน
 *
 * ขอบเขตจังหวัดใน OSM เก็บเป็นเส้นย่อยหลายสิบเส้นที่ต่อกันเป็นวง
 * ray casting ไม่สนลำดับของเส้น ขอแค่ได้เส้นขอบครบทุกช่วง เพราะมันนับแค่ว่า
 * รังสีที่ยิงออกไปตัดขอบกี่ครั้ง เลขคี่คืออยู่ข้างใน
 *
 * ที่ต้องระวังคือห้ามลากเส้นปิดจากปลายกลับมาหัวของแต่ละเส้นย่อย
 * เพราะเส้นย่อยเส้นเดียวไม่ได้ล้อมพื้นที่อะไร การปิดให้เองจะเพิ่มขอบปลอม
 * แล้วผลนับผิดทั้งหมด (ลองมาแล้ว 207 จาก 364 จุดตกนอกจังหวัดหมด)
 */
function inProvince(lng, lat, ways) {
  let inside = false;
  for (const way of ways) {
    for (let i = 1; i < way.length; i += 1) {
      const [x1, y1] = way[i - 1];
      const [x2, y2] = way[i];
      if (y1 > lat !== y2 > lat) {
        const x = x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1);
        if (lng < x) inside = !inside;
      }
    }
  }
  return inside;
}

/** เตรียมข้อมูลจังหวัด — คำนวณกรอบสี่เหลี่ยมไว้คัดออกเร็ว ๆ ก่อนคำนวณจริง */
function prepare(rawProvinces) {
  return rawProvinces.map((p) => ({
    name: p.name,
    iso: p.iso,
    bbox: p.bbox,
    ways: p.rings,
  }));
}

/** ระยะกำลังสองจากจุดไปยังส่วนของเส้นตรง (องศา ไม่ต้องแปลงเป็นเมตร) */
function distToSegment2(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const ex = x1 + t * dx - px;
  const ey = y1 + t * dy - py;
  return ex * ex + ey * ey;
}

/** ระยะจากจุดไปยังเส้นขอบที่ใกล้ที่สุดของจังหวัดนั้น */
function distToBoundary2(lng, lat, ways) {
  let best = Infinity;
  for (const way of ways) {
    for (let i = 1; i < way.length; i += 1) {
      const d = distToSegment2(lng, lat, way[i - 1][0], way[i - 1][1], way[i][0], way[i][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * ชื่อจังหวัดของพิกัดนี้ คืน null ถ้าหาไม่ได้จริง ๆ
 *
 * ปกติใช้ ray casting ซึ่งแม่นเมื่อเส้นขอบปิดเป็นวง แต่จังหวัดชายทะเลใน OSM
 * มักไม่ได้เอาแนวชายฝั่งมาเป็นสมาชิกของ relation ขอบเขตจึงเปิดอยู่ด้านทะเล
 * ทำให้นับรอบตัดผิดทั้งจังหวัด (เจอครบทั้งสมุทรสงคราม สมุทรสาคร ระยอง
 * เพชรบุรี ประจวบฯ สงขลา ปัตตานี นราธิวาส)
 *
 * กรณีนั้นถอยมาใช้วิธีสำรอง — เลือกจังหวัดที่กรอบสี่เหลี่ยมครอบจุดนี้อยู่
 * และมีเส้นขอบใกล้จุดที่สุด ซึ่งได้ผลดีกับจุดชายฝั่งที่อยู่ติดขอบจังหวัดตัวเอง
 */
function provinceAt(prepared, lng, lat) {
  const inBox = [];
  for (const province of prepared) {
    const [minLng, minLat, maxLng, maxLat] = province.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (inProvince(lng, lat, province.ways)) return province.name;
    inBox.push(province);
  }

  if (inBox.length === 0) return null;

  let best = null;
  let bestDist = Infinity;
  for (const province of inBox) {
    const d = distToBoundary2(lng, lat, province.ways);
    if (d < bestDist) {
      bestDist = d;
      best = province.name;
    }
  }
  return best;
}

module.exports = { prepare, provinceAt, inProvince };
