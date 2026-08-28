"use client";

import { normalizeState } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { createClient } from "./client";

const TABLE = "trip_states";

export interface LoadResult {
  state: AppState | null;
  error: string | null;
}

/** อ่านแผนของผู้ใช้จาก Supabase — คืน null ถ้ายังไม่เคยบันทึก */
export async function loadRemoteState(userId: string): Promise<LoadResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { state: null, error: describe(error.message) };
  if (!data?.data || Object.keys(data.data).length === 0) {
    return { state: null, error: null };
  }
  return { state: normalizeState(data.data), error: null };
}

/** เขียนทับแผนของผู้ใช้ */
export async function saveRemoteState(
  userId: string,
  state: AppState,
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: state }, { onConflict: "user_id" });

  return error ? describe(error.message) : null;
}

/** แปล error ที่เจอบ่อยให้บอกวิธีแก้ได้ตรงจุด */
function describe(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("relation") && m.includes("does not exist")) {
    return "ยังไม่ได้สร้างตารางในฐานข้อมูล — รัน supabase/schema.sql ใน SQL Editor ก่อน";
  }
  if (m.includes("row-level security") || m.includes("violates row-level")) {
    return "สิทธิ์ไม่พอ — ตรวจว่ารัน RLS policy ใน supabase/schema.sql ครบแล้ว";
  }
  if (m.includes("jwt") || m.includes("expired")) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "เชื่อมต่อ Supabase ไม่ได้ — ตรวจอินเทอร์เน็ตหรือค่า URL";
  }
  return message;
}
