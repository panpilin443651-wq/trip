"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OsmPlace } from "@/data/osm-places";
import { cn } from "@/lib/cn";
import {
  googleMapsUrl,
  placesInProvince,
  placesInTrip,
  searchCuratedPlaces,
  type PlaceOption,
} from "@/lib/place-search";
import { searchPlaces, type GeocodeHit } from "@/lib/routing";
import { Input } from "./ui";

/**
 * ช่องเลือกสถานที่ — กดแล้วมีรายการที่ดังในจังหวัดขึ้นมาให้เลือกทันที
 * พิมพ์เองก็ได้ ไม่ต้องเลือกจากรายการ
 *
 * รายการมาจาก 3 ชั้น
 *   1. ที่คัดไว้เองของจังหวัดนั้น — ขึ้นทันทีไม่ต้องรอเน็ต มีเวลาที่ควรเผื่อ
 *      และค่าเข้าติดมาด้วย แต่มีแค่จังหวัดละ 4-8 แห่ง
 *   2. ที่เที่ยวจาก OpenStreetMap — โหลดจาก /api/places ตามจังหวัด
 *      มีเยอะกว่ามาก แต่มีแค่ชื่อ ประเภท และพิกัด
 *   3. ค้นสดจาก Nominatim — สำหรับที่ที่ไม่มีในสองชั้นแรก เช่นโรงแรม
 * ทุกแถวมีลิงก์เปิดใน Google Maps ต่อ เผื่ออยากดูรูปกับรีวิวก่อนตัดสินใจ
 */
