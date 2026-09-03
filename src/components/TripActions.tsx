"use client";

import { useState } from "react";
import { TripListSheet } from "@/components/TripListSheet";
import { Button, Card } from "@/components/ui";
import { useTrip } from "@/lib/trip-context";

/**
 * ปุ่มจัดการแผนในหน้าหลัก — หน้าแรกที่เห็นหลังล็อกอิน
 *
 * ปุ่มสลับแผนมีอยู่บนแถบบนแล้ว แต่เป็นปุ่มเล็กที่คนหาไม่เจอ
 * หน้าหลักเป็นที่แรกที่ตาไปตก จึงวางทางเลือกสองทางไว้ให้ชัด ๆ
 * ว่าจะทำแผนเดิมต่อ หรือเริ่มแผนใหม่
 */
export function TripActions() {
  const { trips, createTrip } = useTrip();
  const [open, setOpen] = useState(false);

  const others = trips.length - 1;

  return (
    <>
      <Card as="section">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setOpen(true)}
          >
            🧳 แผนเที่ยวเดิม
            {others > 0 ? ` (อีก ${others} แผน)` : ""}
          </Button>
          <Button className="flex-1" onClick={() => createTrip()}>
            ➕ สร้างแผนใหม่
          </Button>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-faint">
          สร้างแผนใหม่แล้วแผนเดิมยังอยู่ครบ สลับกลับไปดูได้ตลอด
        </p>
      </Card>

      <TripListSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
