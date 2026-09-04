/**
 * ทดสอบปุ่มกรองหมวดในการ์ด "วัด ร้านดัง ที่พัก"
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-district-groups.mts
 *
 * เดิมพอเลือกอำเภอแล้วปุ่มส่วนใหญ่กดไม่ได้ เพราะชุดข้อมูลจำกัดจำนวนต่อจังหวัด
 * พอหารลงอำเภอจึงเหลือหมวดละศูนย์ ปุ่ม "วัด" ตาย 78% "โรงแรม" ตาย 76%
 * เทสต์นี้กันไม่ให้กลับไปเป็นแบบนั้นอีกโดยไม่มีใครรู้
 */
import { OSM_HOTELS } from "@/data/osm-hotels";
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";
import {
  ALL_GROUPS,
  byDistrict,
  groupCount,
  rowsInScope,
  type GroupedRow,
} from "@/lib/district-groups";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

interface Row extends GroupedRow {
  name: string;
  district: string;
}
const row = (name: string, district: string, group: string): Row => ({
  name,
  district,
  group,
});

const GROUPS = ["วัด", "ที่เที่ยว", "คาเฟ่", "ร้านอาหาร", "โรงแรม", "รีสอร์ต"];

console.log("\nยังไม่เลือกอำเภอ — ดูทั้งจังหวัด");
{
  const all = [row("ก", "เมือง", "วัด"), row("ข", "ชะอำ", "คาเฟ่")];
  const r = rowsInScope(all, byDistrict<Row>(""), ALL_GROUPS);
  check("ได้ทุกแถว", r.rows.length === 2);
  check("ไม่บอกว่าถอยไปทั้งจังหวัด", !r.wholeProvince);
  check("กรองหมวดได้", rowsInScope(all, byDistrict<Row>(""), "วัด").rows.length === 1);
}

