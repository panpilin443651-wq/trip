import { DISTRICTS } from "@/data/districts";
import { OSM_HOTELS } from "@/data/osm-hotels";
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";
import { PROVINCES } from "@/data/provinces";

/**
 * ค้นสถานที่จริงจากคำถาม เพื่อส่งให้ผู้ช่วย AI ใช้ตอบ
 *
 * ทำไมต้องมี — หน้าแนะนำเที่ยวให้เลือกได้แค่ จังหวัด → อำเภอ ซึ่งตอบสามอย่างนี้ไม่ได้
 *   บางแสน  อยู่ระดับตำบล เลือกจากรายการอำเภอไม่ได้
 *   โคราช   เป็นชื่อเล่น ไม่ตรงกับชื่อจังหวัดที่เก็บไว้
 *   เขาใหญ่ คร่อมนครราชสีมากับปราจีนบุรี โครงสร้าง "หนึ่งจังหวัด" อธิบายไม่ได้
 *
 * ทั้งสามชื่อ *มีอยู่แล้ว* ในข้อมูล 5,208 รายการ แค่เข้าไม่ถึงผ่านช่องทางเดิม
 * ไฟล์นี้จึงค้นด้วยชื่อข้ามทุกจังหวัด แล้วส่งผลให้โมเดลเรียบเรียงเป็นคำตอบ
 *
 * ฝั่งเซิร์ฟเวอร์เท่านั้น — ชุดข้อมูลรวมกันเกิน 1 MB ห้ามติดไปกับ bundle
 */

export interface PlaceRow {
  name: string;
  province: string;
  district: string;
  /** ประเภทแบบอ่านง่าย เช่น วัด น้ำตก คาเฟ่ โรงแรม */
  kind: string;
  /** หมวดงบประมาณ ใช้ตอนกดใส่แผน */
  category: "attraction" | "food" | "accommodation";
  /** มีหน้า Wikipedia — ใช้เป็นสัญญาณว่าเป็นที่ที่คนรู้จัก */
  notable: boolean;
  lat: number;
  lng: number;
  /** คำอธิบายสั้น มีเฉพาะข้อมูลที่คัดเอง */
  note?: string;
}

interface IndexedRow extends PlaceRow {
  /** ข้อมูลที่คัดเองมีคำอธิบายกับเคล็ดลับ ดันขึ้นก่อนของ OSM ที่มีแต่ชื่อ */
  curated: boolean;
}

/** ส่งให้โมเดลมากกว่านี้ไม่ได้ช่วยให้ตอบดีขึ้น แต่กินโควตาต่อคำถาม */
const MAX_ROWS = 40;
const MAX_CONTEXT_CHARS = 6000;

/** สั้นกว่านี้ตรงกันโดยบังเอิญได้ง่าย — "ปาย" ยาว 3 จึงลงไปต่ำกว่านี้ไม่ได้ */
const MIN_GRAM = 3;
/** ยาวกว่านี้ไม่มีชื่อสถานที่ไหนยาวพอจะตรงทั้งท่อน */
const MAX_GRAM = 12;

/**
 * ตัดคำที่โผล่ในชื่อสถานที่เยอะเกินไปออกจากดัชนี
 *
 * "ร้าน" "วัด" "โรงแรม" อยู่ในชื่อเป็นพัน ๆ แห่ง ถ้าเอามาเป็นตัวตั้งค้น
 * จะได้ผู้สมัครมาครึ่งประเทศแล้วคะแนนเฉลี่ยกลบชื่อที่ตรงจริง ๆ ไปหมด
 * ประเภทสถานที่ยังใช้ได้อยู่ แต่ไปใช้เป็นตัวกรองท้ายสุดแทน (ดู CATEGORY_WORDS)
 */
const MAX_POSTINGS = 400;

// ─── สร้างดัชนีครั้งเดียวตอนโหลดโมดูล ───────────────────────────────────────

