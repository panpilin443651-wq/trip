"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { newId } from "./id";
import { timeToMinutes, todayISO } from "./format";
import {
  activeTrip,
  clearState,
  createDefaultLibrary,
  createDefaultState,
  fitDayPlans,
  isTripEmpty,
  loadLibrary,
  normalizeState,
  saveLibrary,
} from "./storage";
import {
  loadRemoteLibrary,
  saveRemoteLibrary,
} from "./supabase/trip-store";
import type {
  Activity,
  AppState,
  DayPlan,
  ChecklistItem,
  Expense,
  Place,
  Trip,
  TripLibrary,
} from "./types";

type Action =
  | { type: "replace"; state: AppState }
  | { type: "updateTrip"; patch: Partial<Trip> }
  | { type: "setDayCount"; dayCount: number }
  | { type: "setDayPlan"; dayIndex: number; patch: Partial<DayPlan> }
  | { type: "addActivity"; activity: Omit<Activity, "id" | "order"> }
  | { type: "updateActivity"; id: string; patch: Partial<Activity> }
  | { type: "deleteActivity"; id: string }
  | { type: "addExpense"; expense: Omit<Expense, "id"> }
  | { type: "updateExpense"; id: string; patch: Partial<Expense> }
  | { type: "deleteExpense"; id: string }
  | { type: "addPlace"; place: Omit<Place, "id"> }
  | { type: "updatePlace"; id: string; patch: Partial<Place> }
  | { type: "deletePlace"; id: string }
  | { type: "addChecklistItems"; items: Array<Omit<ChecklistItem, "id">> }
  | { type: "updateChecklistItem"; id: string; patch: Partial<ChecklistItem> }
  | { type: "deleteChecklistItem"; id: string };

/** คำสั่งที่ทำกับคลังแผน ไม่ใช่กับเนื้อในของแผนใดแผนหนึ่ง */
type LibraryAction =
  | { type: "replaceLibrary"; library: TripLibrary }
  | { type: "createTrip"; name?: string }
  | { type: "switchTrip"; id: string }
  | { type: "deleteTrip"; id: string }
  | { type: "duplicateTrip"; id: string }
  | { type: "addTrip"; state: AppState };

export type TripAction = Action | LibraryAction;

function nextOrder(activities: Activity[]): number {
  return activities.reduce((max, a) => Math.max(max, a.order), 0) + 1;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "replace":
      return action.state;

    case "updateTrip":
      return { ...state, trip: { ...state.trip, ...action.patch } };

    case "setDayCount": {
      const dayCount = Math.max(1, Math.round(action.dayCount));
      const lastIndex = dayCount - 1;
      // ย้ายกิจกรรมของวันที่หายไปมาไว้วันสุดท้าย แทนที่จะลบทิ้งเงียบ ๆ
      const activities = state.activities.map((a) =>
        a.dayIndex > lastIndex ? { ...a, dayIndex: lastIndex } : a,
      );
      return {
        ...state,
        // dayPlans ต้องยาวเท่าจำนวนวันเสมอ ไม่งั้นวันที่เพิ่มมาจะไม่มีที่เก็บ
        trip: {
          ...state.trip,
          dayCount,
          dayPlans: fitDayPlans(state.trip.dayPlans, dayCount),
        },
        activities,
      };
    }

    case "setDayPlan": {
      const dayPlans = fitDayPlans(state.trip.dayPlans, state.trip.dayCount).map(
        (plan, i) =>
          i === action.dayIndex ? { ...plan, ...action.patch } : plan,
      );
      return { ...state, trip: { ...state.trip, dayPlans } };
    }

    case "addActivity":
      return {
        ...state,
        activities: [
          ...state.activities,
          { ...action.activity, id: newId(), order: nextOrder(state.activities) },
        ],
      };

    case "updateActivity":
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id ? { ...a, ...action.patch } : a,
        ),
      };

    case "deleteActivity":
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.id),
      };

    case "addExpense":
      return {
        ...state,
        expenses: [...state.expenses, { ...action.expense, id: newId() }],
      };

    case "updateExpense":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      };

    case "deleteExpense":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      };

    case "addPlace":
      return {
        ...state,
        places: [...state.places, { ...action.place, id: newId() }],
      };

    case "updatePlace":
      return {
        ...state,
        places: state.places.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      };

    case "deletePlace":
      return {
        ...state,
        places: state.places.filter((p) => p.id !== action.id),
      };

    case "addChecklistItems": {
      const existing = new Set(
        state.checklist.map((c) => `${c.group}::${c.text}`),
      );
      const fresh = action.items
        .filter((item) => !existing.has(`${item.group}::${item.text}`))
        .map((item) => ({ ...item, id: newId() }));
      return { ...state, checklist: [...state.checklist, ...fresh] };
    }

    case "updateChecklistItem":
      return {
        ...state,
        checklist: state.checklist.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };

    case "deleteChecklistItem":
      return {
        ...state,
        checklist: state.checklist.filter((c) => c.id !== action.id),
      };

    default:
      return state;
  }
}

