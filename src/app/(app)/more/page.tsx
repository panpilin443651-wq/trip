"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui";
import { SECONDARY_NAV } from "@/lib/nav";

export default function MorePage() {
  return (
    <>
      <PageHeader emoji="⋯" title="เพิ่มเติม" subtitle="เมนูที่เหลือทั้งหมด" />

      <ul className="space-y-2">
        {SECONDARY_NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <Card className="flex items-center gap-3 transition-colors hover:border-brand">
                <span className="text-2xl leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted">{item.description}</p>
                </div>
                <span className="shrink-0 text-muted" aria-hidden>
                  ›
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="mt-4">
        <h2 className="text-base font-semibold">🔐 บัญชี</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          ออกจากระบบแล้วข้อมูลทริปยังอยู่ในเบราว์เซอร์เครื่องนี้เหมือนเดิม
        </p>
        <SignOutButton />
      </Card>
    </>
  );
}
