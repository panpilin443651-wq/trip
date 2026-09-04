import type { HotelHit } from "@/app/api/hotels/route";
import type { OsmPlace } from "@/data/osm-places";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import type { Province } from "@/data/provinces";
import {
  activityFill,
  placeFill,
  type SuggestionFill,
} from "./activity-search";
import type { ScopeFilter } from "./district-groups";
import { googleMapsUrl } from "./place-search";

/**
 * รวมทุกแหล่งข้อมูลแนะนำให้เป็นแถวหน้าตาเดียวกัน
 *
 * ก่อนหน้านี้หน้าแผนรายวันมีการ์ดแนะนำสองใบซ้อนกัน — ใบหนึ่งมีสถานที่กับกิจกรรม
 * ที่คัดเองแต่ไม่มีลิงก์แผนที่ อีกใบมีร้านอาหารกับคาเฟ่จาก OSM ที่มีลิงก์
 * ผลคือไม่มีวัดกับที่พักเลย และสองการ์ดใช้คนละขอบเขตจังหวัดทั้งที่อยู่หน้าเดียวกัน
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่มี React จะได้เทสต์ใน Node ตรง ๆ ได้
 */

export type SuggestionGroup =
  | "สถานที่"
  | "กิจกรรม"
  | "วัด"
  | "ร้านอาหาร"
  | "คาเฟ่"
  | "ที่พัก";

export const SUGGESTION_GROUPS: SuggestionGroup[] = [
  "สถานที่",
  "กิจกรรม",
  "วัด",
  "ร้านอาหาร",
  "คาเฟ่",
  "ที่พัก",
];

export interface SuggestionRow {
  key: string;
  name: string;
  emoji: string;
  group: SuggestionGroup;
  /** บรรทัดย่อยใต้ชื่อ เช่น "คาเฟ่ · กาแฟ" หรือ "โรงแรม ระดับ 4 ดาว" */
  hint: string;
  province: string;
  district: string;
  /** มีหน้า Wikipedia — ติดดาวและดันขึ้นบน */
  notable: boolean;
  /**
   * ลิงก์ Google Maps — กิจกรรมไม่มี เพราะเป็นสิ่งที่ทำ ไม่ใช่ที่ที่ไป
   * ถ้าฝืนทำลิงก์ด้วยชื่อจังหวัดจะพาไปผิดที่ ซึ่งแย่กว่าไม่มีลิงก์
   */
  mapsUrl: string | null;
  /** ข้อความยาวที่เอาไปค้นได้ รวมคำอธิบายด้วย ไม่ใช่แค่ชื่อ */
  haystack: string;
  fill: SuggestionFill;
}

/** ที่พักเผื่อเวลาไว้ 12 ชั่วโมง เพราะเช็กอินแล้วนอนข้ามคืน */
const STAY_MINUTES = 720;
const FOOD_MINUTES = 60;
const PLACE_MINUTES = 90;