console.log("\nเลือกอำเภอที่มีของในหมวดนั้น");
{
  const all = [
    row("วัดในเมือง", "เมือง", "วัด"),
    row("วัดที่ชะอำ", "ชะอำ", "วัด"),
    row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่"),
  ];
  const r = rowsInScope(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("ได้เฉพาะของอำเภอนั้น", r.rows.length === 1 && r.rows[0].name === "วัดที่ชะอำ");
  check("ไม่ถอยไปทั้งจังหวัด", !r.wholeProvince);
  check("นับตรงกับที่จะได้เห็น", groupCount(all, byDistrict<Row>("ชะอำ"), "วัด").count === 1);
  check("ไม่ติดป้ายทั้งจังหวัด", !groupCount(all, byDistrict<Row>("ชะอำ"), "วัด").wide);
}

console.log("\nเลือกอำเภอที่ไม่มีของในหมวดนั้น — ต้องถอยไปทั้งจังหวัด");
{
  const all = [
    row("วัดในเมือง", "เมือง", "วัด"),
    row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่"),
  ];
  const r = rowsInScope(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("ยังได้รายการมาแสดง ไม่ใช่หน้าจอว่าง", r.rows.length === 1);
  check("บอกว่ากำลังดูทั้งจังหวัด", r.wholeProvince);

  const c = groupCount(all, byDistrict<Row>("ชะอำ"), "วัด");
  // ปุ่มต้องไม่บอกว่า 0 แล้วกดไปเจอรายการ
  check("ปุ่มบอกจำนวนที่จะได้เห็นจริง", c.count === 1 && c.wide);
}

console.log("\nไม่มีของในหมวดนั้นเลยทั้งจังหวัด");
{
  const all = [row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่")];
  const r = rowsInScope(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("ได้รายการว่าง", r.rows.length === 0);
  // ทั้งจังหวัดก็ว่าง บอกว่า "แสดงทั้งจังหวัดแทน" ไปก็สับสนเปล่า ๆ
  check("ไม่ขึ้นหมายเหตุว่าถอยไปทั้งจังหวัด", !r.wholeProvince);
  check("ปุ่มนับเป็น 0 (กดไม่ได้ถูกแล้ว)", groupCount(all, byDistrict<Row>("ชะอำ"), "วัด").count === 0);
}

console.log("\nแถวที่ไม่รู้อำเภอ");
{
  const all = [row("ไม่รู้อำเภอ", "", "วัด"), row("วัดชะอำ", "ชะอำ", "วัด")];
  check(
    "ไม่ถูกนับเข้าอำเภอใดอำเภอหนึ่ง",
    rowsInScope(all, byDistrict<Row>("ชะอำ"), "วัด").rows.length === 1,
  );
  check("แต่ยังเห็นตอนดูทั้งจังหวัด", rowsInScope(all, byDistrict<Row>(""), "วัด").rows.length === 2);
}

console.log("\nวัดกับข้อมูลจริงทั้งประเทศ");
{
  interface RealRow extends GroupedRow {
    district: string;
  }
  const rowsOf = (prov: string): RealRow[] => [
    ...(OSM_PLACES[prov] ?? []).map((p) => ({
      district: p.district,
      group: p.kind === "วัด" ? "วัด" : "ที่เที่ยว",
    })),
    ...(OSM_RESTAURANTS[prov] ?? []).map((f) => ({
      district: f.district,
      group: f.kind === "คาเฟ่" ? "คาเฟ่" : "ร้านอาหาร",
    })),
    ...(OSM_HOTELS[prov] ?? []).map((h) => ({
      district: h.district,
      group: h.kind === "รีสอร์ต" ? "รีสอร์ต" : "โรงแรม",
    })),
  ];

  let buttons = 0;
  let dead = 0;
  let deadTemple = 0;
  let deadHotel = 0;
  let templeButtons = 0;
  let hotelButtons = 0;
  let lying = 0;

  for (const prov of Object.keys(OSM_PLACES)) {
    const all = rowsOf(prov);
    const districts = [...new Set(all.map((r) => r.district).filter(Boolean))];
    for (const d of districts) {
      for (const g of GROUPS) {
        buttons += 1;
        const { count, wide } = groupCount(all, byDistrict<RealRow>(d), g);
        const shown = rowsInScope(all, byDistrict<RealRow>(d), g).rows.length;
        // ตัวเลขบนปุ่มต้องเท่ากับจำนวนที่กดแล้วได้เห็นจริงเสมอ
        if (count !== shown) lying += 1;
        if (count === 0) {
          dead += 1;
          if (g === "วัด") deadTemple += 1;
          if (g === "โรงแรม") deadHotel += 1;
        }
        if (g === "วัด") templeButtons += 1;
        if (g === "โรงแรม") hotelButtons += 1;
        if (wide && shown === 0) lying += 1;
      }
    }
  }

  const pct = (n: number, of: number) => (n / of) * 100;
  check(`ตัวเลขบนปุ่มตรงกับรายการที่ได้เห็นทุกปุ่ม (${buttons} ปุ่ม)`, lying === 0, `ผิด ${lying}`);
  check(
    `ปุ่มที่กดไม่ได้เหลือน้อยกว่า 15% (${pct(dead, buttons).toFixed(1)}%)`,
    pct(dead, buttons) < 15,
  );
  check(
    `ปุ่ม "วัด" ที่กดไม่ได้เหลือน้อยกว่า 25% (เดิม 78%, ตอนนี้ ${pct(deadTemple, templeButtons).toFixed(1)}%)`,
    pct(deadTemple, templeButtons) < 25,
  );
  check(
    `ปุ่ม "โรงแรม" ที่กดไม่ได้เหลือน้อยกว่า 10% (เดิม 76%, ตอนนี้ ${pct(deadHotel, hotelButtons).toFixed(1)}%)`,
    pct(deadHotel, hotelButtons) < 10,
  );
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
