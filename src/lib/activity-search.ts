import {
  PROVINCES,
  type SuggestedActivity,
  type SuggestedPlace,
} from "@/data/provinces";
import type { CategoryId } from "./types";

/** ค่าที่จะเติมลงฟอร์มกิจกรรมเมื่อเลือกรายการที่ค้นเจอ */
export interface SuggestionFill {
  title: string;
  placeName: string;
  province: string;
  detail: string;
  durationMin: number;
  cost: number;
  category: CategoryId;
  lat?: number;
  lng?: number;
}

export interface ActivitySuggestion {
  key: string;
  kind: "activity" | "place";
  province: string;
  emoji: string;
  name: string;
  /** บรรทัดรองอธิบายรายการนี้ */
  hint: string;
  /** อยู่ในจังหวัดที่เลือกไว้หรือไม่ ใช้แยกกลุ่มตอนแสดงผล */
  inTrip: boolean;
  fill: SuggestionFill;
}

/** สร้างกิจกรรมจากสถานที่แนะนำ */
export function placeFill(province: string, place: SuggestedPlace): SuggestionFill {
  return {
    title: place.name,
    placeName: `${place.name} ${province}`,
    province,
    detail: `${place.description}\n💡 ${place.tip}`,
    durationMin: place.durationMin,
    cost: place.fee,
    category: place.fee > 0 ? "attraction" : "other",
    lat: place.lat,
    lng: place.lng,
  };
}

/** สร้างกิจกรรมจากกิจกรรมแนะนำ */
export function activityFill(
  province: string,
  activity: SuggestedActivity,
): SuggestionFill {
  return {
    title: activity.name,
    placeName: province,
    province,
    detail: `${activity.description}\n💵 ${activity.price}\n⏱️ ${activity.duration}\n🎒 ${activity.prepare}`,
    // ข้อมูลแนะนำเก็บระยะเวลาเป็นข้อความ เช่น "ครึ่งวัน" แปลงเป็นนาทีไม่ได้
    // จึงตั้ง 2 ชั่วโมงเป็นค่าเริ่มต้นให้ผู้ใช้ปรับเอง
    durationMin: 120,
    cost: 0,
    category: "other",
  };
}

interface Entry {
  key: string;
  kind: "activity" | "place";
  province: string;
  emoji: string;
  name: string;
  hint: string;
  /** ประเภทสั้น ๆ เช่น วัด ธรรมชาติ ตลาด — มีเฉพาะสถานที่ */
  tag: string;
  description: string;
  /** ทิปหรือของที่ต้องเตรียม คำอย่าง "เดินป่า" มักโผล่ตรงนี้ */
  extra: string;
  fill: SuggestionFill;
}

/**
 * ดัชนีค้นหาจากข้อมูลแนะนำทั้ง 77 จังหวัด (~500 รายการ)
 * สร้างครั้งเดียวตอนโหลดโมดูล เล็กพอที่จะไล่ทั้งชุดต่อการพิมพ์หนึ่งตัว
 */
const INDEX: Entry[] = PROVINCES.flatMap((province) => [
  ...province.places.map((place) => ({
    key: `place:${place.id}`,
    kind: "place" as const,
    province: province.name,
    emoji: place.emoji,
    name: place.name,
    hint: `${place.tag} • ${province.name}`,
    tag: place.tag,
    description: place.description,
    extra: `${place.tip} ${place.bestTime}`,
    fill: placeFill(province.name, place),
  })),
  ...province.activities.map((activity) => ({
    key: `activity:${activity.id}`,
    kind: "activity" as const,
    province: province.name,
    emoji: activity.emoji,
    name: activity.name,
    hint: `${activity.duration} • ${activity.price} • ${province.name}`,
    tag: "",
    description: activity.description,
    extra: activity.prepare,
    fill: activityFill(province.name, activity),
  })),
]);

/**
 * คำพ้องที่คนใช้ค้นกับคำที่อยู่ในข้อมูลจริง
 *
 * ข้อมูลแนะนำเขียนด้วยคำเฉพาะของแต่ละที่ เช่น ภูกระดึงเขียนว่า
 * "อุทยาน" และ "ต้องเดินขึ้น 5.5 กม." ไม่มีคำว่า "เดินป่า" สักที่
 * ถ้าเทียบตรงตัวอย่างเดียว คนพิมพ์ "เดินป่า" จะไม่เจออะไรเลยทั้งที่
 * จังหวัดนั้นมีที่เดินป่าอยู่ จึงต้องขยายคำค้นเป็นกลุ่มคำที่ใกล้เคียงกัน
 */
