"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { NavIcon } from "@/components/NavIcon";
import { TripSwitcher } from "@/components/TripSwitcher";
import { cn } from "@/lib/cn";
import { PRIMARY_NAV, SIDEBAR_NAV } from "@/lib/nav";
import {
  isSidebarCollapsed,
  setSidebarCollapsed,
  sidebarServerSnapshot,
  subscribeSidebar,
} from "@/lib/sidebar";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * แถบล่างสำหรับมือถือ — สี่เมนูหลัก ปุ่มใหญ่พอสำหรับนิ้ว
 *
 * ตัวที่เลือกอยู่มีเม็ดยาสีแบรนด์รองไอคอนไว้ ทำให้เห็นว่าอยู่หน้าไหน
 * ได้จากหางตาโดยไม่ต้องอ่านตัวหนังสือ ซึ่งเล็กมากในแถบขนาดนี้
 */
export function BottomNav() {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch pb-[env(safe-area-inset-bottom)]">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 pt-1.5 pb-1 text-[11px] font-medium transition-colors",
                  active ? "text-pick-text" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-pick-soft" : "bg-transparent",
                  )}
                >
                  <NavIcon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * แถบข้างสำหรับจอใหญ่ — มีครบทุกเมนู และย่อเก็บได้
 *
 * ย่อแล้วเหลือแค่ไอคอน กว้าง 4rem คืนพื้นที่ให้เนื้อหาราว 12rem
 * ซึ่งมีผลจริงกับหน้าที่มีตารางและแผนที่ จำสถานะไว้ใน localStorage
 * เพราะคนที่ชอบแบบย่อมักอยากให้ย่อไว้ตลอด ไม่ใช่กดใหม่ทุกครั้งที่เปิดเว็บ
 *
 * ตอนย่อยังต้องกดเมนูได้ครบ จึงเหลือไอคอนไว้พร้อม title ให้เอาเมาส์ชี้ดูชื่อ
 * และใส่ aria-label ไว้ให้โปรแกรมอ่านหน้าจอ
 */
export function SideNav() {
  const isActive = useIsActive();
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    isSidebarCollapsed,
    sidebarServerSnapshot,
  );

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-line bg-card transition-[width] lg:block",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="sticky top-0 flex h-dvh flex-col gap-2 p-3">
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-2 transition-colors hover:bg-brand-soft",
              collapsed ? "justify-center" : "flex-1",
            )}
            title="Travel Planner"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl ring-1 ring-accent/25">
              ✈️
            </span>
            {collapsed ? null : (
              <span className="truncate text-base font-semibold">
                Travel Planner
              </span>
            )}
          </Link>

          {collapsed ? null : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="ย่อแถบเมนู"
              title="ย่อแถบเมนู"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-brand-soft hover:text-ink"
            >
              «
            </button>
          )}
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="กางแถบเมนู"
            title="กางแถบเมนู"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-brand-soft hover:text-ink"
          >
            »
          </button>
        ) : (
          <TripSwitcher className="w-full" />
        )}

        <nav aria-label="เมนูทั้งหมด" className="mt-1 min-h-0 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {SIDEBAR_NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active
                        ? "bg-pick-soft text-pick-text"
                        : "text-muted hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                    {collapsed ? null : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
