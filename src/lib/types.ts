export type CategoryId =
  | "transport"
  | "accommodation"
  | "food"
  | "attraction"
  | "shopping"
  | "other";

export type Priority = "high" | "medium" | "low";

/**
 * ช่วงการเดินทางหนึ่งช่วง เช่น กรุงเทพฯ → เชียงใหม่ ด้วยเครื่องบิน
 *
 * แยกเป็นช่วง ๆ แทนที่จะเก็บวิธีเดินทางเดียวต่อวัน เพราะวันเดียวมักใช้
 * หลายวิธี เช่น บินลงเชียงใหม่ตอนเช้าแล้วเช่ารถขึ้นดอยอินทนนท์ต่อ
 */
export interface TravelLeg {
  id: string;
  /** ต้นทาง ว่างได้ถ้ายังไม่ระบุ */
  from: string;
  /** ปลายทาง */
  to: string;
  /** วิธีเดินทางของช่วงนี้ (ดู src/data/transport.ts) ว่าง = ยังไม่ระบุ */
  transport: string;
  /** รายละเอียดของช่วงนี้ เช่น TG104 09:30 / เช่ารถที่สนามบิน */
  note: string;
}

/** จังหวัดและช่วงการเดินทางของแต่ละวันในแผน */
export interface DayPlan {
  /** จังหวัดที่เที่ยวในวันนั้น ว่าง = ยังไม่ระบุ */
  province: string;
  /** ช่วงการเดินทางของวันนั้น เรียงตามลำดับที่เดินทางจริง */
  legs: TravelLeg[];
  /** บันทึกรวมของวันนั้น เช่น เช็กอินโรงแรมก่อนบ่ายสาม */
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
  /** วิธีเดินทางหลักของทริป ใช้คำนวณประมาณการค่าใช้จ่าย (ดู src/data/transport.ts) */
  mainTransport: string;
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
  /**
   * ชื่อที่ใช้แสดงในที่แคบ ๆ เช่นหมุดบนแผนที่และรายการค่าใช้จ่าย
   * ตั้งอัตโนมัติจากกิจกรรมแรก ถ้าไม่มีกิจกรรมก็ใช้ชื่อสถานที่
   */
  title: string;
  placeName: string;
  /**
   * สิ่งที่จะทำที่สถานที่นี้ ใส่ได้หลายอย่าง เช่น ["ไหว้พระ", "ถ่ายรูป"]
   * ไม่ใส่ก็ได้ ถือว่าแค่แวะไปที่นั่น
   */
  activities?: string[];
  /** จังหวัดของกิจกรรมนี้ ค่าเริ่มต้นมาจากจังหวัดของวันนั้น */
  province?: string;
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
