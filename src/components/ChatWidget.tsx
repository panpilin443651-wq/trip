"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { Sheet } from "./ui";

/**
 * ปุ่มลอยเรียกผู้ช่วย AI ได้จากทุกหน้า
 *
 * ซ่อนตัวเองในหน้า /chat เพราะที่นั่นมีแชทเต็มหน้าอยู่แล้ว
 * และซ่อนในหน้า /explore ที่มีการ์ดผู้ช่วยแนะนำที่เที่ยวอยู่ในหน้าแล้ว
 * — สองช่องแชทในจอเดียวสับสน และปุ่มลอยจะไปทับแถบใส่แผนที่ลอยอยู่มุมเดียวกัน
 * ตำแหน่งบนมือถือต้องอยู่เหนือแถบเมนูล่าง (fixed bottom-0 สูง 16)
 */
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/chat" || pathname === "/explore") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ถามผู้ช่วย AI"
        className="fixed right-5 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl shadow-[var(--shadow-lift)] transition-colors hover:bg-brand-dark lg:bottom-6"
      >
        💬
      </button>

      <Sheet open={open} title="💬 ผู้ช่วย AI" onClose={() => setOpen(false)}>
        <ChatPanel className="h-[60dvh]" />
      </Sheet>
    </>
  );
}
