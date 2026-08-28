"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PROVINCE_BY_NAME,
  type SuggestedActivity,
  type SuggestedPlace,
} from "@/data/provinces";
import { activityFill, matchesQuery, placeFill } from "@/lib/activity-search";
import { cn } from "@/lib/cn";
import { addMinutesToTime, formatDuration, formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Badge, Button, Card, Input, SectionTitle } from "./ui";

type Tab = "places" | "activities";

/**
 * ข้อความทั้งหมดของแถวหนึ่งที่เอาไปค้นได้
 * ต้องรวมคำอธิบายและทิปด้วย เพราะคำที่คนพิมพ์อย่าง "เดินป่า"
 * ไม่ได้อยู่ในชื่อสถานที่สักแห่ง แต่อยู่ในคำอธิบายเส้นทาง
 */
function haystack(row: PlaceRow | ActivityRow): string {
  const item = "place" in row ? row.place : row.activity;
  const extra =
    "place" in row
      ? `${row.place.tag} ${row.place.tip} ${row.place.bestTime}`
      : `${row.activity.prepare} ${row.activity.duration}`;
  return `${item.name} ${item.description} ${extra} ${row.province}`.toLowerCase();
}

interface PlaceRow {
  province: string;
  place: SuggestedPlace;
}
interface ActivityRow {
  province: string;
  activity: SuggestedActivity;
}

/**
 * ช่องแนะนำสถานที่และกิจกรรม ดึงจากจังหวัดที่เลือกไว้ในแพลนการเที่ยว
 * กดครั้งเดียวใส่ลงวันที่กำลังดูอยู่ได้เลย
 */
export function TripSuggestions({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip, activities } = state;

  const [tab, setTab] = useState<Tab>("places");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const provinces = useMemo(
    () =>
      trip.provinces
        .map((name) => PROVINCE_BY_NAME.get(name))
        .filter((p) => p !== undefined),
    [trip.provinces],
  );

  /** ชื่อกิจกรรมที่อยู่ในแผนแล้ว ใช้กันเพิ่มซ้ำ */
  const planned = useMemo(
    () => new Set(activities.map((a) => a.title)),
    [activities],
  );

  const placeRows = useMemo<PlaceRow[]>(
    () =>
      provinces.flatMap((province) =>
        province.places.map((place) => ({ province: province.name, place })),
      ),
    [provinces],
  );

  const activityRows = useMemo<ActivityRow[]>(
    () =>
      provinces.flatMap((province) =>
        province.activities.map((activity) => ({
          province: province.name,
          activity,
        })),
      ),
    [provinces],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  /** ต่อท้ายกิจกรรมสุดท้ายของวัน เผื่อเวลาเดินทาง 30 นาที */
  function nextStartTime(): string {
    const last = activitiesForDay(dayIndex).at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function addPlace(row: PlaceRow) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex,
        startTime: nextStartTime(),
        ...placeFill(row.province, row.place),
      },
    });
    notify(`ใส่ "${row.place.name}" ในวันที่ ${dayIndex + 1} แล้ว`);
  }

  function addActivity(row: ActivityRow) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex,
        startTime: nextStartTime(),
        ...activityFill(row.province, row.activity),
      },
    });
    notify(`ใส่ "${row.activity.name}" ในวันที่ ${dayIndex + 1} แล้ว`);
  }
  if (provinces.length === 0) {
    return (
      <Card as="section" className="bg-canvas">
        <SectionTitle emoji="✨" title="แนะนำสำหรับทริปนี้" />
        <p className="text-sm text-muted">
          ยังไม่ได้เลือกจังหวัดในแพลนการเที่ยว เลือกก่อนแล้วระบบจะแนะนำ
          สถานที่และกิจกรรมของจังหวัดนั้นให้ที่นี่
        </p>
        <Link href="/settings" className="mt-3 inline-block">
          <Button variant="secondary" size="sm">
            🗺️ เลือกจังหวัด
          </Button>
        </Link>
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const countPlaces = placeRows.filter((row) =>
    matchesQuery(haystack(row), q),
  ).length;
  const countActivities = activityRows.filter((row) =>
    matchesQuery(haystack(row), q),
  ).length;
  const rows = (tab === "places" ? placeRows : activityRows).filter((row) =>
    matchesQuery(haystack(row), q),
  );
  const visible = expanded ? rows : rows.slice(0, 4);

  return (
    <Card as="section">
      <SectionTitle
        emoji="✨"
        title="แนะนำสำหรับทริปนี้"
        action={
          <span className="text-xs text-muted">
            ใส่ในวันที่ {dayIndex + 1}
          </span>
        }
      />

      <p className="mb-3 text-sm text-muted">
        จาก {provinces.map((p) => p.name).join(" • ")}
      </p>

      <div className="mb-3 flex gap-2 rounded-xl bg-line/50 p-1">
        {(
          [
            ["places", `📍 สถานที่ (${countPlaces})`],
            ["activities", `🎯 กิจกรรม (${countActivities})`],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setExpanded(false);
            }}
            className={cn(
              "min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors",
              tab === id ? "bg-card text-ink shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setExpanded(false);
        }}
        placeholder="🔍 ค้นหา เช่น เดินป่า ล่องแก่ง ตลาด"
        aria-label="ค้นหาสถานที่และกิจกรรมแนะนำ"
        className="mb-3"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
          ไม่พบรายการที่ตรงกับ &ldquo;{query}&rdquo; ในจังหวัดที่เลือกไว้
        </p>
      ) : null}

      <ul className="space-y-2">
        {tab === "places"
          ? (visible as PlaceRow[]).map((row) => {
              const added = planned.has(row.place.name);
              return (
                <li
                  key={row.place.id}
                  className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {row.place.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.place.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.province} • ⏱️ {formatDuration(row.place.durationMin)}{" "}
                      • 🎟️{" "}
                      {row.place.fee > 0 ? formatTHB(row.place.fee) : "ไม่มีค่าเข้า"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={added ? "secondary" : "primary"}
                    disabled={added}
                    onClick={() => addPlace(row)}
                    className="shrink-0"
                  >
                    {added ? "✓ อยู่ในแผน" : "➕ ใส่"}
                  </Button>
                </li>
              );
            })
          : (visible as ActivityRow[]).map((row) => {
              const added = planned.has(row.activity.name);
              return (
                <li
                  key={row.activity.id}
                  className="rounded-xl border border-line px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none" aria-hidden>
                      {row.activity.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{row.activity.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">
                        {row.activity.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge>{row.province}</Badge>
                        <Badge className="bg-brand-soft text-brand">
                          💵 {row.activity.price}
                        </Badge>
                        <Badge>⏱️ {row.activity.duration}</Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-faint">
                        🎒 {row.activity.prepare}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={added ? "secondary" : "primary"}
                      disabled={added}
                      onClick={() => addActivity(row)}
                      className="shrink-0"
                    >
                      {added ? "✓" : "➕ ใส่"}
                    </Button>
                  </div>
                </li>
              );
            })}
      </ul>

      {rows.length > 4 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm text-brand underline"
        >
          {expanded ? "ย่อรายการ" : `ดูทั้งหมด ${rows.length} รายการ`}
        </button>
      ) : null}

      {toast ? (
        <p role="status" className="mt-3 text-sm text-ok">
          ✓ {toast}
        </p>
      ) : null}
    </Card>
  );
}
