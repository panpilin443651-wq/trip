"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_MAP } from "@/data/categories";
import { TONE_CLASSES, type BudgetBreakdown } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatTHB, toNumber } from "@/lib/format";
import type { CategoryId } from "@/lib/types";
import { Button, Card, Input, ProgressBar } from "./ui";

type CategoryRow = BudgetBreakdown["byCategory"][number];

export function BudgetCategoryCard({
  row,
  onBudgetChange,
  onDeleteExpense,
}: {
  row: CategoryRow;
  onBudgetChange: (categoryId: CategoryId, value: number) => void;
  onDeleteExpense: (expenseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_MAP[row.id];
  const tone = TONE_CLASSES[row.status.tone];
  const overBy = row.budget > 0 ? Math.max(0, row.spent - row.budget) : 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-xl" aria-hidden>
            {meta.emoji}
          </span>
          <div className="min-w-0">
            <p className="font-medium">{meta.label}</p>
            <p className={cn("text-sm tabular-nums", tone.text)}>
              {formatTHB(row.spent)}
              <span className="text-muted"> / {formatTHB(row.budget)}</span>
            </p>
          </div>
        </div>

        <div className="w-28 shrink-0">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={row.budget}
            aria-label={`งบหมวด${meta.label}`}
            onChange={(e) =>
              onBudgetChange(row.id, Math.max(0, toNumber(e.target.value)))
            }
            className="min-h-10 text-right text-sm"
          />
        </div>
      </div>

      <ProgressBar
        percent={row.status.percent}
        barClass={tone.bar}
        className="mt-3"
      />

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={cn(overBy > 0 ? tone.text : "text-muted")}>
          {row.budget <= 0
            ? "ยังไม่ได้ตั้งงบหมวดนี้"
            : overBy > 0
              ? `เกินงบ ${formatTHB(overBy)}`
              : `เหลือ ${formatTHB(row.budget - row.spent)}`}
        </span>

        {row.lines.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-brand underline"
          >
            {expanded ? "ซ่อนรายการ" : `ดู ${row.lines.length} รายการ`}
          </button>
        ) : null}
      </div>

      {expanded && row.lines.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {row.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 py-1 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {line.fromActivity ? "📋 " : "💵 "}
                {line.label}
                {line.fromActivity && typeof line.dayIndex === "number" ? (
                  <span className="ml-1 text-xs text-faint">
                    วันที่ {line.dayIndex + 1}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatTHB(line.amount)}
              </span>
              {line.fromActivity ? (
                <Link
                  href="/itinerary"
                  className="shrink-0 text-xs text-brand underline"
                >
                  แก้ที่แผน
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`ลบ ${line.label}`}
                  onClick={() => onDeleteExpense(line.id)}
                >
                  🗑️
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
