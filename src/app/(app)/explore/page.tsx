"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  Card,
  Field,
  Select,
  Sheet,
} from "@/components/ui";
import { PROVINCES, type SuggestedPlace } from "@/data/provinces";
import { cn } from "@/lib/cn";
import {
  addDaysISO,
  addMinutesToTime,
  formatDateShort,
  formatDuration,
  formatTHB,
} from "@/lib/format";
import { useTrip } from "@/lib/trip-context";

type Tab = "places" | "activities";

export default function ExplorePage() {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip, places } = state;

  // ถ้าตั้งปลายทางไว้แล้ว ให้เปิดจังหวัดนั้นก่อน
  const initialProvince =
    PROVINCES.find((p) => p.name.includes(trip.destination.trim()) && trip.destination.trim())
      ?.id ?? PROVINCES[0].id;

  const [provinceId, setProvinceId] = useState(initialProvince);
  const [tab, setTab] = useState<Tab>("places");
  const [scheduling, setScheduling] = useState<SuggestedPlace | null>(null);
  const [targetDay, setTargetDay] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const province =
    PROVINCES.find((p) => p.id === provinceId) ?? PROVINCES[0];

  const savedNames = useMemo(
    () => new Set(places.map((p) => p.name)),
    [places],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function addToPlaces(place: SuggestedPlace) {
    if (savedNames.has(place.name)) {
      notify(`"${place.name}" อยู่ในรายการอยู่แล้ว`);
      return;
    }
    dispatch({
      type: "addPlace",
      place: {
        name: place.name,
        province: province.name,
        note: `${place.description} • ${place.tip}`,
        priority: "medium",
        visited: false,
        lat: place.lat,
        lng: place.lng,
      },
    });
    notify(`เพิ่ม "${place.name}" ลงรายการสถานที่แล้ว`);
  }

  /** ต่อท้ายกิจกรรมสุดท้ายของวันนั้น เผื่อเวลาเดินทาง 30 นาที */
  function suggestedStartTime(dayIndex: number): string {
    const existing = activitiesForDay(dayIndex);
    const last = existing.at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function scheduleActivity() {
    if (!scheduling) return;
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex: targetDay,
        startTime: suggestedStartTime(targetDay),
        durationMin: scheduling.durationMin,
        title: scheduling.name,
        placeName: `${scheduling.name} ${province.name}`,
        detail: `${scheduling.description}\n💡 ${scheduling.tip}`,
        cost: scheduling.fee,
        category: scheduling.fee > 0 ? "attraction" : "other",
        lat: scheduling.lat,
        lng: scheduling.lng,
      },
    });
    notify(`ใส่ "${scheduling.name}" ในแผนวันที่ ${targetDay + 1} แล้ว`);
    setScheduling(null);
  }

  return (
    <>
      <PageHeader
        emoji="🧭"
        title="แนะนำเที่ยว"
        subtitle="เลือกจังหวัดแล้วหยิบสถานที่หรือกิจกรรมใส่แผนได้ทันที"
      />

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {PROVINCES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProvinceId(item.id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              item.id === provinceId
                ? "border-brand bg-brand text-white"
                : "border-line bg-card text-muted hover:text-ink",
            )}
          >
            {item.emoji} {item.name}
          </button>
        ))}
      </div>

      <Card className="mb-4 bg-brand-soft ring-1 ring-brand/10">
        <h2 className="font-semibold">
          {province.emoji} {province.name}
        </h2>
        <p className="mt-1 text-sm text-muted">{province.blurb}</p>
        <p className="mt-2 text-xs text-faint">
          {province.region} • {province.places.length} สถานที่ •{" "}
          {province.activities.length} กิจกรรมแนะนำ
        </p>
      </Card>

      <div className="mb-4 flex gap-2 rounded-xl bg-line/50 p-1">
        {(
          [
            ["places", "📍 สถานที่แนะนำ"],
            ["activities", "🎯 กิจกรรมแนะนำ"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors",
              tab === id ? "bg-card text-ink shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "places" ? (
        <ul className="space-y-3">
          {province.places.map((place) => (
            <Card as="li" key={place.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {place.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{place.name}</h3>
                    <Badge>{place.tag}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {place.description}
                  </p>

                  <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                    <div className="flex gap-1.5">
                      <dt className="text-muted">⏱️ ควรเผื่อ</dt>
                      <dd>{formatDuration(place.durationMin)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted">🎟️ ค่าเข้า</dt>
                      <dd>
                        {place.fee > 0 ? `~${formatTHB(place.fee)}` : "ไม่มีค่าเข้า"}
                      </dd>
                    </div>
                    <div className="flex gap-1.5 sm:col-span-2">
                      <dt className="shrink-0 text-muted">🕐 ช่วงที่เหมาะ</dt>
                      <dd>{place.bestTime}</dd>
                    </div>
                  </dl>

                  <p className="mt-2.5 rounded-xl bg-canvas px-3 py-2.5 text-sm leading-relaxed text-muted">
                    💡 {place.tip}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addToPlaces(place)}
                      disabled={savedNames.has(place.name)}
                    >
                      {savedNames.has(place.name)
                        ? "✓ อยู่ในรายการแล้ว"
                        : "➕ เพิ่มลงรายการ"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setScheduling(place);
                        setTargetDay(0);
                      }}
                    >
                      📅 ใส่ในแผน
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {province.activities.map((activity) => (
            <Card as="li" key={activity.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {activity.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{activity.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {activity.description}
                  </p>

                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">💵 ราคาประมาณ</dt>
                      <dd>{activity.price}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">⏱️ ใช้เวลา</dt>
                      <dd>{activity.duration}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">🎒 ควรเตรียม</dt>
                      <dd>{activity.prepare}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <p className="mt-5 text-xs leading-relaxed text-faint">
        ⚠️ ค่าเข้าและระยะเวลาเป็นค่าประมาณสำหรับใช้ตั้งงบและจัดตาราง
        ควรตรวจสอบกับแหล่งข้อมูลทางการอีกครั้งก่อนเดินทางจริง
      </p>

      <Sheet
        open={scheduling !== null}
        title="ใส่ในแผนเที่ยว"
        onClose={() => setScheduling(null)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setScheduling(null)}
            >
              ยกเลิก
            </Button>
            <Button className="flex-1" onClick={scheduleActivity}>
              เพิ่มลงแผน
            </Button>
          </div>
        }
      >
        {scheduling ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-canvas p-3">
              <p className="font-medium">
                {scheduling.emoji} {scheduling.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                ⏱️ {formatDuration(scheduling.durationMin)} • 🎟️{" "}
                {scheduling.fee > 0 ? formatTHB(scheduling.fee) : "ไม่มีค่าเข้า"}
              </p>
            </div>

            {trip.dayCount > 1 ? (
              <Field label="ใส่ในวันที่">
                <Select
                  value={targetDay}
                  onChange={(e) => setTargetDay(Number(e.target.value))}
                >
                  {Array.from({ length: trip.dayCount }, (_, index) => (
                    <option key={index} value={index}>
                      วันที่ {index + 1} (
                      {formatDateShort(addDaysISO(trip.startDate, index))})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <p className="text-sm text-muted">
              จะเริ่มเวลา{" "}
              <span className="font-medium text-ink">
                {suggestedStartTime(targetDay)}
              </span>{" "}
              (ต่อจากกิจกรรมสุดท้ายของวันนั้น เผื่อเวลาเดินทาง 30 นาที)
              ปรับได้ภายหลังที่หน้าแผนเที่ยว
            </p>
          </div>
        ) : null}
      </Sheet>

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-lg lg:inset-x-auto lg:right-8 lg:bottom-8 lg:max-w-sm"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
