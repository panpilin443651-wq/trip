"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** client สำหรับฝั่งเบราว์เซอร์ — เก็บ session ลงคุกกี้ให้ฝั่งเซิร์ฟเวอร์อ่านได้ */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