/** ตั้งชื่อแผนใหม่ไม่ให้ซ้ำกับที่มีอยู่ เช่น "ทริปใหม่ 2" */
function untitledName(trips: AppState[]): string {
  const base = "ทริปใหม่";
  const taken = new Set(trips.map((t) => t.trip.name.trim()));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

/**
 * ตัวจัดการคลังแผน
 *
 * คำสั่งที่ไม่ใช่เรื่องคลัง จะถูกส่งต่อไปให้ reducer ของแผนที่เปิดอยู่
 * ทุกหน้าจึง dispatch เหมือนเดิมได้โดยไม่ต้องรู้ว่ามีหลายแผน
 */
function libraryReducer(
  library: TripLibrary,
  action: TripAction,
): TripLibrary {
  switch (action.type) {
    case "replaceLibrary":
      return action.library;

    case "createTrip": {
      const fresh = createDefaultState(
        action.name?.trim() || untitledName(library.trips),
      );
      return {
        ...library,
        trips: [...library.trips, fresh],
        activeTripId: fresh.id,
      };
    }

    case "addTrip":
      return {
        ...library,
        trips: [...library.trips, action.state],
        activeTripId: action.state.id,
      };

    case "duplicateTrip": {
      const source = library.trips.find((t) => t.id === action.id);
      if (!source) return library;
      // ต้องออกไอดีใหม่ให้ทุกอย่างข้างใน ไม่งั้นแก้ของก๊อปแล้วไปโดนต้นฉบับด้วย
      const copy: AppState = {
        ...source,
        id: newId(),
        createdAt: todayISO(),
        trip: { ...source.trip, name: `${source.trip.name} (สำเนา)` },
        activities: source.activities.map((a) => ({ ...a, id: newId() })),
        expenses: source.expenses.map((e) => ({ ...e, id: newId() })),
        places: source.places.map((p) => ({ ...p, id: newId() })),
        checklist: source.checklist.map((c) => ({ ...c, id: newId() })),
      };
      return {
        ...library,
        trips: [...library.trips, copy],
        activeTripId: copy.id,
      };
    }

    case "switchTrip":
      return library.trips.some((t) => t.id === action.id)
        ? { ...library, activeTripId: action.id }
        : library;

    case "deleteTrip": {
      const rest = library.trips.filter((t) => t.id !== action.id);
      // ต้องเหลืออย่างน้อยหนึ่งแผนเสมอ ลบอันสุดท้ายให้กลายเป็นแผนเปล่าแทน
      if (rest.length === 0) {
        const fresh = createDefaultState();
        return { ...library, trips: [fresh], activeTripId: fresh.id };
      }
      return {
        ...library,
        trips: rest,
        activeTripId: rest.some((t) => t.id === library.activeTripId)
          ? library.activeTripId
          : rest[0].id,
      };
    }

    default:
      return {
        ...library,
        trips: library.trips.map((t) =>
          t.id === library.activeTripId ? reducer(t, action) : t,
        ),
      };
  }
}

export type SyncStatus =
  | { phase: "loading" }
  | { phase: "ready"; migrated?: boolean }
  | { phase: "error"; message: string };

/** ข้อมูลย่อของแต่ละแผน สำหรับแสดงในรายการสลับแผน */
export interface TripSummary {
  id: string;
  name: string;
  startDate: string;
  dayCount: number;
  provinces: string[];
  activityCount: number;
  totalBudget: number;
  isActive: boolean;
}

interface TripContextValue {
  /** แผนที่เปิดอยู่ — ทุกหน้าอ่านตัวนี้เหมือนเดิม */
  state: AppState;
  /** id ผู้ใช้ที่ล็อกอินอยู่ ใช้เป็นโฟลเดอร์เก็บรูปใน Storage */
  userId: string;
  dispatch: React.Dispatch<TripAction>;
  /** รายการแผนทั้งหมด เรียงแผนที่สร้างล่าสุดไว้บน */
  trips: TripSummary[];
  createTrip: (name?: string) => void;
  switchTrip: (id: string) => void;
  deleteTrip: (id: string) => void;
  duplicateTrip: (id: string) => void;
  /** กิจกรรมของวันหนึ่ง เรียงตามเวลาเริ่ม */
  activitiesForDay: (dayIndex: number) => Activity[];
  /**
   * เขียนลง localStorage ทันทีโดยไม่รอ debounce
   * รับ patch ของ trip ได้ เพราะ dispatch ที่เพิ่งเรียกยังไม่สะท้อนใน state
   * ตอนที่ event handler ทำงานอยู่ ถ้าไม่ส่งมาจะบันทึกค่าเก่า
   */
  saveNow: (tripPatch?: Partial<Trip>) => void;
  /** เวลาที่บันทึกสำเร็จครั้งล่าสุด (epoch ms) */
  lastSavedAt: number | null;
  /** สถานะการซิงก์กับ Supabase */
  sync: SyncStatus;
  exportJSON: () => void;
  importJSON: (file: File) => Promise<void>;
  resetAll: () => void;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [library, dispatch] = useReducer(
    libraryReducer,
    null,
    createDefaultLibrary,
  );
  const state = activeTrip(library);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ phase: "loading" });

  /**
   * โหลดแผนจาก Supabase ครั้งเดียวตอนเข้า
   * ถ้าบัญชียังไม่มีข้อมูล แต่เครื่องนี้มีของเก่าใน localStorage
   * ให้ยกของเก่าขึ้นคลาวด์ให้เลย ผู้ใช้จะได้ไม่เสียแผนที่ทำไว้ก่อนมี Supabase
   */
  useEffect(() => {
    let cancelled = false;

    loadRemoteLibrary(userId).then(async ({ library: remote, error }) => {
      if (cancelled) return;

      if (error) {
        setSync({ phase: "error", message: error });
        return;
      }

      if (remote) {
        dispatch({ type: "replaceLibrary", library: remote });
        setSync({ phase: "ready" });
        return;
      }

      const local = loadLibrary();
      const hasLocalData = local.trips.some((t) => !isTripEmpty(t));

      if (hasLocalData) {
        const saveError = await saveRemoteLibrary(userId, local);
        if (cancelled) return;
        dispatch({ type: "replaceLibrary", library: local });
        setSync(
          saveError
            ? { phase: "error", message: saveError }
            : { phase: "ready", migrated: true },
        );
        return;
      }

      setSync({ phase: "ready" });
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // บันทึกขึ้น Supabase แบบหน่วงเวลา และสำรองไว้ใน localStorage ด้วย
  // เผื่อเน็ตหลุด จะได้ไม่เสียงานที่เพิ่งพิมพ์
  useEffect(() => {
    if (sync.phase !== "ready") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      saveLibrary(library);
      void saveRemoteLibrary(userId, library).then((error) => {
        setSync(
          error ? { phase: "error", message: error } : { phase: "ready" },
        );
        if (!error) setLastSavedAt(Date.now());
      });
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [library, sync.phase, userId]);

  const value = useMemo<TripContextValue>(
    () => ({
      state,
      userId,
      dispatch,
      activitiesForDay: (dayIndex: number) =>
        state.activities
          .filter((a) => a.dayIndex === dayIndex)
          .sort(
            (a, b) =>
              timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
              a.order - b.order,
          ),
      trips: [...library.trips]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((t) => ({
          id: t.id,
          name: t.trip.name,
          startDate: t.trip.startDate,
          dayCount: t.trip.dayCount,
          provinces: t.trip.provinces,
          activityCount: t.activities.length,
          totalBudget: t.trip.totalBudget,
          isActive: t.id === library.activeTripId,
        })),
      createTrip: (name?: string) => dispatch({ type: "createTrip", name }),
      switchTrip: (id: string) => dispatch({ type: "switchTrip", id }),
      deleteTrip: (id: string) => dispatch({ type: "deleteTrip", id }),
      duplicateTrip: (id: string) => dispatch({ type: "duplicateTrip", id }),
      saveNow: (tripPatch?: Partial<Trip>) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const next: TripLibrary = tripPatch
          ? {
              ...library,
              trips: library.trips.map((t) =>
                t.id === library.activeTripId
                  ? { ...t, trip: { ...t.trip, ...tripPatch } }
                  : t,
              ),
            }
          : library;
        saveLibrary(next);
        void saveRemoteLibrary(userId, next).then((error) => {
          if (error) setSync({ phase: "error", message: error });
          else setLastSavedAt(Date.now());
        });
      },
      lastSavedAt,
      sync,
      exportJSON: () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `travel-planner-${state.trip.startDate}.json`;
        link.click();
        URL.revokeObjectURL(url);
      },
      importJSON: async (file: File) => {
        // เพิ่มเป็นแผนใหม่ ไม่ทับของเดิม ไฟล์ที่ export ไว้ก่อนหน้านี้เป็นแผนเดียว
        // normalizeState จึงอ่านได้ตรง ๆ และต้องออกไอดีใหม่กันชนกับแผนที่มีอยู่
        const text = await file.text();
        const loaded = normalizeState(JSON.parse(text));
        dispatch({ type: "addTrip", state: { ...loaded, id: newId() } });
      },
      resetAll: () => {
        const fresh = createDefaultLibrary();
        clearState();
        dispatch({ type: "replaceLibrary", library: fresh });
        void saveRemoteLibrary(userId, fresh);
      },
    }),
    [state, library, lastSavedAt, sync, userId],
  );

  if (sync.phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 text-muted">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
          <span className="text-sm">กำลังโหลดแผนจาก Supabase…</span>
        </div>
      </div>
    );
  }

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip ต้องอยู่ภายใน <TripProvider>");
  return ctx;
}
