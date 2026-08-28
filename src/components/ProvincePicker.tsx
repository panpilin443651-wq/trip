"use client";

import { useState } from "react";
import { districtsOf } from "@/data/districts";
import { PROVINCE_BY_NAME, PROVINCES_BY_REGION } from "@/data/provinces";
import { cn } from "@/lib/cn";
import { Button, Select } from "./ui";

/**
 * เลือกได้หลายจังหวัดในทริปเดียว และเจาะเลือกอำเภอในแต่ละจังหวัดได้
 * ลำดับที่เลือกคือลำดับการเดินทาง จังหวัดแรกใช้เป็นจุดตั้งต้นของแผนที่
 */
export function ProvincePicker({
  provinces,
  districts,
  onChangeProvinces,
  onChangeDistricts,
}: {
  provinces: string[];
  districts: Record<string, string[]>;
  onChangeProvinces: (provinces: string[]) => void;
  onChangeDistricts: (districts: Record<string, string[]>) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const selected = new Set(provinces);

  function addProvince(name: string) {
    if (!name || selected.has(name)) return;
    onChangeProvinces([...provinces, name]);
    setExpanded(name);
  }

  function removeProvince(name: string) {
    onChangeProvinces(provinces.filter((p) => p !== name));
    // เอาอำเภอของจังหวัดนั้นออกด้วย ไม่ให้ค้างเป็นข้อมูลกำพร้า
    const next = { ...districts };
    delete next[name];
    onChangeDistricts(next);
  }

  /** ย้ายจังหวัดขึ้น-ลง เพื่อจัดลำดับการเดินทาง */
  function move(index: number, delta: number) {
    const next = [...provinces];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChangeProvinces(next);
  }

  function toggleDistrict(province: string, district: string) {
    const current = districts[province] ?? [];
    const next = current.includes(district)
      ? current.filter((d) => d !== district)
      : [...current, district];
    onChangeDistricts({ ...districts, [province]: next });
  }

  return (
    <div>
      {provinces.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {provinces.map((name, index) => {
            const province = PROVINCE_BY_NAME.get(name);
            const all = districtsOf(name);
            const picked = districts[name] ?? [];
            const open = expanded === name;

            return (
              <li
                key={name}
                className="rounded-xl border border-line bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-fill text-xs font-semibold text-ink">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {province?.emoji ?? "📍"} {name}
                    <span className="ml-1.5 text-xs text-faint">
                      {picked.length > 0
                        ? `เลือก ${picked.length} อำเภอ`
                        : `${all.length} อำเภอ`}
                    </span>
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
                      disabled={index === provinces.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`เอา ${name} ออก`}
                      onClick={() => removeProvince(name)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                {picked.length > 0 && !open ? (
                  <p className="mt-1.5 pl-9 text-xs text-muted">
                    {picked.join(" • ")}
                  </p>
                ) : null}

                {all.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : name)}
                    className="mt-1.5 pl-9 text-xs text-brand underline"
                  >
                    {open ? "ปิดรายการอำเภอ" : "เลือกอำเภอ"}
                  </button>
                ) : null}

                {open ? (
                  <div className="mt-2 border-t border-line pt-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          onChangeDistricts({ ...districts, [name]: [] })
                        }
                      >
                        ล้างที่เลือก
                      </Button>
                      <span className="text-xs text-faint">
                        ไม่เลือกอำเภอ = ทั้งจังหวัด
                      </span>
                    </div>

                    <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                      {all.map((district) => {
                        const active = picked.includes(district);
                        return (
                          <button
                            key={district}
                            type="button"
                            onClick={() => toggleDistrict(name, district)}
                            aria-pressed={active}
                            className={cn(
                              "min-h-9 rounded-full border px-3 text-xs transition-colors",
                              active
                                ? "border-brand bg-brand text-canvas"
                                : "border-line text-muted hover:text-ink",
                            )}
                          >
                            {district}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted">
          ยังไม่ได้เลือกจังหวัด — เลือกจากช่องด้านล่างได้เลย เลือกกี่จังหวัดก็ได้
        </p>
      )}

      <Select
        value=""
        onChange={(e) => addProvince(e.target.value)}
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

      <p className="mt-2 text-xs leading-relaxed text-faint">
        เลือกได้ครบทั้ง 77 จังหวัด • ลำดับในรายการคือลำดับการเดินทาง
        จังหวัดแรกใช้เป็นจุดตั้งต้นของแผนที่
      </p>
    </div>
  );
}
