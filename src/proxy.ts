import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/** หน้าที่เข้าได้โดยไม่ต้องล็อกอิน */
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

/**
 * ต่ออายุ session ของ Supabase ทุกคำขอ และกันหน้าที่ต้องล็อกอิน
 *
 * ต้องทำที่นี่เพราะ Server Component เขียนคุกกี้ไม่ได้
 * ถ้าไม่ต่ออายุ ผู้ใช้จะหลุดออกจากระบบเมื่อ access token หมดอายุ (~1 ชม.)
 *
 * Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy — ดู
 * node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 */
export async function proxy(request: NextRequest) {
  // ยังไม่ได้ตั้ง env ให้ปล่อยผ่าน แล้วให้หน้าเว็บแสดงวิธีตั้งค่าแทน
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // ต้องเรียก getUser() ไม่ใช่ getSession() เพราะ getUser จะไปยืนยันกับ
  // เซิร์ฟเวอร์ Supabase จริง ส่วน getSession อ่านจากคุกกี้ซึ่งปลอมได้
  //
  // ถ้า Supabase ล่มหรือเน็ตมีปัญหา ให้ถือว่ายังไม่ล็อกอินแล้วเด้งไปหน้า login
  // ดีกว่าปล่อยให้ทั้งเว็บ 500
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    // เส้นทาง API ถูกเรียกด้วย fetch ถ้า redirect ไปหน้า login ฝั่งเรียกจะได้
    // HTML กลับไปแล้ว parse JSON พัง จึงตอบ 401 ให้จัดการต่อได้ตรง ๆ
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * ข้ามไฟล์สแตติกและรูป เพื่อไม่ให้ยิง getUser() ทุกไฟล์
     * (_next, favicon, ไฟล์ที่มีนามสกุลรูป)
     *
     * ต้องข้ามไฟล์ของ PWA ด้วย — manifest กับ sw.js ถูกโหลดโดยเบราว์เซอร์เอง
     * ไม่ได้แนบคุกกี้เซสชันมาเสมอ ถ้าโดนเด้งไปหน้า login จะติดตั้งเป็นแอปไม่ได้
     * ส่วน offline.html ต้องเปิดได้ตอนไม่มีเน็ต ซึ่งเช็กเซสชันไม่ได้อยู่แล้ว
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
