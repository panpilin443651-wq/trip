"use client";

import { useEffect, useRef, useState } from "react";
import { deletePhoto, signPhotoUrls, uploadPhoto } from "@/lib/supabase/photos";
import { Button } from "./ui";

/**
 * ช่องใส่รูปความทรงจำของจุดแวะ
 *
 * bucket เป็นแบบส่วนตัว จึงต้องขอ signed URL ทุกครั้งที่จะแสดง
 * เก็บเฉพาะ "พาธ" ไว้ในข้อมูลทริป ไม่เก็บ URL เพราะ URL มีอายุ
 */
export function PhotoManager({
  userId,
  paths,
  onChange,
}: {
  userId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const key = paths.join("|");

  /**
   * ผูกผลลัพธ์ไว้กับชุดพาธที่ขอไป
   * พอผู้ใช้ลบหรือเพิ่มรูป key จะเปลี่ยน แล้ว URL ชุดเก่าจะถูกมองข้ามเอง
   * ไม่ต้องล้างค่าด้วย setState ใน effect ซึ่งทำให้เกิด cascading render
   */
  const [urlState, setUrlState] = useState<{
    key: string;
    map: Record<string, string>;
  } | null>(null);
  const urls = urlState?.key === key ? urlState.map : {};

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    signPhotoUrls(key.split("|")).then((map) => {
      if (!cancelled) setUrlState({ key, map });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function handleFiles(files: FileList) {
    setBusy(true);
    setError(null);

    const added: string[] = [];
    for (const file of Array.from(files)) {
      const { path, error: uploadError } = await uploadPhoto(userId, file);
      if (uploadError) {
        setError(uploadError);
        break;
      }
      if (path) added.push(path);
    }

    if (added.length > 0) onChange([...paths, ...added]);
    setBusy(false);
  }

  async function remove(path: string) {
    onChange(paths.filter((p) => p !== path));
    // ลบไฟล์จริงด้วย ไม่งั้นจะค้างกินโควตาโดยไม่มีใครอ้างถึง
    await deletePhoto(path);
  }

  return (
    <div>
      {paths.length > 0 ? (
        <ul className="mb-3 grid grid-cols-3 gap-2">
          {paths.map((path) => (
            <li
              key={path}
              className="relative aspect-square overflow-hidden rounded-xl border border-line bg-canvas"
            >
              {urls[path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[path]}
                  alt="รูปความทรงจำ"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-faint">
                  กำลังโหลด…
                </span>
              )}
              <button
                type="button"
                onClick={() => void remove(path)}
                aria-label="ลบรูปนี้"
                className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/85 text-sm text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
      >
        {busy ? "กำลังอัปโหลด…" : "📷 เพิ่มรูป"}
      </Button>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          ⚠️ {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          รูปถูกย่อให้เล็กลงอัตโนมัติก่อนอัปโหลด และเก็บแบบส่วนตัว
          เฉพาะบัญชีคุณเท่านั้นที่เปิดดูได้
        </p>
      )}
    </div>
  );
}
