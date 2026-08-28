"use client";

import { useState } from "react";
import { PROVINCE_BY_NAME, PROVINCES_BY_REGION } from "@/data/provinces";
import { cn } from "@/lib/cn";
import { Button, Select } from "./ui";

/**
 * เลือกได้หลายจังหวัดในทริปเดียว
 * ลำดับที่เลือกคือลำดับการเดินทาง จังหวัดแรกใช้เป็นจุดตั้งต้นของแผนที่
 */
export function ProvincePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (provinces: string[]) => void;
}) {
  const [pending, setPending] = useState("");
  const selected = new Set(value);

  function add(name: string) {
    if (!name || selected.has(name)) return;
    onChange([...value, name]);
    setPending("");
  }

  function remove(name: string) {
    onChange(value.filter((p) => p !== name));
  }

  /** ย้ายจังหวัดขึ้น-ลง เพื่อจัดลำดับการเดินทาง */
  function move(index: number, delta: number) {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {value.map((name, index) => {
            const province = PROVINCE_BY_NAME.get(name);
            return (
              <li
                key={name}
                className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-fill text-xs font-semibold text-ink">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {province?.emoji ?? "📍"} {name}
                  {province ? (
                    <span className="ml-1.5 text-xs text-faint">
                      {province.places.length} ที่แนะนำ
                    </span>
                  ) : null}
                </span>

                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`เลื่อน ${name} ขึ้น`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`เลื่อน ${name} ลง`}
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`เอา ${name} ออก`}
                    onClick={() => remove(name)}
                  >
                    ✕
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted">
          ยังไม่ได้เลือกจังหวัด — เลือกจากช่องด้านล่างได้เลย เลือกกี่จังหวัดก็ได้
        </p>
      )}

      <div className="flex gap-2">
        <Select
          value={pending}
          onChange={(e) => add(e.target.value)}
          aria-label="เพิ่มจังหวัด"
        >
          <option value="">➕ เพิ่มจังหวัด…</option>
          {PROVINCES_BY_REGION.map((group) => (
            <optgroup key={group.region} label={group.region}>
              {group.provinces.map((province) => (
                <option
                  key={province.id}
                  value={province.name}
                  disabled={selected.has(province.name)}
                >
                  {province.emoji} {province.name}
                  {selected.has(province.name) ? " (เลือกแล้ว)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <p className={cn("mt-2 text-xs", value.length > 0 ? "text-faint" : "text-muted")}>
        เลือกได้ครบทั้ง 77 จังหวัด • ลำดับในรายการคือลำดับการเดินทาง
        จังหวัดแรกใช้เป็นจุดตั้งต้นของแผนที่
      </p>
    </div>
  );
}
