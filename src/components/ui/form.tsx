"use client";

import {
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL_CLASS =
  "w-full min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink " +
  "placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL_CLASS, className)} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(CONTROL_CLASS, "min-h-20 resize-y", className)}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL_CLASS, "pr-8", className)}>
      {children}
    </select>
  );
}

/**
 * ช่องกรอกตัวเลขที่ลบจนว่างได้
 *
 * ถ้าผูก value เป็นตัวเลขตรง ๆ กับ input type=number จะเจอปัญหา:
 * พอผู้ใช้ลบตัวเลขจนหมด เบราว์เซอร์ส่งค่าว่างมา ซึ่ง Number("") = 0
 * ทำให้ค่า 0 เด้งกลับเข้าช่องทันทีและลบทิ้งไม่ได้ เลข 0 จึงค้างอยู่หน้าสุด
 * แล้วพิมพ์ต่อได้เป็นเลขที่ผิด
 *
 * จึงเก็บข้อความดิบไว้ใน draft ระหว่างที่ผู้ใช้กำลังพิมพ์
 * แล้วค่อยส่งตัวเลขที่แปลงแล้วออกไปให้ผู้เรียก
 */
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  onBlur,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  // ระหว่างพิมพ์ให้ยึดข้อความที่ผู้ใช้เห็น นอกนั้นยึดค่าจริงจาก state
  // ค่า 0 แสดงเป็นช่องว่าง เพื่อให้พิมพ์ทับได้เลยโดยไม่ต้องลบ 0 ก่อน
  const text = draft ?? (value === 0 ? "" : String(value));

  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);

        const parsed = Number(raw);
        onValueChange(
          raw.trim() === "" || !Number.isFinite(parsed)
            ? min
            : Math.max(min, parsed),
        );
      }}
      onBlur={(e: FocusEvent<HTMLInputElement>) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