function buildIndex(): IndexedRow[] {
  const rows: IndexedRow[] = [];

  for (const province of PROVINCES) {
    for (const place of province.places) {
      rows.push({
        name: place.name,
        province: province.name,
        district: place.district ?? "",
        kind: place.tag,
        category: "attraction",
        notable: Boolean(place.featured),
        lat: place.lat,
        lng: place.lng,
        note: place.description,
        curated: true,
      });
    }
  }

  for (const [province, list] of Object.entries(OSM_PLACES)) {
    for (const p of list) {
      rows.push({
        name: p.name,
        province,
        district: p.district,
        kind: p.kind,
        category: "attraction",
        notable: p.notable,
        lat: p.lat,
        lng: p.lng,
        curated: false,
      });
    }
  }

  for (const [province, list] of Object.entries(OSM_RESTAURANTS)) {
    for (const r of list) {
      rows.push({
        name: r.name,
        province,
        district: r.district,
        kind: r.cuisine ? `${r.kind} · ${r.cuisine}` : r.kind,
        category: "food",
        notable: r.notable,
        lat: r.lat,
        lng: r.lng,
        curated: false,
      });
    }
  }

  for (const [province, list] of Object.entries(OSM_HOTELS)) {
    for (const h of list) {
      rows.push({
        name: h.name,
        province,
        district: h.district,
        kind: h.stars > 0 ? `${h.kind} ระดับ ${h.stars} ดาว` : h.kind,
        category: "accommodation",
        notable: h.notable,
        lat: h.lat,
        lng: h.lng,
        curated: false,
      });
    }
  }

  return rows;
}

/** ทุก n-gram ยาว MIN_GRAM ของข้อความหนึ่ง ใช้เป็นกุญแจของดัชนีผกผัน */
function seedGrams(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + MIN_GRAM <= text.length; i += 1) {
    out.push(text.slice(i, i + MIN_GRAM));
  }
  return out;
}

function buildPostings(rows: IndexedRow[]): Map<string, number[]> {
  const postings = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    // ชื่อซ้ำใน n-gram เดียวกันได้ ("บ้านบ้าน") กันไม่ให้ลงดัชนีสองรอบ
    for (const gram of new Set(seedGrams(rows[i].name))) {
      const list = postings.get(gram);
      if (list) list.push(i);
      else postings.set(gram, [i]);
    }
  }
  for (const [gram, list] of postings) {
    if (list.length > MAX_POSTINGS) postings.delete(gram);
  }
  return postings;
}

const INDEX = buildIndex();
const POSTINGS = buildPostings(INDEX);

/** ชื่ออำเภอ → จังหวัดที่มีอำเภอชื่อนี้ (ชื่อซ้ำข้ามจังหวัดได้ เช่น "เมือง...") */
const DISTRICT_TO_PROVINCES = new Map<string, string[]>();
for (const [province, districts] of Object.entries(DISTRICTS)) {
  for (const district of districts) {
    const list = DISTRICT_TO_PROVINCES.get(district);
    if (list) list.push(province);
    else DISTRICT_TO_PROVINCES.set(district, [province]);
  }
}

/** ให้เทสต์ตรวจได้ว่าอ่านข้อมูลมาครบ */
export const INDEX_SIZE = INDEX.length;

// ─── ตัดคำถามให้เหลือแต่ชื่อสถานที่ ─────────────────────────────────────────

/**
 * คำที่ต้องตัดทิ้งก่อนเอาไปค้น
 *
 * เจอของจริงตอนทดสอบ — "โคราชมีที่พักแนะนำไหม" ไปตรงกับ "อาคารที่พัก สก.ทอ."
 * ที่ชะอำ และ "มีอะไรน่ากินบ้าง" ไปตรงกับ "เขากินนอน" ที่พิษณุโลก
 * เพราะคำถามภาษาไทยเขียนติดกัน ช่วง "ที่พัก" กับ "ากิน" จึงโผล่ในชื่อสถานที่ได้
 * ถ้าไม่ตัดออก คำบอกประเภทจะกลบชื่อที่ผู้ใช้ตั้งใจถามถึงจริง ๆ
 *
 * เรียงยาวไปสั้น เพื่อให้ "ที่เที่ยว" ถูกตัดก่อน "เที่ยว" และ "ที่"
 * ประเภทสถานที่ไม่ได้หายไปเฉย ๆ — ย้ายไปเป็นตัวกรองใน wantedCategory แทน
 *
 * ห้ามใส่คำยาวสองตัวอักษร ("ไป" "มา" "ดี" "มี") — ตัดแล้วไม่ได้อะไรเลย เพราะ
 * ช่วงที่สั้นกว่า MIN_GRAM จับคู่ไม่ได้อยู่แล้ว แต่ทำให้ชื่อจริงพังเป็นแถบ
 * ("นครราชสีมา" เหลือ "นครราชสี" เพราะโดน "มา" · "ขอนแก่น" เหลือ "นแก่น" เพราะโดน "ขอ")
 */
