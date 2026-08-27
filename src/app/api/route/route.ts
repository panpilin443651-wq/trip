import { NextResponse } from "next/server";

/**
 * พร็อกซีไป OSRM public server
 * ทำฝั่งเซิร์ฟเวอร์เพื่อเลี่ยง CORS และให้แคชผลลัพธ์ที่ขอบได้
 *
 * รูปแบบ coords: 'lng,lat;lng,lat;...'
 */
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{ distance: number; duration: number }>;
  }>;
}

const COORD_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export async function GET(request: Request) {
  const coords = new URL(request.url).searchParams.get("coords") ?? "";
  const parts = coords.split(";").filter(Boolean);

  if (parts.length < 2 || parts.length > 25) {
    return NextResponse.json(
      { error: "ต้องมีพิกัด 2-25 จุด" },
      { status: 400 },
    );
  }
  if (!parts.every((part) => COORD_PATTERN.test(part))) {
    return NextResponse.json({ error: "รูปแบบพิกัดไม่ถูกต้อง" }, { status: 400 });
  }

  const url = `${OSRM_BASE}/${parts.join(";")}?overview=full&geometries=geojson`;

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "travel-planner/1.0" },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 86_400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "บริการเส้นทางไม่พร้อมใช้งาน" },
        { status: 502 },
      );
    }

    const data = (await upstream.json()) as OsrmResponse;
    const route = data.routes?.[0];

    if (data.code !== "Ok" || !route) {
      return NextResponse.json(
        { error: "ไม่พบเส้นทางระหว่างจุดที่เลือก" },
        { status: 404 },
      );
    }

    const legs = (route.legs ?? []).map((leg) => ({
      distance: leg.distance,
      duration: leg.duration,
    }));

    // OSRM คืน [lng, lat] แต่ Leaflet ใช้ [lat, lng]
    const geometry = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );

    return NextResponse.json(
      {
        legs,
        totalDistance: route.distance,
        totalDuration: route.duration,
        geometry,
        estimated: false,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "เรียกบริการเส้นทางไม่สำเร็จ" },
      { status: 504 },
    );
  }
}
