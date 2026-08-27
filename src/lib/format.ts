const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/** 1234 -> "฿1,234" */
export function formatTHB(amount: number): string {
  return baht.format(Math.round(amount || 0));
}

/** 1234 -> "1,234" (ไม่มีสัญลักษณ์สกุลเงิน) */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(
    Math.round(amount || 0),
  );
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** บวกวันจากวันที่ ISO โดยไม่แตะ timezone */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function parseISO(iso: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return null;
  return new Date(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    12,
    0,
    0,
  );
}

/** '2026-09-01' -> 'อ. 1 ก.ย. 2569' */
export function formatDateThai(iso: string, withWeekday = true): string {
  const d = parseISO(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    weekday: withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** '2026-09-01' -> '1 ก.ย.' */
export function formatDateShort(iso: string): string {
  const d = parseISO(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
  }).format(d);
}

/** จำนวนวันจากวันนี้ถึงวันที่กำหนด (บวก = อนาคต) */
export function daysUntil(iso: string): number | null {
  const target = parseISO(iso);
  if (!target) return null;
  const now = parseISO(todayISO());
  if (!now) return null;
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** '09:00' -> นาทีจากเที่ยงคืน */
export function timeToMinutes(time: string): number {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!parts) return 0;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

/** 540 -> '09:00' (วนกลับถ้าเกินเที่ยงคืน) */
export function minutesToTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** 90 -> '1 ชม. 30 นาที' */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** อ่านค่าจาก input type=number ให้ได้ตัวเลขเสมอ */
export function toNumber(value: string | number, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
