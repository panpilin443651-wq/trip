import { cookies } from "next/headers";

export const AUTH_COOKIE = "tp_auth";
/** อายุคุกกี้ 7 วัน */
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * รหัสแบบ fixed ตามสเปก — ไม่มี database
 * เปลี่ยนได้ผ่าน env var บน Vercel โดยไม่ต้องแก้โค้ด
 */
export function expectedCredentials() {
  return {
    username: process.env.AUTH_USERNAME || "admin",
    password: process.env.AUTH_PASSWORD || "raotworkshop",
  };
}

/** ค่าที่เก็บในคุกกี้ ไม่ใช่รหัสผ่าน เพื่อไม่ให้รหัสหลุดออกจากเซิร์ฟเวอร์ */
export function sessionToken(): string {
  const { username, password } = expectedCredentials();
  let hash = 0;
  const seed = `${username}:${password}:travel-planner`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `v1.${Math.abs(hash).toString(36)}`;
}

export async function isLoggedIn(): Promise<boolean> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value === sessionToken();
}
