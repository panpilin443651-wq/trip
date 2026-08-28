"use client";

import { useState } from "react";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import { formatDistance, haversine } from "@/lib/geo";
import { addMinutesToTime } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import type { Activity } from "@/lib/types";
import { Badge, Button, Card, SectionTitle } from "./ui";

/**
 * ร้านอาหารและคาเฟ่รอบจุดแวะของวันนั้น
 *
 * ข้อมูลมาจาก OpenStreetMap (ฟรี ไม่ต้องมี API key)
 * แต่ละร้านมีปุ่มเปิดใน Google Maps ต่อ เพื่อดูรีวิวและเรตติ้ง
 */
export function NearbyRestaurants({
  dayIndex,
  activities,
}: {
  dayIndex: number;
  /** กิจกรรมของวันนั้นที่ปักหมุดแล้ว */
  activities: Activity[];
}) {
  const { dispatch, activitiesForDay } = useTrip();
  const [hits, setHits] = useState<RestaurantHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // ค้นรอบจุดกลางของวัน จะได้ครอบคลุมทุกจุดแวะแทนที่จะอิงจุดเดียว
  const center = activities.length
    ? {
        lat:
          activities.reduce((sum, a) => sum + (a.lat as number), 0) /
          activities.length,
        lng:
          activities.reduce((sum, a) => sum + (a.lng as number), 0) /
          activities.length,
      }
    : null;

  async function search() {
    if (!center) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/restaurants?lat=${center.lat}&lng=${center.lng}&radius=3000`,
        { signal: AbortSignal.timeout(30000) },
      );
      if (!res.ok) throw new Error("failed");
      setHits((await res.json()) as RestaurantHit[]);
    } catch {
      setError("ค้นหาไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setLoading(false);
    }
  }

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
        detail: `${hit.kind}${hit.cuisine ? ` • ${hit.cuisine}` : ""}\n🔗 ${hit.mapsUrl}`,
        cost: 0,
        category: "food",
        lat: hit.lat,
        lng: hit.lng,
      },
    });
    setAdded((prev) => new Set(prev).add(hit.id));
  }

  if (!center) return null;

  return (
    <Card as="section">
      <SectionTitle
        emoji="🍽️"
        title="ร้านอาหารแถวนั้น"
        action={
          hits ? (
            <span className="text-xs text-muted">{hits.length} ร้าน</span>
          ) : null
        }
      />

      {hits === null ? (
        <>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            ค้นร้านอาหารและคาเฟ่ในรัศมี 3 กม. รอบจุดแวะของวันนี้
            แต่ละร้านเปิดดูรีวิวใน Google Maps ต่อได้
          </p>
          <Button onClick={() => void search()} disabled={loading}>
            {loading ? "กำลังค้นหา…" : "🔍 ค้นร้านแถวนี้"}
          </Button>
        </>
      ) : hits.length === 0 ? (
        <p className="text-sm text-muted">
          ไม่พบร้านที่มีชื่อในแผนที่รอบ ๆ นี้ — พื้นที่ห่างไกลมักยังไม่มีใครลงข้อมูล
          ลองค้นใน Google Maps โดยตรงแทน
        </p>
      ) : (
        <ul className="space-y-2">
          {hits.map((hit) => {
            const away = center
              ? haversine(center, { lat: hit.lat, lng: hit.lng })
              : 0;
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
                    <Badge>📏 {formatDistance(away)}</Badge>
                  </div>
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
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          ⚠️ {error}
        </p>
      ) : null}

      {hits && hits.length > 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-faint">
          ข้อมูลร้านจาก OpenStreetMap ซึ่งอาสาสมัครช่วยกันลง อาจไม่ครบหรือ
          ไม่อัปเดตเท่า Google เวลาจะไปจริงควรเช็กเวลาเปิด-ปิดใน Google Maps อีกที
        </p>
      ) : null}
    </Card>
  );
}
