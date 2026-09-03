"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORY_MAP } from "@/data/categories";
import { buildBreakdown } from "@/lib/budget";
import { formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Button, Sheet, cn } from "./ui";

/**
 * เด้งเตือนเมื่อค่าใช้จ่ายเกินงบ ทั้งงบรวมและงบรายหมวด
 *
 * mount อยู่ใน layout จึงเตือนได้จากทุกหน้า เพราะการเพิ่มค่าใช้จ่าย
 * เกิดที่หน้าแผนเที่ยวและหน้าแนะนำเที่ยวได้ด้วย ไม่ใช่แค่หน้างบ
 */
export function BudgetAlert() {
  const { state } = useTrip();
  const pathname = usePathname();
  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const overCategories = breakdown.byCategory.filter(
    (row) => row.budget > 0 && row.spent > row.budget,
  );

  /**
   * เตือนทั้งกรณีเกินงบรวม และกรณีเกินเฉพาะบางหมวด
   *
   * เดิมเตือนแค่เกินงบรวม แต่จ่ายค่าอาหารทะลุงบหมวดอาหารไปแล้วยังไม่เตือน
   * ถ้างบรวมยังเหลือ ซึ่งเป็นจุดที่คนพลาดบ่อยกว่า เพราะงบรวมมักตั้งเผื่อไว้
   */
  const overTotal = breakdown.status.tone === "over";
  const isOver = overTotal || overCategories.length > 0;
  const [dismissed, setDismissed] = useState(false);

  // กลับมาอยู่ในงบแล้วให้พร้อมเตือนใหม่ในครั้งถัดไป
  // ปรับ state ระหว่าง render แบบนี้เป็นแพตเทิร์นที่ React รองรับ
  // และเลี่ยงการ setState ใน effect ซึ่งทำให้เกิด cascading render
  if (!isOver && dismissed) setDismissed(false);

  const overCategoryTotal = overCategories.reduce(
    (sum, row) => sum + (row.spent - row.budget),
    0,
  );

  return (
    <Sheet
      open={isOver && !dismissed}
      title={overTotal ? "⚠️ ค่าใช้จ่ายเกินงบแล้ว" : "⚠️ บางหมวดเกินงบแล้ว"}
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
          <p className="text-sm text-danger">
            {overTotal ? "เกินงบรวมไป" : "เกินงบรายหมวดไป"}
          </p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums text-danger">
            {formatTHB(
              overTotal ? Math.abs(breakdown.remaining) : overCategoryTotal,
            )}
          </p>
          {overTotal ? null : (
            <p className="mt-1 text-xs leading-relaxed text-danger">
              งบรวมยังไม่เกิน แต่หมวดด้านล่างใช้ทะลุที่ตั้งไว้แล้ว
            </p>
          )}
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">งบที่ตั้งไว้</dt>
            <dd className="tabular-nums">{formatTHB(breakdown.totalBudget)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">ใช้ไปแล้ว</dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                overTotal ? "text-danger" : "text-ink",
              )}
            >
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
          {overTotal
            ? "ลองตัดกิจกรรมที่ค่าใช้จ่ายสูงออก ปรับงบรวมให้สูงขึ้น หรือย้ายบางกิจกรรมไปทริปหน้า"
            : "ปรับงบหมวดนี้ให้สูงขึ้นได้ที่หน้างบประมาณ หรือใช้ปุ่มเกลี่ยส่วนที่เหลือถ้างบรวมยังพอ"}
        </p>
      </div>
    </Sheet>
  );
}
