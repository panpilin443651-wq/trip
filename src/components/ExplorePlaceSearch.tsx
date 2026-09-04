"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OsmPlace } from "@/data/osm-places";
import type { RestaurantHit } from "@/app/api/restaurants/route";
import type { SuggestedPlace } from "@/data/provinces";
import { cn } from "@/lib/cn";
import { googleMapsUrl } from "@/lib/place-search";
import { Input } from "./ui";

interface Row {
  key: string;
  name: string;
  emoji: string;
  hint: string;
  starred: boolean;
  lat: number;
  lng: number;
  /** มีข้อมูลที่คัดไว้เอง จึงเปิดหน้ารายละเอียดได้ */
  curated?: SuggestedPlace;
}

/**
 * ช่องค้นหาสถานที่ของหน้าแนะนำเที่ยว — กดแล้วมีรายการขึ้นมาให้เลือก
 *
 * รายการมาจากสองแหล่ง และจำกัดตามอำเภอที่เลือกไว้เสมอ
 *   ⭐ คัดมาแนะนำ — มีคำอธิบาย เวลาที่ควรไป ค่าเข้า และแผนที่ของจุดนั้น
 *   📍 จาก OpenStreetMap — มีเยอะกว่ามาก แต่มีแค่ชื่อกับประเภท
 *
 * ดาวมีสองความหมายตามแหล่ง เขียนบอกไว้ที่หัวข้อกลุ่ม ไม่ปนกัน
 *   กลุ่มบน = คนเขียนข้อมูลคัดว่าห้ามพลาด
 *   กลุ่มล่าง = มีหน้า Wikipedia ซึ่งเป็นสัญญาณเดียวที่ OSM มี
 *
 * เลือกที่ที่คัดไว้เอง = เปิดหน้ารายละเอียด ส่วนที่มาจาก OSM ไม่มีหน้ารายละเอียด
 * จึงกรองรายการข้างล่างให้แทน แล้วไปกดปุ่มใส่แผนที่การ์ดนั้นต่อได้
 */
