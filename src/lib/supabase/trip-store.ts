"use client";

import { normalizeLibrary } from "@/lib/storage";
import type { TripLibrary } from "@/lib/types";
import { createClient } from "./client";

const TABLE = "trip_states";

export interface LoadResult {
  library: TripLibrary | null;
  error: string | null;
}

/**
 * อ่านคลังแผนของผู้ใช้จาก Supabase — คืน null ถ้ายังไม่เคยบันทึก
 *
 * แถวที่บันทึกไว้ก่อนมีหลายทริปจะเป็น AppState ก้อนเดียว normalizeLibrary
 * ห่อให้เป็นคลังที่มีแผนเดียวให้เอง ไม่ต้องแก้ฐานข้อมูล
 */
export async function loadRemoteLibrary(userId: string): Promise<LoadResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { library: null, error: describe(error.message) };
  if (!data?.data || Object.keys(data.data).length === 0) {
    return { library: null, error: null };
  }
  return { library: normalizeLibrary(data.data), error: null };
}

/** เขียนทับคลังแผนของผู้ใช้ */
export async function saveRemoteLibrary(
  userId: string,
  library: TripLibrary,
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: library }, { onConflict: "user_id" });

  return error ? describe(error.message) : null;
}

/** แปล error ที่เจอบ่อยให้บอกวิธีแก้ได้ตรงจุด */
function describe(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("relation") && m.includes("does not exist")) {
    return "ยังไม่ได้สร้างตารางในฐานข้อมูล — รัน supabase/schema.sql ใน SQL Editor ก่อน";
  }
  // GRANT กับ RLS เป็นคนละชั้น จึงแยกข้อความเพื่อชี้ทางแก้ให้ถูกจุด
  if (m.includes("permission denied")) {
    return "ยังไม่ได้ให้สิทธิ์ตาราง — รัน supabase/schema.sql ใหม่อีกครั้ง (เวอร์ชันล่าสุดมีคำสั่ง grant แล้ว)";
  }
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "RLS policy ไม่ผ่าน — ตรวจว่ารัน policy ใน supabase/schema.sql ครบทั้ง 4 อัน";
  }
  if (m.includes("jwt") || m.includes("expired")) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "เชื่อมต่อ Supabase ไม่ได้ — ตรวจอินเทอร์เน็ตหรือค่า URL";
  }
  return message;
}
