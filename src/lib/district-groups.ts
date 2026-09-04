/**
 * กรองรายการตามหมวด ภายในขอบเขตที่แคบกว่าจังหวัด
 *
 * **เคยถอยไปทั้งจังหวัดให้อัตโนมัติเมื่ออำเภอที่เลือกไม่มีของในหมวดนั้น**
 * เพราะกลัวปุ่มกรองตาย (วัดตาย 78% โรงแรมตาย 76% เมื่อเจาะอำเภอ)
 * แต่ผลคือผู้ใช้เลือกอำเภอแล้วยังได้รายการทั้งจังหวัดเกือบทุกครั้ง
 * จนรู้สึกว่าการเลือกอำเภอไม่มีผลอะไรเลย ซึ่งแย่กว่าปุ่มที่กดแล้วว่าง
 *
 * ตอนนี้จึง **กรองตามที่เลือกจริง ๆ ไม่ถอยเอง** ส่วนปัญหาปุ่มตายแก้ที่หน้าจอ
 * แทน — หมวดที่ว่างยังกดได้ และขึ้นปุ่มให้ขยายไปทั้งจังหวัดเองเมื่อผู้ใช้ต้องการ
 * ผู้ใช้จึงรู้ตลอดว่ากำลังดูขอบเขตไหนอยู่
 */

/** หมวดรวมที่หมายถึง "ไม่กรอง" */
export const ALL_GROUPS = "ทั้งหมด";

export interface GroupedRow {
  group: string;
}

/**
 * เงื่อนไขว่าแถวไหนอยู่ในขอบเขตที่แคบลง
 * `null` = ไม่จำกัดขอบเขต ใช้ทั้งจังหวัด
 */
export type ScopeFilter<T> = ((row: T) => boolean) | null;

/** เฉพาะแถวในหมวดที่เลือก */
export function inGroup<T extends GroupedRow>(rows: T[], group: string): T[] {
  return group === ALL_GROUPS ? rows : rows.filter((row) => row.group === group);
}

/** แถวที่ควรแสดง — ตามขอบเขตและหมวดที่เลือก ตรงไปตรงมา ไม่ถอยเอง */
export function scopedRows<T extends GroupedRow>(
  all: T[],
  narrow: ScopeFilter<T>,
  group: string,
): T[] {
  return inGroup(narrow ? all.filter(narrow) : all, group);
}

/**
 * จำนวนของหมวดหนึ่ง ทั้งในขอบเขตที่เลือกและในทั้งจังหวัด
 *
 * ต้องรู้ทั้งสองเลข — เลขในขอบเขตคือสิ่งที่ขึ้นบนปุ่ม ส่วนเลขทั้งจังหวัด
 * ใช้ตัดสินว่าควรเสนอให้ขยายขอบเขตไหม ถ้าทั้งจังหวัดก็ไม่มี เสนอไปก็เก้อ
 */
export function groupCounts<T extends GroupedRow>(
  all: T[],
  narrow: ScopeFilter<T>,
  group: string,
): { scoped: number; province: number } {
  return {
    scoped: scopedRows(all, narrow, group).length,
    province: inGroup(all, group).length,
  };
}

/** ตัวช่วยที่ใช้บ่อย — จำกัดด้วยชื่ออำเภอเดียว ว่าง = ไม่จำกัด */
export function byDistrict<T extends GroupedRow & { district: string }>(
  district: string,
): ScopeFilter<T> {
  return district ? (row) => row.district === district : null;
}