const STOP_WORDS = [
  "แนะนำหน่อย", "จุดชมวิว", "ร้านอาหาร", "ที่เที่ยว", "ของหวาน", "อะไรบ้าง",
  "ที่ไหนดี", "น่าสนใจ", "เดินทาง", "รีสอร์ต", "รีสอร์ท", "กินอะไร",
  "อยากไป", "ที่ไหน", "มีอะไร", "อะไรดี", "แนะนำ", "โรงแรม", "ร้านดัง",
  "ดีไหม", "จังหวัด", "ควรไป", "หน่อย", "อำเภอ", "ตำบล", "ที่พัก",
  "ที่กิน", "เที่ยว", "คาเฟ่", "กาแฟ", "อยาก", "อะไร", "กี่วัน", "น่าไป",
  "บ้าง", "ช่วย", "ทริป", "แถว", "ไหม", "ควร", "พาไป", "วัน", "คืน",
  "แผน", "กิน", "นอน", "พัก", "น่า", "ไหน",
];

/**
 * เหลือแต่ท่อนที่น่าจะเป็นชื่อสถานที่
 *
 * แทนคำที่ตัดด้วยช่องว่าง ไม่ใช่ลบทิ้ง ไม่งั้นตัวอักษรสองข้างจะมาต่อกัน
 * กลายเป็นคำใหม่ที่ไม่มีใครพิมพ์
 */
