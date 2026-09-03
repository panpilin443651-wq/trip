"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
 * รายการมาจาก 2 ทาง
 *   1. สถานที่ที่คัดไว้ของจังหวัดนั้น — ขึ้นทันที ไม่ต้องรอเน็ต
 *      และมีเวลาที่ควรเผื่อกับค่าเข้าติดมาด้วย
 *   2. ค้นสดจากแผนที่ สำหรับที่ที่ไม่มีในรายการ เช่น โรงแรมหรือร้านเฉพาะเจาะจง
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
  // ผูกผลค้นไว้กับคำค้นที่ยิงไป จะได้รู้ว่าเป็นผลของคำที่พิมพ์อยู่ตอนนี้ไหม
  // ถ้าเก็บแค่ตัวผลลัพธ์ ต้องล้างค่าทิ้งใน effect ซึ่งติดกฎ set-state-in-effect
  const [remote, setRemote] = useState<{ query: string; hits: GeocodeHit[] }>({
    query: "",
    hits: [],
  });
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provinceKey = tripProvinces.filter(Boolean).join("|");
  const query = value.trim();

  /** ยังไม่พิมพ์ = โชว์ที่ดังของจังหวัดวันนั้น พิมพ์แล้ว = ค้นจากที่คัดไว้ */
  const curated = useMemo(() => {
    const provinces = provinceKey ? provinceKey.split("|") : [];
    if (query.length === 0) {
      const own = dayProvince ? placesInProvince(dayProvince) : [];
      return own.length > 0 ? own : placesInTrip(provinces).slice(0, 10);
    }
    return searchCuratedPlaces(query, provinces, 8);
  }, [query, dayProvince, provinceKey]);

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

  /** ยิงไปแล้วแต่ผลของคำนี้ยังไม่กลับมา */
  const searching = query.length >= 3 && remote.query !== query;

  const remoteOptions = useMemo<PlaceOption[]>(() => {
    // ผลที่ผูกกับคำค้นเก่า ถือว่ายังไม่มา — เทียบในนี้ไม่ใช่ข้างนอก
    // ไม่งั้นได้อาร์เรย์ใหม่ทุก render แล้ว useMemo ก็ไม่ช่วยอะไร
    if (remote.query !== query) return [];
    return remote.hits
      // ชื่อที่มีอยู่ในรายการที่คัดไว้แล้วไม่ต้องโชว์ซ้ำ
      .filter((hit) => !curated.some((c) => c.name === hit.name))
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
  }, [remote, query, curated]);

  const options = [...curated, ...remoteOptions];
  const showList = open && options.length > 0;

  function pick(option: PlaceOption) {
    onPick(option);
    setOpen(false);
    setActive(0);
  }

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
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg"
        >
          {query.length === 0 && curated.length > 0 ? (
            <li className="px-3 pt-1 pb-1.5 text-xs text-faint">
              ⭐ ที่ดังใน {dayProvince || "ทริปนี้"} — พิมพ์เพื่อค้นที่อื่น
            </li>
          ) : null}

          {options.map((option, index) => (
            <li key={option.key} role="option" aria-selected={index === active}>
              {/* คั่นให้เห็นว่าแถวไหนมาจากการค้นสด ซึ่งไม่มีเวลา/ค่าเข้าให้ */}
              {index === curated.length && remoteOptions.length > 0 ? (
                <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-faint">
                  ค้นจากแผนที่
                </p>
              ) : null}

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
                      {option.province ? `${option.province} • ` : ""}
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
          ))}
        </ul>
      ) : null}

      {searching ? (
        <p className="mt-1 text-xs text-faint">กำลังค้นจากแผนที่…</p>
      ) : null}
    </div>
  );
}
