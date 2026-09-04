import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    // ตัวเลขมาก่อนคำอธิบาย เพราะเป็นสิ่งที่คนกวาดตาหา
    // ไม่มีอิโมจินำแล้ว ตัวเลขจึงขึ้นไปอยู่บนสุดของกล่องได้เลย
    <div className="rounded-2xl border border-line bg-card px-3 py-3">
      <div className={cn("text-xl font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
