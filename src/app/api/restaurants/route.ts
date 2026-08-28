import { NextResponse } from "next/server";

/**
 * ค้นร้านอาหารและคาเฟ่รอบพิกัดที่ให้มา ผ่าน Overpass API (OpenStreetMap)
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
}

const KIND_LABEL: Record<string, string> = {
  restaurant: "ร้านอาหาร",
  cafe: "คาเฟ่",
  fast_food: "อาหารจานด่วน",
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
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
            mapsUrl:
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(`${name} ${elLat},${elLng}`),
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
