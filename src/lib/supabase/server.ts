import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * client สำหรับ Server Component และ Server Action
 *
 * Server Component เขียนคุกกี้ไม่ได้ จึงต้อง try/catch ตอน setAll
 * การต่ออายุ token ทำที่ proxy.ts แทน
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // เรียกจาก Server Component ซึ่งเขียนคุกกี้ไม่ได้ — proxy จัดการต่อให้
        }
      },
    },
  });
}
