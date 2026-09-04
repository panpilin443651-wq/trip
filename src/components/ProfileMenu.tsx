"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutIconButton } from "@/components/SignOutIconButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet } from "@/components/ui";
import { SECONDARY_NAV } from "@/lib/nav";

/**
 * ปุ่มโปรไฟล์มุมขวาบน — กดแล้วเปิดเมนูบัญชี
 *
 * ย้ายมาจากแถบล่างเพราะโปรไฟล์ไม่ใช่ปลายทางที่คนเข้าบ่อยเท่าสี่เมนูที่เหลือ
 * แถบล่างจึงเหลือสี่ช่อง ปุ่มใหญ่ขึ้น กดง่ายขึ้น
 *
 * สวิตช์โหมดมืดกับปุ่มออกจากระบบย้ายเข้ามาอยู่ในนี้ด้วย เดิมอยู่บนแถบบน
 * ซึ่งพอมีคำกำกับแล้วกินที่จนชื่อแผนแทบไม่เหลือที่ ในเมนูมีที่ให้เขียนคำเต็ม
 * และยังกดถึงได้ในสองขั้นจากทุกหน้าเหมือนเดิม
 */
export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="โปรไฟล์และการตั้งค่า"
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] font-medium transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      >
        <span aria-hidden>👤</span>
        <span className="whitespace-nowrap">โปรไฟล์</span>
      </button>

      <Sheet open={open} title="👤 โปรไฟล์" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas px-3 py-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-xl"
              aria-hidden
            >
              🧑‍✈️
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{email || "ผู้ใช้"}</p>
              <p className="text-xs text-muted">เข้าสู่ระบบอยู่</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <ThemeToggle className="w-full justify-between" />
            <SignOutIconButton className="w-full justify-center" />
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">เมนูอื่น</p>
            <ul className="space-y-1.5">
              {SECONDARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition-colors hover:bg-brand-soft"
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {item.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="shrink-0 text-muted" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/more"
            onClick={() => setOpen(false)}
            className="block text-center text-sm text-brand underline"
          >
            เปิดหน้าโปรไฟล์เต็ม
          </Link>
        </div>
      </Sheet>
    </>
  );
}
