import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { SITE_URL } from "@/lib/site";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const TITLE = "Travel Planner — วางแผนการท่องเที่ยว";
const DESCRIPTION =
  "วางแผนทริป จัดตารางกิจกรรมรายวัน คุมงบประมาณแยกหมวด และดูเส้นทางบนแผนที่";

export const metadata: Metadata = {
  // ต้องมี ไม่งั้น og:image จะเป็นพาธสั้น ๆ แล้ว LINE ดึงรูปไม่ได้
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Travel Planner",
  // การ์ดพรีวิวตอนแชร์ลิงก์ในแอปแชต — รูปมาจาก src/app/opengraph-image.tsx
  openGraph: {
    type: "website",
    siteName: "Travel Planner",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "th_TH",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // iOS ไม่อ่าน manifest ต้องบอกผ่าน meta ของตัวเองถึงจะเปิดแบบเต็มจอ
  appleWebApp: {
    capable: true,
    title: "Travel Planner",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  other: {
    // Next 16 ออกให้แค่ mobile-web-app-capable ซึ่งเป็นชื่อมาตรฐานใหม่
    // แต่ Safari บน iOS ยังดูชื่อเดิมของ Apple อยู่ ถ้าไม่มีตัวนี้
    // เปิดจากหน้าจอโฮมแล้วจะได้แถบที่อยู่ของ Safari มาด้วย ไม่เต็มจอ
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // ค่าเริ่มต้นเป็นโหมดมืด สคริปต์ใน <head> แก้ให้ตรงโหมดจริงก่อนหน้าจอถูกวาด
  // และปุ่มสลับโหมดแก้ตามทุกครั้งที่กด
  themeColor: THEME_COLOR.dark,
  width: "device-width",
  initialScale: 1,
  // เปิดแบบแอปแล้วเนื้อหาต้องไหลไปใต้รอยบากและแถบล่างของเครื่อง
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme ตั้งเป็นมืดไว้ก่อน แล้วสคริปต์ด้านล่างแก้ให้ตรงกับที่ผู้ใช้เลือก
    // suppressHydrationWarning จำเป็น เพราะสคริปต์แก้ attribute ก่อน React จะ hydrate
    <html
      lang="th"
      data-theme="dark"
      suppressHydrationWarning
      className={`${notoSansThai.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
