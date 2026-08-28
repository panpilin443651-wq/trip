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
import { timeToMinutes } from "./format";
import {
  clearState,
  createDefaultState,
  loadState,
  normalizeState,
  saveState,
} from "./storage";
import {
  loadRemoteState,
  saveRemoteState,
} from "./supabase/trip-store";
import type {
  Activity,
  AppState,
  ChecklistItem,
  Expense,
  Place,
  Trip,
} from "./types";

type Action =
  | { type: "replace"; state: AppState }
  | { type: "updateTrip"; patch: Partial<Trip> }
  | { type: "setDayCount"; dayCount: number }
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
      return { ...state, trip: { ...state.trip, dayCount }, activities };
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

export type SyncStatus =
  | { phase: "loading" }
  | { phase: "ready"; migrated?: boolean }
  | { phase: "error"; message: string };

interface TripContextValue {
  state: AppState;
  /** id ผู้ใช้ที่ล็อกอินอยู่ ใช้เป็นโฟลเดอร์เก็บรูปใน Storage */
  userId: string;
  dispatch: React.Dispatch<Action>;
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
  const [state, dispatch] = useReducer(reducer, null, createDefaultState);
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

    loadRemoteState(userId).then(async ({ state: remote, error }) => {
      if (cancelled) return;

      if (error) {
        setSync({ phase: "error", message: error });
        return;
      }

      if (remote) {
        dispatch({ type: "replace", state: remote });
        setSync({ phase: "ready" });
        return;
      }

      const local = loadState();
      const hasLocalData =
        local.activities.length > 0 ||
        local.places.length > 0 ||
        local.checklist.length > 0 ||
        local.expenses.length > 0 ||
        local.trip.provinces.length > 0;

      if (hasLocalData) {
        const saveError = await saveRemoteState(userId, local);
        if (cancelled) return;
        dispatch({ type: "replace", state: local });
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
      saveState(state);
      void saveRemoteState(userId, state).then((error) => {
        setSync(
          error ? { phase: "error", message: error } : { phase: "ready" },
        );
        if (!error) setLastSavedAt(Date.now());
      });
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, sync.phase, userId]);

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
      saveNow: (tripPatch?: Partial<Trip>) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const next = tripPatch
          ? { ...state, trip: { ...state.trip, ...tripPatch } }
          : state;
        saveState(next);
        void saveRemoteState(userId, next).then((error) => {
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
        const text = await file.text();
        dispatch({ type: "replace", state: normalizeState(JSON.parse(text)) });
      },
      resetAll: () => {
        const fresh = createDefaultState();
        clearState();
        dispatch({ type: "replace", state: fresh });
        void saveRemoteState(userId, fresh);
      },
    }),
    [state, lastSavedAt, sync, userId],
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
