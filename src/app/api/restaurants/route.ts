import { NextResponse } from "next/server";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";

/**
 * ร้านอาหารและคาเฟ่ของจังหวัดหนึ่ง จากข้อมูลที่คัดไว้ล่วงหน้า
 *
 * เสิร์ฟผ่าน API แทนที่จะให้ client import ตรง ๆ เพราะข้อมูลชุดนี้เกือบ 400 KB
 * ถ้าติดไปกับ bundle ผู้ใช้มือถือต้องโหลดทั้งก้อนทุกครั้งที่เปิดเว็บ
 * ทั้งที่ดูแค่จังหวัดเดียว
 *
 * เคยมีโหมดค้นสดรอบพิกัดผ่าน Overpass ด้วย แต่เอาออกแล้วพร้อมการ์ด
 * "ร้านอาหารแถวนั้น" เพราะซ้อนกับรายการรายจังหวัดซึ่งเร็วกว่าและใช้ได้
 * ตั้งแต่ยังไม่ปักหมุด
 *
 * ข้อมูลนิ่ง สร้างตอน build จึงแคชได้ยาว
 */
export interface RestaurantHit {
  id: string;
  name: string;
  /** ร้านอาหาร หรือ คาเฟ่ */
  kind: string;
  cuisine: string | null;
  lat: number;
  lng: number;
  /** ลิงก์เปิดใน Google Maps เพื่อดูรีวิวและเรตติ้งต่อ */
  mapsUrl: string;
  /** เวลาเปิดปิดตามรูปแบบ OSM ว่างได้ */
  openingHours: string | null;
  /** มีคนเขียนถึงใน Wikipedia — ใช้ติดดาวในรายการ */
  notable: boolean;
}

/** ค้นด้วยชื่อ + พิกัด เพื่อให้ Google เจอร้านเดียวกันแล้วเห็นรีวิว */
function mapsUrlFor(name: string, lat: number, lng: number): string {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${name} ${lat},${lng}`)
  );
}

export async function GET(request: Request) {
  const province = (
    new URL(request.url).searchParams.get("province") ?? ""
  ).trim();

  if (!province) {
    return NextResponse.json({ error: "ต้องระบุจังหวัด" }, { status: 400 });
  }

  const hits: RestaurantHit[] = (OSM_RESTAURANTS[province] ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    cuisine: r.cuisine || null,
    lat: r.lat,
    lng: r.lng,
    mapsUrl: mapsUrlFor(r.name, r.lat, r.lng),
    openingHours: r.openingHours || null,
    notable: r.notable,
  }));

  return NextResponse.json(hits, {
    headers: {
      // max-age ให้เบราว์เซอร์ด้วย ไม่งั้นเปิดหน้าใหม่ทีก็ยิงใหม่ทุกที
      "Cache-Control":
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
