import { redirect } from "next/navigation";
import { BottomNav, SideNav } from "@/components/AppNav";
import { BudgetAlert } from "@/components/BudgetAlert";
import { ChatWidget } from "@/components/ChatWidget";
import { SyncStatus } from "@/components/SyncStatus";
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

  return (
    <div className="flex flex-1">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TripProvider userId={user.id}>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pt-8 lg:pb-10">
            {children}
          </main>
          <BudgetAlert />
          <ChatWidget />
          <SyncStatus />
        </TripProvider>
      </div>
      <BottomNav />
    </div>
  );
}
