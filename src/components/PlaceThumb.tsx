"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PlacePhoto as Photo } from "@/app/api/place-photo/route";
import { cn } from "@/lib/cn";

const EMPTY: Photo = { url: null, title: null, pageUrl: null };

/**
 * จำผลไว้ในหน่วยความจำของแท็บ
 *
 * รายการหนึ่งหน้ามีได้สิบกว่าแถว และผู้ใช้สลับหมวด/พิมพ์ค้นไปมา
 * ถ้าไม่จำไว้จะยิงซ้ำที่เดิมทุกครั้งที่ React เรนเดอร์ใหม่
 * เก็บเป็น Promise เลยเพื่อให้แถวที่ขอชื่อเดียวกันพร้อมกันใช้คำขอเดียว
 */
const cache = new Map<string, Promise<Photo>>();

function lookup(name: string, province: string): Promise<Photo> {
  const key = `${name}::${province}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const qs =
    `name=${encodeURIComponent(name)}` +
    (province ? `&province=${encodeURIComponent(province)}` : "");

  const request = fetch(`/api/place-photo?${qs}`, {
    signal: AbortSignal.timeout(10000),
  })
    .then((r) => (r.ok ? (r.json() as Promise<Photo>) : EMPTY))
    .catch(() => EMPTY);

  cache.set(key, request);
  return request;
}

/** ไอคอนกล้อง ใช้บนช่องที่ยังไม่มีรูป */
function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M4.6 7.8h3.1l1.4-2.2h5.8l1.4 2.2h3.1a1.8 1.8 0 0 1 1.8 1.8v7.4a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V9.6a1.8 1.8 0 0 1 1.8-1.8z" />
      <circle cx="12" cy="13.2" r="3.1" />
    </svg>
  );
}

/**
 * รูปย่อของสถานที่ในรายการ
 *
 * รูปจริงมาจากวิกิพีเดีย ซึ่งมีให้เฉพาะที่ที่คนเขียนถึง — วัดได้ราว 89%
 * ที่เที่ยวได้ราว 24% แต่ร้านอาหารกับคาเฟ่ได้แค่ 1.7% เพราะแทบไม่มีร้านไหน
 * มีหน้าวิกิพีเดีย
 *
 * รูปของ Google Maps ฝังมาแสดงเองไม่ได้ ต้องใช้ Places API ซึ่งบังคับผูก
 * บัญชีเรียกเก็บเงิน ช่องที่ไม่มีรูปจึงทำเป็นปุ่มพาไปดูรูปใน Google Maps แทน
 * ทุกแถวจึงมีทางไปดูรูปเสมอ ไม่ว่าจะหารูปมาแสดงเองได้หรือไม่
 *
 * @param skipLookup ข้ามการยิงหา ใช้กับแถวที่รู้อยู่แล้วว่าไม่มีหน้าวิกิพีเดีย
 *   (ธง notable ในชุดข้อมูล) จะได้ไม่ยิงคำขอที่รู้ผลล่วงหน้าว่าไม่เจอ
 */
export function PlaceThumb({
  name,
  province,
  mapsUrl,
  skipLookup = false,
  className,
}: {
  name: string;
  province?: string;
  mapsUrl: string;
  skipLookup?: boolean;
  className?: string;
}) {
  const wanted = `${name}::${province ?? ""}`;
  const [result, setResult] = useState<{ key: string; photo: Photo } | null>(
    skipLookup ? { key: wanted, photo: EMPTY } : null,
  );

  useEffect(() => {
    if (skipLookup || !name) return;
    let cancelled = false;
    lookup(name, province ?? "").then((photo) => {
      if (!cancelled) setResult({ key: wanted, photo });
    });
    return () => {
      cancelled = true;
    };
  }, [name, province, wanted, skipLookup]);

  const photo = result?.key === wanted ? result.photo : null;
  const box = cn(
    "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl",
    className,
  );

  // ยังโหลดอยู่
  if (!skipLookup && result === null) {
    return <div className={cn(box, "animate-pulse bg-line")} />;
  }

  if (photo?.url) {
    return (
      <div className={cn(box, "bg-line")}>
        <Image
          src={photo.url}
          alt={`รูปของ${name}`}
          fill
          sizes="64px"
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`ดูรูปของ${name}ใน Google Maps`}
      aria-label={`ดูรูปของ${name}ใน Google Maps`}
      className={cn(
        box,
        "flex flex-col items-center justify-center gap-0.5 border border-line bg-canvas text-muted transition-colors hover:border-brand hover:text-brand",
      )}
    >
      <CameraIcon />
      <span className="text-[10px] leading-none">ดูรูป</span>
    </a>
  );
}
