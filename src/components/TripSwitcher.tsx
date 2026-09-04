"use client";

import { useState } from "react";
import { TripListSheet } from "@/components/TripListSheet";
import { useTrip } from "@/lib/trip-context";

/**
 * ปุ่มสลับแผนเที่ยวบนแถบบน — กดแล้วเปิดรายการแผนทั้งหมด
 *
 * อยู่บนแถบบนเพราะต้องกดถึงได้จากทุกหน้า สร้างแผนใหม่แล้วแผนเดิมยังอยู่ครบ
 * แค่สลับกลับไปดูได้
 */
export function TripSwitcher() {
  const { state, trips } = useTrip();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-brand-soft"
        aria-label="สลับแผนเที่ยว"
      >
        <span
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-base ring-1 ring-accent/25 sm:flex"
          aria-hidden
        >
          ✈️
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {state.trip.name || "ทริปของฉัน"}
          </span>
          <span className="block text-[11px] text-muted">
            {trips.length > 1
              ? `${trips.length} แผน · แตะเพื่อสลับ`
              : "แตะเพื่อจัดการแผน"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted" aria-hidden>
          ▾
        </span>
      </button>

      <TripListSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
