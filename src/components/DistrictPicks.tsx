"use client";

import { useEffect, useMemo, useState } from "react";
import type { OsmPlace } from "@/data/osm-places";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import { addMinutesToTime } from "@/lib/format";
import { googleMapsUrl } from "@/lib/place-search";
import { useTrip } from "@/lib/trip-context";
import { Badge, Button, Card, Input, SectionTitle, cn } from "./ui";

/** จำนวนที่โชว์ก่อนกด "ดูเพิ่ม" */
const PREVIEW = 10;

type Row = {
  key: string;
  name: string;
  emoji: string;
  kind: string;
  hint: string;
  lat: number;
  lng: number;
  notable: boolean;
  /** หมวดสำหรับปุ่มกรอง */
  group: "วัด" | "ที่เที่ยว" | "คาเฟ่" | "ร้านอาหาร";
};

const GROUPS = ["ทั้งหมด", "วัด", "ที่เที่ยว", "คาเฟ่", "ร้านอาหาร"] as const;
type Group = (typeof GROUPS)[number];

/**
 * ที่เที่ยว วัด คาเฟ่ และร้านอาหารของอำเภอที่เลือก จาก OpenStreetMap
 *
 * เสริมจากรายการที่คัดไว้เอง ซึ่งมีแค่จังหวัดละ 4-8 แห่ง ชุดนี้มีหลักพัน
 * แต่ไม่มีคำอธิบายหรือค่าเข้า เพราะ OSM ไม่ได้เก็บไว้ จึงพาไปดูรูปกับรีวิวต่อ
 * ที่ Google Maps แทน
 *
 * ⭐ = มีหน้า Wikipedia หรือ Wikidata ซึ่งเป็นสัญญาณเดียวที่ OSM มีว่า
 * ที่ไหน "ดัง" จริง ไม่ใช่คะแนนรีวิว
 */
