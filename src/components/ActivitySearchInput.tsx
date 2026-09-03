"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  searchSuggestions,
  type ActivitySuggestion,
  type SuggestionFill,
} from "@/lib/activity-search";
import { cn } from "@/lib/cn";
import { Input } from "./ui";

/**
 * ช่องชื่อกิจกรรมที่พิมพ์เองก็ได้ ค้นจากที่แนะนำก็ได้
 *
 * พิมพ์คำอย่าง "เดินป่า" แล้วจะเจอสถานที่/กิจกรรมของจังหวัดที่เลือกไว้
 * ที่ตรงกับคำนั้น เลือกแล้วเติมรายละเอียด เวลา ค่าใช้จ่าย และพิกัดให้เลย
 */
export function ActivitySearchInput({
  value,
  onChange,
  onPick,
  onSubmit,
  provinces,
  placeholder = "เช่น เดินป่า ล่องแก่ง ไหว้พระ…",
  autoFocus = true,
}: {
  value: string;
  onChange: (title: string) => void;
  onPick: (fill: SuggestionFill) => void;
  /** กด Enter ทั้งที่ไม่ได้เลือกจากรายการ — ใช้ชื่อที่พิมพ์เองไปเลย */
  onSubmit?: () => void;
  /** จังหวัดที่เลือกไว้ ใช้ดันผลลัพธ์ของจังหวัดนั้นขึ้นก่อน */
  provinces: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // provinces เป็น array ที่ผู้เรียกสร้างใหม่ทุก render จึงยุบเป็นสตริงก่อน
  const provinceKey = provinces.filter(Boolean).join("|");

  const matches = useMemo(
    () =>
      searchSuggestions(value, provinceKey ? provinceKey.split("|") : [], 8),
    [value, provinceKey],
  );

  const inTripCount = matches.filter((m) => m.inTrip).length;
  const showList = open && matches.length > 0;

  function pick(item: ActivitySuggestion) {
    onPick(item.fill);
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
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // หน่วงไว้ให้ onMouseDown ของรายการทำงานก่อนปิด
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          // พิมพ์ชื่อเองแล้วกด Enter ทั้งที่ไม่มีรายการให้เลือก
          if (!showList) {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
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
          {matches.map((item, index) => (
            <li key={item.key} role="option" aria-selected={index === active}>
              {/* คั่นให้เห็นว่าจากตรงไหนเป็นจังหวัดนอกแผน จะได้ไม่เผลอเลือก */}
              {index === inTripCount && inTripCount > 0 ? (
                <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-faint">
                  จังหวัดอื่นที่ตรงกับคำค้น
                </p>
              ) : null}

              <button
                type="button"
                // ต้องใช้ onMouseDown เพราะ onClick มาหลัง blur ซึ่งปิดรายการไปแล้ว
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  pick(item);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left",
                  index === active ? "bg-brand-soft" : "",
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.kind === "activity" ? "🎯 " : "📍 "}
                    {item.hint}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
