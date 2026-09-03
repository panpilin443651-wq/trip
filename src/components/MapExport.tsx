"use client";

import { useState } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import {
  MAX_GOOGLE_POINTS,
  buildGpx,
  buildKml,
  googleDirectionsUrl,
  safeFileName,
  type RoutePoint,
} from "@/lib/map-export";

/** ดาวน์โหลดข้อความเป็นไฟล์ โดยไม่ต้องส่งอะไรขึ้นเซิร์ฟเวอร์ */
function downloadText(text: string, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * ส่งเส้นทางของวันนี้ออกไปใช้ข้างนอก
 *
 * เว็บสั่งให้ Google Maps ดาวน์โหลดแผนที่ออฟไลน์เองไม่ได้ (ไม่มี API ให้ทำ)
 * จึงทำสองทางให้เลือก — เปิดเส้นทางในแอป Google Maps แล้วผู้ใช้กดบันทึก
 * ออฟไลน์เอง หรือโหลดไฟล์ GPX/KML ไปเปิดในแอปที่ใช้แผนที่ออฟไลน์ได้จริง
 */
export function MapExport({
  points,
  tripName,
  dayLabel,
}: {
  points: RoutePoint[];
  tripName: string;
  dayLabel: string;
}) {
  const [howTo, setHowTo] = useState(false);

  if (points.length === 0) return null;

  const directions = googleDirectionsUrl(points);
  const dropped = Math.max(0, points.length - MAX_GOOGLE_POINTS);
  const baseName = safeFileName(`${tripName}-${dayLabel}`);

  return (
    <Card as="section">
      <SectionTitle emoji="📲" title="เอาแผนที่ไปใช้ตอนเดินทาง" />

      <div className="space-y-2">
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-canvas transition-colors hover:bg-brand-dark"
          >
            🗺️ เปิดเส้นทางวันนี้ใน Google Maps
          </a>
        ) : (
          <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn">
            ⚠️ ต้องมีจุดที่ปักหมุดแล้วอย่างน้อย 2 จุดถึงจะนำทางได้
            ตอนนี้มี {points.length} จุด
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                buildGpx(points, `${tripName} — ${dayLabel}`),
                `${baseName}.gpx`,
                "application/gpx+xml",
              )
            }
          >
            ⬇️ โหลดไฟล์ GPX
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadText(
                buildKml(points, `${tripName} — ${dayLabel}`),
                `${baseName}.kml`,
                "application/vnd.google-earth.kml+xml",
              )
            }
          >
            ⬇️ โหลดไฟล์ KML
          </Button>
        </div>
      </div>

      {dropped > 0 ? (
        <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn">
          ⚠️ Google Maps รับจุดแวะกลางทางได้สูงสุด {MAX_GOOGLE_POINTS - 2} จุด
          ลิงก์นี้จึงพาไปแค่ {MAX_GOOGLE_POINTS} จุดแรก อีก {dropped} จุดที่เหลือ
          อยู่ในไฟล์ GPX/KML ครบ
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setHowTo((v) => !v)}
        className="mt-3 text-sm text-brand underline"
      >
        {howTo ? "ซ่อนวิธีใช้" : "ใช้ยังไงตอนไม่มีเน็ต?"}
      </button>

      {howTo ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
          <div>
            <p className="font-medium text-ink">
              วิธีที่ 1 — บันทึกแผนที่ออฟไลน์ในแอป Google Maps
            </p>
            <p className="mt-1 text-xs text-faint">
              เว็บสั่งให้แอปโหลดแผนที่เองไม่ได้ ต้องกดในแอป
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">
              <li>กดปุ่มเปิดเส้นทางด้านบน ให้แอป Google Maps เปิดขึ้นมา</li>
              <li>ย้อนกลับไปหน้าแผนที่ แล้วเลื่อนให้เห็นพื้นที่ที่จะไป</li>
              <li>
                กดรูปโปรไฟล์มุมขวาบน → <b>แผนที่ออฟไลน์</b> →{" "}
                <b>เลือกแผนที่ของคุณเอง</b>
              </li>
              <li>ปรับกรอบให้คลุมเส้นทาง แล้วกดดาวน์โหลด</li>
            </ol>
          </div>

          <div>
            <p className="font-medium text-ink">
              วิธีที่ 2 — ใช้ไฟล์ GPX กับแอปที่ออฟไลน์ได้เต็มตัว
            </p>
            <p className="mt-1.5">
              โหลดไฟล์ GPX แล้วเปิดด้วย Organic Maps หรือ OsmAnd
              (ทั้งคู่ฟรีและใช้แผนที่ OpenStreetMap แบบออฟไลน์ทั้งประเทศ)
              หมุดทุกจุดกับลำดับการเดินทางจะเข้าไปครบ ไม่จำกัดจำนวนจุด
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">
              วิธีที่ 3 — เอาหมุดเข้าบัญชี Google
            </p>
            <p className="mt-1.5">
              โหลดไฟล์ KML แล้วนำเข้าที่ Google My Maps
              จะเปิดดูในแอป Google Maps ได้ที่ &ldquo;ที่บันทึกไว้&rdquo; →
              &ldquo;แผนที่&rdquo;
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
