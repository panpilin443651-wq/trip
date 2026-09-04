import { EMPTY_BUDGETS } from "@/data/categories";
import { DEFAULT_FUEL_PRICE, DEFAULT_KM_PER_LITRE } from "./fuel";
import { todayISO } from "./format";
import { newId } from "./id";
import type {
  Activity,
  AppState,
  DayPlan,
  TravelLeg,
  TripLibrary,
} from "./types";

export const STORAGE_KEY = "travel-planner:state";
export const STATE_VERSION = 2;

export function createDefaultState(name = "ทริปของฉัน"): AppState {
  return {
    version: STATE_VERSION,
    id: newId(),
    createdAt: todayISO(),
    trip: {
      name,
      provinces: [],
      districts: {},
      dayPlans: [{ province: "", legs: [], note: "" }],
      mainTransport: "",
      startDate: todayISO(),
      dayCount: 1,
      travelers: 1,
      totalBudget: 0,
      budgets: { ...EMPTY_BUDGETS },
      notes: "",
      budgetNote: "",
      fuel: {
        kmPerLitre: DEFAULT_KM_PER_LITRE,
        pricePerLitre: DEFAULT_FUEL_PRICE,
        roundTrip: true,
      },
    },
    activities: [],
    expenses: [],
  };
}

/**
 * เติมฟิลด์ที่ขาดและตัดค่าที่ผิดรูปทิ้ง เพื่อให้ข้อมูลเก่า/ไฟล์ import
 * ที่ไม่สมบูรณ์ไม่ทำให้แอปพัง
 */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** เอาเฉพาะเลขบวก ไม่งั้นคืนค่าตั้งต้น */
