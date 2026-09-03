"use client";

import { useState } from "react";
import { googleMapsUrl, type PlaceOption } from "@/lib/place-search";
import { PlaceCombobox } from "./PlaceCombobox";

/** สร้างตัวเลือกจากชื่อที่ผู้ใช้พิมพ์เอง ซึ่งไม่มีพิกัดและข้อมูลอื่นติดมา */
function typedPlace(name: string): PlaceOption {
  return {
    key: `typed:${name}`,
    name,
    emoji: "📍",
    province: "",
    hint: "พิมพ์เอง — ยังไม่ได้ปักหมุด",
    source: "search",
  };
}

/**
 * เลือกสถานที่ได้หลายที่รวดเดียว แต่ละที่จะกลายเป็นคนละรายการในแผน
 *
 * วางแผนวันหนึ่งมักนึกออกทีเดียวหลายที่ ถ้าต้องเปิดฟอร์ม-บันทึก-เปิดใหม่
 * ทีละที่จะช้ามาก เลือกรวดเดียวแล้วค่อยไปปรับเวลาทีหลังสะดวกกว่า
 */
export function PlaceListInput({
  value,
  onChange,
  onFirstPick,
  dayProvince,
  tripProvinces,
}: {
  value: PlaceOption[];
  onChange: (places: PlaceOption[]) => void;
  /**
   * เรียกเมื่อเลือกที่แรก ใช้เติมเวลาที่ควรเผื่อ ค่าเข้า และหมวดลงในฟอร์ม
   * ที่ถัด ๆ ไปจะพกข้อมูลของตัวเองไปตอนบันทึก ไม่ต้องมาทับค่าในฟอร์ม
   */
  onFirstPick: (option: PlaceOption) => void;
  dayProvince: string;
  tripProvinces: string[];
}) {
  const [draft, setDraft] = useState("");

  function add(option: PlaceOption) {
    const name = option.name.trim();
    // ชื่อซ้ำไม่ต้องเพิ่ม กดพลาดสองทีจะได้ไม่ได้สองรายการเหมือนกัน
    if (!name || value.some((p) => p.name === name)) {
      setDraft("");
      return;
    }
    if (value.length === 0) onFirstPick(option);
    onChange([...value, { ...option, name }]);
    setDraft("");
  }

  function remove(key: string) {
    onChange(value.filter((p) => p.key !== key));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      {value.length > 0 ? (
        <ol className="mb-2 space-y-1.5">
          {value.map((place, index) => (
            <li
              key={place.key}
              className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-fill text-xs font-semibold text-canvas">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {place.emoji} {place.name}
                </span>
                <span className="block truncate text-xs text-faint">
                  {place.hint}
                </span>
              </span>
              <div className="flex shrink-0 gap-0.5">
                <a
                  href={googleMapsUrl(place.name, place.lat, place.lng)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`เปิด ${place.name} ใน Google Maps`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  🗺️
                </a>
                <button
                  type="button"
                  aria-label={`เลื่อน ${place.name} ขึ้น`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`เลื่อน ${place.name} ลง`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`เอา ${place.name} ออก`}
                  onClick={() => remove(place.key)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <PlaceCombobox
        value={draft}
        onChange={setDraft}
        onPick={add}
        onSubmit={() => add(typedPlace(draft.trim()))}
        dayProvince={dayProvince}
        tripProvinces={tripProvinces}
        autoFocus={value.length === 0}
        placeholder={
          value.length === 0
            ? "กดเพื่อดูที่ดังในจังหวัดนี้ หรือพิมพ์ชื่อเอง"
            : "เพิ่มที่ถัดไป…"
        }
      />
    </div>
  );
}
