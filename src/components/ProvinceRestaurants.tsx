"use client";

import { useEffect, useMemo, useState } from "react";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import { addMinutesToTime } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import { Badge, Button, Card, Input, SectionTitle, cn } from "./ui";

/** จำนวนที่โชว์ตอนยังไม่ได้กดดูทั้งหมด */
const PREVIEW = 8;

/**
 * ร้านอาหารและคาเฟ่ดังของจังหวัด จากฐานข้อมูลที่คัดไว้ล่วงหน้า
 *
 * ดูได้ตั้งแต่ยังไม่มีจุดแวะเลย แค่เลือกจังหวัดไว้ก็พอ เหมาะกับตอนกำลังวางแผน
 * ว่าจะไปกินอะไรบ้าง พิมพ์ค้นชื่อร้านหรือประเภทอาหารได้
 *
 * ร้านที่มีคนเขียนถึงใน Wikipedia ติดดาว ⭐ และถูกดันขึ้นบนสุดเสมอ
 * เพราะเป็นสัญญาณเดียวที่ OSM มีว่าร้านไหน "ดัง" จริง
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
  const [query, setQuery] = useState("");
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

  const current = result?.province === active ? result : null;
  const all = current?.hits ?? null;

  /**
   * กรองตามคำค้นแล้วดันร้านติดดาวขึ้นก่อน
   *
   * ค้นทั้งชื่อ ประเภทอาหาร และชนิดร้าน เพราะคนมักพิมพ์ว่า "กาแฟ" หรือ "ทะเล"
   * มากกว่าจะจำชื่อร้านได้
   */
  const filtered = useMemo(() => {
    if (!all) return null;
    const q = query.trim().toLowerCase();
    const matched = q
      ? all.filter((r) =>
          [r.name, r.cuisine ?? "", r.kind].some((field) =>
            field.toLowerCase().includes(q),
          ),
        )
      : all;
    return [...matched].sort(
      (a, b) => Number(!!b.notable) - Number(!!a.notable),
    );
  }, [all, query]);

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

  const starred = all?.filter((r) => r.notable).length ?? 0;

  return (
    <Card as="section">
      <SectionTitle
        emoji="🍜"
        title="ร้านดังในจังหวัด"
        action={
          all ? (
            <span className="text-xs text-muted">
              {all.length} ร้าน{starred > 0 ? ` · ⭐ ${starred}` : ""}
            </span>
          ) : null
        }
      />

      {provinces.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {provinces.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setProvince(name);
                setQuery("");
              }}
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

      {all && all.length > 0 ? (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นชื่อร้าน หรือประเภท เช่น กาแฟ อาหารทะเล"
          aria-label="ค้นหาร้านในจังหวัด"
          className="mb-3"
        />
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
          OpenStreetMap ไว้น้อยจะเป็นแบบนี้ ลองค้นใน Google Maps โดยตรงแทน
        </p>
      ) : filtered && filtered.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          ไม่พบร้านที่ตรงกับ &ldquo;{query}&rdquo; ใน{active} —
          ลองพิมพ์สั้นลงหรือค้นด้วยประเภทอาหารแทน
        </p>
      ) : filtered ? (
        <>
          <ul className="space-y-2">
            {(showAll ? filtered : filtered.slice(0, PREVIEW)).map((hit) => {
              const inPlan = added.has(hit.id);
              return (
                <li
                  key={hit.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5",
                    hit.notable
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">
                      {hit.notable ? (
                        <span className="mr-1" title="มีคนเขียนถึงใน Wikipedia">
                          ⭐
                        </span>
                      ) : null}
                      {hit.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{hit.kind}</Badge>
                      {hit.cuisine ? <Badge>{hit.cuisine}</Badge> : null}
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

          {filtered.length > PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-sm text-brand underline"
            >
              {showAll
                ? "ย่อรายการ"
                : `ดูอีก ${filtered.length - PREVIEW} ร้าน`}
            </button>
          ) : null}

          <p className="mt-3 text-xs leading-relaxed text-faint">
            ⭐ = มีคนเขียนถึงใน Wikipedia · คัดจาก OpenStreetMap เฉพาะร้านที่มีเว็บ
            เบอร์โทร หรือเวลาเปิดปิด และตัดร้านเชนที่มีทุกห้างออกแล้ว
            เวลาจะไปจริงควรเช็กเวลาเปิด-ปิดใน Google Maps อีกที
          </p>
        </>
      ) : null}
    </Card>
  );
}