export function keywords(question: string): string[] {
  let text = question;
  for (const word of STOP_WORDS) text = text.split(word).join(" ");
  return text
    .split(/[\s,.!?;:()"'`/\-–—]+/u)
    .map((s) => s.trim())
    // เก็บท่อนสองตัวอักษรไว้ด้วย เพื่อให้อำเภอชื่อสั้นอย่าง "คง" "พล" "ปง"
    // ยังตรงแบบเป๊ะ ๆ ได้ · การค้นด้วยชื่อไม่สนใจท่อนสั้นอยู่แล้ว
    // เพราะ seedGrams ไม่คืนอะไรเมื่อสั้นกว่า MIN_GRAM
    .filter((s) => s.length >= 2);
}

// ─── ค้นหา ──────────────────────────────────────────────────────────────────

/**
 * ช่วงที่ยาวที่สุดของคำถามที่โผล่อยู่ในชื่อสถานที่
 *
 * ใช้แทนการตัดคำ เพราะภาษาไทยไม่มีช่องว่างคั่นคำ และตัวตัดคำที่ดีพอ
 * ต้องลง dependency ใหม่ ซึ่งโปรเจกต์นี้ตั้งใจไม่เพิ่ม
 * ยิ่งช่วงที่ตรงยาว ยิ่งแปลว่าผู้ใช้เจาะจงถึงที่นั้นจริง
 */
function longestOverlap(question: string, name: string): number {
  const limit = Math.min(MAX_GRAM, question.length);
  for (let len = limit; len >= MIN_GRAM; len -= 1) {
    for (let i = 0; i + len <= question.length; i += 1) {
      if (name.includes(question.slice(i, i + len))) return len;
    }
  }
  return 0;
}

/**
 * คำบอกประเภทที่ใช้เป็นตัวกรองท้ายสุด ไม่ใช่ตัวตั้งค้น
 * ("กินอะไรดี" ควรได้ร้านขึ้นก่อน แต่ไม่ควรลากร้านทั้งประเทศมาเป็นผู้สมัคร)
 */
const CATEGORY_WORDS: Array<[PlaceRow["category"], string[]]> = [
  ["food", ["กิน", "ร้านอาหาร", "อาหาร", "คาเฟ่", "กาแฟ", "ของหวาน", "ร้านดัง"]],
  ["accommodation", ["ที่พัก", "โรงแรม", "รีสอร์ต", "รีสอร์ท", "นอน", "พักที่ไหน"]],
  ["attraction", ["ที่เที่ยว", "เที่ยว", "วัด", "ทะเล", "น้ำตก", "จุดชมวิว"]],
];

function wantedCategory(question: string): PlaceRow["category"] | null {
  for (const [category, words] of CATEGORY_WORDS) {
    if (words.some((w) => question.includes(w))) return category;
  }
  return null;
}

export interface RetrieveResult {
  rows: PlaceRow[];
  /** ข้อความที่ยัดเข้า prompt */
  context: string;
  /** เจอชื่อสถานที่ในคำถามไหม ถ้าไม่เจอแปลว่าใช้จังหวัดที่เลือกบนหน้าแทน */
  matchedByName: boolean;
}

export function retrieve(
  question: string,
  scope: { province?: string; district?: string } = {},
): RetrieveResult {
  // ต้องดูประเภทจากคำถามเต็มก่อน เพราะคำบอกประเภทคือคำที่ keywords() ตัดทิ้ง
  const category = wantedCategory(question);
  const terms = keywords(question);

  const picked: IndexedRow[] = [];
  const taken = new Set<string>();
  const add = (row: IndexedRow) => {
    const key = `${row.name}::${row.province}`;
    if (taken.has(key) || picked.length >= MAX_ROWS) return;
    taken.add(key);
    picked.push(row);
  };

  const areas: Array<{ province: string; district: string }> = [];
  const addArea = (province: string, district: string) => {
    if (areas.length >= 4) return;
    if (areas.some((a) => a.province === province && a.district === district)) return;
    areas.push({ province, district });
  };

  /*
   * 1. ชื่อจังหวัด/อำเภอที่พิมพ์มาตรง ๆ เชื่อได้มากกว่าการเดาจากชื่อสถานที่
   *    ("เที่ยวปากช่อง" ควรได้ทั้งอำเภอ ไม่ใช่แค่ที่ที่มีคำว่าปากช่องในชื่อ)
   *
   *    เทียบกับ *คำถามดิบ* ไม่ใช่ terms ที่ตัดคำแล้ว เพราะการตัดคำทำชื่อจริงพังได้
   *    ("น่าน" โดน "น่า" กินจนไม่เหลืออะไร) ชื่อเขตปกครองเป็นข้อมูลที่เราแน่ใจ
   *    จึงเทียบตรง ๆ ปลอดภัยกว่า — แต่ต้องยาวอย่างน้อย 4 ตัวอักษร ไม่งั้น
   *    อำเภอชื่อสั้นอย่าง "คง" กับ "พล" จะไปตรงกับคำธรรมดาในประโยคได้
   */
  const ADMIN_MIN = 4;
  for (const province of PROVINCES) {
    const hit =
      (province.name.length >= ADMIN_MIN && question.includes(province.name)) ||
      terms.includes(province.name);
    if (hit) addArea(province.name, "");
  }
  for (const [district, provinces] of DISTRICT_TO_PROVINCES) {
    const hit =
      (district.length >= ADMIN_MIN && question.includes(district)) ||
      terms.includes(district);
    if (!hit) continue;
    for (const province of provinces) addArea(province, district);
  }

  // เอ่ยชื่อจังหวัด/อำเภอมาตรง ๆ = ถามถึงสถานที่แน่นอน ไม่ต้องเดาจากอย่างอื่น
  const namedAdminArea = areas.length > 0;

  // 2. หาผู้สมัครจากดัชนีผกผัน แล้วให้คะแนนตามความยาวช่วงที่ตรง
  const seen = new Set<number>();
  for (const term of terms) {
    for (const gram of new Set(seedGrams(term))) {
      for (const i of POSTINGS.get(gram) ?? []) seen.add(i);
    }
  }

  /*
   * เก็บว่าแต่ละท่อนคำถามตรงกับชื่อสถานที่ได้ยาวสุดเท่าไร แล้วรับเฉพาะที่ตรงยาวสุด
   *
   * ถ้าไม่ทำ ท่อนที่ตรงบางส่วนจะแย่งที่ของคำตอบจริง — เจอของจริงตอนทดสอบ
   * "โคราชมี" มีช่วง "ราชม" อยู่ข้างใน ซึ่งไปตรงกับ "ราชมงคล" "ภูพิงคราชนิเวศน์"
   * "ราชดำริ" ทั่วประเทศ ผลเลยมีเชียงใหม่ สุรินทร์ กรุงเทพ เพชรบุรี ปนมากับโคราช
   * ทั้งที่ผู้ใช้ถามถึงที่เดียว
   */
  const overlaps = new Map<number, number>();
  const bestPerTerm = new Map<string, number>();
  for (const i of seen) {
    const name = INDEX[i].name;
    let best = 0;
    for (const term of terms) {
      const overlap = longestOverlap(term, name);
      if (overlap > best) best = overlap;
      if (overlap > (bestPerTerm.get(term) ?? 0)) bestPerTerm.set(term, overlap);
    }
    overlaps.set(i, best);
  }
  const bestOverlap = Math.max(0, ...bestPerTerm.values());

  const scored: Array<{ row: IndexedRow; score: number }> = [];
  // ตรงกันแค่ 3 ตัวอักษรทั้งที่ผู้ใช้พิมพ์มายาวกว่านั้นมาก แปลว่าไม่ได้ตรงอะไรจริง
  // ("สวัสดี" ไปตรงกับ "พระพันวัสสา" ที่ช่วง "วัส")
  const enough = bestOverlap >= MIN_GRAM + 1 || terms.some((t) => t.length === bestOverlap);
  for (const [i, overlap] of enough ? overlaps : []) {
    if (overlap < bestOverlap) continue;
    const row = INDEX[i];
    scored.push({
      row,
      score:
        overlap * 10 +
        (row.notable ? 6 : 0) +
        (row.curated ? 4 : 0) +
        (category && row.category === category ? 5 : 0),
    });
  }
  scored.sort((a, b) => b.score - a.score);

  const matchedByName = scored.length > 0 || areas.length > 0;

  /*
   * คำถามนี้ถามถึงสถานที่หรือเปล่า
   *
   * ผู้ช่วยเป็นตัวเดียวที่ตอบทั้งเรื่องที่เที่ยวและเรื่องการใช้งานเว็บ ถ้าค้น
   * สถานที่ให้ทุกคำถาม คำถามอย่าง "งบเหลือเท่าไร" จะลากสถานที่ 40 แห่งเข้า
   * prompt ไปด้วย เปลืองโควตาและล่อให้ผู้ช่วยพูดถึงที่เที่ยวทั้งที่ไม่มีใครถาม
   *
   * การจับชื่อได้อย่างเดียวเชื่อไม่ได้ ภาษาไทยเขียนติดกันจึงชนกันเองบ่อยมาก
   * เจอของจริง — "เพิ่มรูปความทรงจำยังไง" ไปตรงกับ "บ้านแห่งความทรงจำ" เต็ม ๆ
   * 9 ตัวอักษร และ "งบเหลือเท่าไร" ไปตรงกับ "บ้านก้านเหลือง"
   *
   * จึงนับว่าถามถึงสถานที่เมื่อเข้าข้อใดข้อหนึ่ง
   *   1. ใช้คำบอกประเภท (กิน/ที่พัก/เที่ยว/วัด) — บอกเจตนาชัดที่สุด
   *   2. เอ่ยชื่อจังหวัดหรืออำเภอมาตรง ๆ
   *   3. ช่วงที่ตรงกินพื้นที่เกินครึ่งของท่อนคำถาม — "เขาใหญ่" ตรงเต็ม 7 จาก 7
   *      ส่วน "ความทรงจำ" ตรงแค่ 9 จาก 21 ตัวของ "เพิ่มรูปความทรงจำยังไง"
   */
  let bestRatio = 0;
  for (const [term, overlap] of bestPerTerm) {
    if (term.length > 0) bestRatio = Math.max(bestRatio, overlap / term.length);
  }
  if (category === null && !namedAdminArea && bestRatio < 0.6) {
    return { rows: [], context: "", matchedByName: false };
  }

  // ที่ตรงชื่อเป๊ะสำคัญที่สุด ใส่ก่อน แต่กันที่ไว้ให้เพื่อนบ้านด้วย
  for (const { row } of scored.slice(0, 12)) add(row);

  /*
   * 3. ขยายไปทั้งอำเภอของผลที่ตรงชื่อ
   *
   * ขั้นนี้คือหัวใจของเคส "เขาใหญ่" — ที่เที่ยวในปากช่องส่วนใหญ่ไม่มีคำว่า
   * เขาใหญ่ อยู่ในชื่อ (ฟาร์มโชคชัย ไร่องุ่น ฯลฯ) ถ้าจับแต่ชื่อจะได้แค่ไม่กี่แห่ง
   * แล้วคำตอบจะบางจนไม่มีประโยชน์
   */
  for (const { row } of scored.slice(0, 12)) {
    if (row.district) addArea(row.province, row.district);
  }

  // 4. ไม่เจอชื่อสถานที่ในคำถามเลย ("มีอะไรน่ากินบ้าง") ใช้ที่เลือกไว้บนหน้าแทน
  if (areas.length === 0 && scope.province) {
    addArea(scope.province, scope.district ?? "");
  }

  for (const area of areas) {
    const neighbours = INDEX.filter(
      (r) =>
        r.province === area.province &&
        (area.district ? r.district === area.district : true),
    ).sort(
      (a, b) =>
        Number(b.curated) - Number(a.curated) ||
        Number(b.notable) - Number(a.notable) ||
        a.name.localeCompare(b.name, "th"),
    );

    // หมวดที่ผู้ใช้ถามถึงมาก่อน แต่ยังใส่หมวดอื่นตามหลังเผื่อถามต่อ
    const ordered = category
      ? [
          ...neighbours.filter((r) => r.category === category),
          ...neighbours.filter((r) => r.category !== category),
        ]
      : neighbours;
    for (const row of ordered) add(row);
  }

  return { rows: picked.map(stripInternal), context: toContext(picked), matchedByName };
}

function stripInternal({ curated, ...row }: IndexedRow): PlaceRow {
  void curated;
  return row;
}

function toContext(rows: IndexedRow[]): string {
  const lines: string[] = [];
  let total = 0;
  for (const row of rows) {
    const where = row.district
      ? `อ.${row.district} จ.${row.province}`
      : `จ.${row.province}`;
    const note = row.note ? ` — ${row.note.slice(0, 120)}` : "";
    const line = `- ${row.name} (${row.kind}, ${where})${note}`;
    if (total + line.length > MAX_CONTEXT_CHARS) break;
    total += line.length + 1;
    lines.push(line);
  }
  return lines.join("\n");
}

// ─── จับชื่อสถานที่จากคำตอบ ─────────────────────────────────────────────────

/**
 * หาสถานที่ที่โมเดลพูดถึงในคำตอบ เพื่อขึ้นเป็นปุ่ม "ใส่ในแผน"
 *
 * เทียบกับ rows ที่ *เราส่งไปเอง* เท่านั้น ผลพลอยได้คือถ้าโมเดลแต่งชื่อขึ้นมา
 * จากความรู้ทั่วไป ปุ่มจะไม่ขึ้น — ผู้ใช้จึงแยกออกเองว่าอันไหนมีในข้อมูลจริง
 * โดยไม่ต้องอ่านคำเตือน ที่กดใส่แผนได้ = ของที่ตรวจสอบแล้ว
 */
export function matchPlacesInAnswer(
  answer: string,
  rows: PlaceRow[],
  limit = 8,
): PlaceRow[] {
  // ชื่อยาวก่อน ไม่งั้น "เขาใหญ่" จะไปกินช่วงของ "เขาใหญ่อาร์ตมิวเซียม"
  // แล้วปุ่มจะพาไปผิดที่
  const byLength = [...rows].sort((a, b) => b.name.length - a.name.length);
  const used: Array<[number, number]> = [];
  const found: Array<{ row: PlaceRow; at: number }> = [];

  for (const row of byLength) {
    const at = answer.indexOf(row.name);
    if (at < 0) continue;
    const end = at + row.name.length;
    if (used.some(([s, e]) => at < e && s < end)) continue;
    used.push([at, end]);
    found.push({ row, at });
  }

  // เรียงตามลำดับที่โผล่ในคำตอบ ปุ่มจะได้ตรงกับที่อ่าน
  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map((f) => f.row);
}
