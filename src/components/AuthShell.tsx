import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** กรอบหน้า login / signup พร้อมคำเตือนถ้ายังไม่ได้ตั้งค่า Supabase */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-3xl ring-1 ring-accent/25">
            ✈️
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
          {children}
        </div>

        {!isSupabaseConfigured ? (
          <div className="mt-5 rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm leading-relaxed text-warn">
            <p className="font-medium">⚠️ ยังไม่ได้ตั้งค่า Supabase</p>
            <p className="mt-1.5">
              ตั้ง environment variables 2 ตัวนี้แล้ว deploy ใหม่
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas px-3 py-2 text-xs text-ink">
              NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY
            </pre>
            <p className="mt-2 text-xs">
              หาได้ที่ Supabase Dashboard → Project Settings → API
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          ข้อมูลทริปถูกเก็บในบัญชีของคุณบน Supabase
          <br />
          เข้าจากเครื่องไหนก็เห็นแผนเดียวกัน
        </p>
      </div>
    </main>
  );
}
