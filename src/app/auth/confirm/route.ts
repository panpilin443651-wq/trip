import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * ปลายทางของลิงก์ยืนยันอีเมลจาก Supabase
 * แลก token_hash เป็น session แล้วพาเข้าแอป
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=ลิงก์ไม่ถูกต้อง", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=ลิงก์หมดอายุหรือถูกใช้ไปแล้ว", url),
    );
  }

  return NextResponse.redirect(
    new URL(next.startsWith("/") ? next : "/dashboard", url),
  );
}
