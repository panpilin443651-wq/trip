"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, PRIMARY_NAV } from "@/lib/nav";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** แถบล่างสำหรับมือถือ — ปุ่มใหญ่พอสำหรับนิ้ว */
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
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <span className="text-xl leading-none" aria-hidden>
                  {item.emoji}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Link
            href="/more"
            aria-current={isActive("/more") ? "page" : undefined}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
              isActive("/more") ? "text-brand" : "text-muted",
            )}
          >
            <span className="text-xl leading-none" aria-hidden>
              ⋯
            </span>
            เพิ่มเติม
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** แถบข้างสำหรับจอใหญ่ — มีครบทุกเมนู */
export function SideNav() {
  const isActive = useIsActive();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-card lg:block">
      <div className="sticky top-0 flex h-dvh flex-col p-4">
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-2 py-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-xl ring-1 ring-gold/25">
            ✈️
          </span>
          <span className="text-base font-semibold">Travel Planner</span>
        </Link>

        <nav aria-label="เมนูทั้งหมด">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand-soft text-brand"
                        : "text-muted hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {item.emoji}
                    </span>
                    {item.label}
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