function lower(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * แถวจากข้อมูลที่คัดเอง — มีคำอธิบายและเคล็ดลับ ซึ่ง OSM ไม่มี
 */
function curatedRows(province: Province): SuggestionRow[] {
  const places = province.places.map<SuggestionRow>((place) => ({
    key: `c-${place.id}`,
    name: place.name,
    emoji: place.emoji,
    group: "สถานที่",
    hint: place.tag,
    province: province.name,
    district: place.district ?? "",
    notable: Boolean(place.featured),
    mapsUrl: googleMapsUrl(place.name, place.lat, place.lng),
    haystack: lower(
      place.name,
      place.description,
      place.tag,
      place.tip,
      place.bestTime,
      province.name,
    ),
    fill: placeFill(province.name, place),
  }));

  const activities = province.activities.map<SuggestionRow>((activity) => ({
    key: `a-${activity.id}`,
    name: activity.name,
    emoji: activity.emoji,
    group: "กิจกรรม",
    hint: activity.description,
    province: province.name,
    district: "",
    notable: false,
    mapsUrl: null,
    haystack: lower(
      activity.name,
      activity.description,
      activity.prepare,
      activity.duration,
      province.name,
    ),
    fill: activityFill(province.name, activity),
  }));

  return [...places, ...activities];
}

function osmPlaceRows(province: string, list: OsmPlace[]): SuggestionRow[] {
  return list.map((p) => ({
    key: `p-${p.id}`,
    name: p.name,
    emoji: p.emoji,
    // วัดเป็นหมวดของตัวเอง ที่เหลือรวมอยู่ในสถานที่
    group: (p.kind === "วัด" ? "วัด" : "สถานที่") as SuggestionGroup,
    hint: p.kind,
    province,
    district: p.district,
    notable: p.notable,
    mapsUrl: googleMapsUrl(p.name, p.lat, p.lng),
    haystack: lower(p.name, p.kind, p.district, province),
    fill: {
      title: p.name,
      placeName: `${p.name} ${province}`,
      province,
      detail: p.district ? `${p.kind} • อ.${p.district}` : p.kind,
      durationMin: PLACE_MINUTES,
      cost: 0,
      category: "attraction",
      lat: p.lat,
      lng: p.lng,
    },
  }));
}

function restaurantRows(
  province: string,
  list: RestaurantHit[],
): SuggestionRow[] {
  return list.map((r) => ({
    key: `f-${r.id}`,
    name: r.name,
    emoji: r.kind === "คาเฟ่" ? "☕" : "🍽️",
    group: (r.kind === "คาเฟ่" ? "คาเฟ่" : "ร้านอาหาร") as SuggestionGroup,
    hint: [r.kind, r.cuisine, r.openingHours].filter(Boolean).join(" · "),
    province,
    district: r.district,
    notable: r.notable,
    mapsUrl: r.mapsUrl,
    haystack: lower(r.name, r.kind, r.cuisine, r.district, province),
    fill: {
      title: r.name,
      placeName: `${r.name} ${province}`,
      province,
      detail: [r.kind, r.cuisine].filter(Boolean).join(" • "),
      durationMin: FOOD_MINUTES,
      cost: 0,
      category: "food",
      lat: r.lat,
      lng: r.lng,
    },
  }));
}

function hotelRows(province: string, list: HotelHit[]): SuggestionRow[] {
  return list.map((h) => ({
    key: `h-${h.id}`,
    name: h.name,
    emoji: h.kind === "รีสอร์ต" ? "🏝️" : "🏨",
    // โรงแรมกับรีสอร์ตรวมเป็นปุ่มเดียว การ์ดนี้มีหมวดเยอะกว่าการ์ดในแท็บ
    // แนะนำเที่ยวอยู่แล้ว ถ้าแยกอีกจะเป็น 8 ปุ่มจนล้นบนมือถือ
    // ประเภทจริงยังบอกอยู่ในบรรทัดย่อย
    group: "ที่พัก",
    // ดาวของโรงแรมคือระดับที่พัก คนละเรื่องกับ ⭐ ที่แปลว่ามีคนเขียนถึง
    // จึงเขียนเป็นคำ ไม่ใช้สัญลักษณ์ดาว จะได้ไม่อ่านสลับกัน
    hint: h.stars > 0 ? `${h.kind} ระดับ ${h.stars} ดาว` : h.kind,
    province,
    district: h.district,
    notable: h.notable,
    mapsUrl: h.mapsUrl,
    haystack: lower(h.name, h.kind, h.district, province),
    fill: {
      title: h.name,
      placeName: `${h.name} ${province}`,
      province,
      detail: h.district ? `${h.kind} • อ.${h.district}` : h.kind,
      durationMin: STAY_MINUTES,
      cost: 0,
      category: "accommodation",
      lat: h.lat,
      lng: h.lng,
    },
  }));
}

export interface SuggestionSources {
  /** จังหวัดที่คัดข้อมูลไว้เอง ว่างได้ถ้าจังหวัดนั้นยังไม่มีข้อมูลที่คัดเอง */
  curated: Province[];
  osmPlaces: Record<string, OsmPlace[]>;
  restaurants: Record<string, RestaurantHit[]>;
  hotels: Record<string, HotelHit[]>;
}

/**
 * รวมทุกแหล่งแล้วตัดชื่อซ้ำออก
 *
 * ที่ที่คัดไว้เองมักมีใน OSM ด้วย ("หาดชะอำ" อยู่ทั้งสองที่) ถ้าไม่ตัด
 * จะขึ้นสองแถวติดกันโดยที่ผู้ใช้ไม่รู้ว่าต่างกันตรงไหน
 * **ให้ของที่คัดเองชนะ** เพราะมีคำอธิบาย เคล็ดลับ ค่าเข้า และเวลาที่ควรเผื่อ
 * ส่วน OSM มีแค่ชื่อกับประเภท
 */
export function buildSuggestionRows(
  sources: SuggestionSources,
): SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  for (const province of sources.curated) rows.push(...curatedRows(province));
  for (const [province, list] of Object.entries(sources.osmPlaces)) {
    rows.push(...osmPlaceRows(province, list));
  }
  for (const [province, list] of Object.entries(sources.restaurants)) {
    rows.push(...restaurantRows(province, list));
  }
  for (const [province, list] of Object.entries(sources.hotels)) {
    rows.push(...hotelRows(province, list));
  }

  const seen = new Set<string>();
  const unique: SuggestionRow[] = [];
  for (const row of rows) {
    const key = `${row.name.trim()}::${row.province}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  // ที่ที่คนเขียนถึงขึ้นก่อน ที่เหลือเรียงตามชื่อให้ลำดับคงที่ทุกครั้ง
  return unique.sort(
    (a, b) =>
      Number(b.notable) - Number(a.notable) ||
      a.name.localeCompare(b.name, "th"),
  );
}

/**
 * เงื่อนไขว่าแถวไหนอยู่ในอำเภอที่เลือกไว้ในแพลนการเที่ยว
 *
 * `trip.districts` เก็บเป็น { จังหวัด: [อำเภอ] } และ **อาเรย์ว่าง = ทั้งจังหวัด**
 * ถ้าไม่มีจังหวัดไหนเจาะอำเภอไว้เลย จะคืน null แปลว่าไม่ต้องกรอง
 *
 * เทียบเป็นคู่ จังหวัด+อำเภอ ไม่ใช่ชื่ออำเภอลอย ๆ เพราะชื่ออำเภอซ้ำข้ามจังหวัดได้
 * (มี "เมือง..." ทุกจังหวัด และชื่ออย่าง "ปากช่อง" ก็ไม่ได้มีที่เดียว)
 *
 * **กิจกรรมไม่มีอำเภอโดยธรรมชาติ** เพราะเป็นสิ่งที่ทำ ไม่ใช่ที่ที่ไป
 * จึงต้องนับว่าอยู่ในขอบเขตเสมอ ไม่งั้นเจาะอำเภอปุ๊บกิจกรรมหายหมด
 * ที่ที่คัดเองราว 7% ก็ยังไม่ได้ระบุอำเภอ ใช้กฎเดียวกันจะได้ไม่หายไปเงียบ ๆ
 */
export function byPlanDistricts(
  districts: Record<string, string[]>,
): ScopeFilter<SuggestionRow> {
  const allowed = new Set<string>();
  for (const [province, list] of Object.entries(districts)) {
    for (const district of list) allowed.add(`${province}::${district}`);
  }
  if (allowed.size === 0) return null;
  return (row) =>
    !row.district || allowed.has(`${row.province}::${row.district}`);
}
