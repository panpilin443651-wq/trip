export interface SuggestedPlace {
  id: string;
  name: string;
  emoji: string;
  /** ประเภทสั้น ๆ เช่น วัด, ธรรมชาติ, ตลาด */
  tag: string;
  description: string;
  lat: number;
  lng: number;
  /** อำเภอ/เขต ที่สถานที่นี้ตั้งอยู่ (เติมด้วย scripts/fill-districts.js) */
  district?: string;
  /** เวลาที่ควรเผื่อไว้ในสถานที่นี้ (นาที) */
  durationMin: number;
  /** ค่าเข้าโดยประมาณต่อคน (บาท) 0 = ไม่มีค่าเข้า */
  fee: number;
  bestTime: string;
  tip: string;
}

export interface SuggestedActivity {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** ราคาโดยประมาณต่อคน (บาท) */
  price: string;
  duration: string;
  prepare: string;
}

export type Region =
  | "ภาคเหนือ"
  | "ภาคตะวันออกเฉียงเหนือ"
  | "ภาคกลาง"
  | "ภาคตะวันออก"
  | "ภาคตะวันตก"
  | "ภาคใต้";

export const REGIONS: Region[] = [
  "ภาคเหนือ",
  "ภาคตะวันออกเฉียงเหนือ",
  "ภาคกลาง",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
  "ภาคใต้",
];

export interface Province {
  id: string;
  name: string;
  emoji: string;
  region: Region;
  blurb: string;
  center: { lat: number; lng: number };
  places: SuggestedPlace[];
  activities: SuggestedActivity[];
}
