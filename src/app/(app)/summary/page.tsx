"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Button, Card, ProgressBar, SectionTitle } from "@/components/ui";
import { CATEGORY_MAP } from "@/data/categories";
import { buildBreakdown, TONE_CLASSES, TONE_EMOJI } from "@/lib/budget";
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
  const tone = TONE_CLASSES[breakdown.status.tone];

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
          subtitle="ดูแผนทั้งทริปในหน้าเดียว บันทึกเป็นรูปหรือ PDF ได้"
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
      </div>

      {/* ส่วนที่ถูกพิมพ์ลง PDF */}
      <div id="trip-summary" className="space-y-5">
        <Card>
          <p className="text-sm text-brand">✈️ Travel Planner</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {trip.name || "ทริปของฉัน"}
          </h1>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">🗓️ วันที่</dt>
              <dd className="font-medium">
                {trip.dayCount === 1
                  ? formatDateThai(trip.startDate)
                  : `${formatDateThai(trip.startDate, false)} – ${formatDateThai(
                      addDaysISO(trip.startDate, trip.dayCount - 1),
                      false,
                    )}`}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">📍 จังหวัด</dt>
              <dd className="font-medium">
                {trip.provinces.length > 0
                  ? trip.provinces.join(" → ")
                  : "ยังไม่ได้เลือกจังหวัด"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted">👥 ผู้เดินทาง</dt>
              <dd className="font-medium">{trip.travelers} คน</dd>
            </div>
          </dl>

          {trip.notes ? (
            <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
              📝 {trip.notes}
            </p>
          ) : null}
        </Card>

        <Card className={cn("ring-1 ring-inset", tone.ring)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">
                {breakdown.status.tone === "over" ? "เกินงบไป" : "งบคงเหลือ"}
              </p>
              <p className={cn("mt-1 text-3xl font-semibold tabular-nums", tone.text)}>
                {formatTHB(Math.abs(breakdown.remaining))}
              </p>
            </div>
            <span className={cn("rounded-full px-3 py-1.5 text-xs font-medium", tone.chip)}>
              {TONE_EMOJI[breakdown.status.tone]} {breakdown.status.label}
            </span>
          </div>

          <ProgressBar
            percent={breakdown.status.percent}
            barClass={tone.bar}
            className="mt-4 h-2.5"
          />

          <div className="mt-2.5 flex justify-between text-sm text-muted">
            <span>
              ใช้ไป{" "}
              <span className="font-medium text-ink">
                {formatTHB(breakdown.totalSpent)}
              </span>
            </span>
            <span>
              จากงบ{" "}
              <span className="font-medium text-ink">
                {formatTHB(breakdown.totalBudget)}
              </span>
            </span>
          </div>

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
        </Card>

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

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-sm text-muted">📋 กิจกรรมทั้งทริป</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totalActivities}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-muted">✅ Checklist</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {checklistDone}/{checklist.length}
            </p>
          </Card>
        </div>

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

        <p className="pt-2 text-center text-xs text-faint">
          สร้างด้วย Travel Planner • ค่าใช้จ่ายและเวลาเป็นค่าประมาณ
        </p>
      </div>
    </>
  );
}
