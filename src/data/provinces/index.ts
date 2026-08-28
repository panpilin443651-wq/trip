/**
 * ข้อมูลแนะนำเที่ยวครบทั้ง 77 จังหวัด
 *
 * พิกัดทุกจุดดึงมาจาก OpenStreetMap (Nominatim) แล้วตรวจว่าอยู่ในระยะ
 * ที่สมเหตุสมผลจากศูนย์กลางจังหวัด ส่วนค่าเข้าและระยะเวลาเป็นค่าประมาณ
 * สำหรับใช้ตั้งงบและจัดตารางเท่านั้น ควรตรวจกับแหล่งข้อมูลทางการก่อนเดินทางจริง
 */
import { FEATURED_PROVINCES } from "./featured";
import { NORTH_PROVINCES } from "./north";
import { ISAN_1_PROVINCES } from "./isan-1";
import { ISAN_2_PROVINCES } from "./isan-2";
import { CENTRAL_1_PROVINCES } from "./central-1";
import { CENTRAL_2_PROVINCES } from "./central-2";
import { EAST_WEST_PROVINCES } from "./east-west";
import { SOUTH_PROVINCES } from "./south";
import { REGIONS, type Province } from "./types";

export type {
  Province,
  Region,
  SuggestedActivity,
  SuggestedPlace,
} from "./types";
export { REGIONS } from "./types";

/** จังหวัดที่มีข้อมูลละเอียดกว่าจังหวัดอื่น แสดงเป็นกลุ่มแนะนำ */
export const FEATURED_PROVINCE_IDS = new Set(
  FEATURED_PROVINCES.map((p) => p.id),
);

const ALL = [
  ...FEATURED_PROVINCES,
  ...NORTH_PROVINCES,
  ...ISAN_1_PROVINCES,
  ...ISAN_2_PROVINCES,
  ...CENTRAL_1_PROVINCES,
  ...CENTRAL_2_PROVINCES,
  ...EAST_WEST_PROVINCES,
  ...SOUTH_PROVINCES,
];

/** เรียงตามภาค แล้วเรียงชื่อจังหวัดแบบไทยภายในภาค */
export const PROVINCES: Province[] = [...ALL].sort(
  (a, b) =>
    REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) ||
    a.name.localeCompare(b.name, "th"),
);

export const PROVINCE_BY_ID = new Map(PROVINCES.map((p) => [p.id, p]));
export const PROVINCE_BY_NAME = new Map(PROVINCES.map((p) => [p.name, p]));

/** จังหวัดจัดกลุ่มตามภาค ใช้กับ optgroup ในช่องเลือกจังหวัด */
export const PROVINCES_BY_REGION = REGIONS.map((region) => ({
  region,
  provinces: PROVINCES.filter((p) => p.region === region),
}));
