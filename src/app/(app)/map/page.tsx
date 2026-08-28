"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DayTabs } from "@/components/DayTabs";
import { PageHeader } from "@/components/PageHeader";
import type { MapPoint } from "@/components/TripMap";
import { Badge, Button, Card, EmptyState, StatTile } from "@/components/ui";
import { PROVINCE_BY_NAME } from "@/data/provinces";
import { formatDistance, formatTravelTime, hasCoords } from "@/lib/geo";
import { fetchRoute, type RouteResult } from "@/lib/routing";
import { useTrip } from "@/lib/trip-context";

// Leaflet แตะ window ตอน import จึงต้องโหลดฝั่ง client เท่านั้น
const TripMap = dynamic(() => import("@/components/TripMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60dvh] min-h-80 items-center justify-center rounded-2xl border border-line bg-canvas text-sm text-muted">
      กำลังโหลดแผนที่…
    </div>
  ),
});

const BANGKOK = { lat: 13.7563, lng: 100.5018 };

export default function MapPage() {
  const { state, activitiesForDay } = useTrip();
  const { trip } = state;

  const [dayIndex, setDayIndex] = useState(0);
  /** ผูกผลลัพธ์กับชุดพิกัดที่ขอไป เพื่อไม่ต้องล้างค่าเก่าด้วย setState ใน effect */
  const [routeState, setRouteState] = useState<{
    key: string;
    result: RouteResult;
  } | null>(null);

  const safeDayIndex = Math.min(dayIndex, trip.dayCount - 1);
  const dayActivities = useMemo(
    () => activitiesForDay(safeDayIndex),
    [activitiesForDay, safeDayIndex],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      dayActivities
        .filter(hasCoords)
        .map((activity) => ({
          activity,
          lat: activity.lat as number,
          lng: activity.lng as number,
        })),
    [dayActivities],
  );

  const missing = dayActivities.filter((a) => !hasCoords(a));

  // ศูนย์กลางเริ่มต้น: จังหวัดปลายทางถ้าตรงกับข้อมูลที่มี ไม่งั้นกรุงเทพฯ
  const center = useMemo(() => {
    if (points.length > 0) return { lat: points[0].lat, lng: points[0].lng };
    const first = trip.provinces
      .map((name) => PROVINCE_BY_NAME.get(name))
      .find(Boolean);
    return first?.center ?? BANGKOK;
  }, [points, trip.provinces]);

  const routeKey = points
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join(";");

  // ผลลัพธ์ที่ค้างจากวันก่อนหน้าจะถูกมองข้ามเองเพราะ key ไม่ตรง
  const route = routeState?.key === routeKey ? routeState.result : null;
  const loading = points.length >= 2 && route === null;

  useEffect(() => {
    if (routeKey.split(";").length < 2) return;

    let cancelled = false;
    const coords = routeKey.split(";").map((pair) => {
      const [lat, lng] = pair.split(",").map(Number);
      return { lat, lng };
    });

    fetchRoute(coords).then((result) => {
      if (!cancelled) setRouteState({ key: routeKey, result });
    });

    return () => {
      cancelled = true;
    };
  }, [routeKey]);

  return (
    <>
      <PageHeader
        emoji="🗺️"
        title="แผนที่และเส้นทาง"
        subtitle="หมุดเรียงตามลำดับเวลาของกิจกรรมในวันนั้น"
      />

      <DayTabs
        dayCount={trip.dayCount}
        startDate={trip.startDate}
        value={safeDayIndex}
        onChange={setDayIndex}
      />

      {dayActivities.length === 0 ? (
        <EmptyState
          emoji="📍"
          title="ยังไม่มีกิจกรรมในวันนี้"
          description="เพิ่มกิจกรรมในหน้าแผนเที่ยวก่อน แล้วปักหมุดสถานที่เพื่อดูเส้นทาง"
          action={
            <Link href="/itinerary">
              <Button>📋 ไปหน้าแผนเที่ยว</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <TripMap
            points={points}
            geometry={route?.geometry ?? points.map((p) => [p.lat, p.lng])}
            center={center}
          />

          {points.length >= 2 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  emoji="🛣️"
                  label="ระยะทางรวม"
                  value={
                    loading
                      ? "…"
                      : formatDistance(route?.totalDistance ?? 0)
                  }
                />
                <StatTile
                  emoji="⏱️"
                  label="เวลาเดินทางรวม"
                  value={
                    loading ? "…" : formatTravelTime(route?.totalDuration ?? 0)
                  }
                />
              </div>

              {route?.estimated ? (
                <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
                  ⚠️ เรียกบริการเส้นทางไม่สำเร็จ
                  ตัวเลขนี้เป็นค่าประมาณจากระยะเส้นตรง (คูณ 1.3) และความเร็วเฉลี่ย 45
                  กม./ชม.
                </p>
              ) : null}

              <Card>
                <h2 className="mb-3 text-base font-semibold">🚗 ช่วงการเดินทาง</h2>
                <ol className="space-y-2">
                  {points.slice(0, -1).map((point, index) => {
                    const next = points[index + 1];
                    const leg = route?.legs[index];
                    return (
                      <li
                        key={`${point.activity.id}-${next.activity.id}`}
                        className="flex items-start justify-between gap-3 border-b border-line pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-muted">{index + 1}</span>{" "}
                          {point.activity.title}
                          <span className="text-muted"> → </span>
                          <span className="text-muted">{index + 2}</span>{" "}
                          {next.activity.title}
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                          {leg ? (
                            <>
                              <span className="block font-medium">
                                {formatDistance(leg.distance)}
                              </span>
                              <span className="block text-xs text-muted">
                                {formatTravelTime(leg.duration)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">…</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </>
          ) : points.length === 1 ? (
            <p className="rounded-xl bg-canvas px-3 py-2.5 text-sm text-muted">
              มีหมุดเดียวในวันนี้ — ปักหมุดอย่างน้อย 2 จุดเพื่อคำนวณระยะทาง
            </p>
          ) : null}

          {missing.length > 0 ? (
            <Card>
              <h2 className="mb-1 text-base font-semibold">
                📌 ยังไม่ได้ปักหมุด ({missing.length})
              </h2>
              <p className="mb-3 text-sm text-muted">
                กิจกรรมเหล่านี้ยังไม่มีพิกัด จึงไม่ถูกนำมาคำนวณระยะทาง
                แก้ไขกิจกรรมแล้วกดปุ่ม 🔍 ข้างช่องสถานที่เพื่อปักหมุด
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((activity) => (
                  <li key={activity.id}>
                    <Badge>{activity.title}</Badge>
                  </li>
                ))}
              </ul>
              <Link href="/itinerary" className="mt-3 inline-block">
                <Button variant="secondary" size="sm">
                  ไปแก้ที่หน้าแผนเที่ยว
                </Button>
              </Link>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
