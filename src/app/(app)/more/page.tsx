import Link from "next/link";
import { BuildInfo } from "@/components/BuildInfo";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { SECONDARY_NAV } from "@/lib/nav";

/**
 * หน้าโปรไฟล์ — บัญชีอยู่บนสุด แล้วตามด้วยเมนูที่ไม่ได้อยู่บนแถบล่าง
 *
 * เอาบัญชีขึ้นก่อนเพราะเป็นสิ่งที่คนคาดว่าจะเจอเมื่อกดปุ่ม "โปรไฟล์"
 * ส่วนเมนูที่เหลือตามลงมาในรูปการ์ดที่กดได้ทั้งใบ
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageHeader emoji="👤" title="โปรไฟล์" subtitle="บัญชีและเมนูที่เหลือ" />

      <Card className="mb-4 flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-2xl"
          aria-hidden
        >
          🧑‍✈️
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user?.email ?? "ผู้ใช้"}</p>
          <p className="text-sm text-muted">เข้าสู่ระบบอยู่</p>
        </div>
      </Card>

      <ul className="space-y-2">
        {SECONDARY_NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <Card className="flex items-center gap-3 transition-colors hover:border-brand">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-xl leading-none"
                  aria-hidden
                >
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
          ออกจากระบบแล้วแผนทริปยังอยู่ในบัญชีเหมือนเดิม เข้าใหม่เมื่อไหร่ก็เห็นครบ
        </p>
        <SignOutButton />
      </Card>

      <BuildInfo />
    </>
  );
}
