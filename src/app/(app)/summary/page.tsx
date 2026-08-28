"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BudgetSummary } from "@/components/BudgetSummary";
import { DayPlanLine } from "@/components/DayPlanLine";
import { PageHeader } from "@/components/PageHeader";
import { TripOverviewCard } from "@/components/TripOverviewCard";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { CATEGORY_MAP } from "@/data/categories";
import { buildBreakdown } from "@/lib/budget";
import { cn } from "@/lib/cn";
import {
  addDaysISO,
  addMinutesToTime,
  formatDateThai,
  formatDuration,
  formatTHB,
} from "@/lib/format";
import { downloadCanvas, drawTripSummary } from "@/lib/summary-image";
import { signPhotoUrls } from "@/lib/supabase/photos";
import { useTrip } from "@/lib/trip-context";

export default function SummaryPage() {
  const { state, activitiesForDay } = useTrip();
  const { trip, checklist, places } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageState, setImageState] = useState<"idle" | "working" | "done">(
    "idle",
  );

  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const days = useMemo(
    () =>
      Array.from({ length: trip.dayCount }, (_, index) => {
        const list = activitiesForDay(index);
        return {
          index,
          date: addDaysISO(trip.startDate, index),
          activities: list,
          cost: list.reduce((sum, a) => sum + a.cost, 0),
          minutes: list.reduce((sum, a) => sum + a.durationMin, 0),
        };
      }),
    [activitiesForDay, trip.dayCount, trip.startDate],
  );

  // bucket เป็นแบบส่วนตัว จึงต้องขอ signed URL ก่อนทั้งแสดงผลและ export
  const photoPaths = useMemo(
    () => state.activities.flatMap((a) => a.photos ?? []),
    [state.activities],
  );
  const photoKey = photoPaths.join(`|`);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!photoKey) return;
    let cancelled = false;
    signPhotoUrls(photoKey.split("|"), 7200).then((map) => {
      if (!cancelled) setPhotoUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [photoKey]);

  const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);
  const checklistDone = checklist.filter((c) => c.done).length;

  async function saveImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setImageState("working");
    try {
      // ต้อง await เพราะต้องโหลดรูปความทรงจำเข้ามาวาดก่อน
      await drawTripSummary(canvas, state, photoUrls);
      downloadCanvas(canvas, `แผนเที่ยว-${trip.name || "ทริป"}.png`);
      setImageState("done");
      window.setTimeout(() => setImageState("idle"), 3000);
    } catch {
      setImageState("idle");
    }
  }

  return (
    <>
      {/* canvas ใช้วาดรูปตอนกดบันทึกเท่านั้น ไม่ต้องแสดงบนหน้า */}
      <canvas ref={canvasRef} className="hidden" aria-hidden />

      <div className="print-hide">
        <PageHeader
          emoji="📄"
          title="สรุปแผนเที่ยว"
          subtitle="ไฟล์สำหรับเก็บไว้หรือส่งให้เพื่อน รวมทุกวันไว้หน้าเดียว"
        />

        <Card className="mb-5">
          <SectionTitle emoji="💾" title="บันทึกแผน" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => void saveImage()}>
              {imageState === "working" ? "กำลังสร้างรูป…" : "🖼️ บันทึกเป็นรูป PNG"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => window.print()}
            >
              📄 บันทึกเป็น PDF
            </Button>
          </div>

          {imageState === "done" ? (
            <p role="status" className="mt-2.5 text-sm text-ok">
              ✓ บันทึกรูปแล้ว ดูได้ในโฟลเดอร์ดาวน์โหลด
            </p>
          ) : (
            <p className="mt-2.5 text-xs leading-relaxed text-faint">
              ปุ่ม PDF จะเปิดหน้าต่างพิมพ์ของเบราว์เซอร์ — เลือกปลายทางเป็น
              &ldquo;Save as PDF&rdquo; หรือ &ldquo;บันทึกเป็น PDF&rdquo;
              แล้วกดบันทึก
            </p>
          )}
        </Card>

        {/*
          ข้อมูลด้านล่างซ้ำกับหน้าหลักโดยตั้งใจ เพราะเป็นตัวอย่างไฟล์ที่จะได้
          ไฟล์ที่ส่งให้คนอื่นต้องอ่านรู้เรื่องด้วยตัวเอง จะตัดหัวทริปหรืองบออกไม่ได้
        */}
        <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs leading-relaxed text-muted">
          👀 ด้านล่างคือหน้าตาไฟล์ที่จะได้ — เลื่อนดูให้ครบก่อนกดบันทึกได้เลย
        </p>
      </div>

      {/* ส่วนที่ถูกพิมพ์ลง PDF */}
      <div id="trip-summary" className="space-y-5">
        <TripOverviewCard trip={trip} showTitle />

        <BudgetSummary breakdown={breakdown}>
          <ul className="mt-4 grid gap-1.5 border-t border-line pt-3 text-sm sm:grid-cols-2">
            {breakdown.byCategory
              .filter((row) => row.spent > 0)
              .map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {CATEGORY_MAP[row.id].emoji} {CATEGORY_MAP[row.id].label}
                  </span>
                  <span className="tabular-nums">{formatTHB(row.spent)}</span>
                </li>
              ))}
          </ul>

          {trip.budgetNote.trim() ? (
            <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
              📝 {trip.budgetNote}
            </p>
          ) : null}
        </BudgetSummary>

        {days.map((day) => (
          <section key={day.index} className="break-inside-avoid">
            <SectionTitle
              emoji="🗓️"
              title={
                trip.dayCount === 1
                  ? "แผนการเที่ยว"
                  : `วันที่ ${day.index + 1} • ${formatDateThai(day.date)}`
              }
              action={
                <span className="text-sm font-medium">
                  {formatTHB(day.cost)}
                </span>
              }
            />

            <DayPlanLine plan={trip.dayPlans[day.index]} showNote className="mb-2" />

            {day.activities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
                ยังไม่มีกิจกรรมในวันนี้
              </p>
            ) : (
              <ol className="space-y-2">
                {day.activities.map((activity) => (
                  <Card as="li" key={activity.id} className="flex gap-3">
                    <div className="shrink-0 text-center">
                      <p className="text-sm font-semibold tabular-nums text-brand">
                        {activity.startTime}
                      </p>
                      <p className="text-xs text-faint tabular-nums">
                        {addMinutesToTime(activity.startTime, activity.durationMin)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{activity.title}</p>
                      {activity.placeName ? (
                        <p className="mt-0.5 text-sm break-words text-muted">
                          📍 {activity.placeName}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge>
                          {CATEGORY_MAP[activity.category].emoji}{" "}
                          {CATEGORY_MAP[activity.category].label}
                        </Badge>
                        <Badge>⏱️ {formatDuration(activity.durationMin)}</Badge>
                      </div>

                      {(activity.photos ?? []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(activity.photos ?? []).map((path) =>
                            photoUrls[path] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={path}
                                src={photoUrls[path]}
                                alt="รูปความทรงจำ"
                                className="h-20 w-20 rounded-lg border border-line object-cover"
                              />
                            ) : null,
                          )}
                        </div>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {activity.cost > 0 ? formatTHB(activity.cost) : "ฟรี"}
                    </span>
                  </Card>
                ))}
              </ol>
            )}

            <p className="mt-2 px-1 text-xs text-muted">
              รวม {day.activities.length} กิจกรรม • ⏱️{" "}
              {formatDuration(day.minutes)}
            </p>
          </section>
        ))}

        {places.length > 0 ? (
          <section className="break-inside-avoid">
            <SectionTitle emoji="📍" title="สถานที่ที่อยากไป" />
            <Card>
              <ul className="space-y-1.5 text-sm">
                {places.map((place) => (
                  <li key={place.id} className="flex items-start gap-2">
                    <span className="shrink-0">
                      {place.visited ? "✅" : "⬜"}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 break-words",
                        place.visited && "text-faint line-through",
                      )}
                    >
                      {place.name}
                      {place.province ? (
                        <span className="text-muted"> • {place.province}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {/*
          ยอดรวมท้ายไฟล์ เคยเป็นการ์ดใหญ่ 2 ใบซึ่งซ้ำกับตัวเลขบนหน้าหลัก
          และซ้ำกับบรรทัด "รวม N กิจกรรม" ของแต่ละวันที่อยู่เหนือขึ้นไป
          จึงยุบเหลือบรรทัดเดียวปิดท้าย
        */}
        <p className="border-t border-line pt-3 text-center text-xs text-muted">
          📋 รวม {totalActivities} กิจกรรม
          {checklist.length > 0
            ? ` • ✅ เตรียมของแล้ว ${checklistDone}/${checklist.length} รายการ`
            : ""}
        </p>

        <p className="text-center text-xs text-faint">
          สร้างด้วย Travel Planner • ค่าใช้จ่ายและเวลาเป็นค่าประมาณ
        </p>
      </div>
    </>
  );
}