function pos(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * แปลงช่วงการเดินทางที่อ่านมาให้เป็นรูปที่ใช้ได้
 *
 * ข้อมูลรุ่นก่อนเก็บวิธีเดินทางเดียวต่อวันในฟิลด์ transport จึงย้ายมาเป็น
 * ช่วงแรกให้ ไม่งั้นคนที่เคยเลือกไว้จะเห็นช่องว่างเปล่าหลังอัปเดต
 */
function fitLegs(item: Record<string, unknown> | undefined): TravelLeg[] {
  const raw = item?.legs;
  if (Array.isArray(raw)) {
    return raw
      .filter((leg): leg is Record<string, unknown> => !!leg && typeof leg === "object")
      .map((leg) => ({
        id: str(leg.id) || newId(),
        from: str(leg.from),
        to: str(leg.to),
        transport: str(leg.transport),
        note: str(leg.note),
      }));
  }

  const legacy = str(item?.transport);
  if (!legacy) return [];
  return [
    { id: newId(), from: "", to: str(item?.province), transport: legacy, note: "" },
  ];
}

/** ทำให้ dayPlans ยาวเท่า dayCount เสมอ เผื่อจำนวนวันถูกเปลี่ยน */
export function fitDayPlans(plans: unknown, dayCount: number): DayPlan[] {
  const list = Array.isArray(plans) ? plans : [];
  return Array.from({ length: dayCount }, (_, i) => {
    const item = list[i] as Record<string, unknown> | undefined;
    return {
      province: str(item?.province),
      legs: fitLegs(item),
      note: str(item?.note),
    };
  });
}

/**
 * เติมรายการกิจกรรมให้ข้อมูลรุ่นเก่า
 *
 * เดิมหนึ่งรายการมีกิจกรรมได้อย่างเดียวเก็บไว้ในฟิลด์ title ตอนนี้ใส่ได้หลายอย่าง
 * ของเก่าจึงต้องยกชื่อเดิมมาเป็นกิจกรรมแรก ยกเว้นกรณีที่ title เท่ากับชื่อสถานที่
 * ซึ่งแปลว่าตอนนั้นผู้ใช้ไม่ได้กรอกกิจกรรม แค่บันทึกว่าแวะที่นั่น
 */
function normalizeActivity(raw: Activity): Activity {
  const list = Array.isArray(raw.activities)
    ? raw.activities.filter((a): a is string => typeof a === "string" && !!a.trim())
    : undefined;
  if (list) return { ...raw, activities: [...new Set(list.map((a) => a.trim()))] };

  const title = (raw.title ?? "").trim();
  const place = (raw.placeName ?? "").trim();
  return { ...raw, activities: title && title !== place ? [title] : [] };
}

export function normalizeState(raw: unknown): AppState {
  const base = createDefaultState();
  if (!raw || typeof raw !== "object") return base;

  const input = raw as Partial<AppState>;
  const trip = { ...base.trip, ...(input.trip ?? {}) };

  // ข้อมูลรุ่นเก่าเก็บจังหวัดเดียวในชื่อ destination — ย้ายเข้า provinces ให้
  // ค่าเริ่มต้นของ provinces เป็น array ว่างอยู่แล้ว จึงต้องเช็กว่า "ว่าง" ด้วย
  // ไม่ใช่เช็กแค่ว่าเป็น array หรือไม่ ไม่งั้นข้อมูลเก่าจะถูกทิ้ง
  const cleaned = Array.isArray(trip.provinces)
    ? trip.provinces.filter(
        (p): p is string => typeof p === "string" && !!p.trim(),
      )
    : [];

  const safeDayCount = Math.max(1, Math.round(Number(trip.dayCount) || 1));

  const legacy = (input.trip as { destination?: unknown } | undefined)
    ?.destination;
  const provinces =
    cleaned.length > 0
      ? cleaned
      : typeof legacy === "string" && legacy.trim()
        ? [legacy.trim()]
        : [];

  return {
    version: STATE_VERSION,
    // ข้อมูลรุ่นก่อนไม่มี id/createdAt เพราะตอนนั้นเก็บได้ทริปเดียว
    id: typeof input.id === "string" && input.id ? input.id : newId(),
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : trip.startDate || todayISO(),
    trip: {
      ...trip,
      dayCount: safeDayCount,
      travelers: Math.max(1, Math.round(Number(trip.travelers) || 1)),
      totalBudget: Math.max(0, Number(trip.totalBudget) || 0),
      budgets: { ...EMPTY_BUDGETS, ...(trip.budgets ?? {}) },
      // ข้อมูลรุ่นก่อนไม่มีก้อนนี้ และช่องกรอกอาจถูกล้างจนเป็น 0 ซึ่งจะทำให้
      // หารแล้วได้ Infinity จึงดึงกลับมาเป็นค่าตั้งต้นเมื่อไม่ใช่เลขบวก
      fuel: {
        kmPerLitre: pos(trip.fuel?.kmPerLitre, DEFAULT_KM_PER_LITRE),
        pricePerLitre: pos(trip.fuel?.pricePerLitre, DEFAULT_FUEL_PRICE),
        roundTrip: trip.fuel?.roundTrip !== false,
      },
      provinces: [...new Set(provinces)],
      // เก็บเฉพาะอำเภอของจังหวัดที่ยังอยู่ในแผน กันข้อมูลค้างหลังเอาจังหวัดออก
      districts: Object.fromEntries(
        Object.entries(
          (trip.districts ?? {}) as Record<string, unknown>,
        ).flatMap(([province, list]) =>
          provinces.includes(province) && Array.isArray(list)
            ? [[province, [...new Set(list.filter((d) => typeof d === "string"))]]]
            : [],
        ),
      ),
      dayPlans: fitDayPlans(trip.dayPlans, safeDayCount),
      mainTransport:
        typeof trip.mainTransport === "string" ? trip.mainTransport : "",
    },
    activities: Array.isArray(input.activities)
      ? input.activities
          .filter((a) => a && typeof a.id === "string")
          .map(normalizeActivity)
      : [],
    expenses: Array.isArray(input.expenses)
      ? input.expenses.filter((e) => e && typeof e.id === "string")
      : [],
  };
}

// ── คลังแผนหลายทริป ─────────────────────────────────────────────────

export function createDefaultLibrary(): TripLibrary {
  const first = createDefaultState();
  return { version: STATE_VERSION, activeTripId: first.id, trips: [first] };
}

/**
 * อ่านคลังแผนจากข้อมูลดิบ รองรับทั้งรูปแบบใหม่และรูปแบบทริปเดียวของเดิม
 *
 * ข้อมูลรุ่นก่อนเป็น AppState ก้อนเดียวไม่มีฟิลด์ trips จึงห่อให้เป็นคลัง
 * ที่มีแผนเดียว ผู้ใช้เดิมจะได้เห็นแผนของตัวเองเหมือนเดิมหลังอัปเดต
 *
 * การันตีว่าคืนคลังที่มีอย่างน้อยหนึ่งแผนเสมอ และ activeTripId ชี้ไปที่แผน
 * ที่มีอยู่จริง ทุกหน้าจึงไม่ต้องเช็กกรณีคลังว่าง
 */
export function normalizeLibrary(raw: unknown): TripLibrary {
  if (!raw || typeof raw !== "object") return createDefaultLibrary();

  const input = raw as Partial<TripLibrary>;
  if (!Array.isArray(input.trips)) {
    // รูปแบบเดิม — ทั้งก้อนคือแผนเดียว
    const only = normalizeState(raw);
    return { version: STATE_VERSION, activeTripId: only.id, trips: [only] };
  }

  const trips = input.trips.map((t) => normalizeState(t));
  if (trips.length === 0) return createDefaultLibrary();

  // ไอดีซ้ำจะทำให้สลับแผนแล้วไปโดนผิดอัน ออกไอดีใหม่ให้ตัวที่ซ้ำ
  const seen = new Set<string>();
  const unique = trips.map((t) =>
    seen.has(t.id) ? { ...t, id: newId() } : (seen.add(t.id), t),
  );

  const activeTripId = unique.some((t) => t.id === input.activeTripId)
    ? (input.activeTripId as string)
    : unique[0].id;

  return { version: STATE_VERSION, activeTripId, trips: unique };
}

/** แผนที่เปิดอยู่ — normalizeLibrary การันตีว่ามีเสมอ */
export function activeTrip(library: TripLibrary): AppState {
  return (
    library.trips.find((t) => t.id === library.activeTripId) ?? library.trips[0]
  );
}

/** แผนนี้มีอะไรอยู่บ้างไหม ใช้ตัดสินว่าควรยกของเก่าขึ้นคลาวด์หรือเตือนก่อนลบ */
export function isTripEmpty(state: AppState): boolean {
  return (
    state.activities.length === 0 &&
    state.expenses.length === 0 &&
    state.trip.provinces.length === 0
  );
}

export function loadLibrary(): TripLibrary {
  if (typeof window === "undefined") return createDefaultLibrary();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultLibrary();
    return normalizeLibrary(JSON.parse(raw));
  } catch {
    // JSON พัง หรือ localStorage ถูกปิด — เริ่มใหม่แทนที่จะให้แอปล่ม
    return createDefaultLibrary();
  }
}

export function saveLibrary(library: TripLibrary): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    // เต็มโควตา หรืออยู่ในโหมดส่วนตัว — ข้ามไปเงียบ ๆ
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ไม่ต้องทำอะไร
  }
}
