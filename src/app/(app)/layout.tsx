import { redirect } from "next/navigation";
import { BottomNav, SideNav } from "@/components/AppNav";
import { isLoggedIn } from "@/lib/auth";
import { TripProvider } from "@/lib/trip-context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // ด่านเดียวของทุกหน้าในกลุ่มนี้ — ไม่ผ่านคือเด้งไปหน้า login
  if (!(await isLoggedIn())) redirect("/login");

  return (
    <div className="flex flex-1">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TripProvider>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-24 lg:px-8 lg:pt-8 lg:pb-10">
            {children}
          </main>
        </TripProvider>
      </div>
      <BottomNav />
    </div>
  );
}
