"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HotelHit } from "@/app/api/hotels/route";
import type { OsmPlace } from "@/data/osm-places";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import { PlaceThumb } from "@/components/PlaceThumb";
import { PROVINCE_BY_NAME } from "@/data/provinces";
import { matchesQuery } from "@/lib/activity-search";
import { cn } from "@/lib/cn";
import { groupCount, rowsInScope } from "@/lib/district-groups";
import { addMinutesToTime } from "@/lib/format";
import {
  buildSuggestionRows,
  byPlanDistricts,
  SUGGESTION_GROUPS,
  type SuggestionGroup,
  type SuggestionRow,
} from "@/lib/trip-suggestions";
import { useTrip } from "@/lib/trip-context";
import { Button, Card, Input, SectionTitle } from "./ui";

/** จำนวนที่โชว์ก่อนกด "ดูทั้งหมด" */
const PREVIEW = 6;

type Group = "ทั้งหมด" | SuggestionGroup;
const GROUPS: Group[] = ["ทั้งหมด", ...SUGGESTION_GROUPS];

/**
 * แนะนำสถานที่ กิจกรรม วัด ร้านอาหาร คาเฟ่ และที่พัก สำหรับวันที่กำลังดูอยู่
 * กดครั้งเดียวใส่ลงวันนั้นได้เลย ทุกแถวที่มีพิกัดมีลิงก์ไป Google Maps
 *
 * เดิมเป็นการ์ดสองใบซ้อนกัน ใบนี้กับ ProvinceRestaurants ซึ่งทำคนละครึ่ง
 * ของงานเดียวกัน รวมเป็นใบเดียวแล้ว ดูเหตุผลใน lib/trip-suggestions.ts
 */
