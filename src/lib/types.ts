export type CategoryId =
  | "transport"
  | "accommodation"
  | "food"
  | "attraction"
  | "shopping"
  | "other";

export type Priority = "high" | "medium" | "low";

/** จังหวัดและวิธีเดินทางของแต่ละวันในแผน */
export interface DayPlan {
  /** จังหวัดที่เที่ยวในวันนั้น ว่าง = ยังไม่ระบุ */
  province: string;
  /** วิธีเดินทางหลักของวันนั้น (ดู src/data/transport.ts) ว่าง = ยังไม่ระบุ */
  transport: string;
  /** บันทึกการเดินทาง เช่น เที่ยวบิน TG104 / รถไฟขบวน 109 */
  note: string;
}

export interface Trip {
  name: string;
  /** จังหวัดที่จะไปในทริปนี้ ไปได้หลายจังหวัดในทริปเดียว */
  provinces: string[];
  /** อำเภอที่เลือกในแต่ละจังหวัด เช่น { "เชียงใหม่": ["เมืองเชียงใหม่", "แม่ริม"] } */
  districts: Record<string, string[]>;
  /** แผนรายวัน ความยาวเท่ากับ dayCount เสมอ (normalizeState คุมให้) */
  dayPlans: DayPlan[];
  /** ISO date 'YYYY-MM-DD' */
  startDate: string;
  /** 1 = day trip, > 1 = ทริปหลายวัน */
  dayCount: number;
  travelers: number;
  totalBudget: number;
  /** งบที่ตั้งไว้แต่ละหมวด */
  budgets: Record<CategoryId, number>;
  notes: string;
  /** บันทึกช่วยจำเรื่องงบ เช่น จ่ายมัดจำไปแล้วเท่าไร หารกันยังไง */
  budgetNote: string;
}

export interface Activity {
  id: string;
  /** 0-based */
  dayIndex: number;
  /** 'HH:MM' */
  startTime: string;
  /** เวลาที่ใช้ในสถานที่นั้น (นาที) */
  durationMin: number;
  title: string;
  placeName: string;
  detail: string;
  cost: number;
  category: CategoryId;
  lat?: number;
  lng?: number;
  /** พาธรูปความทรงจำใน Supabase Storage (บัคเก็ต trip-photos) */
  photos?: string[];
  /** ลำดับที่สร้าง ใช้ตัดสินเมื่อเวลาเริ่มเท่ากัน */
  order: number;
}

/** ค่าใช้จ่ายที่ไม่ได้ผูกกับกิจกรรม เช่น ที่พัก ค่าน้ำมัน */
export interface Expense {
  id: string;
  label: string;
  amount: number;
  category: CategoryId;
}

export interface Place {
  id: string;
  name: string;
  province: string;
  note: string;
  priority: Priority;
  visited: boolean;
  lat?: number;
  lng?: number;
}

export interface ChecklistItem {
  id: string;
  group: string;
  text: string;
  done: boolean;
}

export interface AppState {
  version: number;
  trip: Trip;
  activities: Activity[];
  expenses: Expense[];
  places: Place[];
  checklist: ChecklistItem[];
}

export interface LatLng {
  lat: number;
  lng: number;
}
