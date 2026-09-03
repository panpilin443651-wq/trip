import { NextResponse } from "next/server";
import { OSM_RESTAURANTS } from "@/data/osm-restaurants";

/**
 * ร้านอาหารและคาเฟ่ — รับได้สองแบบ
 *
 *   ?province=เชียงใหม่   อ่านจากฐานข้อมูลที่คัดไว้ล่วงหน้า ตอบทันที ใช้ได้ทุกที่
 *   ?lat=&lng=&radius=   ค้นสดรอบพิกัดผ่าน Overpass ได้ร้านใกล้จุดแวะจริง ๆ
 *
 * มีสองแบบเพราะใช้คนละจังหวะ — ตอนวางแผนยังไม่มีพิกัดก็เลือกจากรายการของ
 * จังหวัดได้เลย ส่วนตอนจัดตารางรายวันแล้วอยากได้ร้านใกล้ ๆ ค่อยค้นสด
 *
 * ทำฝั่งเซิร์ฟเวอร์เพื่อเลี่ยง CORS และให้แคชผลลัพธ์ที่ขอบได้
 * ไม่ต้องใช้ API key ต่างจาก Google Places
 */
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface RestaurantHit {
  id: string;
  name: string;
  kind: string;
  cuisine: string | null;
  lat: number;
  lng: number;
  /** ลิงก์เปิดใน Google Maps เพื่อดูรีวิวและเรตติ้งต่อ */
  mapsUrl: string;
  /** เวลาเปิดปิดตามรูปแบบ OSM — มีเฉพาะผลจากฐานข้อมูลรายจังหวัด */
  openingHours?: string | null;
  /** มีคนเขียนถึงใน Wikipedia — มีเฉพาะผลจากฐานข้อมูลรายจังหวัด */
  notable?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  restaurant: "ร้านอาหาร",
  cafe: "คาเฟ่",
  fast_food: "อาหารจานด่วน",
};

/** ลิงก์ค้นร้านใน Google Maps ด้วยชื่อ + พิกัด จะได้เจอร้านเดียวกันแล้วเห็นรีวิว */
function mapsUrlFor(name: string, lat: number, lng: number): string {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${name} ${lat},${lng}`)
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const province = (params.get("province") ?? "").trim();
  if (province) {
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
        // ข้อมูลนิ่ง สร้างตอน build จึงแคชได้ยาว
        "Cache-Control":
          "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  }

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Math.min(5000, Math.max(500, Number(params.get("radius")) || 2000));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "พิกัดไม่ถูกต้อง" }, { status: 400 });
  }

  const query =
    `[out:json][timeout:20];` +
    `(node["amenity"~"^(restaurant|cafe|fast_food)$"]["name"]` +
    `(around:${radius},${lat},${lng}););out body 30;`;

  for (const mirror of MIRRORS) {
    try {
      const upstream = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "travel-planner/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(25000),
        next: { revalidate: 86_400 },
      });

      if (!upstream.ok) continue;

      const text = await upstream.text();
      if (!text.trim().startsWith("{")) continue;

      const data = JSON.parse(text) as { elements?: OverpassElement[] };
      const results: RestaurantHit[] = (data.elements ?? [])
        .map((el) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLng = el.lon ?? el.center?.lon;
          const name = el.tags?.name;
          if (!name || elLat === undefined || elLng === undefined) return null;

          const amenity = el.tags?.amenity ?? "restaurant";
          return {
            id: String(el.id),
            name,
            kind: KIND_LABEL[amenity] ?? "ร้านอาหาร",
            cuisine: el.tags?.cuisine?.split(";")[0] ?? null,
            lat: elLat,
            lng: elLng,
            // ค้นด้วยชื่อ + พิกัด เพื่อให้ Google เจอร้านเดียวกันแล้วเห็นรีวิว
            mapsUrl: mapsUrlFor(name, elLat, elLng),
          } satisfies RestaurantHit;
        })
        .filter((r): r is RestaurantHit => r !== null);

      return NextResponse.json(results, {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      // ลอง mirror ถัดไป
    }
  }

  return NextResponse.json(
    { error: "ค้นหาร้านอาหารไม่สำเร็จ ลองใหม่อีกครั้ง" },
    { status: 504 },
  );
}
