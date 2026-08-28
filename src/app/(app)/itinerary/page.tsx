"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityCard } from "@/components/ActivityCard";
import {
  ActivityForm,
  emptyDraft,
  toDraft,
  type ActivityDraft,
} from "@/components/ActivityForm";
import { DayTabs } from "@/components/DayTabs";
import { PageHeader } from "@/components/PageHeader";
import { TripSuggestions } from "@/components/TripSuggestions";
import { Button, Card, ConfirmDialog, EmptyState } from "@/components/ui";
import {
  addDaysISO,
  formatDateThai,
  formatDuration,
  formatTHB,
} from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import type { Activity } from "@/lib/types";

export default function ItineraryPage() {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip } = state;

  const [dayIndex, setDayIndex] = useState(0);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  /** null = ฟอร์มปิดอยู่ — เปิดใหม่ทุกครั้งจะได้ instance ใหม่ผ่าน formSession */
  const [form, setForm] = useState<{
    session: number;
    editingId: string | null;
    draft: ActivityDraft;
  } | null>(null);

  // จำนวนวันอาจถูกลดในหน้าตั้งค่า ระหว่างที่ยังค้างแท็บวันเดิมไว้
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
      draft: emptyDraft(safeDayIndex),
    }));
  }

  function openEdit(activity: Activity) {
    setForm((prev) => ({
      session: (prev?.session ?? 0) + 1,
      editingId: activity.id,
      draft: toDraft(activity),
    }));
  }

  function handleSubmit(next: ActivityDraft) {
    if (form?.editingId) {
      dispatch({ type: "updateActivity", id: form.editingId, patch: next });
    } else {
      dispatch({ type: "addActivity", activity: next });
    }
    setForm(null);
    setDayIndex(next.dayIndex);
  }

  return (
    <>
      <PageHeader
        emoji="📋"
        title="แผนเที่ยว"
        subtitle={
          trip.dayCount > 1
            ? `${trip.dayCount} วัน • เริ่ม ${formatDateThai(trip.startDate, false)}`
            : `ทริปวันเดียว • ${formatDateThai(trip.startDate)}`
        }
        action={
          <Button onClick={openCreate} className="hidden sm:inline-flex">
            ➕ เพิ่มกิจกรรม
          </Button>
        }
      />

      <DayTabs
        dayCount={trip.dayCount}
        startDate={trip.startDate}
        value={safeDayIndex}
        onChange={setDayIndex}
      />

      {trip.dayCount > 1 ? (
        <p className="mb-4 text-sm text-muted">
          🗓️ {formatDateThai(addDaysISO(trip.startDate, safeDayIndex))}
        </p>
      ) : null}

      {dayActivities.length === 0 ? (
        <EmptyState
          emoji="🗒️"
          title="ยังไม่มีกิจกรรมในวันนี้"
          description="เพิ่มกิจกรรมแรก หรือหยิบจากหน้าแนะนำเที่ยวก็ได้"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openCreate}>➕ เพิ่มกิจกรรม</Button>
              <Link href="/explore">
                <Button variant="secondary">🧭 ดูที่แนะนำ</Button>
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
                onEdit={() => openEdit(activity)}
                onDelete={() => setDeleting(activity)}
              />
            ))}
          </ul>

          <Card className="mt-4 bg-canvas">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                รวม {dayActivities.length} กิจกรรม
              </span>
              <span className="text-muted">
                ⏱️ {formatDuration(totals.minutes)}
              </span>
              <span className="font-semibold">
                💰 {formatTHB(totals.cost)}
              </span>
            </div>
            <p className="mt-2 text-xs text-faint">
              ดูระยะทางระหว่างจุดแวะได้ที่{" "}
              <Link href="/map" className="text-brand underline">
                หน้าแผนที่
              </Link>
            </p>
          </Card>
        </>
      )}

      <div className="mt-4">
        <TripSuggestions dayIndex={safeDayIndex} />
      </div>

      <button
        type="button"
        onClick={openCreate}
        aria-label="เพิ่มกิจกรรม"
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-canvas shadow-lg transition-colors hover:bg-brand-dark sm:hidden"
      >
        ＋
      </button>

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
