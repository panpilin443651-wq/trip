import type { MetadataRoute } from "next";

/**
 * ข้อมูลสำหรับติดตั้งเว็บเป็นแอปบนเครื่อง
 * Next สร้างเป็น /manifest.webmanifest ให้เอง
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travel Planner — วางแผนการท่องเที่ยว",
    short_name: "Travel Planner",
    description:
      "วางแผนทริป จัดตารางกิจกรรมรายวัน คุมงบประมาณแยกหมวด และดูเส้นทางบนแผนที่",
    lang: "th",
    dir: "ltr",
    // เปิดแอปแล้วเข้าหน้าหลักเลย ถ้ายังไม่ล็อกอินจะถูกพาไปหน้าเข้าสู่ระบบเอง
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1a30",
    theme_color: "#0e1a30",
    categories: ["travel", "productivity", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // maskable ให้ระบบครอบตัดเป็นทรงของเครื่องได้โดยไม่กินเนื้อหา
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "แผนเที่ยว",
        short_name: "แผนเที่ยว",
        url: "/settings#plan",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "แผนที่",
        short_name: "แผนที่",
        url: "/map",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "งบประมาณ",
        short_name: "งบ",
        url: "/budget",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
