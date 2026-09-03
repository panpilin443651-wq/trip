"use client";

import { useEffect, useState } from "react";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import { addMinutesToTime } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Badge, Button, Card, SectionTitle, cn } from "./ui";

/**
 * ร้านอาหารและคาเฟ่ดังของจังหวัด จากฐานข้อมูลที่คัดไว้ล่วงหน้า
 *
 * ต่างจาก NearbyRestaurants ตรงที่ตัวนั้นค้นสดรอบพิกัดจุดแวะ ต้องปักหมุดก่อน
 * ส่วนตัวนี้ดูได้ตั้งแต่ยังไม่มีจุดแวะเลย แค่เลือกจังหวัดไว้ก็พอ
 * เหมาะกับตอนกำลังวางแผนว่าจะไปกินอะไรบ้าง
 */
export function ProvinceRestaurants({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip } = state;

  const dayProvince = trip.dayPlans[dayIndex]?.province ?? "";
  const provinces = dayProvince
    ? [dayProvince]
    : trip.provinces.length > 0
      ? trip.provinces
      : [];

  const [province, setProvince] = useState(provinces[0] ?? "");
  const active = provinces.includes(province) ? province : (provinces[0] ?? "");

  /**
   * ผูกผลลัพธ์กับจังหวัดที่ขอไป ผลเก่าจะถูกมองข้ามเองเมื่อจังหวัดไม่ตรง
   * จึงไม่ต้องล้างค่าเก่าด้วย setState ตอนเริ่ม effect
   * hits เป็น null แปลว่าโหลดไม่สำเร็จ
   */
  const [result, setResult] = useState<{
    province: string;
    hits: RestaurantHit[] | null;
  } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    fetch(`/api/restaurants?province=${encodeURIComponent(active)}`, {
      signal: AbortSignal.timeout(15000),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((hits: RestaurantHit[]) => {
        if (!cancelled) setResult({ province: active, hits });
      })
      .catch(() => {
        if (!cancelled) setResult({ province: active, hits: null });
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  /** ต่อท้ายกิจกรรมสุดท้ายของวัน เผื่อเวลาเดินทาง 30 นาที */
  function nextStartTime(): string {
    const last = activitiesForDay(dayIndex).at(-1);
    if (!last) return "12:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function addToPlan(hit: RestaurantHit) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex,
        startTime: nextStartTime(),
        durationMin: 60,
        title: hit.name,
        placeName: hit.name,
        province: active,
        detail:
          `${hit.kind}${hit.cuisine ? ` • ${hit.cuisine}` : ""}` +
          `${hit.openingHours ? `\n🕒 ${hit.openingHours}` : ""}` +
          `\n🔗 ${hit.mapsUrl}`,
        cost: 0,
        category: "food",
        lat: hit.lat,
        lng: hit.lng,
      },
    });
    setAdded((prev) => new Set(prev).add(hit.id));
  }

  if (provinces.length === 0) return null;

  // แยกกิ่งจากตัว current ตรง ๆ ไม่ใช่จากตัวแปร boolean ที่แยกไว้
  // เพราะ TypeScript ตามไม่ทันว่า hits ไม่เป็น null แล้ว
  const current = result?.province === active ? result : null;
  const hits = current?.hits ?? null;

  return (
    <Card as="section">
      <SectionTitle
        emoji="🍜"
        title="ร้านดังในจังหวัด"
        action={
          hits ? (
            <span className="text-xs text-muted">{hits.length} ร้าน</span>
          ) : null
        }
      />

      {provinces.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {provinces.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setProvince(name)}
              aria-pressed={name === active}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm transition-colors",
                name === active
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-muted hover:bg-brand-soft",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {current === null ? (
        <p className="text-sm text-muted">กำลังโหลด…</p>
      ) : current.hits === null ? (
        <p role="alert" className="text-sm text-danger">
          ⚠️ โหลดรายการร้านไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่
        </p>
      ) : current.hits.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          ยังไม่มีร้านของ{active}ในฐานข้อมูล — จังหวัดที่คนลงข้อมูลใน
          OpenStreetMap ไว้น้อยจะเป็นแบบนี้ ลองใช้ปุ่มค้นร้านแถวนั้นด้านล่างแทน
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {(showAll ? current.hits : current.hits.slice(0, 8)).map((hit) => {
              const inPlan = added.has(hit.id);
              return (
                <li
                  key={hit.id}
                  className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{hit.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{hit.kind}</Badge>
                      {hit.cuisine ? <Badge>{hit.cuisine}</Badge> : null}
                      {hit.notable ? <Badge>⭐ มีคนเขียนถึง</Badge> : null}
                    </div>
                    {hit.openingHours ? (
                      <p className="mt-1 text-xs text-faint">
                        🕒 {hit.openingHours}
                      </p>
                    ) : null}
                    <a
                      href={hit.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs text-brand underline"
                    >
                      เปิดใน Google Maps ↗
                    </a>
                  </div>

                  <Button
                    size="sm"
                    variant={inPlan ? "secondary" : "primary"}
                    disabled={inPlan}
                    onClick={() => addToPlan(hit)}
                    className="shrink-0"
                  >
                    {inPlan ? "✓ ใส่แล้ว" : "➕ ใส่"}
                  </Button>
                </li>
              );
            })}
          </ul>

          {current.hits.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-sm text-brand underline"
            >
              {showAll ? "ย่อรายการ" : `ดูอีก ${current.hits.length - 8} ร้าน`}
            </button>
          ) : null}

          <p className="mt-3 text-xs leading-relaxed text-faint">
            คัดจาก OpenStreetMap เฉพาะร้านที่มีเว็บ เบอร์โทร เวลาเปิดปิด
            หรือมีคนเขียนถึง และตัดร้านเชนที่มีทุกห้างออกแล้ว
            เวลาจะไปจริงควรเช็กเวลาเปิด-ปิดใน Google Maps อีกที
          </p>
        </>
      )}
    </Card>
  );
}
