import { NextResponse } from "next/server";
import { OSM_HOTELS } from "@/data/osm-hotels";
import { OSM_PLACES } from "@/data/osm-places";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";
import { PROVINCES } from "@/data/provinces";
import { googleMapsUrl } from "@/lib/place-search";
import {
  buildSuggestionRows,
  searchSuggestionRows,
  type SuggestionRow,
} from "@/lib/trip-suggestions";

/**
 * ค้นสถานที่ทั่วประเทศด้วยชื่อ — ทุกหมวดในการ์ด "แนะนำสำหรับทริปนี้"
 *
 * การ์ดนั้นโหลดเฉพาะจังหวัดของวันที่กำลังดู ซึ่งพอสำหรับการเลือกทั่วไป
 * แต่ถ้าผู้ใช้นึกชื่อที่ไหนได้อยู่แล้วและที่นั่นอยู่คนละจังหวัด (หรือคนละอำเภอ
 * ที่ไม่ได้เจาะไว้) จะหาไม่เจอเลย เส้นทางนี้จึงค้นข้ามทุกจังหวัดให้
 *
 * ใช้ buildSuggestionRows ตัวเดียวกับที่การ์ดใช้ แถวที่ได้จึงหน้าตาเหมือนกันเป๊ะ
 * ฝั่งเบราว์เซอร์เอาไปแสดงและกดใส่แผนได้เลยโดยไม่ต้องแปลงอะไรอีก
 */

/** ให้ Google เจอที่เดียวกันแล้วเห็นรูปกับรีวิว */
const withMaps = <T extends { name: string; lat: number; lng: number }>(
  byProvince: Record<string, T[]>,
) =>
  Object.fromEntries(
    Object.entries(byProvince).map(([province, list]) => [
      province,
      list.map((row) => ({
        ...row,
        mapsUrl: googleMapsUrl(row.name, row.lat, row.lng),
      })),
    ]),
  );

/*
 * สร้างทุกแถวครั้งเดียวตอนโหลดโมดูล
 *
 * ราว 5,400 แถว ใช้เวลาสร้างไม่ถึงวินาที และคำค้นแต่ละครั้งเป็นแค่การกรอง
 * ในหน่วยความจำ ถ้าสร้างใหม่ทุกคำขอจะช้ากว่ามากโดยไม่ได้อะไรเพิ่ม
 * เพราะข้อมูลเป็นไฟล์นิ่ง ไม่เปลี่ยนระหว่างที่เซิร์ฟเวอร์ทำงาน
 */
const ALL_ROWS: SuggestionRow[] = buildSuggestionRows({
  curated: PROVINCES,
  osmPlaces: OSM_PLACES,
  restaurants: withMaps(OSM_RESTAURANTS),
  hotels: withMaps(OSM_HOTELS),
});

/** ส่งกลับมากกว่านี้ก็เลื่อนหาไม่ไหว และคำค้นที่กว้างขนาดนั้นควรพิมพ์ให้แคบลง */
const LIMIT = 20;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLowerCase();
  /** จังหวัดของทริป ใช้ดันผลของจังหวัดนั้นขึ้นก่อน ไม่ได้ใช้กรองทิ้ง */
  const near = (params.get("province") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ error: "คำค้นสั้นเกินไป" }, { status: 400 });
  }

  return NextResponse.json(
    searchSuggestionRows(ALL_ROWS, query, near, LIMIT),
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
