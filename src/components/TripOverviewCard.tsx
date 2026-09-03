"use client";

import Link from "next/link";
import { addDaysISO, daysUntil, formatDateThai } from "@/lib/format";
import type { Trip } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

/**
 * การ์ดข้อมูลทริป — จังหวัด ช่วงวันที่ จำนวนวัน จำนวนคน และบันทึก
 *
 * หน้าหลักกับหน้าสรุปแผนเคยเขียนการ์ดนี้แยกกันคนละชุด พอแก้ที่เดียว
 * อีกหน้าก็ไม่ตาม จึงรวมมาไว้ที่เดียวแล้วปรับรายละเอียดด้วย prop แทน
 */
export function TripOverviewCard({
  trip,
  showTitle = false,
  showCountdown = false,
  editLink = false,
}: {
  trip: Trip;
  /** โชว์ชื่อทริปเป็นหัวข้อ — หน้าหลักโชว์ไว้ที่หัวหน้าอยู่แล้วจึงไม่ต้องซ้ำ */
  showTitle?: boolean;
  /** นับถอยหลังเหมาะกับหน้าจอ แต่ไม่เหมาะกับไฟล์ที่เซฟไว้อ่านทีหลัง */
  showCountdown?: boolean;
  editLink?: boolean;
}) {
  const lastDate = addDaysISO(trip.startDate, Math.max(0, trip.dayCount - 1));
  const countdown = showCountdown ? daysUntil(trip.startDate) : null;

  const countdownLabel =
    countdown === null
      ? null
      : countdown > 0
        ? `อีก ${countdown} วัน`
        : countdown === 0
          ? "วันนี้แล้ว! 🎉"
          : `ผ่านมา ${Math.abs(countdown)} วัน`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showTitle ? (
            <>
              <p className="text-sm text-brand">✈️ Travel Planner</p>
              <h1 className="mt-1 mb-2 text-2xl font-semibold break-words">
                {trip.name || "ทริปของฉัน"}
              </h1>
            </>
          ) : null}

          <p className="text-sm text-muted">
            {trip.provinces.length > 0
              ? `📍 ${trip.provinces.join(" → ")}`
              : "📍 ยังไม่ได้เลือกจังหวัด"}
          </p>

          <p className="mt-1.5 font-medium">
            🗓️{" "}
            {trip.dayCount === 1
              ? formatDateThai(trip.startDate)
              : `${formatDateThai(trip.startDate, false)} – ${formatDateThai(lastDate, false)}`}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge className="bg-accent-soft text-accent">
              {trip.dayCount === 1 ? "☀️ 1 Day Trip" : `🌙 ${trip.dayCount} วัน`}
            </Badge>
            <Badge>👥 {trip.travelers} คน</Badge>
            {countdownLabel ? <Badge>⏳ {countdownLabel}</Badge> : null}
          </div>
        </div>

        {editLink ? (
          <Link href="/settings" className="shrink-0">
            <Button variant="ghost" size="sm" aria-label="แก้ไขข้อมูลทริป">
              ✏️
            </Button>
          </Link>
        ) : null}
      </div>

      {trip.notes ? (
        <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
          📝 {trip.notes}
        </p>
      ) : null}
    </Card>
  );
}
