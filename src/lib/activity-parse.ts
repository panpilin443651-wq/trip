/**
 * อ่านราคาและระยะเวลาของกิจกรรมแนะนำ ที่เขียนไว้เป็นข้อความภาษาคน
 *
 * ข้อมูลกิจกรรมใน src/data/provinces/*.ts เขียนให้คนอ่าน ไม่ใช่ให้เครื่องอ่าน
 * — "150–400 บาท/คน", "ครึ่งวัน–เต็มวัน", "ฟรี–4,000 บาท (แล้วแต่งาน)"
 * แต่การใส่ลงแผนต้องการตัวเลข (นาที และบาท) จึงต้องแปลงตรงนี้
 *
 * ค่าที่ได้เป็นค่าประมาณเพื่อตั้งต้นเท่านั้น ข้อความเดิมยังถูกเก็บไว้ในราย
 * ละเอียดของกิจกรรม ผู้ใช้จึงเห็นช่วงจริงและแก้ตัวเลขเองได้ที่หน้าแผนเที่ยว
 */

/** ตัดข้อความในวงเล็บทิ้งก่อน มักเป็นหมายเหตุที่มีตัวเลขปนมาแล้วทำให้อ่านผิด */
function stripNotes(text: string): string {
  return text.replace(/\([^)]*\)/g, " ");
}

/** ดึงตัวเลขทั้งหมด รองรับจุดทศนิยมและเครื่องหมายคั่นหลักพัน */
function numbersIn(text: string): number[] {
  const found = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found
    .map((raw) => Number(raw.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

/** กลางช่วง ถ้ามีเลขเดียวก็คืนเลขนั้น */
function middle(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  return (Math.min(...values) + Math.max(...values)) / 2;
}

/**
 * ช่วงเวลาที่เขียนเป็นคำ ไม่มีตัวเลขให้จับ
 *
 * "วัน" หนึ่งวันเที่ยวคิดเป็น 8 ชั่วโมง ไม่ใช่ 24 เพราะไม่มีใครเที่ยวข้ามคืนรวด
 */
const PHRASE_MINUTES: Array<[RegExp, number]> = [
  [/ครึ่งวัน/, 240],
  [/ครึ่งคืน/, 240],
  [/เต็มวัน|ทั้งวัน/, 480],
  [/ทั้งคืน|ข้ามคืน/, 480],
];

const MIN_DURATION = 15;
const MAX_DURATION = 720;
/** ใช้เมื่ออ่านไม่ออก — สองชั่วโมงเป็นค่ากลางของกิจกรรมส่วนใหญ่ในชุดข้อมูล */
const FALLBACK_DURATION = 120;

/**
 * แปลงข้อความระยะเวลาเป็นจำนวนนาที
 *
 * ใช้ "กลางช่วง" ไม่ใช่ค่าต่ำสุดหรือสูงสุด — ค่าต่ำสุดทำให้กิจกรรมถัดไปทับเวลากัน
 * ส่วนค่าสูงสุดทำให้จองเวลาไว้เกินจนใส่อะไรต่อในวันนั้นไม่ได้
 * ปัดเป็นช่วง 15 นาทีเพราะไม่มีใครวางแผนละเอียดกว่านั้น
 */
export function parseDurationMin(text: string): number {
  const clean = stripNotes(text);
  const values = numbersIn(clean);

  let minutes: number;
  if (values.length > 0) {
    const unit = /นาที/.test(clean) ? 1 : /วัน|คืน/.test(clean) ? 480 : 60;
    minutes = middle(values) * unit;
  } else {
    const hits = PHRASE_MINUTES.filter(([re]) => re.test(clean)).map(
      ([, m]) => m,
    );
    minutes = middle(hits);
  }

  if (!Number.isFinite(minutes) || minutes <= 0) return FALLBACK_DURATION;
  const rounded = Math.round(minutes / 15) * 15;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, rounded));
}

/**
 * แปลงข้อความราคาเป็นจำนวนบาท
 *
 * "ฟรี" นับเป็น 0 และยังเป็นขอบล่างของช่วงได้ ("ฟรี–100 บาท" = 0 ถึง 100)
 * ปัดเป็นหลักสิบเพราะเป็นค่าประมาณอยู่แล้ว การโชว์ 275 บาททำให้ดูแม่นเกินจริง
 */
export function parsePriceTHB(text: string): number {
  const clean = stripNotes(text);
  const values = numbersIn(clean);
  if (/ฟรี|ไม่มีค่า|ไม่เสียค่า/.test(clean)) values.push(0);
  if (values.length === 0) return 0;

  const amount = middle(values);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount / 10) * 10;
}
