import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isLoggedIn()) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-3xl">
            ✈️
          </div>
          <h1 className="text-2xl font-semibold">Travel Planner</h1>
          <p className="mt-1.5 text-sm text-muted">
            วางแผนทริป คุมงบ และดูเส้นทางในที่เดียว
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          เป็นการล็อกอินด้วยรหัสคงที่เพื่อกันคนทั่วไปเข้าดูเท่านั้น
          <br />
          ไม่เหมาะกับการเก็บข้อมูลที่เป็นความลับ
        </p>
      </div>
    </main>
  );
}
