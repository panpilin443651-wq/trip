/**
 * ทดสอบการกรองตามหมวดและขอบเขตที่แคบกว่าจังหวัด
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-district-groups.mts
 *
 * เคยถอยไปทั้งจังหวัดให้อัตโนมัติเมื่ออำเภอที่เลือกไม่มีของในหมวดนั้น
 * เพราะกลัวปุ่มกรองตาย แต่ผลคือผู้ใช้เลือกอำเภอแล้วยังได้รายการทั้งจังหวัด
 * เกือบทุกครั้ง (วัด 78% โรงแรม 76%) จนรู้สึกว่าเลือกอำเภอไปก็ไม่มีผลอะไร
 *
 * ตอนนี้กรองตามที่เลือกจริง ๆ เทสต์นี้กันไม่ให้กลับไปถอยเองเงียบ ๆ อีก
 */
import { OSM_HOTELS } from "@/data/osm-hotels";
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";
import {
  ALL_GROUPS,
  byDistrict,
  groupCounts,
  scopedRows,
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
  check("ได้ทุกแถว", scopedRows(all, byDistrict<Row>(""), ALL_GROUPS).length === 2);
  check("กรองหมวดได้", scopedRows(all, byDistrict<Row>(""), "วัด").length === 1);
}

console.log("\nเลือกอำเภอแล้วต้องกรองจริง");
{
  const all = [
    row("วัดในเมือง", "เมือง", "วัด"),
    row("วัดที่ชะอำ", "ชะอำ", "วัด"),
    row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่"),
  ];
  const rows = scopedRows(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("ได้เฉพาะของอำเภอนั้น", rows.length === 1 && rows[0].name === "วัดที่ชะอำ");

  const c = groupCounts(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("นับในขอบเขตได้ถูก", c.scoped === 1);
  check("และรู้จำนวนทั้งจังหวัดด้วย", c.province === 2);
}

console.log("\nอำเภอที่เลือกไม่มีของในหมวดนั้น — ต้องว่าง ไม่ใช่ถอยเอง");
{
  const all = [
    row("วัดในเมือง", "เมือง", "วัด"),
    row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่"),
  ];
  // นี่คือหัวใจของการแก้รอบนี้ — เดิมคืนวัดของทั้งจังหวัดมาให้เงียบ ๆ
  check("ไม่ถอยไปทั้งจังหวัดเอง", scopedRows(all, byDistrict<Row>("ชะอำ"), "วัด").length === 0);

  const c = groupCounts(all, byDistrict<Row>("ชะอำ"), "วัด");
  check("ปุ่มบอก 0 ตามความจริง", c.scoped === 0);
  // หน้าจอใช้เลขนี้ตัดสินว่าควรเสนอปุ่ม "ดูทั้งจังหวัด" ไหม
  check("แต่บอกด้วยว่าทั้งจังหวัดมี 1 แห่ง", c.province === 1);
}

console.log("\nไม่มีของในหมวดนั้นเลยทั้งจังหวัด");
{
  const all = [row("คาเฟ่ชะอำ", "ชะอำ", "คาเฟ่")];
  const c = groupCounts(all, byDistrict<Row>("ชะอำ"), "วัด");
  // ทั้งจังหวัดก็ไม่มี เสนอให้ขยายขอบเขตไปก็เก้อ หน้าจอจึงปิดปุ่มนั้นได้เลย
  check("ทั้งสองเลขเป็น 0", c.scoped === 0 && c.province === 0);
}

console.log("\nแถวที่ไม่รู้อำเภอ");
{
  const all = [row("ไม่รู้อำเภอ", "", "วัด"), row("วัดชะอำ", "ชะอำ", "วัด")];
  check(
    "ไม่ถูกนับเข้าอำเภอใดอำเภอหนึ่ง",
    scopedRows(all, byDistrict<Row>("ชะอำ"), "วัด").length === 1,
  );
  check("แต่ยังเห็นตอนดูทั้งจังหวัด", scopedRows(all, byDistrict<Row>(""), "วัด").length === 2);
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
  let lying = 0;
  let leaked = 0;
  let canWiden = 0;
  let trulyEmpty = 0;

  for (const prov of Object.keys(OSM_PLACES)) {
    const all = rowsOf(prov);
    const districts = [...new Set(all.map((r) => r.district).filter(Boolean))];
    for (const d of districts) {
      for (const g of GROUPS) {
        buttons += 1;
        const narrow = byDistrict<RealRow>(d);
        const rows = scopedRows(all, narrow, g);
        const c = groupCounts(all, narrow, g);
        // ตัวเลขบนปุ่มต้องเท่ากับจำนวนที่กดแล้วได้เห็นจริงเสมอ
        if (c.scoped !== rows.length) lying += 1;
        // ทุกแถวต้องอยู่ในอำเภอที่เลือกจริง ๆ ไม่มีของอำเภออื่นหลุดมา
        if (rows.some((r) => r.district !== d)) leaked += 1;
        if (c.scoped === 0 && c.province > 0) canWiden += 1;
        if (c.scoped === 0 && c.province === 0) trulyEmpty += 1;
      }
    }
  }

  const pct = (n: number) => ((n / buttons) * 100).toFixed(1) + "%";
  check(`ตัวเลขบนปุ่มตรงกับรายการที่ได้เห็นทุกปุ่ม (${buttons} ปุ่ม)`, lying === 0, `ผิด ${lying}`);
  check("ไม่มีรายการของอำเภออื่นหลุดเข้ามาเลย", leaked === 0, `หลุด ${leaked} ปุ่ม`);
  console.log(`    หมวดที่ว่างแต่ขยายไปทั้งจังหวัดได้ ${canWiden} ปุ่ม (${pct(canWiden)})`);
  console.log(`    หมวดที่ไม่มีของเลยทั้งจังหวัด ${trulyEmpty} ปุ่ม (${pct(trulyEmpty)})`);
  // ส่วนใหญ่ของปุ่มที่ว่างมีทางออกให้ผู้ใช้กดขยายเอง ไม่ใช่ทางตัน
  check("ปุ่มที่ว่างส่วนใหญ่ยังขยายไปทั้งจังหวัดได้", canWiden > trulyEmpty);
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
