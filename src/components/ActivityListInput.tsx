"use client";

import { useState } from "react";
import type { SuggestionFill } from "@/lib/activity-search";
import { ActivitySearchInput } from "./ActivitySearchInput";

/**
 * รายการกิจกรรมที่จะทำที่สถานที่หนึ่ง ใส่ได้หลายอย่าง
 *
 * ที่เดียวมักทำหลายอย่าง เช่นไปวัดแล้วทั้งไหว้พระ ถ่ายรูป และชิมของกินหน้าวัด
 * เดิมใส่ได้อย่างเดียวจึงต้องแยกเป็นคนละรายการทั้งที่เป็นการแวะครั้งเดียว
 */
export function ActivityListInput({
  value,
  onChange,
  onFirstPick,
  provinces,
}: {
  value: string[];
  onChange: (activities: string[]) => void;
  /**
   * เรียกเมื่อเลือกกิจกรรมแรกจากรายการที่แนะนำ
   * ใช้เติมระยะเวลา ค่าใช้จ่าย และหมวดให้ครั้งเดียว — กิจกรรมถัดไปไม่ควรไปทับ
   * ค่าที่ผู้ใช้ปรับเองไว้แล้ว และค่าใช้จ่ายของรายการนี้มีช่องเดียว
   */
  onFirstPick: (fill: SuggestionFill) => void;
  provinces: string[];
}) {
  const [draft, setDraft] = useState("");

  function add(name: string) {
    const text = name.trim();
    // ชื่อซ้ำไม่ต้องเพิ่ม กดพลาดสองทีจะได้ไม่ได้สองบรรทัดเหมือนกัน
    if (!text || value.includes(text)) {
      setDraft("");
      return;
    }
    onChange([...value, text]);
    setDraft("");
  }

  function remove(name: string) {
    onChange(value.filter((item) => item !== name));
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
          {value.map((name, index) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  aria-label={`เลื่อน ${name} ขึ้น`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`เลื่อน ${name} ลง`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`เอา ${name} ออก`}
                  onClick={() => remove(name)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <ActivitySearchInput
        value={draft}
        onChange={setDraft}
        onPick={(fill) => {
          // กิจกรรมแรกเท่านั้นที่เอาเวลาและค่าใช้จ่ายที่แนะนำมาเติมให้
          if (value.length === 0) onFirstPick(fill);
          add(fill.title);
        }}
        onSubmit={() => add(draft)}
        provinces={provinces}
        placeholder="พิมพ์แล้วกด Enter เช่น ไหว้พระ ถ่ายรูป…"
        autoFocus={false}
      />

      <p className="mt-1 text-xs text-faint">
        {value.length > 0
          ? `เพิ่มแล้ว ${value.length} กิจกรรม — พิมพ์เพิ่มได้อีก`
          : "ไม่ใส่ก็ได้ จะใช้ชื่อสถานที่เป็นชื่อรายการให้เอง"}
      </p>
    </div>
  );
}
