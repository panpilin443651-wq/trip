"use client";

import dynamic from "next/dynamic";
import { PlacePhoto } from "@/components/PlacePhoto";
import { Badge, Button, Sheet } from "@/components/ui";
import type { SuggestedPlace } from "@/data/provinces";
import { formatDuration, formatTHB } from "@/lib/format";
import { googleMapsUrl } from "@/lib/place-search";

/**
 * แผนที่ต้องโหลดฝั่งเบราว์เซอร์เท่านั้น — Leaflet แตะ window ตอน import
 * ถ้าเรนเดอร์ฝั่งเซิร์ฟเวอร์จะพังทันที
 */
const PlaceMiniMap = dynamic(() => import("@/components/PlaceMiniMap"), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full animate-pulse rounded-2xl bg-line" />
  ),
});

/**
 * หน้ารายละเอียดสถานที่ — ขั้นที่ 3 กับ 4 ของโฟลว์
 *
 * รวมรายละเอียดกับแผนที่ของจุดนั้นไว้ที่เดียว เพราะสองอย่างนี้คนดูพร้อมกัน
 * เสมอ ("ที่นี่คืออะไร" กับ "อยู่ตรงไหน") ถ้าแยกคนละหน้าจะต้องกดสลับไปมา
 */
export function PlaceDetailSheet({
  place,
  province,
  onClose,
  onAddToTrip,
}: {
  place: SuggestedPlace | null;
  province: string;
  onClose: () => void;
  /** ใส่เป็นจุดแวะในตารางของวันใดวันหนึ่ง */
  onAddToTrip: (place: SuggestedPlace) => void;
}) {
  return (
    <Sheet
      open={!!place}
      title={place ? place.name : ""}
      onClose={onClose}
      footer={
        place ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => onAddToTrip(place)}>
              ใส่ในโปรแกรมเที่ยว
            </Button>
            <a
              href={googleMapsUrl(`${place.name} ${province}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="secondary" className="w-full">
                เปิดใน Google Maps
              </Button>
            </a>
          </div>
        ) : null
      }
    >
      {place ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-brand-soft text-brand">{place.tag}</Badge>
            <Badge>{place.district ?? province}</Badge>
            <Badge>{formatDuration(place.durationMin)}</Badge>
            <Badge>
              {place.fee > 0 ? formatTHB(place.fee) : "ไม่มีค่าเข้า"}
            </Badge>
          </div>

          {/* รูปมาก่อนคำอธิบาย เพราะคนดูรูปตัดสินใจเร็วกว่าอ่าน */}
          <PlacePhoto name={place.name} province={province} />

          <p className="text-sm leading-relaxed">{place.description}</p>

          {/* แผนที่ของจุดนี้โดยเฉพาะ */}
          <PlaceMiniMap lat={place.lat} lng={place.lng} label={place.name} />

          <dl className="space-y-2 text-sm">
            <div className="rounded-2xl bg-canvas px-3 py-2.5">
              <dt className="text-xs text-muted">ช่วงที่ควรไป</dt>
              <dd className="mt-0.5 leading-relaxed">{place.bestTime}</dd>
            </div>
            <div className="rounded-2xl bg-canvas px-3 py-2.5">
              <dt className="text-xs text-muted">เคล็ดลับ</dt>
              <dd className="mt-0.5 leading-relaxed">{place.tip}</dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-faint">
            พิกัดมาจาก OpenStreetMap ส่วนค่าเข้าและเวลาเปิด-ปิดเป็นค่าโดยประมาณ
            ควรเช็กอีกครั้งก่อนออกเดินทาง
          </p>
        </div>
      ) : null}
    </Sheet>
  );
}