export function DistrictPicks({
  province,
  district,
  dayIndex,
  onAdded,
}: {
  province: string;
  /** ว่าง = ทั้งจังหวัด */
  district: string;
  dayIndex: number;
  onAdded: (name: string) => void;
}) {
  const { dispatch, activitiesForDay } = useTrip();

  /**
   * ผูกผลลัพธ์กับจังหวัด+อำเภอที่ขอไป ผลเก่าจะถูกมองข้ามเองเมื่อคีย์ไม่ตรง
   * จึงไม่ต้องล้างค่าเก่าด้วย setState ตอนเริ่ม effect ซึ่งติดกฎ
   * react-hooks/set-state-in-effect
   */
  const wanted = `${province}::${district}`;
  const [result, setResult] = useState<{
    key: string;
    rows: Row[] | null;
  } | null>(null);

  const [group, setGroup] = useState<Group>("ทั้งหมด");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!province) return;
    let cancelled = false;

    const qs = `province=${encodeURIComponent(province)}${
      district ? `&district=${encodeURIComponent(district)}` : ""
    }`;

    Promise.all([
      fetch(`/api/places?${qs}`, { signal: AbortSignal.timeout(15000) }).then(
        (r) => (r.ok ? r.json() : Promise.reject(new Error("places"))),
      ),
      fetch(`/api/restaurants?${qs}`, {
        signal: AbortSignal.timeout(15000),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("food")))),
    ])
      .then(([places, food]: [OsmPlace[], RestaurantHit[]]) => {
        if (cancelled) return;
        const rows: Row[] = [
          ...places.map((p) => ({
            key: `p-${p.id}`,
            name: p.name,
            emoji: p.emoji,
            kind: p.kind,
            hint: p.kind,
            lat: p.lat,
            lng: p.lng,
            notable: p.notable,
            group: (p.kind === "วัด" ? "วัด" : "ที่เที่ยว") as Row["group"],
          })),
          ...food.map((f) => ({
            key: `f-${f.id}`,
            name: f.name,
            emoji: f.kind === "คาเฟ่" ? "☕" : "🍽️",
            kind: f.kind,
            hint: [f.cuisine, f.openingHours].filter(Boolean).join(" · "),
            lat: f.lat,
            lng: f.lng,
            notable: f.notable,
            group: (f.kind === "คาเฟ่" ? "คาเฟ่" : "ร้านอาหาร") as Row["group"],
          })),
        ];
        setResult({ key: wanted, rows });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: wanted, rows: null });
      });

    return () => {
      cancelled = true;
    };
  }, [province, district, wanted]);

  const current = result?.key === wanted ? result : null;
  const all = current?.rows ?? null;

  const filtered = useMemo(() => {
    if (!all) return null;
    const q = query.trim().toLowerCase();
    return all
      .filter((row) => group === "ทั้งหมด" || row.group === group)
      .filter(
        (row) =>
          !q ||
          row.name.toLowerCase().includes(q) ||
          row.hint.toLowerCase().includes(q),
      )
      .sort((a, b) => Number(b.notable) - Number(a.notable));
  }, [all, group, query]);

  /** ต่อท้ายกิจกรรมสุดท้ายของวัน เผื่อเวลาเดินทาง 30 นาที */
  function nextStartTime(): string {
    const last = activitiesForDay(dayIndex).at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function addToPlan(row: Row) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex,
        startTime: nextStartTime(),
        durationMin: row.group === "คาเฟ่" || row.group === "ร้านอาหาร" ? 60 : 90,
        title: row.name,
        placeName: `${row.name} ${province}`,
        province,
        detail: `${row.kind}${row.hint && row.hint !== row.kind ? ` • ${row.hint}` : ""}`,
        cost: 0,
        category:
          row.group === "คาเฟ่" || row.group === "ร้านอาหาร"
            ? "food"
            : "attraction",
        lat: row.lat,
        lng: row.lng,
      },
    });
    setAdded((prev) => new Set(prev).add(row.key));
    onAdded(row.name);
  }

  const where = district || province;
  const starred = all?.filter((r) => r.notable).length ?? 0;

  return (
    <Card as="section" className="mt-4">
      <SectionTitle
        emoji="🛕"
        title={`วัด คาเฟ่ ร้านดัง ใน${where}`}
        action={
          all ? (
            <span className="text-xs text-muted">
              {all.length} แห่ง{starred > 0 ? ` · ⭐ ${starred}` : ""}
            </span>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {GROUPS.map((name) => {
          const count =
            name === "ทั้งหมด"
              ? (all?.length ?? 0)
              : (all?.filter((r) => r.group === name).length ?? 0);
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                setGroup(name);
                setShowAll(false);
              }}
              aria-pressed={group === name}
              disabled={all !== null && count === 0}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-40",
                group === name
                  ? "border-brand bg-brand text-canvas"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {name}
              {all ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {all && all.length > 0 ? (
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นชื่อ หรือประเภท เช่น กาแฟ ก๋วยเตี๋ยว"
          aria-label={`ค้นหาใน${where}`}
          className="mb-3"
        />
      ) : null}

      {current === null ? (
        <p className="text-sm text-muted">กำลังโหลด…</p>
      ) : current.rows === null ? (
        <p role="alert" className="text-sm text-danger">
          ⚠️ โหลดข้อมูลไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองใหม่
        </p>
      ) : all && all.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          ยังไม่มีข้อมูลของ{where}ใน OpenStreetMap — อำเภอที่คนลงข้อมูลไว้น้อย
          จะเป็นแบบนี้ ลองเลือกดูทั้งจังหวัดแทน
        </p>
      ) : filtered && filtered.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          ไม่พบที่ตรงกับที่ค้น — ลองพิมพ์สั้นลงหรือเปลี่ยนหมวด
        </p>
      ) : filtered ? (
        <>
          <ul className="space-y-2">
            {(showAll ? filtered : filtered.slice(0, PREVIEW)).map((row) => {
              const inPlan = added.has(row.key);
              return (
                <li
                  key={row.key}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-3 py-2.5",
                    row.notable
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line",
                  )}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {row.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">
                      {row.notable ? (
                        <span className="mr-1" title="มีหน้า Wikipedia">
                          ⭐
                        </span>
                      ) : null}
                      {row.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge>{row.kind}</Badge>
                    </div>
                    {row.hint && row.hint !== row.kind ? (
                      <p className="mt-1 text-xs text-faint">{row.hint}</p>
                    ) : null}
                    <a
                      href={googleMapsUrl(row.name, row.lat, row.lng)}
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
                    onClick={() => addToPlan(row)}
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
              {showAll ? "ย่อรายการ" : `ดูอีก ${filtered.length - PREVIEW} แห่ง`}
            </button>
          ) : null}

          <p className="mt-3 text-xs leading-relaxed text-faint">
            ⭐ = มีหน้า Wikipedia · ข้อมูลจาก OpenStreetMap ไม่มีคำอธิบายและค่าเข้า
            กดลิงก์ไปดูรูปกับรีวิวใน Google Maps ก่อนตัดสินใจได้
          </p>
        </>
      ) : null}
    </Card>
  );
}