export function TripSuggestions({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip, activities } = state;

  /*
   * ใช้จังหวัดของวันนั้นก่อน ถ้ายังไม่ได้ระบุค่อยใช้ทุกจังหวัดในทริป
   * ดูวันที่ 3 อยู่ก็ควรได้ที่เที่ยวของจังหวัดวันที่ 3 ไม่ใช่ทั้งทริป
   */
  const dayProvince = trip.dayPlans[dayIndex]?.province ?? "";
  const provinceNames = useMemo(
    () => (dayProvince ? [dayProvince] : trip.provinces),
    [dayProvince, trip.provinces],
  );

  /*
   * อำเภอที่เจาะไว้ในแพลนการเที่ยว — เฉพาะของจังหวัดที่การ์ดนี้กำลังแนะอยู่
   *
   * ถ้าไม่ได้เจาะอำเภอไว้เลยจะได้ null แปลว่าใช้ทั้งจังหวัดเหมือนเดิม
   * ถ้าเจาะไว้แล้วหมวดไหนไม่มีของในอำเภอนั้น จะถอยไปทั้งจังหวัดให้เอง
   * พร้อมบอกให้รู้ ไม่ปล่อยให้ปุ่มตายเหมือนที่เคยเจอกับการ์ดในแท็บแนะนำเที่ยว
   */
  const planDistricts = useMemo(() => {
    const picked: Record<string, string[]> = {};
    for (const name of provinceNames) {
      const list = trip.districts[name] ?? [];
      if (list.length > 0) picked[name] = list;
    }
    return picked;
  }, [provinceNames, trip.districts]);

  const scope = useMemo(() => byPlanDistricts(planDistricts), [planDistricts]);
  const districtLabels = Object.values(planDistricts).flat();

  const [group, setGroup] = useState<Group>("ทั้งหมด");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * ผูกผลลัพธ์กับจังหวัดที่ขอไป ผลของจังหวัดเก่าถูกมองข้ามเองเมื่อคีย์ไม่ตรง
   * จึงไม่ต้องล้างค่าเก่าด้วย setState ตอนเริ่ม effect ซึ่งติดกฎ
   * react-hooks/set-state-in-effect
   */
  const wanted = provinceNames.join("|");
  const [result, setResult] = useState<{
    key: string;
    rows: SuggestionRow[] | null;
  } | null>(null);

  useEffect(() => {
    if (provinceNames.length === 0) return;
    let cancelled = false;

    const load = async (name: string) => {
      const qs = `province=${encodeURIComponent(name)}`;
      const [places, food, stay] = await Promise.all([
        fetch(`/api/places?${qs}`, { signal: AbortSignal.timeout(15000) }).then(
          (r) => (r.ok ? (r.json() as Promise<OsmPlace[]>) : []),
        ),
        fetch(`/api/restaurants?${qs}`, {
          signal: AbortSignal.timeout(15000),
        }).then((r) => (r.ok ? (r.json() as Promise<RestaurantHit[]>) : [])),
        fetch(`/api/hotels?${qs}`, { signal: AbortSignal.timeout(15000) }).then(
          (r) => (r.ok ? (r.json() as Promise<HotelHit[]>) : []),
        ),
      ]);
      return { name, places, food, stay };
    };

    Promise.all(provinceNames.map(load))
      .then((loaded) => {
        if (cancelled) return;
        setResult({
          key: wanted,
          rows: buildSuggestionRows({
            curated: provinceNames
              .map((name) => PROVINCE_BY_NAME.get(name))
              .filter((p) => p !== undefined),
            osmPlaces: Object.fromEntries(loaded.map((l) => [l.name, l.places])),
            restaurants: Object.fromEntries(loaded.map((l) => [l.name, l.food])),
            hotels: Object.fromEntries(loaded.map((l) => [l.name, l.stay])),
          }),
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: wanted, rows: null });
      });

    return () => {
      cancelled = true;
    };
  }, [provinceNames, wanted]);

  const current = result?.key === wanted ? result : null;
  const all = current?.rows ?? null;

  /** ชื่อที่อยู่ในแผนแล้ว ใช้กันเพิ่มซ้ำ */
  const planned = useMemo(
    () => new Set(activities.map((a) => a.title)),
    [activities],
  );

  /*
   * นับให้ตรงกับที่กดแล้วได้เห็นจริง — ใช้ตัวเดียวกับการ์ดในแท็บแนะนำเที่ยว
   * เคยเจอปุ่มบอก 0 แต่กดไปมีรายการขึ้น ซึ่งอ่านแล้วงง
   */
  const countFor = (name: Group) =>
    all ? groupCount(all, scope, name).count : 0;

  const filtered = useMemo(() => {
    if (!all) return null;
    const q = query.trim().toLowerCase();
    return rowsInScope(all, scope, group).rows.filter((row) =>
      matchesQuery(row.haystack, q),
    );
  }, [all, scope, group, query]);

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

  function add(row: SuggestionRow) {
    dispatch({
      type: "addActivity",
      activity: { dayIndex, startTime: nextStartTime(), ...row.fill },
    });
    notify(`ใส่ "${row.name}" ในวันที่ ${dayIndex + 1} แล้ว`);
  }

  if (provinceNames.length === 0) {
    return (
      <Card as="section" className="bg-canvas">
        <SectionTitle title="แนะนำสำหรับทริปนี้" />
        <p className="text-sm leading-relaxed text-muted">
          ยังไม่ได้เลือกจังหวัดในแพลนการเที่ยว เลือกก่อนแล้วระบบจะแนะนำ
          สถานที่ กิจกรรม วัด ร้านอาหาร คาเฟ่ และที่พักของจังหวัดนั้นให้ที่นี่
        </p>
        <Link href="/settings" className="mt-3 inline-block">
          <Button variant="secondary" size="sm">
            🗺️ เลือกจังหวัด
          </Button>
        </Link>
      </Card>
    );
  }

  const usingWholeProvince = all ? groupCount(all, scope, group).wide : false;
  const visible = filtered ? (expanded ? filtered : filtered.slice(0, PREVIEW)) : [];

  return (
    <Card as="section">
      <SectionTitle
        title="แนะนำสำหรับทริปนี้"
        action={
          <span className="text-xs text-muted">ใส่ในวันที่ {dayIndex + 1}</span>
        }
      />

      <p className="mb-3 text-sm leading-relaxed text-muted">
        จาก{" "}
        {districtLabels.length > 0
          ? `อ.${districtLabels.join(" • อ.")} (${provinceNames.join(" • ")})`
          : provinceNames.join(" • ")}
        {all ? ` · ${all.length} แห่ง` : ""}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {GROUPS.map((name) => {
          const count = countFor(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setGroup(name);
                setExpanded(false);
              }}
              aria-pressed={group === name}
              disabled={all !== null && count === 0}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                group === name
                  ? "border-pick bg-pick text-on-pick"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {name}
              {all ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setExpanded(false);
        }}
        placeholder="🔍 ค้นหา เช่น เดินป่า ก๋วยเตี๋ยว ริมทะเล"
        aria-label="ค้นหารายการแนะนำ"
        className="mb-3"
      />

      {usingWholeProvince ? (
        <p className="mb-3 text-xs leading-relaxed text-muted">
          อำเภอที่เลือกไว้ในแพลนไม่มี{group}ในฐานข้อมูล — กำลังแสดง{group}
          ทั้งจังหวัดแทน
        </p>
      ) : null}

      {current === null ? (
        <p className="text-sm text-muted">กำลังโหลด…</p>
      ) : current.rows === null ? (
        <p role="alert" className="text-sm text-danger">
          ⚠️ โหลดข้อมูลไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่
        </p>
      ) : filtered && filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm leading-relaxed text-muted">
          ไม่พบรายการที่ตรงกับ &ldquo;{query}&rdquo; ในหมวด{group}
          {" — "}ลองเปลี่ยนหมวดหรือลบคำค้นดู
        </p>
      ) : null}

      <ul className="space-y-2">
        {visible.map((row) => {
          const added = planned.has(row.name);
          return (
            <li
              key={row.key}
              className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              {/* กิจกรรมไม่มีพิกัด จึงไม่มีรูปและไม่มีลิงก์แผนที่
                  ใช้อิโมจิของกิจกรรมนั้นแทนเพื่อให้แถวไม่แหว่ง */}
              {row.mapsUrl ? (
                <PlaceThumb
                  name={row.name}
                  province={row.province}
                  mapsUrl={row.mapsUrl}
                  skipLookup={!row.notable}
                  className="h-14 w-14"
                />
              ) : (
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-canvas text-2xl"
                  aria-hidden
                >
                  {row.emoji}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">
                  {row.notable ? "⭐ " : ""}
                  {row.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {row.hint}
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {row.province}
                  {row.district ? ` · อ.${row.district}` : ""}
                </p>
                {row.mapsUrl ? (
                  <a
                    href={row.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-brand underline underline-offset-2"
                  >
                    เปิดใน Google Maps
                  </a>
                ) : null}
              </div>

              <Button
                size="sm"
                variant={added ? "secondary" : "primary"}
                disabled={added}
                onClick={() => add(row)}
                className="shrink-0"
              >
                {added ? "✓ อยู่ในแผน" : "➕ ใส่"}
              </Button>
            </li>
          );
        })}
      </ul>

      {filtered && filtered.length > PREVIEW ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm text-brand underline"
        >
          {expanded ? "ย่อรายการ" : `ดูทั้งหมด ${filtered.length} รายการ`}
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
