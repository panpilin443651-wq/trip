/**
 * บอกว่าพิกัดหนึ่งอยู่อำเภอไหน จากขอบเขตที่ดึงไว้ด้วย
 * scripts/fetch-district-boundaries.js
 *
 * ใช้เครื่องคำนวณตัวเดียวกับ geo-provinces.js ทั้งหมด (ray casting + วิธีสำรอง
 * เลือกขอบที่ใกล้ที่สุด) ไม่ได้เขียนใหม่ เพราะอัลกอริทึมไม่ผูกกับว่าเป็น
 * จังหวัดหรืออำเภอ ขอแค่ได้เส้นขอบมาเป็นชุด ๆ
 *
 * ต่างกันที่ตรงนี้ "แคบวงก่อน" — หาอำเภอเฉพาะในจังหวัดที่รู้อยู่แล้วเท่านั้น
 * ได้ประโยชน์สองต่อ
 *   1. เร็วขึ้นมาก เทียบกับไล่ทั้ง 928 อำเภอทุกจุด
 *   2. วิธีสำรองปลอดภัยขึ้น — ถ้าจุดตกนอกทุกอำเภอ (เกิดกับจุดริมทะเลที่
 *      เส้นขอบใน OSM ไม่ปิดวง) การเลือกอำเภอที่ขอบใกล้สุด "ภายในจังหวัดเดิม"
 *      อย่างมากก็ได้อำเภอข้างเคียงที่ถูกจังหวัด ไม่หลุดไปคนละภาค
 */
const { prepare, provinceAt, inProvince } = require("./geo-provinces.js");

/**
 * จัดขอบเขตอำเภอเป็นกลุ่มตามจังหวัด แล้วเตรียมให้พร้อมคำนวณ
 *
 * @param rawDistricts ผลจาก fetch-district-boundaries.js — [{province, name, bbox, rings}]
 * @returns Map จังหวัด -> รายการอำเภอที่เตรียมแล้ว
 */
function prepareByProvince(rawDistricts) {
  const grouped = new Map();
  for (const district of rawDistricts) {
    if (!grouped.has(district.province)) grouped.set(district.province, []);
    grouped.get(district.province).push(district);
  }

  const out = new Map();
  for (const [province, list] of grouped) out.set(province, prepare(list));
  return out;
}

/**
 * หาอำเภอของพิกัด — ต้องรู้จังหวัดมาก่อน
 *
 * คืน null ถ้าจังหวัดนั้นไม่มีข้อมูลขอบเขต ผู้เรียกควรปล่อยให้ฟิลด์อำเภอว่างไว้
 * ดีกว่าเดามั่ว เพราะหน้าเว็บกรองด้วยชื่ออำเภอแบบตรงตัว
 */
function districtAt(byProvince, province, lng, lat) {
  const districts = byProvince.get(province);
  if (!districts || districts.length === 0) return null;
  return provinceAt(districts, lng, lat);
}

/**
 * หาว่าพิกัดตกอยู่ในอำเภอไหนของทั้งประเทศ แบบ "อยู่ในรูปจริงเท่านั้น"
 *
 * ไม่มีวิธีสำรองแบบเลือกขอบที่ใกล้ที่สุด เพราะตัวนี้ใช้ตอนสงสัยว่าจังหวัดเดิม
 * ผิด การเดาด้วยระยะทางข้ามจังหวัดจะยิ่งพาไปผิดที่ ถ้าไม่แน่ก็ควรตอบว่าไม่รู้
 *
 * @returns {{province: string, district: string} | null}
 */
function strictLookup(byProvince, lng, lat) {
  for (const [province, districts] of byProvince) {
    for (const district of districts) {
      const [minLng, minLat, maxLng, maxLat] = district.bbox;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (inProvince(lng, lat, district.ways)) {
        return { province, district: district.name };
      }
    }
  }
  return null;
}

module.exports = { prepareByProvince, districtAt, strictLookup };
