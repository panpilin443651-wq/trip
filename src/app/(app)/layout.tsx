import { redirect } from "next/navigation";
import { BottomNav, SideNav } from "@/components/AppNav";
import { BudgetAlert } from "@/components/BudgetAlert";
import { ChatWidget } from "@/components/ChatWidget";
import { ScrollLockGuard } from "@/components/ScrollLockGuard";
import { SyncStatus } from "@/components/SyncStatus";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { TripProvider } from "@/lib/trip-context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured) redirect("/login");

  // proxy.ts กันไว้อีกชั้นแล้ว แต่เช็กซ้ำที่นี่กันกรณี matcher พลาด
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  /*
   * TripProvider ต้องครอบทุกอย่าง รวมถึงแถบข้างและแถบล่าง
   *
   * แถบข้างมีตัวสลับแผนซึ่งเรียก useTrip() ถ้าอยู่นอก provider จะโยน error
   * แล้วทั้งหน้าจอขาว ไม่ใช่แค่แถบข้างพัง — เคยพลาดมาแล้วตอนย้ายตัวสลับแผน
   * เข้ามาไว้ในแถบข้าง
   */
  return (
    <TripProvider userId={user.id}>
      <div className="flex flex-1">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar email={user.email ?? ""} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pt-6 lg:pb-10">
            {children}
          </main>
          <BudgetAlert />
          <ChatWidget />
          <SyncStatus />
          <ScrollLockGuard />
        </div>
        <BottomNav />
      </div>
    </TripProvider>
  );
}
