"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { applyTheme, resolveTheme, type Theme } from "@/lib/theme";

/**
 * เฝ้าดู data-theme บน <html> แล้วบอก React เมื่อมันเปลี่ยน
 *
 * ให้ DOM เป็นเจ้าของค่าจริงแทนที่จะเก็บใน state ของ React เพราะสคริปต์ใน <head>
 * ตั้งค่านี้ไปแล้วตั้งแต่ก่อน React จะทำงาน ถ้าเก็บซ้ำใน state จะมีสองแหล่งความจริง
 * ที่ต้องคอยเช็กให้ตรงกัน (และเป็นเหตุให้ต้อง setState ใน effect ซึ่งควรเลี่ยง)
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const getSnapshot = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";

/** ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ยังไม่รู้ว่าผู้ใช้เลือกอะไร ตรงกับ data-theme ใน layout */
const getServerSnapshot = (): Theme => "dark";

/**
 * สวิตช์เปิด/ปิดโหมดมืด พร้อมคำกำกับ
 *
 * ใช้สวิตช์แทนปุ่มไอคอนเปล่า เพราะไอคอนอย่างเดียวตอบไม่ได้ว่ากดแล้วจะได้อะไร
 * และไม่รู้ว่าตอนนี้อยู่โหมดไหน สวิตช์บอกสถานะปัจจุบันในตัวอยู่แล้ว
 *
 * คำที่เขียนคือ "โหมดมืด" ซึ่งเป็นชื่อของสิ่งที่สวิตช์นี้ควบคุม ไม่ใช่ชื่อโหมด
 * ที่กำลังใช้อยู่ ตำแหน่งสวิตช์เป็นตัวบอกว่าเปิดหรือปิด
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    // ใน dev โหมด Strict ของ React จะ remount แล้วล้าง attribute ที่สคริปต์ตั้งไว้
    // ต้องใส่กลับเอง ตอน production เงื่อนไขนี้เป็นเท็จเสมอจึงไม่ทำอะไร
    const stored = resolveTheme();
    if (document.documentElement.getAttribute("data-theme") !== stored) {
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      title={isDark ? "ปิดโหมดมืด (ใช้โหมดสว่าง)" : "เปิดโหมดมืด"}
      className={cn(
        "flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-line",
        "bg-card px-2.5 text-[13px] font-medium transition-colors hover:bg-brand-soft",
        "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
        className,
      )}
    >
      <span aria-hidden>{isDark ? "🌙" : "☀️"}</span>
      {/*
        จอแคบมากตัดคำว่า "โหมด" ออก เหลือ "มืด" ยังอ่านรู้เรื่องและไม่ดันแถบล้น
        ยอมย่อคำดีกว่าปล่อยให้ปุ่มหลุดขอบจอ
      */}
      <span className="whitespace-nowrap">
        <span className="hidden min-[380px]:inline">โหมด</span>มืด
      </span>
      {/* รางสวิตช์ — ตำแหน่งลูกกลมบอกว่าเปิดหรือปิด */}
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          isDark ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-card transition-[left]",
            isDark ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
