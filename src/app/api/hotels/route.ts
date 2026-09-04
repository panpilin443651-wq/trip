import { NextResponse } from "next/server";
import { OSM_HOTELS } from "@/data/osm-hotels";

/**
 * โรงแรมและรีสอร์ตของจังหวัดหนึ่ง จากข้อมูลที่คัดไว้ล่วงหน้า
 *
 * เสิร์ฟผ่าน API แทนที่จะให้ client import ตรง ๆ เพราะข้อมูลชุดนี้เกือบ 200 KB
 * ถ้าติดไปกับ bundle ผู้ใช้มือถือต้องโหลดทั้งก้อนทุกครั้งที่เปิดเว็บ
 * ทั้งที่ดูแค่จังหวัดเดียว
 *
 * ไม่มีราคา เพราะ OSM ไม่ได้เก็บ และราคาที่พักเปลี่ยนตามวันจนเก็บไว้ไม่มีความหมาย
 * ทุกแถวจึงมีลิงก์ไป Google Maps ให้ไปดูราคาและรีวิวต่อ
 */
export interface HotelHit {
  id: string;
  name: string;
  /** โรงแรม หรือ รีสอร์ต */
  kind: string;
  /** จำนวนดาวตามที่ OSM ระบุ 0 = ไม่ได้ระบุ */
  stars: number;
  lat: number;
  lng: number;
  /** ลิงก์เปิดใน Google Maps เพื่อดูราคา รูป และรีวิวต่อ */
  mapsUrl: string;
  /** มีหน้า Wikipedia — ใช้ติดดาวในรายการ */
  notable: boolean;
  district: string;
}

/** ค้นด้วยชื่อ + พิกัด เพื่อให้ Google เจอที่พักเดียวกันแล้วเห็นราคาและรีวิว */
function mapsUrlFor(name: string, lat: number, lng: number): string {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${name} ${lat},${lng}`)
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const province = (params.get("province") ?? "").trim();
  // กรองต่อด้วยอำเภอได้ ว่าง = ทั้งจังหวัด
  const district = (params.get("district") ?? "").trim();

  if (!province) {
    return NextResponse.json({ error: "ต้องระบุจังหวัด" }, { status: 400 });
  }

  const all = OSM_HOTELS[province] ?? [];
  const rows = district ? all.filter((h) => h.district === district) : all;

  const hits: HotelHit[] = rows.map((h) => ({
    id: h.id,
    name: h.name,
    kind: h.kind,
    stars: h.stars,
    lat: h.lat,
    lng: h.lng,
    mapsUrl: mapsUrlFor(h.name, h.lat, h.lng),
    notable: h.notable,
    district: h.district,
  }));

  return NextResponse.json(hits, {
    headers: {
      "Cache-Control":
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
