"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PlacePhoto as Photo } from "@/app/api/place-photo/route";

/**
 * รูปประกอบของสถานที่ ช่วยตัดสินใจว่าจะไปหรือไม่ไป
 *
 * ไม่ใช่ทุกที่ที่มีรูป (มีเฉพาะที่มีหน้าวิกิพีเดีย) กรณีไม่มีรูปจะไม่แสดงอะไรเลย
 * ดีกว่าโชว์กรอบว่างหรือรูปสำรองที่ไม่เกี่ยว ซึ่งกินที่โดยไม่ให้ข้อมูลอะไร
 *
 * ผูกผลกับชื่อที่ขอไป ผลของที่เก่าจะถูกมองข้ามเองเมื่อชื่อไม่ตรง
 * จึงไม่ต้องล้างค่าเก่าใน effect ซึ่งติดกฎ react-hooks/set-state-in-effect
 */
export function PlacePhoto({
  name,
  province,
  className,
}: {
  name: string;
  province?: string;
  className?: string;
}) {
  const wanted = `${name}::${province ?? ""}`;
  const [result, setResult] = useState<{ key: string; photo: Photo } | null>(
    null,
  );

  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    const qs =
      `name=${encodeURIComponent(name)}` +
      (province ? `&province=${encodeURIComponent(province)}` : "");

    fetch(`/api/place-photo?${qs}`, { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : { url: null, title: null, pageUrl: null }))
      .then((photo: Photo) => {
        if (!cancelled) setResult({ key: wanted, photo });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: wanted, photo: { url: null, title: null, pageUrl: null } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [name, province, wanted]);

  const current = result?.key === wanted ? result.photo : null;

  // ยังโหลดอยู่ — กันพื้นที่ไว้ก่อน จะได้ไม่กระโดดตอนรูปมา
  if (result === null) {
    return (
      <div
        className={`h-44 w-full animate-pulse rounded-2xl bg-line ${className ?? ""}`}
      />
    );
  }

  if (!current?.url) return null;

  return (
    <figure className={className}>
      <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-line">
        <Image
          src={current.url}
          alt={`รูปของ${name}`}
          fill
          sizes="(max-width: 640px) 100vw, 512px"
          className="object-cover"
          unoptimized
        />
      </div>
      {current.pageUrl ? (
        <figcaption className="mt-1.5 text-xs text-faint">
          รูปจาก{" "}
          <a
            href={current.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            วิกิพีเดีย
          </a>
          {current.title && current.title !== name ? ` · ${current.title}` : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
