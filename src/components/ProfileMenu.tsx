"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutIconButton } from "@/components/SignOutIconButton";
import { Sheet } from "@/components/ui";

/**
 * ปุ่มโปรไฟล์มุมขวาบน — มีแค่ประวัติส่วนตัวกับออกจากระบบ
 *
 * ตั้งใจให้สั้น เมนูบัญชีที่ยาวเกินไปทำให้คนต้องอ่านทุกบรรทัดก่อนจะเจอสิ่งที่
 * ต้องการ ส่วนเมนูอื่น ๆ ของแอปอยู่ในแถบข้าง (จอใหญ่) และแถบล่าง (จอเล็ก)
 * ที่กดถึงได้โดยไม่ต้องเปิดเมนูนี้ก่อนอยู่แล้ว
 *
 * สวิตช์โหมดมืดย้ายไปอยู่ในหน้าประวัติส่วนตัว เพราะเป็นการตั้งค่า ไม่ใช่ทางลัด
 */
export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="โปรไฟล์"
        className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-card px-3 text-sm font-medium transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
          aria-hidden
        >
          {(email.trim()[0] ?? "?").toUpperCase()}
        </span>
        <span className="whitespace-nowrap">โปรไฟล์</span>
      </button>

      <Sheet open={open} title="โปรไฟล์" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div className="rounded-2xl bg-canvas px-4 py-3">
            <p className="truncate text-sm font-medium">{email || "ผู้ใช้"}</p>
            <p className="mt-0.5 text-xs text-muted">เข้าสู่ระบบอยู่</p>
          </div>

          <Link
            href="/more"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-line px-4 text-sm font-medium transition-colors hover:bg-brand-soft"
          >
            ประวัติส่วนตัว
            <span className="shrink-0 text-muted" aria-hidden>
              ›
            </span>
          </Link>

          <SignOutIconButton className="w-full justify-center" />
        </div>
      </Sheet>
    </>
  );
}
