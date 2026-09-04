"use client";

import { legTransports } from "@/lib/legs";
import { addDaysISO, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useTrip } from "@/lib/trip-context";

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
  const { state } = useTrip();

  // ทริปวันเดียวไม่ต้องมีแท็บให้รก
  if (dayCount <= 1) return null;

  return (
    <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div className="flex gap-2" role="tablist" aria-label="เลือกวัน">
        {Array.from({ length: dayCount }, (_, index) => {
          const active = index === value;
          // วันหนึ่งใช้ได้หลายวิธี โชว์ 2 อันแรกพอ ไม่งั้นแท็บยาวเกิน
          const modes = legTransports(state.trip.dayPlans[index]).slice(0, 2);
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
                  ? "border-pick bg-pick text-on-pick"
                  : "border-line bg-card text-muted hover:text-ink",
              )}
            >
              {modes.length > 0 ? (
                <span className="mr-1">{modes.map((m) => m.emoji).join("")}</span>
              ) : null}
              วันที่ {index + 1}
              <span
                className={cn(
                  "ml-1.5 text-xs",
                  active ? "text-canvas/70" : "text-faint",
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
