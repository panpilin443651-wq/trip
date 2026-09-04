"use client";

import { daysUntil, formatDateThai } from "@/lib/format";
import type { Trip } from "@/lib/types";

/**
 * แถบต้อนรับหัวหน้าหลัก — ชื่อทริป จังหวัด และนับถอยหลัง
 *
 * ใช้พื้น brand-soft กับตัวอักษรโทนปกติ ไม่ได้ไล่เฉดสีเข้มใต้ตัวหนังสือ
 * เพราะ contrast ของตัวอักษรบนพื้นไล่เฉดจะเปลี่ยนไปเรื่อยตามตำแหน่ง
 * ตรวจไม่ได้ด้วยการวัดคู่สีแบบปกติ ส่วนสีสันมาจากวงกลมเบลอด้านหลัง
 * ซึ่งอยู่นอกแนวตัวหนังสือและถูก overflow-hidden ตัดขอบไว้
 */
export function DashboardHero({ trip }: { trip: Trip }) {
  // เป็น null ได้ถ้าวันที่ในแผนเสียรูป — กรณีนั้นไม่ต้องโชว์ป้ายนับถอยหลัง
  const countdown = daysUntil(trip.startDate);
  const countdownLabel =
    countdown === null
      ? null
      : countdown > 0
        ? `อีก ${countdown} วัน`
        : countdown === 0
          ? "ออกเดินทางวันนี้ 🎉"
          : `ผ่านมาแล้ว ${Math.abs(countdown)} วัน`;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-brand-soft p-5 shadow-[var(--shadow-soft)]">
      {/* วงกลมเบลอสองใบทำให้พื้นดูมีมิติ อยู่มุมขวาซึ่งไม่มีตัวหนังสือทับ */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-brand/20 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 -bottom-14 h-32 w-32 rounded-full bg-accent/20 blur-2xl"
      />

      <div className="relative">
        <p className="text-sm text-muted">ทริปที่กำลังวางแผน</p>
        <h2 className="mt-1 text-2xl leading-snug font-semibold text-balance">
          {trip.name || "ทริปของฉัน"}
        </h2>

        {trip.provinces.length > 0 ? (
          <p className="mt-1.5 text-sm text-muted">
            {trip.provinces.join(" · ")}
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted">
            ยังไม่ได้เลือกจังหวัด — เริ่มที่หน้าแผนเที่ยว
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {countdownLabel ? (
            <span className="rounded-full bg-card px-3 py-1.5 text-sm font-medium text-brand">
              {countdownLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-card px-3 py-1.5 text-sm text-muted">
            {formatDateThai(trip.startDate)}
          </span>
          <span className="rounded-full bg-card px-3 py-1.5 text-sm text-muted">
            {trip.dayCount} วัน · {trip.travelers} คน
          </span>
        </div>
      </div>
    </section>
  );
}
