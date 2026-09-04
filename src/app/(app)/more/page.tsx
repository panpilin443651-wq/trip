import Link from "next/link";
import { BuildInfo } from "@/components/BuildInfo";
import { PageHeader } from "@/components/PageHeader";
import { SignOutConfirmButton } from "@/components/SignOutConfirmButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, SectionTitle } from "@/components/ui";
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
      <PageHeader
        title="ประวัติส่วนตัว"
        subtitle="บัญชี การตั้งค่า และเมนูที่เหลือ"
      />

      <Card className="mb-4">
        <p className="truncate font-medium">{user?.email ?? "ผู้ใช้"}</p>
        <p className="mt-0.5 text-sm text-muted">เข้าสู่ระบบอยู่</p>
      </Card>

      {/* สวิตช์โหมดมืดอยู่ที่นี่ เพราะเป็นการตั้งค่า ไม่ใช่ทางลัดที่ต้องกดบ่อย */}
      <Card className="mb-4">
        <SectionTitle title="การแสดงผล" />
        <ThemeToggle className="w-full justify-between" />
      </Card>

      <ul className="space-y-2">
        {SECONDARY_NAV.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>
              <Card className="flex items-center gap-3 transition-colors hover:border-brand">
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
        <h2 className="text-base font-semibold">บัญชี</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          ออกจากระบบแล้วแผนทริปยังอยู่ในบัญชีเหมือนเดิม เข้าใหม่เมื่อไหร่ก็เห็นครบ
        </p>
        <SignOutConfirmButton className="w-full justify-center" />
      </Card>

      <BuildInfo />
    </>
  );
}
