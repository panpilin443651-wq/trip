import { AVG_SPEED_KMH, ROAD_FACTOR, haversine } from "./geo";
import type { LatLng } from "./types";

export interface RouteLeg {
  distance: number;
  duration: number;
}

export interface RouteResult {
  legs: RouteLeg[];
  totalDistance: number;
  totalDuration: number;
  /** พิกัดสำหรับวาดเส้นทางบนแผนที่ [lat, lng] */
  geometry: Array<[number, number]>;
  /** true = ใช้ค่าประมาณจากเส้นตรง เพราะเรียกบริการเส้นทางไม่สำเร็จ */
  estimated: boolean;
}

export interface GeocodeHit {
  name: string;
  display: string;
  lat: number;
  lng: number;
}

const routeCache = new Map<string, RouteResult>();

function cacheKey(points: LatLng[]): string {
  return points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
}

/** ประมาณระยะทางถนนจากเส้นตรง ใช้เมื่อ OSRM ไม่ตอบ */
export function estimateRoute(points: LatLng[]): RouteResult {
  const legs: RouteLeg[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const distance = haversine(points[i], points[i + 1]) * ROAD_FACTOR;
    legs.push({
      distance,
      duration: (distance / 1000 / AVG_SPEED_KMH) * 3600,
    });
  }

  return {
    legs,
    totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    totalDuration: legs.reduce((sum, leg) => sum + leg.duration, 0),
    geometry: points.map((p) => [p.lat, p.lng] as [number, number]),
    estimated: true,
  };
}

/**
 * ขอเส้นทางจริงผ่าน /api/route (พร็อกซีไป OSRM)
 * ถ้าล้มเหลวด้วยเหตุใดก็ตาม จะคืนค่าประมาณแทนเสมอ เพื่อไม่ให้หน้าแผนที่พัง
 */
export async function fetchRoute(points: LatLng[]): Promise<RouteResult> {
  if (points.length < 2) {
    return {
      legs: [],
      totalDistance: 0,
      totalDuration: 0,
      geometry: points.map((p) => [p.lat, p.lng] as [number, number]),
      estimated: false,
    };
  }

  const key = cacheKey(points);
  const cached = routeCache.get(key);
  if (cached) return cached;

  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const response = await fetch(`/api/route?coords=${encodeURIComponent(coords)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`route ${response.status}`);

    const data = (await response.json()) as RouteResult;
    if (!Array.isArray(data.legs) || data.legs.length === 0) {
      throw new Error("empty route");
    }

    routeCache.set(key, data);
    return data;
  } catch {
    const fallback = estimateRoute(points);
    routeCache.set(key, fallback);
    return fallback;
  }
}

/** ค้นหาพิกัดจากชื่อสถานที่ ผ่าน /api/geocode (พร็อกซีไป Nominatim) */
export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`geocode ${response.status}`);
  return (await response.json()) as GeocodeHit[];
}
