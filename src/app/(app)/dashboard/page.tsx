"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BudgetSummary } from "@/components/BudgetSummary";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { buildBreakdown } from "@/lib/budget";
import {
  addDaysISO,
  addMinutesToTime,
  daysUntil,
  formatDateThai,
  formatDuration,
} from "@/lib/format";
import { hasCoords } from "@/lib/geo";
import { useTrip } from "@/lib/trip-context";

export default function DashboardPage() {
  const { state, activitiesForDay } = useTrip();
  const { trip, activities, places, checklist } = state;

  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const countdown = daysUntil(trip.startDate);
  const lastDate = addDaysISO(trip.startDate, Math.max(0, trip.dayCount - 1));

  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistPercent = checklist.length
    ? (checklistDone / checklist.length) * 100
    : 0;
  const visitedCount = places.filter((p) => p.visited).length;
  const pinnedCount = activities.filter(hasCoords).length;

  /** วันแรกที่ยังมีกิจกรรม — คือสิ่งที่ผู้ใช้อยากเห็นตอนเปิดแอป */
  const focusDay = useMemo(() => {
    for (let index = 0; index < trip.dayCount; index += 1) {
      if (activitiesForDay(index).length > 0) return index;
    }
    return 0;
  }, [activitiesForDay, trip.dayCount]);

  const upcoming = activitiesForDay(focusDay).slice(0, 3);
  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  const countdownLabel =
    countdown === null
      ? null
      : countdown > 0
        ? `อีก ${countdown} วัน`
        : countdown === 0
          ? "วันนี้แล้ว! 🎉"
          : `ผ่านมา ${Math.abs(countdown)} วัน`;

  return (
    <>
      <PageHeader
        emoji="✈️"
        title="Travel Planner"
        subtitle={trip.name || "ทริปของฉัน"}
      />

      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted">
                {trip.destination ? `📍 ${trip.destination}` : "📍 ยังไม่ได้ตั้งปลายทาง"}
              </p>
              <p className="mt-1.5 font-medium">
                {trip.dayCount === 1
                  ? formatDateThai(trip.startDate)
                  : `${formatDateThai(trip.startDate, false)} – ${formatDateThai(lastDate, false)}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="bg-brand-soft text-brand">
                  {trip.dayCount === 1 ? "☀️ 1 Day Trip" : `🌙 ${trip.dayCount} วัน`}
                </Badge>
                <Badge>👥 {trip.travelers} คน</Badge>
                {countdownLabel ? <Badge>⏳ {countdownLabel}</Badge> : null}
              </div>
            </div>

            <Link href="/settings" className="shrink-0">
              <Button variant="ghost" size="sm" aria-label="แก้ไขข้อมูลทริป">
                ✏️
              </Button>
            </Link>
          </div>

          {trip.notes ? (
            <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
              📝 {trip.notes}
            </p>
          ) : null}
        </Card>

        <BudgetSummary breakdown={breakdown} compact />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            emoji="📋"
            label="กิจกรรมทั้งหมด"
            value={String(activities.length)}
          />
          <StatTile
            emoji="⏱️"
            label="เวลารวมในแผน"
            value={formatDuration(totalMinutes)}
          />
          <StatTile
            emoji="📍"
            label="ไปแล้ว / ทั้งหมด"
            value={`${visitedCount}/${places.length}`}
          />
          <StatTile
            emoji="✅"
            label="Checklist"
            value={`${Math.round(checklistPercent)}%`}
            valueClass={checklistPercent === 100 ? "text-ok" : undefined}
          />
        </div>

        {checklist.length > 0 ? (
          <Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">ความคืบหน้าการเตรียมของ</span>
              <Link href="/checklist" className="text-brand underline">
                ดูทั้งหมด
              </Link>
            </div>
            <ProgressBar
              percent={checklistPercent}
              barClass={checklistPercent === 100 ? "bg-ok" : "bg-brand"}
            />
            <p className="mt-2 text-xs text-muted">
              เตรียมแล้ว {checklistDone} จาก {checklist.length} รายการ
            </p>
          </Card>
        ) : null}

        <section>
          <SectionTitle
            emoji="🗓️"
            title={
              trip.dayCount === 1 ? "กิจกรรมในทริป" : `กิจกรรมวันที่ ${focusDay + 1}`
            }
            action={
              activities.length > 0 ? (
                <Link href="/itinerary" className="text-sm text-brand underline">
                  ดูแผนทั้งหมด
                </Link>
              ) : null
            }
          />

          {upcoming.length === 0 ? (
            <EmptyState
              emoji="🧭"
              title="ยังไม่มีกิจกรรมในแผน"
              description="เริ่มจากตั้งค่าทริป แล้วเพิ่มกิจกรรมแรก หรือหยิบจากที่แนะนำก็ได้"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/itinerary">
                    <Button>➕ เพิ่มกิจกรรม</Button>
                  </Link>
                  <Link href="/explore">
                    <Button variant="secondary">🧭 ดูที่แนะนำ</Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((activity) => (
                <Card as="li" key={activity.id} className="flex items-center gap-3">
                  <span className="shrink-0 rounded-lg bg-brand-soft px-2.5 py-1.5 text-sm font-medium tabular-nums text-brand">
                    {activity.startTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{activity.title}</p>
                    <p className="truncate text-xs text-muted">
                      ถึง{" "}
                      {addMinutesToTime(activity.startTime, activity.durationMin)} น.
                      {activity.placeName ? ` • ${activity.placeName}` : ""}
                    </p>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle emoji="⚡" title="ทางลัด" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link href="/itinerary">
              <Button variant="secondary" className="h-20 w-full flex-col gap-1">
                <span className="text-xl">➕</span>
                <span className="text-xs">เพิ่มกิจกรรม</span>
              </Button>
            </Link>
            <Link href="/places">
              <Button variant="secondary" className="h-20 w-full flex-col gap-1">
                <span className="text-xl">📍</span>
                <span className="text-xs">เพิ่มสถานที่</span>
              </Button>
            </Link>
            <Link href="/map">
              <Button variant="secondary" className="h-20 w-full flex-col gap-1">
                <span className="text-xl">🗺️</span>
                <span className="text-xs">ดูแผนที่</span>
              </Button>
            </Link>
            <Link href="/explore">
              <Button variant="secondary" className="h-20 w-full flex-col gap-1">
                <span className="text-xl">🧭</span>
                <span className="text-xs">แนะนำเที่ยว</span>
              </Button>
            </Link>
          </div>
        </section>

        {activities.length > 0 && pinnedCount < activities.length ? (
          <p className="text-xs leading-relaxed text-faint">
            💡 มีกิจกรรม {activities.length - pinnedCount} รายการที่ยังไม่ได้ปักหมุด
            ปักหมุดแล้วจะคำนวณระยะทางในหน้าแผนที่ได้
          </p>
        ) : null}
      </div>
    </>
  );
}
