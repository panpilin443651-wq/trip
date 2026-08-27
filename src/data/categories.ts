import type { CategoryId } from "@/lib/types";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "transport", label: "เดินทาง", emoji: "🚗" },
  { id: "accommodation", label: "ที่พัก", emoji: "🏨" },
  { id: "food", label: "อาหาร", emoji: "🍜" },
  { id: "attraction", label: "ค่าเข้าสถานที่", emoji: "🎟️" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "other", label: "อื่น ๆ", emoji: "📦" },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryMeta>;

export const EMPTY_BUDGETS: Record<CategoryId, number> = {
  transport: 0,
  accommodation: 0,
  food: 0,
  attraction: 0,
  shopping: 0,
  other: 0,
};

export const PRIORITY_META = {
  high: { label: "สูง", emoji: "🔴", order: 0 },
  medium: { label: "กลาง", emoji: "🟡", order: 1 },
  low: { label: "ต่ำ", emoji: "🟢", order: 2 },
} as const;