const KEYWORD_GROUPS: string[][] = [
  [
    "เดินป่า",
    "เทรค",
    "เดินขึ้น",
    // ต้องเจาะจงว่า "แห่งชาติ" ไม่งั้นไปโดนอุทยานประวัติศาสตร์ซึ่งเป็นโบราณสถาน
    "อุทยานแห่งชาติ",
    "ยอดภู",
    "ยอดดอย",
    "ศึกษาธรรมชาติ",
    "ผาชมวิว",
  ],
  ["น้ำตก", "แก่ง", "ลำธาร"],
  ["ทะเล", "ชายหาด", "หาด", "เกาะ", "อ่าว"],
  ["ดำน้ำ", "สน็อกเกิล", "ปะการัง"],
  ["ล่องเรือ", "ล่องแก่ง", "ล่องแพ", "คายัค", "เรือหางยาว"],
  ["วัด", "ไหว้พระ", "พระธาตุ", "พระใหญ่", "โบสถ์", "มัสยิด", "ศาลเจ้า"],
  ["ตลาด", "ถนนคนเดิน", "ของฝาก", "ตลาดน้ำ", "ตลาดนัด"],
  ["คาเฟ่", "กาแฟ", "ร้านกาแฟ"],
  ["จุดชมวิว", "ทะเลหมอก", "พระอาทิตย์", "วิวเมือง", "ผา"],
  ["ประวัติศาสตร์", "โบราณสถาน", "พิพิธภัณฑ์", "เมืองเก่า", "ปราสาท", "วัง"],
  ["น้ำพุร้อน", "ออนเซ็น", "บ่อน้ำร้อน"],
  ["กางเต็นท์", "แคมป์", "ลานกางเต็นท์"],
  ["ปั่นจักรยาน", "จักรยาน"],
  ["ช้อปปิ้ง", "ห้าง", "ศูนย์การค้า"],
  ["ถ้ำ"],
  ["ดูนก", "สัตว์ป่า", "สวนสัตว์"],
  ["ช้าง", "ปางช้าง"],
  ["ชิม", "อาหาร", "ของกิน", "สตรีทฟู้ด", "ร้านอาหาร"],
  ["เวิร์กช็อป", "ทำเอง", "คลาส", "เรียน"],
];

/**
 * คำที่จะเอาไปค้นทั้งหมด — คำที่พิมพ์เองมาก่อนเสมอ ตามด้วยคำพ้อง
 * คำพ้องได้น้ำหนักน้อยกว่า ผลที่ตรงคำจริงจึงยังลอยขึ้นก่อน
 */
export function expandQuery(query: string): Array<{ term: string; weight: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const group = KEYWORD_GROUPS.find((terms) =>
    terms.some((term) => term.includes(q) || q.includes(term)),
  );
  const extras = (group ?? [])
    .filter((term) => term !== q)
    .map((term) => ({ term, weight: 0.55 }));
  return [{ term: q, weight: 1 }, ...extras];
}

/** ข้อความตรงกับคำค้นหรือคำพ้องของมันไหม ใช้กรองรายการแนะนำ */
export function matchesQuery(text: string, query: string): boolean {
  const terms = expandQuery(query);
  if (terms.length === 0) return true;
  const haystack = text.toLowerCase();
  return terms.some(({ term }) => haystack.includes(term));
}

/**
 * คะแนนความตรงของคำค้นกับรายการหนึ่ง 0 = ไม่ตรงเลย
 *
 * ชื่อรายการมีน้ำหนักสูงสุด แต่ต้องค้นคำอธิบายกับทิปด้วย เพราะคำที่คนพิมพ์
 * อย่าง "เดินป่า" ไม่ได้อยู่ในชื่อสถานที่สักแห่ง แต่อยู่ในคำอธิบายเส้นทาง
 */
function scoreTerm(entry: Entry, term: string): number {
  const name = entry.name.toLowerCase();
  if (name === term) return 120;
  if (name.startsWith(term)) return 100;
  if (name.includes(term)) return 80;
  if (entry.tag.toLowerCase().includes(term)) return 60;
  if (entry.description.toLowerCase().includes(term)) return 45;
  if (entry.extra.toLowerCase().includes(term)) return 30;
  return 0;
}

function scoreEntry(
  entry: Entry,
  terms: Array<{ term: string; weight: number }>,
): number {
  let best = 0;
  for (const { term, weight } of terms) {
    best = Math.max(best, scoreTerm(entry, term) * weight);
  }
  return best;
}

/**
 * ค้นสถานที่และกิจกรรมแนะนำจากคำที่พิมพ์
 *
 * จังหวัดที่เลือกไว้ในทริปได้แต้มพิเศษ จึงลอยขึ้นก่อนเสมอ ส่วนจังหวัดอื่น
 * ยังแสดงต่อท้ายพร้อมป้ายชื่อจังหวัด เพราะถ้าตัดทิ้งไปเลย คนที่พิมพ์คำที่
 * จังหวัดตัวเองไม่มีจะเจอรายการว่างโดยไม่รู้สาเหตุ
 */
export function searchSuggestions(
  query: string,
  tripProvinces: string[],
  limit = 8,
): ActivitySuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const terms = expandQuery(q);
  const selected = new Set(tripProvinces.filter(Boolean));

  return INDEX.map((entry) => {
    const base = scoreEntry(entry, terms);
    if (base === 0) return null;
    const inTrip = selected.has(entry.province);
    return { entry, inTrip, score: base + (inTrip ? 1000 : 0) };
  })
    .filter((row) => row !== null)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "th"))
    .slice(0, limit)
    .map(({ entry, inTrip }) => ({
      key: entry.key,
      kind: entry.kind,
      province: entry.province,
      emoji: entry.emoji,
      name: entry.name,
      hint: entry.hint,
      inTrip,
      fill: entry.fill,
    }));
}
