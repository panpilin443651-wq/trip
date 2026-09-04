"use client";

import { useTrip } from "@/lib/trip-context";

/**
 * แจ้งเมื่อซิงก์กับ Supabase ไม่สำเร็จ หรือเพิ่งย้ายข้อมูลเก่าขึ้นคลาวด์
 * ถ้าทุกอย่างปกติจะไม่แสดงอะไรเลย
 */
export function SyncStatus() {
  const { sync } = useTrip();

  if (sync.phase === "error") {
    return (
      <div
        role="alert"
        className="fixed inset-x-3 bottom-24 z-40 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger shadow-[var(--shadow-lift)] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-sm"
      >
        <p className="font-medium">⚠️ บันทึกขึ้น Supabase ไม่สำเร็จ</p>
        <p className="mt-1">{sync.message}</p>
        <p className="mt-1 text-xs">
          ข้อมูลยังถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้ จะไม่หายไปไหน
        </p>
      </div>
    );
  }

  if (sync.phase === "ready" && sync.migrated) {
    return (
      <div
        role="status"
        className="fixed inset-x-3 bottom-24 z-40 rounded-xl border border-ok/40 bg-ok-soft px-4 py-3 text-sm text-ok shadow-[var(--shadow-lift)] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:max-w-sm"
      >
        ✓ ย้ายแผนที่เคยบันทึกไว้ในเครื่องขึ้นบัญชีของคุณแล้ว
      </div>
    );
  }

  return null;
}
