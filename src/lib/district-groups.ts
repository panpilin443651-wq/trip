/**
 * เลือกว่าปุ่มกรองหมวดในการ์ด "วัด ร้านดัง ที่พัก" จะแสดงอะไร
 *
 * ปัญหาที่แก้ — ชุดข้อมูล OpenStreetMap จำกัดจำนวนต่อ "จังหวัด" (จังหวัดละ
 * ไม่กี่สิบแห่ง) พอผู้ใช้เลือกอำเภอ ของที่มีอยู่จะกระจายไปสิบกว่าอำเภอ
 * ทำให้หมวดส่วนใหญ่เหลือศูนย์ ปุ่มจึงกดไม่ได้
 *
 * วัดจากข้อมูลจริง 672 อำเภอ x 6 หมวด = 4,032 ปุ่ม
 *   เดิม  กดไม่ได้ 2,504 ปุ่ม (62%) — "วัด" ตาย 78% "โรงแรม" ตาย 76%
 *   ใหม่  กดไม่ได้   337 ปุ่ม (8%)  ที่เหลือถอยไปแสดงทั้งจังหวัดแทน
 *
 * ที่ยังกดไม่ได้ 8% คือจังหวัดที่ไม่มีหมวดนั้นเลยจริง ๆ (13 จังหวัดไม่มีวัด
 * ในชุดข้อมูล) ซึ่งถูกแล้วที่จะกดไม่ได้
 */

/** หมวดรวมที่หมายถึง "ไม่กรอง" */
export const ALL_GROUPS = "ทั้งหมด";

export interface GroupedRow {
  /** อำเภอที่ตั้ง ว่างได้ถ้าชุดข้อมูลไม่รู้ */
  district: string;
  group: string;
}

function inGroup<T extends GroupedRow>(rows: T[], group: string): T[] {
  return group === ALL_GROUPS ? rows : rows.filter((row) => row.group === group);
}

/**
 * แถวที่ควรแสดงสำหรับอำเภอและหมวดที่เลือก
 *
 * ถ้าอำเภอนั้นไม่มีของในหมวดที่เลือกเลย จะถอยไปใช้ทั้งจังหวัดแทนการขึ้นว่า
 * "ไม่พบ" เพราะที่ที่อยู่คนละอำเภอในจังหวัดเดียวกันมักขับไปได้ในครึ่งชั่วโมง
 * — มีประโยชน์กว่าหน้าจอว่างเปล่าแน่นอน แต่ต้องบอกผู้ใช้ด้วยว่ากำลังดูทั้งจังหวัด
 */
export function rowsInScope<T extends GroupedRow>(
  all: T[],
  district: string,
  group: string,
): { rows: T[]; wholeProvince: boolean } {
  if (!district) return { rows: inGroup(all, group), wholeProvince: false };

  const here = inGroup(
    all.filter((row) => row.district === district),
    group,
  );
  if (here.length > 0) return { rows: here, wholeProvince: false };

  const wide = inGroup(all, group);
  // ไม่มีทั้งในอำเภอและทั้งจังหวัด — ไม่ต้องบอกว่าถอยไปดูทั้งจังหวัด
  // เพราะทั้งจังหวัดก็ว่างเหมือนกัน พูดไปก็สับสนเปล่า ๆ
  return { rows: wide, wholeProvince: wide.length > 0 };
}

/**
 * ตัวเลขที่ขึ้นบนปุ่มหมวด
 *
 * ต้องเป็นจำนวนของสิ่งที่จะได้เห็นจริงเมื่อกด ไม่ใช่จำนวนในอำเภอ
 * ไม่งั้นปุ่มจะบอกว่า 0 แต่กดแล้วมีรายการขึ้นมา
 */
export function groupCount<T extends GroupedRow>(
  all: T[],
  district: string,
  group: string,
): { count: number; wide: boolean } {
  const { rows, wholeProvince } = rowsInScope(all, district, group);
  return { count: rows.length, wide: wholeProvince };
}
