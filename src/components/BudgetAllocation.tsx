"use client";

import { useMemo, useState } from "react";
import { CATEGORY_MAP } from "@/data/categories";
import {
  TONE_CLASSES,
  TONE_EMOJI,
  buildAllocation,
  distributeRemaining,
} from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Button, Card, ProgressBar, SectionTitle } from "./ui";

/**
 * ผูกงบรายหมวดเข้ากับงบรวม
 *
 * เดิมสองตัวเลขนี้เป็นอิสระต่อกัน ตั้งงบรวม 15,000 แล้วแบ่งรายหมวดรวมกันได้
 * 30,000 โดยไม่มีอะไรเตือน การ์ดนี้ทำให้เห็นว่าแบ่งไปแล้วเท่าไร เหลือเท่าไร
 * และเกลี่ยส่วนที่เหลือให้อัตโนมัติได้
 */
export function BudgetAllocation() {
  const { state, dispatch } = useTrip();
  const { trip } = state;

  const allocation = useMemo(() => buildAllocation(trip), [trip]);
  const tone = TONE_CLASSES[allocation.tone];
  const [done, setDone] = useState<string | null>(null);

  function flash(message: string) {
    setDone(message);
    window.setTimeout(() => setDone(null), 3000);
  }

  const shares = useMemo(
    () =>
      allocation.allocated > 0
        ? Object.entries(trip.budgets)
            .filter(([, amount]) => amount > 0)
            .sort(([, a], [, b]) => b - a)
        : [],
    [trip.budgets, allocation.allocated],
  );

  return (
    <Card as="section" className={cn("ring-1 ring-inset", tone.ring)}>
      <SectionTitle emoji="🧩" title="การแบ่งงบลงหมวด" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {allocation.unallocated < 0 ? "แบ่งเกินงบรวมไป" : "ยังไม่ได้แบ่ง"}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              allocation.unallocated < 0 ? tone.text : "text-ink",
            )}
          >
            {formatTHB(Math.abs(allocation.unallocated))}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
            tone.chip,
          )}
        >
          {TONE_EMOJI[allocation.tone]} {allocation.label}
        </span>
      </div>

      <ProgressBar
        percent={allocation.percent}
        barClass={tone.bar}
        className="mt-4 h-2.5"
      />

      <div className="mt-2.5 flex justify-between text-sm">
        <span className="text-muted">
          แบ่งลงหมวดแล้ว{" "}
          <span className="font-medium text-ink tabular-nums">
            {formatTHB(allocation.allocated)}
          </span>
        </span>
        <span className="text-muted">
          งบรวม{" "}
          <span className="font-medium text-ink tabular-nums">
            {formatTHB(allocation.totalBudget)}
          </span>
        </span>
      </div>

      {shares.length > 0 && allocation.allocated > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          {shares.map(([id, amount]) => {
            const meta = CATEGORY_MAP[id as keyof typeof CATEGORY_MAP];
            const percent = (amount / allocation.allocated) * 100;
            return (
              <li key={id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5" aria-hidden>
                    {meta.emoji}
                  </span>
                  {meta.label}
                </span>
                <span className="shrink-0 text-muted tabular-nums">
                  {formatTHB(amount)}{" "}
                  <span className="text-xs text-faint">
                    ({percent.toFixed(0)}%)
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {allocation.unallocated > 0 ? (
          <Button
            className="flex-1"
            onClick={() => {
              dispatch({
                type: "updateTrip",
                patch: { budgets: distributeRemaining(trip) },
              });
              flash(
                `เกลี่ย ${formatTHB(allocation.unallocated)} ลงหมวดที่ยังไม่ได้ตั้งงบแล้ว`,
              );
            }}
          >
            ⚖️ เกลี่ยส่วนที่เหลือ
          </Button>
        ) : null}

        {allocation.allocated > 0 &&
        allocation.allocated !== allocation.totalBudget ? (
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              dispatch({
                type: "updateTrip",
                patch: { totalBudget: allocation.allocated },
              });
              flash(`ตั้งงบรวมเป็น ${formatTHB(allocation.allocated)} แล้ว`);
            }}
          >
            ปรับงบรวม = ผลรวมหมวด
          </Button>
        ) : null}
      </div>

      {done ? (
        <p role="status" className="mt-2.5 text-sm text-ok">
          ✓ {done}
        </p>
      ) : null}

      {allocation.tone === "empty" ? (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
          💡 ตั้งงบรวมของทริปก่อน แล้วกดเกลี่ยส่วนที่เหลือ
          ระบบจะแบ่งลงหมวดที่ยังว่างให้เอง
        </p>
      ) : null}
    </Card>
  );
}
