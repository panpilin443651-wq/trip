import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * รูปที่ขึ้นตอนแชร์ลิงก์ใน LINE, Facebook, Messenger ฯลฯ
 *
 * ขนาด 1200x630 เป็นสัดส่วนที่แอปแชตส่วนใหญ่ใช้แสดงการ์ดใหญ่
 * ข้อความในรูปเป็นอักษรละตินอย่างเดียว เพราะ ImageResponse มีแต่ฟอนต์ละติน
 * ติดมาให้ ถ้าใส่ภาษาไทยจะออกมาเป็นสี่เหลี่ยมเปล่า ส่วนคำอธิบายภาษาไทย
 * ให้ไปอยู่ใน og:description ซึ่งแอปแชตเป็นคนเรนเดอร์เอง
 */
export const alt = "Travel Planner — วางแผนการท่องเที่ยว";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#071b33";
const CARD = "#102a49";
const ACCENT = "#2ba3e3";
const INK = "#f2f7fb";
const MUTED = "#a4b8d1";

export default async function Image() {
  // ใช้ไอคอนตัวเดียวกับที่ติดตั้งเป็นแอป จะได้เป็นภาพจำเดียวกัน
  const logo = await readFile(join(process.cwd(), "public/icon-512.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: NAVY,
          // เส้นขอบสีฟ้าบาง ๆ ด้านบน ให้การ์ดมีจุดเกาะสายตา
          borderTop: `16px solid ${ACCENT}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={220} height={220} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 82, fontWeight: 700, color: INK }}>
              Travel Planner
            </div>
            <div style={{ fontSize: 36, color: ACCENT }}>
              Plan trips across all 77 provinces
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 28,
            color: MUTED,
          }}
        >
          {["Day plans", "Budget", "Map & routes", "Trip summary"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                background: CARD,
                borderRadius: 999,
                padding: "12px 26px",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
