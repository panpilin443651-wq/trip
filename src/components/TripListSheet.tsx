"use client";

import { useState } from "react";
import { Button, ConfirmDialog, Sheet, cn } from "@/components/ui";
import { formatDateShort, formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";

/**
 * รายการแผนเที่ยวทั้งหมด — สลับ ทำสำเนา ลบ และสร้างใหม่
 *
 * แยกออกมาจาก TripSwitcher เพราะเปิดได้จากสองที่ ทั้งปุ่มบนแถบบน
 * และปุ่มในหน้าหลัก ถ้าปล่อยไว้ในตัวสลับจะต้องก๊อปโค้ดชุดนี้สองรอบ
 */
export function TripListSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { trips, createTrip, switchTrip, deleteTrip, duplicateTrip } = useTrip();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const target = trips.find((t) => t.id === pendingDelete);

  return (
    <>
      <Sheet
        open={open}
        title="แผนเที่ยวของฉัน"
        onClose={onClose}
        footer={
          <Button
            className="w-full"
            onClick={() => {
              createTrip();
              onClose();
            }}
          >
            ➕ สร้างแผนใหม่
          </Button>
        }
      >
        <ul className="space-y-2">
          {trips.map((t) => (
            <li
              key={t.id}
              className={cn(
                "rounded-xl border p-3",
                t.isActive ? "border-brand bg-brand-soft" : "border-line",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  switchTrip(t.id);
                  onClose();
                }}
                className="block w-full text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t.name || "ไม่มีชื่อ"}
                  </span>
                  {t.isActive ? (
                    <span className="shrink-0 text-xs text-brand">
                      กำลังดูอยู่
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {formatDateShort(t.startDate)} · {t.dayCount} วัน ·{" "}
                  {t.activityCount} จุดแวะ
                  {t.totalBudget > 0 ? ` · งบ ${formatTHB(t.totalBudget)}` : ""}
                </span>
                {t.provinces.length > 0 ? (
                  <span className="mt-0.5 block truncate text-xs text-faint">
                    {t.provinces.join(" · ")}
                  </span>
                ) : null}
              </button>

              <div className="mt-2 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicateTrip(t.id)}
                >
                  📋 ทำสำเนา
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => setPendingDelete(t.id)}
                >
                  🗑️ ลบ
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>

      <ConfirmDialog
        open={!!target}
        title="ลบแผนนี้?"
        message={
          target
            ? `"${target.name || "ไม่มีชื่อ"}" มี ${target.activityCount} จุดแวะ ` +
              "ลบแล้วเอากลับไม่ได้" +
              (trips.length === 1
                ? " และเนื่องจากเป็นแผนสุดท้าย ระบบจะสร้างแผนเปล่าให้แทน"
                : "")
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteTrip(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
