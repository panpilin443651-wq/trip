import { EMPTY_BUDGETS } from "@/data/categories";
import { todayISO } from "./format";
import { newId } from "./id";
import type { AppState, DayPlan, TravelLeg } from "./types";

export const STORAGE_KEY = "travel-planner:state";
export const STATE_VERSION = 1;

export function createDefaultState(): AppState {
  return {
    version: STATE_VERSION,
    trip: {
      name: "ทริปของฉัน",
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
    },
    activities: [],
    expenses: [],
    places: [],
    checklist: [],
  };
}

/**
 * เติมฟิลด์ที่ขาดและตัดค่าที่ผิดรูปทิ้ง เพื่อให้ข้อมูลเก่า/ไฟล์ import
 * ที่ไม่สมบูรณ์ไม่ทำให้แอปพัง
 */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
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
    trip: {
      ...trip,
      dayCount: safeDayCount,
      travelers: Math.max(1, Math.round(Number(trip.travelers) || 1)),
      totalBudget: Math.max(0, Number(trip.totalBudget) || 0),
      budgets: { ...EMPTY_BUDGETS, ...(trip.budgets ?? {}) },
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
      ? input.activities.filter((a) => a && typeof a.id === "string")
      : [],
    expenses: Array.isArray(input.expenses)
      ? input.expenses.filter((e) => e && typeof e.id === "string")
      : [],
    places: Array.isArray(input.places)
      ? input.places.filter((p) => p && typeof p.id === "string")
      : [],
    checklist: Array.isArray(input.checklist)
      ? input.checklist.filter((c) => c && typeof c.id === "string")
      : [],
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    // JSON พัง หรือ localStorage ถูกปิด — เริ่มใหม่แทนที่จะให้แอปล่ม
    return createDefaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
