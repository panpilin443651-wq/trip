"use client";

import type { ReactNode } from "react";
import { TONE_CLASSES, TONE_EMOJI, type BudgetBreakdown } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatTHB } from "@/lib/format";
import { Card, ProgressBar } from "./ui";

export function BudgetSummary({
  breakdown,
  compact = false,
  children,
}: {
  breakdown: BudgetBreakdown;
  compact?: boolean;
  /** เนื้อหาเสริมท้ายการ์ด เช่น ยอดแยกหมวดในหน้าสรุปแผน */
  children?: ReactNode;
}) {
  const { status, totalBudget, totalSpent, remaining } = breakdown;
  const tone = TONE_CLASSES[status.tone];
  const overBy = Math.abs(remaining);

  return (
    <Card className={cn("ring-1 ring-inset", tone.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {status.tone === "over" ? "เกินงบไป" : "งบคงเหลือ"}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              status.tone === "over" ? tone.text : "text-ink",
            )}
          >
            {formatTHB(status.tone === "over" ? overBy : Math.max(0, remaining))}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
            tone.chip,
          )}
        >
          {TONE_EMOJI[status.tone]} {status.label}
        </span>
      </div>

      <ProgressBar
        percent={status.percent}
        barClass={tone.bar}
        className="mt-4 h-2.5"
      />

      <div className="mt-2.5 flex justify-between text-sm">
        <span className="text-muted">
          ใช้ไป{" "}
          <span className="font-medium text-ink tabular-nums">
            {formatTHB(totalSpent)}
          </span>
        </span>
        <span className="text-muted">
          จากงบ{" "}
          <span className="font-medium text-ink tabular-nums">
            {formatTHB(totalBudget)}
          </span>
        </span>
      </div>

      {children}

      {!compact && status.tone === "empty" ? (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">
          💡 ตั้งงบรวมของทริปได้ที่ช่องด้านล่าง แล้วระบบจะเตือนเมื่อใกล้เต็มหรือเกินงบ
        </p>
      ) : null}
    </Card>
  );
}
