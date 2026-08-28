"use client";

import { PROVINCES_BY_REGION } from "@/data/provinces";
import { Select } from "./ui";

/** ช่องเลือกจังหวัดครบทั้ง 77 จังหวัด จัดกลุ่มตามภาค */
export function ProvinceSelect({
  value,
  onChange,
  placeholder = "— เลือกจังหวัด —",
  allowEmpty = true,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (province: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  // ถ้าค่าที่บันทึกไว้ไม่ตรงกับรายชื่อ (เช่นพิมพ์เองไว้ก่อนหน้า) ให้คงค่านั้นไว้
  const known = PROVINCES_BY_REGION.some((group) =>
    group.provinces.some((p) => p.name === value),
  );

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label={ariaLabel}
    >
      {allowEmpty ? <option value="">{placeholder}</option> : null}

      {value && !known ? (
        <option value={value}>{value} (ที่กรอกไว้เดิม)</option>
      ) : null}

      {PROVINCES_BY_REGION.map((group) => (
        <optgroup key={group.region} label={group.region}>
          {group.provinces.map((province) => (
            <option key={province.id} value={province.name}>
              {province.emoji} {province.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
