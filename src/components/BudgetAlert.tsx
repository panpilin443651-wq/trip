"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORY_MAP } from "@/data/categories";
import { buildBreakdown } from "@/lib/budget";
import { formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Button, Sheet } from "./ui";

/**
 * เด้งเตือนเมื่อค่าใช้จ่ายรวมเกินงบที่ตั้งไว้
 *
 * mount อยู่ใน layout จึงเตือนได้จากทุกหน้า เพราะการเพิ่มค่าใช้จ่าย
 * เกิดที่หน้าแผนเที่ยวและหน้าแนะนำเที่ยวได้ด้วย ไม่ใช่แค่หน้างบ
 */
export function BudgetAlert() {
  const { state } = useTrip();
  const pathname = usePathname();
  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const isOver = breakdown.status.tone === "over";
  const [dismissed, setDismissed] = useState(false);

  // กลับมาอยู่ในงบแล้วให้พร้อมเตือนใหม่ในครั้งถัดไป
  // ปรับ state ระหว่าง render แบบนี้เป็นแพตเทิร์นที่ React รองรับ
  // และเลี่ยงการ setState ใน effect ซึ่งทำให้เกิด cascading render
  if (!isOver && dismissed) setDismissed(false);

  const overCategories = breakdown.byCategory.filter(
    (row) => row.budget > 0 && row.spent > row.budget,
  );

  return (
    <Sheet
      open={isOver && !dismissed}
      title="⚠️ ค่าใช้จ่ายเกินงบแล้ว"
      onClose={() => setDismissed(true)}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          {pathname === "/budget" ? null : (
            <Link href="/budget" className="flex-1" onClick={() => setDismissed(true)}>
              <Button className="w-full">ไปหน้างบประมาณ</Button>
            </Link>
          )}
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setDismissed(true)}
          >
            รับทราบ
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-danger-soft px-4 py-3">
          <p className="text-sm text-danger">เกินงบไป</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums text-danger">
            {formatTHB(Math.abs(breakdown.remaining))}
          </p>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">งบที่ตั้งไว้</dt>
            <dd className="tabular-nums">{formatTHB(breakdown.totalBudget)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">ใช้ไปแล้ว</dt>
            <dd className="font-medium tabular-nums text-danger">
              {formatTHB(breakdown.totalSpent)}
            </dd>
          </div>
        </dl>

        {overCategories.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">หมวดที่เกินงบ</p>
            <ul className="space-y-1.5">
              {overCategories.map((row) => {
                const meta = CATEGORY_MAP[row.id];
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-1.5" aria-hidden>
                        {meta.emoji}
                      </span>
                      {meta.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-danger">
                      +{formatTHB(row.spent - row.budget)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <p className="text-sm leading-relaxed text-muted">
          ลองตัดกิจกรรมที่ค่าใช้จ่ายสูงออก ปรับงบรวมให้สูงขึ้น
          หรือย้ายบางกิจกรรมไปทริปหน้า
        </p>
      </div>
    </Sheet>
  );
}
