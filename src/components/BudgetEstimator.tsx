"use client";

import { useMemo, useState } from "react";
import { CATEGORY_MAP } from "@/data/categories";
import { transportOf } from "@/data/transport";
import { cn } from "@/lib/cn";
import { estimateTrip, TRAVEL_STYLES, type TravelStyle } from "@/lib/estimate";
import { formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Button, Card, SectionTitle } from "./ui";

export function BudgetEstimator() {
  const { state, dispatch } = useTrip();
  const { trip } = state;

  const [style, setStyle] = useState<TravelStyle>("standard");
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const estimate = useMemo(() => estimateTrip(trip, style), [trip, style]);
  const styleMeta = TRAVEL_STYLES.find((s) => s.id === style) ?? TRAVEL_STYLES[1];
  const mainTransport = transportOf(trip.mainTransport);

  function applyAll() {
    const budgets = { ...trip.budgets };
    for (const line of estimate.lines) budgets[line.id] = line.amount;

    dispatch({
      type: "updateTrip",
      patch: { totalBudget: estimate.total, budgets },
    });
    setApplied("ตั้งงบรวมและงบรายหมวดตามประมาณการแล้ว");
    window.setTimeout(() => setApplied(null), 3000);
  }

  function applyTotalOnly() {
    dispatch({ type: "updateTrip", patch: { totalBudget: estimate.total } });
    setApplied("ตั้งงบรวมตามประมาณการแล้ว");
    window.setTimeout(() => setApplied(null), 3000);
  }

  return (
    <Card as="section">
      <SectionTitle title="ประมาณการค่าใช้จ่าย" />

      <p className="mb-3 text-sm text-muted">
        คำนวณจาก {trip.dayCount} วัน • {trip.travelers} คน
        {estimate.nights > 0
          ? ` • ที่พัก ${estimate.rooms} ห้อง × ${estimate.nights} คืน`
          : " • ไปกลับวันเดียว ไม่มีค่าที่พัก"}
        {mainTransport ? ` • ${mainTransport.emoji} ${mainTransport.label}` : null}
      </p>

      {mainTransport ? null : (
        <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn">
          ⚠️ ยังไม่ได้เลือกวิธีเดินทางหลัก ค่าเดินทางจึงยังไม่รวมค่าตั๋วไป-กลับ
          เลือกได้ที่การ์ด &ldquo;รูปแบบการเดินทาง&rdquo; ด้านบน
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {TRAVEL_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStyle(item.id)}
            aria-pressed={item.id === style}
            className={cn(
              "min-h-16 rounded-xl border px-2 py-2 text-center transition-colors",
              item.id === style
                ? "border-brand bg-brand-soft"
                : "border-line bg-card hover:bg-brand-soft",
            )}
          >
            <span className="block text-lg leading-none" aria-hidden>
              {item.emoji}
            </span>
            <span className="mt-1 block text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-faint">{styleMeta.hint}</p>

      <div className="mt-4 rounded-xl bg-canvas px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <span className="text-sm text-muted">ประมาณการรวม</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatTHB(estimate.total)}
          </span>
        </div>
        {trip.travelers > 1 ? (
          <p className="mt-1 text-right text-xs text-muted">
            เฉลี่ยคนละ {formatTHB(estimate.perPerson)}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-sm text-brand underline"
      >
        {expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียดแต่ละหมวด"}
      </button>

      {expanded ? (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {estimate.lines.map((line) => {
            const meta = CATEGORY_MAP[line.id];
            return (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="mr-1.5" aria-hidden>
                    {meta.emoji}
                  </span>
                  {meta.label}
                  <span className="block text-xs text-faint">{line.basis}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatTHB(line.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1" onClick={applyAll}>
          ✅ ใช้ตั้งงบทุกหมวด
        </Button>
        <Button variant="secondary" className="flex-1" onClick={applyTotalOnly}>
          ใช้ตั้งงบรวมอย่างเดียว
        </Button>
      </div>

      {applied ? (
        <p role="status" className="mt-2.5 text-sm text-ok">
          ✓ {applied}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-faint">
        ⚠️ เป็นค่าประมาณจากราคาเฉลี่ยในไทย ไว้ตั้งงบตั้งต้นเท่านั้น
        ราคาจริงต่างกันมากตามจังหวัดและฤดูกาล ปรับตัวเลขรายหมวดได้ด้านล่าง
      </p>
    </Card>
  );
}
