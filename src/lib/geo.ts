import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** ระยะทางเส้นตรงระหว่างสองพิกัด (เมตร) */
export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * ตัวคูณชดเชยจากเส้นตรงเป็นระยะทางถนนโดยประมาณ
 * ใช้เมื่อเรียก OSRM ไม่สำเร็จ
 */
export const ROAD_FACTOR = 1.3;

/** ความเร็วเฉลี่ยที่ใช้ประมาณเวลาเดินทาง (กม./ชม.) */
export const AVG_SPEED_KMH = 45;

/** 12400 -> '12.4 กม.' | 850 -> '850 ม.' */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "-";
  if (meters < 1000) return `${Math.round(meters)} ม.`;
  const km = meters / 1000;
  return `${km.toFixed(km < 100 ? 1 : 0)} กม.`;
}

/** 1080 (วินาที) -> '18 นาที' */
export function formatTravelTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

export function hasCoords(
  item: { lat?: number; lng?: number } | null | undefined,
): item is { lat: number; lng: number } {
  return (
    !!item &&
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng)
  );
}
