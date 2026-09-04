"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BudgetSummary } from "@/components/BudgetSummary";
import { DashboardHero } from "@/components/DashboardHero";
import { DayPlanLine } from "@/components/DayPlanLine";
import { TripActions } from "@/components/TripActions";
import { TripOverviewCard } from "@/components/TripOverviewCard";
import {
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { buildBreakdown } from "@/lib/budget";
import { addMinutesToTime, formatDuration } from "@/lib/format";
import { hasCoords } from "@/lib/geo";
import { useTrip } from "@/lib/trip-context";

export default function DashboardPage() {
  const { state, activitiesForDay } = useTrip();
  const { trip, activities, places, checklist } = state;

  const breakdown = useMemo(() => buildBreakdown(state), [state]);

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
  const dayTotal = activitiesForDay(focusDay).length;
  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  return (
    <>
      <div className="space-y-4">
        <DashboardHero trip={trip} />

        <TripActions />

        <TripOverviewCard trip={trip} editLink />

        <BudgetSummary breakdown={breakdown} compact />

        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="กิจกรรมทั้งหมด"
            value={String(activities.length)}
          />
          <StatTile
            label="เวลารวมในแผน"
            value={formatDuration(totalMinutes)}
          />
          <StatTile
            label="ไปแล้ว / ทั้งหมด"
            value={`${visitedCount}/${places.length}`}
          />
        </div>

        {checklist.length > 0 ? (
          <Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">✅ ความคืบหน้าการเตรียมของ</span>
              <Link href="/checklist" className="text-brand underline">
                ดูทั้งหมด
              </Link>
            </div>
            <ProgressBar
              percent={checklistPercent}
              barClass={checklistPercent === 100 ? "bg-ok" : "bg-brand"}
            />
            <p className="mt-2 text-xs text-muted">
              เตรียมแล้ว {checklistDone} จาก {checklist.length} รายการ (
              {Math.round(checklistPercent)}%)
            </p>
          </Card>
        ) : null}

        <section>
          <SectionTitle
            title={
              trip.dayCount === 1 ? "กิจกรรมในทริป" : `กิจกรรมวันที่ ${focusDay + 1}`
            }
            action={
              activities.length > 0 ? (
                <Link href="/settings#plan" className="text-sm text-brand underline">
                  ดูแผนทั้งหมด
                </Link>
              ) : null
            }
          />

          <DayPlanLine plan={trip.dayPlans[focusDay]} className="mb-2" />

          {upcoming.length === 0 ? (
            <EmptyState
              emoji="🧭"
              title="ยังไม่มีกิจกรรมในแผน"
              description="เริ่มจากตั้งค่าทริป แล้วเพิ่มกิจกรรมแรก หรือหยิบจากที่แนะนำก็ได้"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/settings#plan">
                    <Button>เพิ่มกิจกรรม</Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="secondary">ดูที่แนะนำ</Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <>
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

              {dayTotal > upcoming.length ? (
                <p className="mt-2 px-1 text-xs text-faint">
                  และอีก {dayTotal - upcoming.length} กิจกรรมในวันนี้ —{" "}
                  <Link href="/settings#plan" className="text-brand underline">
                    ดูในแผนเที่ยว
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>

        <section>
          <SectionTitle title="ทางลัด" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link href="/settings#plan">
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
            <Link href="/settings">
              <Button variant="secondary" className="h-20 w-full flex-col gap-1">
                <span className="text-xl">🧭</span>
                <span className="text-xs">แนะนำเที่ยว</span>
              </Button>
            </Link>
          </div>
        </section>

        {/* บอกให้ชัดว่าหน้าสรุปมีไว้ทำอะไร จะได้ไม่งงว่าทำไมข้อมูลคล้ายหน้านี้ */}
        <Link href="/summary">
          <Card className="flex items-center gap-3 transition-colors hover:border-brand">
            <span className="text-2xl leading-none" aria-hidden>
              📄
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">สรุปแผนทั้งทริป</p>
              <p className="text-sm text-muted">
                รวมทุกวันไว้หน้าเดียว บันทึกเป็นรูปหรือ PDF ไว้แชร์ได้
              </p>
            </div>
            <span className="shrink-0 text-muted" aria-hidden>
              ›
            </span>
          </Card>
        </Link>

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