export function PlaceCombobox({
  value,
  onChange,
  onPick,
  dayProvince,
  tripProvinces,
}: {
  value: string;
  onChange: (name: string) => void;
  onPick: (option: PlaceOption) => void;
  /** จังหวัดของวันนั้น ใช้เป็นรายการตั้งต้นตอนยังไม่พิมพ์ */
  dayProvince: string;
  /** จังหวัดทั้งหมดในทริป ใช้ดันผลค้นของจังหวัดเหล่านี้ขึ้นก่อน */
  tripProvinces: string[];
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ผูกผลที่โหลดมาไว้กับคำค้น/จังหวัดที่ขอไป จะได้รู้ว่าเป็นของปัจจุบันไหม
  // ถ้าเก็บแค่ตัวผลลัพธ์ ต้องล้างค่าทิ้งใน effect ซึ่งติดกฎ set-state-in-effect
  const [remote, setRemote] = useState<{ query: string; hits: GeocodeHit[] }>({
    query: "",
    hits: [],
  });
  const [osm, setOsm] = useState<{ province: string; places: OsmPlace[] }>({
    province: "",
    places: [],
  });

  const provinceKey = tripProvinces.filter(Boolean).join("|");
  const query = value.trim();
  const lowerQuery = query.toLowerCase();

  /** ยังไม่พิมพ์ = โชว์ที่ดังของจังหวัดวันนั้น พิมพ์แล้ว = ค้นจากที่คัดไว้ */
  const curated = useMemo(() => {
    const provinces = provinceKey ? provinceKey.split("|") : [];
    if (query.length === 0) {
      const own = dayProvince ? placesInProvince(dayProvince) : [];
      return own.length > 0 ? own : placesInTrip(provinces).slice(0, 10);
    }
    return searchCuratedPlaces(query, provinces, 8);
  }, [query, dayProvince, provinceKey]);

  // โหลดที่เที่ยวของจังหวัดนี้ครั้งเดียวตอนจังหวัดเปลี่ยน
  useEffect(() => {
    if (!dayProvince) return;
    let cancelled = false;
    fetch(`/api/places?province=${encodeURIComponent(dayProvince)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((places: OsmPlace[]) => {
        if (!cancelled) setOsm({ province: dayProvince, places });
      })
      .catch(() => {
        if (!cancelled) setOsm({ province: dayProvince, places: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [dayProvince]);

  // ค้นสดเฉพาะตอนพิมพ์พอสมควรแล้ว และหน่วงไว้ไม่ให้ยิงทุกตัวอักษร
  useEffect(() => {
    if (query.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlaces(query)
        .then((hits) => {
          if (!cancelled) setRemote({ query, hits: hits.slice(0, 4) });
        })
        .catch(() => {
          if (!cancelled) setRemote({ query, hits: [] });
        });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const osmOptions = useMemo<PlaceOption[]>(() => {
    // ผลที่ผูกกับจังหวัดเก่า ถือว่ายังไม่มา — เทียบในนี้ไม่ใช่ข้างนอก
    // ไม่งั้นได้อาร์เรย์ใหม่ทุก render แล้ว useMemo ก็ไม่ช่วยอะไร
    if (osm.province !== dayProvince) return [];
    const matched = lowerQuery
      ? osm.places.filter((p) => p.name.toLowerCase().includes(lowerQuery))
      : osm.places;
    return matched
      // ที่ที่มีอยู่ในรายการที่คัดไว้แล้วไม่ต้องโชว์ซ้ำ
      .filter((p) => !curated.some((c) => c.name === p.name))
      .slice(0, lowerQuery ? 10 : 30)
      .map((p) => ({
        key: `osm:${p.id}`,
        name: p.name,
        emoji: p.emoji,
        province: osm.province,
        hint: p.notable ? `${p.kind} • เป็นที่รู้จัก` : p.kind,
        source: "osm" as const,
        lat: p.lat,
        lng: p.lng,
      }));
  }, [osm, dayProvince, lowerQuery, curated]);

  const remoteOptions = useMemo<PlaceOption[]>(() => {
    if (remote.query !== query) return [];
    return remote.hits
      .filter(
        (hit) =>
          !curated.some((c) => c.name === hit.name) &&
          !osmOptions.some((o) => o.name === hit.name),
      )
      .map((hit) => ({
        key: `search:${hit.lat},${hit.lng}`,
        name: hit.name,
        emoji: "📍",
        province: "",
        hint: hit.display,
        source: "search" as const,
        lat: hit.lat,
        lng: hit.lng,
      }));
  }, [remote, query, curated, osmOptions]);

  const sections = [
    {
      key: "curated",
      label: `⭐ ที่ดังใน ${dayProvince || "ทริปนี้"}`,
      items: curated,
    },
    {
      key: "osm",
      label: `📍 ที่เที่ยวอื่นใน ${dayProvince}`,
      items: osmOptions,
    },
    { key: "search", label: "🔎 ค้นจากแผนที่", items: remoteOptions },
  ].filter((section) => section.items.length > 0);

  const options = sections.flatMap((section) => section.items);
  const showList = open && options.length > 0;
  const searching = query.length >= 3 && remote.query !== query;

  function pick(option: PlaceOption) {
    onPick(option);
    setOpen(false);
    setActive(0);
  }

  // ลำดับแบนของทุกแถว ใช้กับลูกศรขึ้น-ลงที่ไม่รู้จักการแบ่งกลุ่ม
  let flatIndex = -1;

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        placeholder="กดเพื่อดูที่ดังในจังหวัดนี้ หรือพิมพ์ชื่อเอง"
        autoFocus
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // หน่วงไว้ให้ onMouseDown ของรายการทำงานก่อนปิด
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
          } else if (e.key === "Enter" && options[active]) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg"
        >
          {sections.map((section) => (
            <li key={section.key}>
              <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-faint first:border-t-0">
                {section.label}
              </p>
              <ul>
                {section.items.map((option) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  return (
                    <li
                      key={option.key}
                      role="option"
                      aria-selected={index === active}
                    >
                      <div
                        className={cn(
                          "flex items-start gap-1",
                          index === active ? "bg-brand-soft" : "",
                        )}
                      >
                        <button
                          type="button"
                          // ต้องใช้ onMouseDown เพราะ onClick มาหลัง blur ซึ่งปิดรายการไปแล้ว
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                            pick(option);
                          }}
                          onMouseEnter={() => setActive(index)}
                          className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                        >
                          <span className="text-lg leading-none" aria-hidden>
                            {option.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {option.name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {option.hint}
                            </span>
                          </span>
                        </button>

                        <a
                          href={googleMapsUrl(option.name, option.lat, option.lng)}
                          target="_blank"
                          rel="noreferrer"
                          // กัน blur ของช่องพิมพ์ไม่ให้ปิดรายการก่อนลิงก์ทำงาน
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label={`เปิด ${option.name} ใน Google Maps`}
                          className="shrink-0 px-2 py-2 text-base"
                          title="ดูรูปและรีวิวใน Google Maps"
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

      {searching ? (
        <p className="mt-1 text-xs text-faint">กำลังค้นจากแผนที่…</p>
      ) : null}
    </div>
  );
}
