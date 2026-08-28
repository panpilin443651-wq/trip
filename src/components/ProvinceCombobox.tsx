"use client";

import { useId, useMemo, useRef, useState } from "react";
import { PROVINCES } from "@/data/provinces";
import { cn } from "@/lib/cn";
import { Input } from "./ui";

/**
 * ช่องพิมพ์ชื่อจังหวัดแล้วเลือกจากรายการที่กรองให้
 *
 * ใช้แทน <select> ในที่ที่มี 77 ตัวเลือก เพราะเลื่อนหายาก
 * พิมพ์ 2-3 ตัวอักษรก็เจอแล้ว
 */
export function ProvinceCombobox({
  value,
  onChange,
  placeholder = "พิมพ์ชื่อจังหวัด…",
  exclude = [],
  clearOnSelect = false,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (province: string) => void;
  placeholder?: string;
  /** จังหวัดที่ไม่ต้องเสนอ เช่นที่เลือกไปแล้ว */
  exclude?: string[];
  /** ล้างช่องหลังเลือก เหมาะกับกรณีใช้เป็นปุ่ม "เพิ่มจังหวัด" */
  clearOnSelect?: boolean;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ระหว่างพิมพ์ให้เห็นสิ่งที่พิมพ์ ไม่พิมพ์ก็เห็นค่าที่เลือกไว้
  const text = open ? query : value;

  // exclude เป็น array ที่ผู้เรียกสร้างใหม่ทุก render จึงยุบเป็นสตริงก่อน
  // ใช้เป็น dependency ไม่งั้น useMemo จะคำนวณใหม่ทุกครั้งอยู่ดี
  const excludeKey = exclude.join("|");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeKey ? excludeKey.split("|") : []);
    return PROVINCES.filter((p) => !excluded.has(p.name))
      .filter((p) =>
        q === ""
          ? true
          : p.name.toLowerCase().includes(q) ||
            p.region.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [query, excludeKey]);

  function pick(name: string) {
    onChange(name);
    setQuery(clearOnSelect ? "" : name);
    setOpen(false);
    setActive(0);
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => {
          // หน่วงไว้ให้ onMouseDown ของรายการทำงานก่อนปิด
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && matches[active]) {
            e.preventDefault();
            pick(matches[active].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              ไม่พบจังหวัดที่ตรงกับ &ldquo;{query}&rdquo;
            </li>
          ) : (
            matches.map((province, index) => (
              <li key={province.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  // ต้องใช้ onMouseDown เพราะ onClick มาหลัง blur ซึ่งปิดรายการไปแล้ว
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    pick(province.name);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    index === active ? "bg-brand-soft" : "",
                  )}
                >
                  <span aria-hidden>{province.emoji}</span>
                  <span className="flex-1 truncate">{province.name}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {province.region}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
