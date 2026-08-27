import { EMPTY_BUDGETS } from "@/data/categories";
import { todayISO } from "./format";
import type { AppState } from "./types";

export const STORAGE_KEY = "travel-planner:state";
export const STATE_VERSION = 1;

export function createDefaultState(): AppState {
  return {
    version: STATE_VERSION,
    trip: {
      name: "ทริปของฉัน",
      destination: "",
      startDate: todayISO(),
      dayCount: 1,
      travelers: 1,
      totalBudget: 0,
      budgets: { ...EMPTY_BUDGETS },
      notes: "",
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
export function normalizeState(raw: unknown): AppState {
  const base = createDefaultState();
  if (!raw || typeof raw !== "object") return base;

  const input = raw as Partial<AppState>;
  const trip = { ...base.trip, ...(input.trip ?? {}) };

  return {
    version: STATE_VERSION,
    trip: {
      ...trip,
      dayCount: Math.max(1, Math.round(Number(trip.dayCount) || 1)),
      travelers: Math.max(1, Math.round(Number(trip.travelers) || 1)),
      totalBudget: Math.max(0, Number(trip.totalBudget) || 0),
      budgets: { ...EMPTY_BUDGETS, ...(trip.budgets ?? {}) },
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
