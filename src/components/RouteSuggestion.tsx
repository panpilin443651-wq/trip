"use client";

import { useMemo, useState } from "react";
import { formatDistance } from "@/lib/geo";
import { addMinutesToTime, minutesToTime, timeToMinutes } from "@/lib/format";
import { optimizeOrder, travelMinutes } from "@/lib/route-optimize";
import { useTrip } from "@/lib/trip-context";
import type { Activity } from "@/lib/types";
import { Button, Card, SectionTitle, Sheet } from "./ui";

/** ปัดเวลาขึ้นเป็นช่วง 5 นาที ให้ตารางอ่านง่าย */
function roundTo5(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
}

interface Planned {
  activity: Activity;
  startTime: string;
}

/**
 * เสนอจัดลำดับจุดแวะใหม่ให้ไม่ต้องวนไปวนมา
 * ไม่แตะข้อมูลจนกว่าผู้ใช้จะกดยืนยัน
 */
export function RouteSuggestion({
  activities,
}: {
  /** กิจกรรมของวันนั้นที่ปักหมุดแล้ว เรียงตามเวลาปัจจุบัน */
  activities: Activity[];
}) {
  const { dispatch } = useTrip();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [applied, setApplied] = useState(false);

  const result = useMemo(
    () =>
      optimizeOrder(
        activities.map((a) => ({ lat: a.lat as number, lng: a.lng as number })),
      ),
    [activities],
  );

  /**
   * ตารางเวลาใหม่: ตรึงเวลาเริ่มของจุดแรกไว้
   * แล้วไล่ต่อจากเวลาที่ใช้ในสถานที่ + เวลาเดินทางโดยประมาณ
   */
  const plan = useMemo<Planned[]>(() => {
    const ordered = result.order.map((i) => activities[i]);
    if (ordered.length === 0) return [];

    const rows: Planned[] = [];
    let clock = timeToMinutes(activities[0].startTime);

    ordered.forEach((activity, index) => {
      if (index > 0) {
        const previous = ordered[index - 1];
        clock +=
          previous.durationMin +
          travelMinutes(
            { lat: previous.lat as number, lng: previous.lng as number },
            { lat: activity.lat as number, lng: activity.lng as number },
          );
        clock = roundTo5(clock);
      }
      rows.push({ activity, startTime: minutesToTime(clock) });
    });

    return rows;
  }, [activities, result.order]);

  function apply() {
    for (const row of plan) {
      dispatch({
        type: "updateActivity",
        id: row.activity.id,
        patch: { startTime: row.startTime },
      });
    }
    setPreviewOpen(false);
    setApplied(true);
    window.setTimeout(() => setApplied(false), 4000);
  }

  if (applied) {
    return (
      <Card className="border-ok/40 bg-ok-soft">
        <p className="text-sm text-ok">
          ✓ จัดลำดับใหม่แล้ว — ดูตารางเวลาที่อัปเดตได้ในหน้าแผนเที่ยว
        </p>
      </Card>
    );
  }

  // ประหยัดน้อยกว่า 500 เมตรไม่คุ้มที่จะรบกวนให้กด
  if (!result.changed || result.saved < 500) {
    if (activities.length < 3) return null;
    return (
      <Card className="bg-canvas">
        <p className="text-sm text-muted">
          ✓ ลำดับจุดแวะวันนี้ดีอยู่แล้ว ไม่มีทางที่สั้นกว่านี้ให้สลับ
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-accent/40 bg-accent-soft">
        <SectionTitle emoji="🧭" title="จัดลำดับใหม่ได้" />
        <p className="text-sm leading-relaxed text-muted">
          ลำดับตอนนี้เดินทางวนไปมา ถ้าสลับจุดแวะใหม่จะเหลือระยะทาง{" "}
          <span className="font-medium text-ink">
            {formatDistance(result.optimizedDistance)}
          </span>{" "}
          จากเดิม {formatDistance(result.currentDistance)}
        </p>
        <p className="mt-2 text-lg font-semibold text-accent">
          ประหยัดได้ {formatDistance(result.saved)}
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => setPreviewOpen(true)}>
            ดูลำดับใหม่ก่อน
          </Button>
        </div>

        <p className="mt-2 text-xs text-faint">
          จุดแรกของวันถูกตรึงไว้เสมอ เพราะมักเป็นที่พักหรือจุดนัดพบ
        </p>
      </Card>

      <Sheet
        open={previewOpen}
        title="ลำดับใหม่ที่แนะนำ"
        onClose={() => setPreviewOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setPreviewOpen(false)}
            >
              ใช้ลำดับเดิม
            </Button>
            <Button className="flex-1" onClick={apply}>
              ใช้ลำดับใหม่
            </Button>
          </div>
        }
      >
        <p className="mb-4 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
          เวลาเริ่มจะถูกคำนวณใหม่จากเวลาที่ใช้ในแต่ละที่บวกเวลาเดินทาง
          โดยตรึงเวลาเริ่มของจุดแรกไว้เท่าเดิม
        </p>

        <ol className="space-y-2">
          {plan.map((row, index) => {
            const moved = activities[index]?.id !== row.activity.id;
            return (
              <li
                key={row.activity.id}
                className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-fill text-xs font-semibold text-canvas">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.activity.title}
                  </span>
                  <span className="block text-xs text-muted">
                    {row.activity.startTime} →{" "}
                    <span className="font-medium text-ink">
                      {row.startTime}
                    </span>{" "}
                    น. (ถึง{" "}
                    {addMinutesToTime(row.startTime, row.activity.durationMin)})
                  </span>
                </span>
                {moved ? (
                  <span className="shrink-0 text-xs text-accent">ย้าย</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Sheet>
    </>
  );
}
