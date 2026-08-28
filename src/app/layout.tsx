import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Travel Planner — วางแผนการท่องเที่ยว",
  description:
    "วางแผนทริป จัดตารางกิจกรรมรายวัน คุมงบประมาณแยกหมวด และดูเส้นทางบนแผนที่",
};

export const viewport: Viewport = {
  themeColor: "#0e1a30",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
