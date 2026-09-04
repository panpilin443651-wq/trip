import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-3xl border border-line bg-card p-4 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/*
 * ปุ่มหลักต้องเด่นกว่าทุกอย่างรอบตัว จึงเป็นสีทึบเต็ม มีเงา และตัวหนากว่าปกติ
 * ส่วนปุ่มรองตั้งใจให้เงียบ ขอบบางพื้นเรียบ จะได้ไม่แย่งสายตากับปุ่มหลัก
 * ในการ์ดเดียวกัน
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-canvas font-semibold shadow-[var(--shadow-soft)] hover:bg-brand-dark active:bg-brand-dark",
  secondary: "bg-card text-ink border border-line hover:bg-brand-soft",
  ghost: "bg-transparent text-muted hover:bg-line/60 hover:text-ink",
  danger: "bg-danger-soft text-danger font-semibold hover:bg-danger hover:text-canvas",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        // px-6 เคยทำให้สองปุ่มเรียงกันล้นขอบจอแคบ เพราะ flex ไม่ย่อ
        // ให้เล็กกว่าความกว้างขั้นต่ำของเนื้อหา
        size === "md" ? "min-h-12 px-5 text-sm" : "min-h-9 px-4 text-[13px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        className ?? "bg-line/70 text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  percent,
  barClass = "bg-brand",
  className,
}: {
  percent: number;
  barClass?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent || 0));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          barClass,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
