import { NextResponse } from "next/server";
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";
import { districtsOf } from "@/data/districts";

/**
 * อำเภอของจังหวัดหนึ่ง พร้อมจำนวนสถานที่และร้านที่มีข้อมูล
 *
 * หน้าแนะนำเที่ยวใช้ตัดสินว่าจะโชว์ชิปอำเภอไหนบ้าง ถ้าโชว์ครบทุกอำเภอ
 * จังหวัดใหญ่จะมี 20-30 ปุ่มซึ่งกดหายาก และหลายอำเภอกดไปก็ไม่มีอะไรให้ดู
 *
 * นับฝั่งเซิร์ฟเวอร์เพราะข้อมูลสองชุดรวมกันเกือบ 1 MB ถ้าส่งไปนับในเบราว์เซอร์
 * ผู้ใช้มือถือต้องโหลดทั้งก้อนเพื่อทำแค่รายการชื่อ
 */
export interface DistrictCount {
  name: string;
  /** ที่เที่ยว/วัด จาก OpenStreetMap */
  places: number;
  /** ร้านอาหารและคาเฟ่ */
  food: number;
}

export async function GET(request: Request) {
  const province = (
    new URL(request.url).searchParams.get("province") ?? ""
  ).trim();

  if (!province) {
    return NextResponse.json({ error: "ต้องระบุจังหวัด" }, { status: 400 });
  }

  const counts = new Map<string, DistrictCount>();
  // ตั้งต้นจากทะเบียนอำเภอจริง จะได้ไม่หลุดชื่อแปลก ๆ ที่สะกดไม่ตรงเข้ามา
  for (const name of districtsOf(province)) {
    counts.set(name, { name, places: 0, food: 0 });
  }

  for (const place of OSM_PLACES[province] ?? []) {
    const row = counts.get(place.district);
    if (row) row.places += 1;
  }
  for (const shop of OSM_RESTAURANTS[province] ?? []) {
    const row = counts.get(shop.district);
    if (row) row.food += 1;
  }

  const list = [...counts.values()]
    .filter((row) => row.places > 0 || row.food > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  return NextResponse.json(list, {
    headers: {
      "Cache-Control":
        "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
