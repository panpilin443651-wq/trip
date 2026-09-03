import { NextResponse } from "next/server";
import { OSM_PLACES } from "@/data/osm-places";

/**
 * สถานที่ท่องเที่ยวของจังหวัดหนึ่ง จากข้อมูล OpenStreetMap ที่ดึงไว้ล่วงหน้า
 *
 * เสิร์ฟผ่าน API แทนที่จะให้ client import ตรง ๆ เพราะข้อมูลชุดนี้มีหลายพัน
 * รายการ ถ้าติดไปกับ bundle ผู้ใช้มือถือต้องโหลดทั้งก้อนทุกครั้งที่เปิดเว็บ
 * ทั้งที่ดูแค่จังหวัดเดียว
 *
 * ข้อมูลนิ่ง สร้างตอน build จึงแคชได้ยาว
 */
export async function GET(request: Request) {
  const province = (
    new URL(request.url).searchParams.get("province") ?? ""
  ).trim();

  if (!province) {
    return NextResponse.json({ error: "ต้องระบุจังหวัด" }, { status: 400 });
  }

  const places = OSM_PLACES[province] ?? [];

  return NextResponse.json(places, {
    headers: {
      // max-age ให้เบราว์เซอร์ด้วย ไม่งั้นเปิดฟอร์มใหม่ทีก็ยิงใหม่ทุกที
      "Cache-Control":
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
