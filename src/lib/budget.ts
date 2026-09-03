import { CATEGORIES } from "@/data/categories";
import type { Activity, AppState, CategoryId, Expense, Trip } from "./types";

export type BudgetTone = "ok" | "warn" | "over" | "empty";

export interface BudgetStatus {
  tone: BudgetTone;
  /** 0-100 (ตัดที่ 100 สำหรับแสดงผลแถบ) */
  percent: number;
  /** เปอร์เซ็นต์จริง อาจเกิน 100 */
  rawPercent: number;
  remaining: number;
  label: string;
}

/** เกณฑ์เตือนก่อนเต็มงบ */
const WARN_AT = 90;

/**
 * ตรรกะสีจุดเดียวของทั้งแอป — dashboard, หน้างบ และการ์ดหมวดใช้ตัวนี้ร่วมกัน
 * เขียว = ยังไม่เกินงบ, เหลือง = ใช้ไป >= 90%, แดง = เกินงบ
 */
export function getBudgetStatus(spent: number, budget: number): BudgetStatus {
  const remaining = budget - spent;

  if (budget <= 0) {
    return {
      tone: spent > 0 ? "warn" : "empty",
      percent: spent > 0 ? 100 : 0,
      rawPercent: 0,
      remaining: 0,
      label: spent > 0 ? "ยังไม่ได้ตั้งงบ" : "ยังไม่ได้ตั้งงบ",
    };
  }

  const rawPercent = (spent / budget) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));

  if (remaining < 0) {
    return { tone: "over", percent, rawPercent, remaining, label: "เกินงบ" };
  }
  if (rawPercent >= WARN_AT) {
    return { tone: "warn", percent, rawPercent, remaining, label: "ใกล้เต็มงบ" };
  }
  return { tone: "ok", percent, rawPercent, remaining, label: "อยู่ในงบ" };
}

export const TONE_CLASSES: Record<
  BudgetTone,
  { bar: string; text: string; chip: string; ring: string }
> = {
  ok: {
    bar: "bg-ok",
    text: "text-ok",
    chip: "bg-ok-soft text-ok",
    ring: "ring-ok/20",
  },
  warn: {
    bar: "bg-warn",
    text: "text-warn",
    chip: "bg-warn-soft text-warn",
    ring: "ring-warn/20",
  },
  over: {
    bar: "bg-danger",
    text: "text-danger",
    chip: "bg-danger-soft text-danger",
    ring: "ring-danger/20",
  },
  empty: {
    bar: "bg-line",
    text: "text-muted",
    chip: "bg-line text-muted",
    ring: "ring-line",
  },
};

export const TONE_EMOJI: Record<BudgetTone, string> = {
  ok: "✅",
  warn: "⚠️",
  over: "🔴",
  empty: "➖",
};

export interface SpendLine {
  id: string;
  label: string;
  amount: number;
  /** มาจากกิจกรรมหรือไม่ (ถ้าใช่ แก้ไขที่หน้าแผนเที่ยว) */
  fromActivity: boolean;
  dayIndex?: number;
}

export interface BudgetBreakdown {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  status: BudgetStatus;
  byCategory: Array<{
    id: CategoryId;
    budget: number;
    spent: number;
    status: BudgetStatus;
    lines: SpendLine[];
  }>;
}

export function buildBreakdown(state: AppState): BudgetBreakdown {
  const { trip, activities, expenses } = state;

  const byCategory = CATEGORIES.map((category) => {
    const lines: SpendLine[] = [
      ...activities
        .filter((a) => a.category === category.id && a.cost > 0)
        .map((a: Activity) => ({
          id: a.id,
          label: a.title || a.placeName || "กิจกรรม",
          amount: a.cost,
          fromActivity: true,
          dayIndex: a.dayIndex,
        })),
      ...expenses
        .filter((e) => e.category === category.id)
        .map((e: Expense) => ({
          id: e.id,
          label: e.label || "ค่าใช้จ่าย",
          amount: e.amount,
          fromActivity: false,
        })),
    ];

    const spent = lines.reduce((sum, line) => sum + line.amount, 0);
    const budget = trip.budgets[category.id] ?? 0;

    return {
      id: category.id,
      budget,
      spent,
      status: getBudgetStatus(spent, budget),
      lines,
    };
  });

  const totalSpent = byCategory.reduce((sum, c) => sum + c.spent, 0);

  return {
    totalBudget: trip.totalBudget,
    totalSpent,
    remaining: trip.totalBudget - totalSpent,
    status: getBudgetStatus(totalSpent, trip.totalBudget),
    byCategory,
  };
}

