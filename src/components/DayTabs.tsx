"use client";

import { addDaysISO, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";

export function DayTabs({
  dayCount,
  startDate,
  value,
  onChange,
}: {
  dayCount: number;
  startDate: string;
  value: number;
  onChange: (dayIndex: number) => void;
}) {
  // ทริปวันเดียวไม่ต้องมีแท็บให้รก
  if (dayCount <= 1) return null;

  return (
    <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div className="flex gap-2" role="tablist" aria-label="เลือกวัน">
        {Array.from({ length: dayCount }, (_, index) => {
          const active = index === value;
          return (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(index)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-card text-muted hover:text-ink",
              )}
            >
              วันที่ {index + 1}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  active ? "text-white/80" : "text-faint",
                )}
              >
                {formatDateShort(addDaysISO(startDate, index))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
