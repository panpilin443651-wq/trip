"use client";

import { newId } from "@/lib/id";
import { createClient } from "./client";

export const PHOTO_BUCKET = "trip-photos";

/** ย่อรูปให้ด้านยาวสุดไม่เกินเท่านี้ก่อนอัปโหลด */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * ย่อและบีบรูปในเบราว์เซอร์ก่อนอัปโหลด
 *
 * รูปจากมือถือสมัยนี้ไฟล์ละ 3-8 MB ถ้าอัปตรง ๆ จะกินโควตา Storage เร็วมาก
 * และโหลดช้าตอนเปิดดู ย่อเหลือด้านยาว 1600px คุณภาพยังดีพอสำหรับดูบนจอ
 * และใส่ในไฟล์ export
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );

  // ถ้าบีบแล้วไม่เล็กลง (เช่นรูปเล็กอยู่แล้ว) ใช้ไฟล์เดิม
  return blob && blob.size < file.size ? blob : file;
}

export interface UploadResult {
  path: string | null;
  error: string | null;
}

/** อัปโหลดรูป 1 ใบ คืนพาธในบัคเก็ต */
export async function uploadPhoto(
  userId: string,
  file: File,
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    return { path: null, error: "เลือกได้เฉพาะไฟล์รูปภาพ" };
  }

  let body: Blob;
  try {
    body = await compress(file);
  } catch {
    body = file;
  }

  if (body.size > 5 * 1024 * 1024) {
    return { path: null, error: "รูปใหญ่เกิน 5 MB แม้ย่อแล้ว ลองรูปอื่น" };
  }

  const path = `${userId}/${newId()}.jpg`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: "image/jpeg", upsert: false });

  if (error) return { path: null, error: describe(error.message) };
  return { path, error: null };
}

export async function deletePhoto(path: string): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  return error ? describe(error.message) : null;
}

/**
 * ขอ signed URL ของหลายรูปพร้อมกัน
 * bucket เป็นแบบส่วนตัว จึงเปิดดูตรง ๆ ไม่ได้ ต้องขอลิงก์ที่มีอายุทุกครั้ง
 */
export async function signPhotoUrls(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);

  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) map[item.path] = item.signedUrl;
  }
  return map;
}

function describe(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) {
    return "ยังไม่ได้สร้างที่เก็บรูป — รัน supabase/schema.sql ใหม่อีกครั้ง";
  }
  if (m.includes("policy") || m.includes("unauthorized") || m.includes("403")) {
    return "ไม่มีสิทธิ์อัปโหลด — ตรวจว่ารัน storage policy ใน schema.sql ครบแล้ว";
  }
  if (m.includes("payload too large") || m.includes("413")) {
    return "ไฟล์ใหญ่เกินไป";
  }
  if (m.includes("mime")) {
    return "รองรับเฉพาะไฟล์ JPEG, PNG และ WebP";
  }
  return message;
}