// ── ผูกงบรายหมวดเข้ากับงบรวม ────────────────────────────────────────

export interface Allocation {
  /** งบรวมที่ตั้งไว้ */
  totalBudget: number;
  /** ผลรวมงบที่แบ่งลงหมวดแล้ว */
  allocated: number;
  /** งบรวมลบงบที่แบ่งแล้ว — ติดลบ = แบ่งเกินงบรวม */
  unallocated: number;
  /** แบ่งไปแล้วกี่เปอร์เซ็นต์ของงบรวม (ตัดที่ 100 สำหรับแสดงแถบ) */
  percent: number;
  tone: BudgetTone;
  label: string;
}

/**
 * เทียบงบรายหมวดกับงบรวม
 *
 * สองตัวเลขนี้เคยเป็นอิสระต่อกัน ตั้งงบรวมไว้ 15,000 แล้วแบ่งรายหมวดรวมกันได้
 * 30,000 โดยไม่มีอะไรเตือน ตัวนี้ทำให้เห็นความสัมพันธ์ชัด ๆ
 */
export function buildAllocation(trip: Trip): Allocation {
  const allocated = CATEGORIES.reduce(
    (sum, c) => sum + Math.max(0, trip.budgets[c.id] ?? 0),
    0,
  );
  const totalBudget = Math.max(0, trip.totalBudget);
  const unallocated = totalBudget - allocated;

  if (totalBudget <= 0) {
    return {
      totalBudget,
      allocated,
      unallocated,
      percent: 0,
      tone: "empty",
      label: allocated > 0 ? "ยังไม่ได้ตั้งงบรวม" : "ยังไม่ได้ตั้งงบ",
    };
  }

  const percent = Math.min(100, (allocated / totalBudget) * 100);

  if (unallocated < 0) {
    return {
      totalBudget,
      allocated,
      unallocated,
      percent,
      tone: "over",
      label: "แบ่งเกินงบรวม",
    };
  }
  if (unallocated === 0) {
    return {
      totalBudget,
      allocated,
      unallocated,
      percent,
      tone: "ok",
      label: "แบ่งครบพอดี",
    };
  }
  return {
    totalBudget,
    allocated,
    unallocated,
    percent,
    tone: "warn",
    label: "ยังแบ่งไม่ครบ",
  };
}

/**
 * เกลี่ยงบที่ยังไม่ได้แบ่ง ลงหมวดที่ยังไม่ได้ตั้งงบ
 *
 * ถ้าตั้งครบทุกหมวดแล้ว จะเกลี่ยตามสัดส่วนเดิมของแต่ละหมวดแทน
 * เพื่อไม่ให้สัดส่วนที่ผู้ใช้ตั้งใจไว้เพี้ยน
 *
 * เศษที่หารไม่ลงตัวยกไปให้หมวดสุดท้าย ผลรวมจะได้ตรงกับงบรวมเป๊ะ
 * ไม่ใช่ขาดไปหนึ่งบาทเพราะปัดเศษ
 */
export function distributeRemaining(trip: Trip): Record<CategoryId, number> {
  const budgets = { ...trip.budgets };
  const { unallocated } = buildAllocation(trip);
  if (unallocated <= 0) return budgets;

  const empty = CATEGORIES.filter((c) => (budgets[c.id] ?? 0) <= 0);
  const targets = empty.length > 0 ? empty : CATEGORIES;

  const weights = targets.map((c) =>
    empty.length > 0 ? 1 : Math.max(0, budgets[c.id] ?? 0),
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return budgets;

  let given = 0;
  targets.forEach((category, i) => {
    const isLast = i === targets.length - 1;
    const share = isLast
      ? unallocated - given
      : Math.round((unallocated * weights[i]) / totalWeight);
    budgets[category.id] = (budgets[category.id] ?? 0) + share;
    given += share;
  });

  return budgets;
}

/** ผลรวมค่าใช้จ่ายของกิจกรรมในวันหนึ่ง */
export function dayCost(activities: Activity[], dayIndex: number): number {
  return activities
    .filter((a) => a.dayIndex === dayIndex)
    .reduce((sum, a) => sum + (a.cost || 0), 0);
}
