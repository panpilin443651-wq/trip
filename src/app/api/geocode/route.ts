import { NextResponse } from "next/server";

/**
 * พร็อกซีไป Nominatim (OpenStreetMap)
 * ต้องทำฝั่งเซิร์ฟเวอร์เพราะ Nominatim บังคับให้ส่ง User-Agent ที่ระบุตัวตน
 */
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

interface NominatimHit {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
}

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ error: "คำค้นสั้นเกินไป" }, { status: 400 });
  }

  const url =
    `${NOMINATIM}?format=jsonv2&limit=5&accept-language=th` +
    `&countrycodes=th&q=${encodeURIComponent(query)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "travel-planner/1.0 (personal trip planner)",
        "Accept-Language": "th,en",
      },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 86_400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "บริการค้นหาสถานที่ไม่พร้อมใช้งาน" },
        { status: 502 },
      );
    }

    const hits = (await upstream.json()) as NominatimHit[];

    const results = hits
      .filter((hit) => hit.lat && hit.lon)
      .map((hit) => ({
        name: hit.name || hit.display_name?.split(",")[0] || query,
        display: hit.display_name ?? "",
        lat: Number(hit.lat),
        lng: Number(hit.lon),
      }))
      .filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lng));

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "ค้นหาสถานที่ไม่สำเร็จ" },
      { status: 504 },
    );
  }
}
