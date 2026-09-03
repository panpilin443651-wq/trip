/**
 * ลิงก์ไป Google Maps และไฟล์เส้นทางสำหรับใช้ตอนเดินทาง
 *
 * เว็บสั่งให้แอป Google Maps ดาวน์โหลดแผนที่ออฟไลน์เองไม่ได้ ไม่มี API ให้ทำ
 * ที่ทำได้คือส่งเส้นทางเข้าแอปให้ครบ แล้วผู้ใช้กดบันทึกออฟไลน์ในแอปเอง
 * ส่วนไฟล์ GPX/KML เอาไว้เปิดในแอปนำทางที่ใช้แผนที่ออฟไลน์ได้จริง
 * เช่น Organic Maps หรือ OsmAnd
 */

export interface RoutePoint {
  name: string;
  lat: number;
  lng: number;
}

/**
 * Google Maps URL API รับจุดแวะกลางทางได้สูงสุด 9 จุด
 * (ไม่นับต้นทางกับปลายทาง) เกินกว่านั้นลิงก์จะใช้ไม่ได้
 */
export const MAX_WAYPOINTS = 9;

/** จำนวนจุดสูงสุดที่ลิงก์เดียวพาไปได้ = ต้นทาง + จุดแวะ + ปลายทาง */
export const MAX_GOOGLE_POINTS = MAX_WAYPOINTS + 2;

const coord = (p: RoutePoint) => `${p.lat},${p.lng}`;

/**
 * ลิงก์นำทางใน Google Maps ผ่านทุกจุดตามลำดับ
 *
 * ใช้พิกัดแทนชื่อสถานที่ เพราะชื่อไทยซ้ำกันเยอะ (เช่น "วัดกลาง" มีทุกจังหวัด)
 * แล้ว Google อาจพาไปคนละที่
 *
 * คืน null เมื่อมีจุดไม่ถึงสองจุด เพราะยังไม่นับเป็นเส้นทาง
 */
export function googleDirectionsUrl(
  points: RoutePoint[],
  travelMode: "driving" | "walking" | "transit" | "bicycling" = "driving",
): string | null {
  if (points.length < 2) return null;

  const capped = points.slice(0, MAX_GOOGLE_POINTS);
  const origin = capped[0];
  const destination = capped[capped.length - 1];
  const waypoints = capped.slice(1, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: coord(origin),
    destination: coord(destination),
    travelmode: travelMode,
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(coord).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** ลิงก์เปิดจุดเดียวใน Google Maps */
export function googlePointUrl(point: RoutePoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(point)}`;
}

/** หนีอักขระที่ทำให้ XML พัง — ชื่อสถานที่มี & กับ ' ได้ */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * ไฟล์ GPX — เปิดได้ในแอปนำทางเกือบทุกตัวและเครื่อง GPS
 *
 * ใส่ทั้ง waypoint (จุดแวะแต่ละที่) และ route (ลำดับการเดินทาง)
 * แอปบางตัวอ่านแค่อย่างใดอย่างหนึ่ง ใส่ทั้งคู่จึงปลอดภัยกว่า
 */
export function buildGpx(points: RoutePoint[], tripName: string): string {
  const waypoints = points
    .map(
      (p) =>
        `  <wpt lat="${p.lat}" lon="${p.lng}">\n` +
        `    <name>${escapeXml(p.name)}</name>\n` +
        `  </wpt>`,
    )
    .join("\n");

  const route = points
    .map(
      (p) =>
        `    <rtept lat="${p.lat}" lon="${p.lng}">\n` +
        `      <name>${escapeXml(p.name)}</name>\n` +
        `    </rtept>`,
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Travel Planner" ` +
    `xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata><name>${escapeXml(tripName)}</name></metadata>\n` +
    `${waypoints}\n` +
    `  <rte>\n    <name>${escapeXml(tripName)}</name>\n${route}\n  </rte>\n` +
    `</gpx>\n`
  );
}

/**
 * ไฟล์ KML — เปิดใน Google Earth และนำเข้า Google My Maps ได้
 *
 * My Maps เป็นวิธีเดียวที่จะเอาหมุดทั้งชุดเข้าไปอยู่ในบัญชี Google
 * แล้วเปิดดูในแอป Google Maps ได้ (แท็บ "ที่บันทึกไว้" → "แผนที่")
 */
export function buildKml(points: RoutePoint[], tripName: string): string {
  const marks = points
    .map(
      (p, i) =>
        `    <Placemark>\n` +
        `      <name>${i + 1}. ${escapeXml(p.name)}</name>\n` +
        `      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>\n` +
        `    </Placemark>`,
    )
    .join("\n");

  // KML เรียงพิกัดเป็น lng,lat สลับกับ GPX ที่เป็น lat แล้ว lon
  const line = points.map((p) => `${p.lng},${p.lat},0`).join(" ");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n    <name>${escapeXml(tripName)}</name>\n` +
    `${marks}\n` +
    `    <Placemark>\n      <name>เส้นทาง</name>\n` +
    `      <LineString><tessellate>1</tessellate>\n` +
    `        <coordinates>${line}</coordinates>\n` +
    `      </LineString>\n    </Placemark>\n` +
    `  </Document>\n</kml>\n`
  );
}

/** ตั้งชื่อไฟล์ให้ปลอดภัยกับทุกระบบไฟล์ */
export function safeFileName(text: string, fallback = "trip"): string {
  const cleaned = text
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-");
  return cleaned || fallback;
}
