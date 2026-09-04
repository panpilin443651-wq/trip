"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./primitives";

/*
 * ล็อกการเลื่อนหน้าแบบนับจำนวนผู้ถือ ไม่ใช่ต่างคนต่างจำค่าเดิมของตัวเอง
 *
 * แบบเดิมแต่ละกล่องจำค่า overflow ตอนที่ตัวเองเปิด พอมีสองกล่องเปิดซ้อนกัน
 * แล้วปิดสลับลำดับ ค่าที่คืนกลับมาจะเป็น "hidden" ค้างไว้ ทั้งหน้าเลื่อนไม่ได้
 * ต้องรีเฟรชถึงจะหาย
 *
 *   1. กล่อง ก เปิด  — จำค่าเดิม "" แล้วตั้งเป็น hidden
 *   2. กล่อง ข เปิด  — จำค่าเดิม "hidden"
 *   3. กล่อง ก ปิด   — คืนเป็น "" ทั้งที่ ข ยังเปิดอยู่
 *   4. กล่อง ข ปิด   — คืนเป็น "hidden" ค้าง
 *
 * เกิดจริงเมื่อป๊อปอัปเตือนเกินงบเด้งขึ้นมาทับกล่องที่เปิดอยู่ก่อน
 * เพราะตัวเตือนอยู่ใน layout จึงเด้งได้ทุกเมื่อจากทุกหน้า
 */
let lockCount = 0;
let savedOverflow = "";

function lockBodyScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = savedOverflow;
}

/**
 * ปลดล็อกทั้งหมดทิ้ง ใช้เป็นตาข่ายกันพลาดตอนเปลี่ยนหน้า
 *
 * การนับผู้ถือแก้เคสที่รู้จักไปแล้ว แต่ถ้ายังมีทางไหนที่หลงเหลือการล็อกไว้
 * ผู้ใช้จะเจอหน้าที่เลื่อนไม่ได้และไม่มีทางแก้เองนอกจากรีเฟรช
 * ยอมให้ฉากหลังของกล่องที่เปิดค้างเลื่อนได้ ดีกว่าปล่อยให้ทั้งหน้าค้าง
 */
export function releaseAllScrollLocks() {
  if (lockCount === 0) return;
  lockCount = 0;
  document.body.style.overflow = savedOverflow;
}

/** โมดัลที่เลื่อนขึ้นจากด้านล่างบนมือถือ และเป็นกล่องกลางจอบนจอใหญ่ */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  /*
   * แยกการล็อกการเลื่อนออกจากปุ่ม Escape โดยตั้งใจ
   *
   * onClose มักเป็นฟังก์ชันใหม่ทุกรอบที่ผู้เรียกเรนเดอร์ ถ้ารวมไว้ effect เดียว
   * การล็อกจะถูกถอดแล้วใส่ใหม่ทุกครั้งที่พ่อแม่เรนเดอร์ ซึ่งไม่จำเป็นเลย
   */
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-card shadow-[var(--shadow-lift)] sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-line/60"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ลบ",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button
            className="flex-1 bg-danger hover:bg-danger/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
    </Sheet>
  );
}