export function ExplorePlaceSearch({
  value,
  onChange,
  onPickCurated,
  province,
  district,
  curatedPlaces,
}: {
  value: string;
  onChange: (query: string) => void;
  onPickCurated: (place: SuggestedPlace) => void;
  province: string;
  /** ว่าง = ทั้งจังหวัด */
  district: string;
  /** สถานที่ที่คัดไว้เอง กรองตามอำเภอมาแล้ว */
  curatedPlaces: SuggestedPlace[];
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ผูกผลกับจังหวัด+อำเภอที่ขอไป ผลเก่าถูกมองข้ามเองเมื่อคีย์ไม่ตรง
  const wanted = `${province}::${district}`;
  const [osm, setOsm] = useState<{ key: string; rows: Row[] }>({
    key: "",
    rows: [],
  });

  useEffect(() => {
    if (!province) return;
    let cancelled = false;
    const qs = `province=${encodeURIComponent(province)}${
      district ? `&district=${encodeURIComponent(district)}` : ""
    }`;

    Promise.all([
      fetch(`/api/places?${qs}`, { signal: AbortSignal.timeout(15000) }).then(
        (r) => (r.ok ? r.json() : []),
      ),
      fetch(`/api/restaurants?${qs}`, {
        signal: AbortSignal.timeout(15000),
      }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([places, food]: [OsmPlace[], RestaurantHit[]]) => {
        if (cancelled) return;
        setOsm({
          key: wanted,
          rows: [
            ...places.map((p) => ({
              key: `p-${p.id}`,
              name: p.name,
              emoji: p.emoji,
              hint: p.kind,
              starred: p.notable,
              lat: p.lat,
              lng: p.lng,
            })),
            ...food.map((f) => ({
              key: `f-${f.id}`,
              name: f.name,
              emoji: f.kind === "คาเฟ่" ? "☕" : "🍽️",
              hint: [f.kind, f.cuisine].filter(Boolean).join(" · "),
              starred: f.notable,
              lat: f.lat,
              lng: f.lng,
            })),
          ],
        });
      })
      .catch(() => {
        if (!cancelled) setOsm({ key: wanted, rows: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [province, district, wanted]);

  const query = value.trim().toLowerCase();

  const curatedRows = useMemo<Row[]>(
    () =>
      curatedPlaces
        .filter(
          (place) =>
            !query ||
            [place.name, place.tag, place.description].some((f) =>
              f.toLowerCase().includes(query),
            ),
        )
        .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
        .slice(0, 8)
        .map((place) => ({
          key: `c-${place.id}`,
          name: place.name,
          emoji: place.emoji,
          hint: place.tag,
          starred: !!place.featured,
          lat: place.lat,
          lng: place.lng,
          curated: place,
        })),
    [curatedPlaces, query],
  );

  const osmRows = useMemo<Row[]>(() => {
    // ผลที่ผูกกับอำเภอเก่า ถือว่ายังไม่มา — เทียบในนี้ ไม่ใช่ข้างนอก
    // ไม่งั้นได้อาร์เรย์ใหม่ทุก render แล้ว useMemo ก็ไม่ช่วยอะไร
    if (osm.key !== wanted) return [];
    const names = new Set(curatedRows.map((r) => r.name));
    return osm.rows
      .filter(
        (row) =>
          !names.has(row.name) &&
          (!query ||
            row.name.toLowerCase().includes(query) ||
            row.hint.toLowerCase().includes(query)),
      )
      .sort((a, b) => Number(b.starred) - Number(a.starred))
      .slice(0, query ? 12 : 20);
  }, [osm, wanted, curatedRows, query]);

  const where = district || province;
  const sections = [
    { label: `คัดมาแนะนำใน${where}`, rows: curatedRows },
    { label: `จาก OpenStreetMap ใน${where}`, rows: osmRows },
  ].filter((s) => s.rows.length > 0);

  const options = sections.flatMap((s) => s.rows);
  const showList = open && options.length > 0;

  function pick(row: Row) {
    if (row.curated) onPickCurated(row.curated);
    // ที่จาก OSM ไม่มีหน้ารายละเอียด กรองรายการข้างล่างให้แทน
    else onChange(row.name);
    setOpen(false);
    setActive(0);
  }

  let flatIndex = -1;

  return (
    <div className="relative">
      <Input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        placeholder={`กดเพื่อดูที่เที่ยวใน${where} หรือพิมพ์ค้นเอง`}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const row = options[active];
            if (row) pick(row);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-[var(--shadow-lift)]"
        >
          {sections.map((section) => (
            <li key={section.label}>
              <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-faint first:border-t-0">
                {section.label}
              </p>
              <ul>
                {section.rows.map((row) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  return (
                    <li key={row.key} role="option" aria-selected={index === active}>
                      <div
                        className={cn(
                          "flex items-start gap-1",
                          index === active ? "bg-brand-soft" : "",
                        )}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                            pick(row);
                          }}
                          onMouseEnter={() => setActive(index)}
                          className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                        >
                          <span className="text-lg leading-none" aria-hidden>
                            {row.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {row.starred ? (
                                <span className="mr-1" aria-hidden>
                                  ⭐
                                </span>
                              ) : null}
                              {row.name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {row.hint}
                            </span>
                          </span>
                        </button>
                        <a
                          href={googleMapsUrl(row.name, row.lat, row.lng)}
                          target="_blank"
                          rel="noreferrer"
                          // กัน blur ของช่องพิมพ์ ไม่งั้นรายการปิดก่อนลิงก์ทำงาน
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label={`เปิด ${row.name} ใน Google Maps`}
                          title="ดูรูปและรีวิวใน Google Maps"
                          className="shrink-0 px-2 py-2 text-base"
                        >
                          🗺️
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
