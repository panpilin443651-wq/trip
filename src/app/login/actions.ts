"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthState {
  error?: string;
  notice?: string;
}

/** แปลข้อความ error ของ Supabase เป็นภาษาไทยที่ผู้ใช้เข้าใจ */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("email not confirmed"))
    return "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ยืนยันในกล่องจดหมายก่อน";
  if (m.includes("user already registered"))
    return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
  if (m.includes("password should be at least"))
    return "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";
  if (m.includes("unable to validate email"))
    return "รูปแบบอีเมลไม่ถูกต้อง";
  if (m.includes("rate limit") || m.includes("too many"))
    return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return message;
}

function readForm(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "/dashboard"),
  };
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ดูวิธีตั้งค่าด้านล่าง" };
  }

  const { email, password, next } = readForm(formData);
  if (!email || !password) {
    return { error: "กรอกอีเมลและรหัสผ่านให้ครบ" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translate(error.message) };

  revalidatePath("/", "layout");
  // กัน open redirect: รับเฉพาะ path ภายในเว็บนี้
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ดูวิธีตั้งค่าด้านล่าง" };
  }

  const { email, password } = readForm(formData);
  if (!email || !password) {
    return { error: "กรอกอีเมลและรหัสผ่านให้ครบ" };
  }
  if (password.length < 6) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: translate(error.message) };

  // ถ้าโปรเจกต์เปิด "Confirm email" ไว้ จะยังไม่มี session จนกว่าจะยืนยันอีเมล
  if (!data.session) {
    return {
      notice:
        "สมัครเรียบร้อย — เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว เปิดลิงก์แล้วค่อยกลับมาเข้าสู่ระบบ",
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
