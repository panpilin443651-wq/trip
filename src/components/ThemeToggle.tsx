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

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border border-line",
        "bg-card text-lg transition-colors hover:bg-brand-soft",
        "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
        className,
      )}
    >
      {/*
        โชว์ไอคอนของโหมดที่จะได้เมื่อกด ไม่ใช่โหมดปัจจุบัน
        คนอ่านปุ่มจะได้รู้ว่ากดแล้วเกิดอะไร
      */}
      <span aria-hidden>{next === "light" ? "☀️" : "🌙"}</span>
    </button>
  );
}
