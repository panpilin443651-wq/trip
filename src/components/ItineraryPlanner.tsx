"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDaysISO,
  formatDateThai,
  formatDuration,
  formatTHB,
} from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import type { Activity } from "@/lib/types";
import { ActivityCard } from "./ActivityCard";
import {
  ActivityForm,
  emptyDraft,
  toDraft,
  type ActivityDraft,
} from "./ActivityForm";
import { DayPlanCard } from "./DayPlanCard";
import { DayTabs } from "./DayTabs";
import { ProvinceRestaurants } from "./ProvinceRestaurants";
import { TripSuggestions } from "./TripSuggestions";
import { Button, Card, ConfirmDialog, EmptyState, SectionTitle } from "./ui";

/**
 * ตารางกิจกรรมรายวันทั้งชุด — แท็บวัน จังหวัด/ช่วงการเดินทาง รายการกิจกรรม
 * และช่องแนะนำ
 *
 * แยกออกมาเป็นคอมโพเนนต์เพราะย้ายไปอยู่ในหน้าตั้งค่าทริปแล้ว
 * จะได้อยู่ที่เดียวกับที่ตั้งจำนวนวันและเลือกจังหวัด ไม่ต้องสลับหน้าไปมา
 */
export function ItineraryPlanner() {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip } = state;

  const [dayIndex, setDayIndex] = useState(0);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  /** null = ฟอร์มปิดอยู่ — เปิดใหม่ทุกครั้งจะได้ instance ใหม่ผ่าน session */
  const [form, setForm] = useState<{
    session: number;
    editingId: string | null;
    draft: ActivityDraft;
  } | null>(null);

  // จำนวนวันอาจถูกลดในการ์ดด้านบน ระหว่างที่ยังค้างแท็บวันเดิมไว้
  const safeDayIndex = Math.min(dayIndex, trip.dayCount - 1);
  const dayActivities = activitiesForDay(safeDayIndex);

  const totals = useMemo(() => {
    return {
      cost: dayActivities.reduce((sum, a) => sum + a.cost, 0),
      minutes: dayActivities.reduce((sum, a) => sum + a.durationMin, 0),
    };
  }, [dayActivities]);

  function openCreate() {
    setForm((prev) => ({
      session: (prev?.session ?? 0) + 1,
      editingId: null,
      // ดึงจังหวัดจากแผนของวันนั้นมาให้ ไม่ต้องกรอกซ้ำทุกกิจกรรม
      draft: emptyDraft(safeDayIndex, trip.dayPlans[safeDayIndex]?.province ?? ""),
    }));
  }

  function openEdit(activity: Activity) {
    setForm((prev) => ({
      session: (prev?.session ?? 0) + 1,
      editingId: activity.id,
      draft: toDraft(activity),
    }));
  }

  function handleSubmit(drafts: ActivityDraft[]) {
    if (drafts.length === 0) return;

    if (form?.editingId) {
      // ตอนแก้ไขฟอร์มคืนมารายการเดียวเสมอ
      dispatch({ type: "updateActivity", id: form.editingId, patch: drafts[0] });
    } else {
      // เลือกมาหลายที่ก็เพิ่มทีละรายการ เวลาถูกเรียงต่อกันมาจากฟอร์มแล้ว
      for (const item of drafts) {
        dispatch({ type: "addActivity", activity: item });
      }
    }
    setForm(null);
    setDayIndex(drafts[0].dayIndex);
  }

  return (
    <>
      <Card as="section">
        <SectionTitle
          title="แผนเที่ยว"
          action={
            <Button size="sm" onClick={openCreate}>
              ➕ เพิ่มกิจกรรม
            </Button>
          }
        />

        <p className="mb-3 text-sm text-muted">
          {trip.dayCount > 1
            ? `จัดตารางกิจกรรมทีละวัน ทั้งหมด ${trip.dayCount} วัน เริ่ม ${formatDateThai(trip.startDate, false)}`
            : `ทริปวันเดียว • ${formatDateThai(trip.startDate)}`}
        </p>

        <DayTabs
          dayCount={trip.dayCount}
          startDate={trip.startDate}
          value={safeDayIndex}
          onChange={setDayIndex}
        />

        {trip.dayCount > 1 ? (
          <p className="mb-3 text-sm text-muted">
            🗓️ {formatDateThai(addDaysISO(trip.startDate, safeDayIndex))}
          </p>
        ) : null}

        <DayPlanCard dayIndex={safeDayIndex} />

        {dayActivities.length === 0 ? (
          <EmptyState
            emoji="🗒️"
            title="ยังไม่มีกิจกรรมในวันนี้"
            description="เพิ่มกิจกรรมแรก หรือหยิบจากที่แนะนำด้านล่างก็ได้"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={openCreate}>เพิ่มกิจกรรม</Button>
                <Link href="/settings">
                  <Button variant="secondary">ดูที่แนะนำ</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {dayActivities.map((activity, index) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  index={index}
                  dayProvince={trip.dayPlans[safeDayIndex]?.province}
                  onEdit={() => openEdit(activity)}
                  onDelete={() => setDeleting(activity)}
                />
              ))}
            </ul>

            <div className="mt-4 rounded-xl bg-canvas px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-muted">
                  รวม {dayActivities.length} กิจกรรม
                </span>
                <span className="text-muted">
                  {formatDuration(totals.minutes)}
                </span>
                <span className="font-semibold">{formatTHB(totals.cost)}</span>
              </div>
              <p className="mt-2 text-xs text-faint">
                ดูระยะทางระหว่างจุดแวะได้ที่{" "}
                <Link href="/map" className="text-brand underline">
                  หน้าแผนที่
                </Link>
              </p>
            </div>
          </>
        )}
      </Card>

      <TripSuggestions dayIndex={safeDayIndex} />

      <ProvinceRestaurants dayIndex={safeDayIndex} />

      {form ? (
        <ActivityForm
          key={form.session}
          initial={form.draft}
          isEdit={form.editingId !== null}
          dayCount={trip.dayCount}
          startDate={trip.startDate}
          onClose={() => setForm(null)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="ลบกิจกรรม"
        message={`ต้องการลบ "${deleting?.title ?? ""}" ออกจากแผนหรือไม่? ค่าใช้จ่ายของกิจกรรมนี้จะถูกหักออกจากงบด้วย`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) dispatch({ type: "deleteActivity", id: deleting.id });
          setDeleting(null);
        }}
      />
    </>
  );
}
