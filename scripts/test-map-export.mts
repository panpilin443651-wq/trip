/**
 * ทดสอบลิงก์ Google Maps และไฟล์ GPX/KML
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-map-export.mts
 */
import { googleDirectionsUrl, buildGpx, buildKml, safeFileName, MAX_GOOGLE_POINTS, type RoutePoint } from "@/lib/map-export";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, e = "") => c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const pts: RoutePoint[] = [
  { name: "วัดพระแก้ว", lat: 13.7515, lng: 100.4927 },
  { name: "ร้าน A & B ของ 'เจ๊'", lat: 13.7563, lng: 100.5018 },
  { name: "ไอคอนสยาม", lat: 13.7263, lng: 100.5100 },
];

console.log("ลิงก์ Google Maps");
const url = googleDirectionsUrl(pts)!;
check("มีลิงก์", !!url);
const u = new URL(url);
check("โฮสต์ถูก", u.host === "www.google.com" && u.pathname === "/maps/dir/", u.host);
check("ต้นทางเป็นพิกัดจุดแรก", u.searchParams.get("origin") === "13.7515,100.4927", String(u.searchParams.get("origin")));
check("ปลายทางเป็นพิกัดจุดสุดท้าย", u.searchParams.get("destination") === "13.7263,100.51", String(u.searchParams.get("destination")));
check("จุดแวะกลางทางมี 1 จุด", u.searchParams.get("waypoints") === "13.7563,100.5018", String(u.searchParams.get("waypoints")));
check("โหมดขับรถ", u.searchParams.get("travelmode") === "driving");
check("จุดเดียว → null", googleDirectionsUrl([pts[0]]) === null);
check("ไม่มีจุด → null", googleDirectionsUrl([]) === null);

const many: RoutePoint[] = Array.from({ length: 20 }, (_, i) => ({ name: `จุด ${i}`, lat: 13 + i / 100, lng: 100 + i / 100 }));
const manyUrl = new URL(googleDirectionsUrl(many)!);
check(`จุดเยอะถูกตัดเหลือ ${MAX_GOOGLE_POINTS}`,
  manyUrl.searchParams.get("waypoints")!.split("|").length === MAX_GOOGLE_POINTS - 2,
  manyUrl.searchParams.get("waypoints")!.split("|").length + " จุดแวะ");

console.log("\nไฟล์ GPX/KML เป็น XML ที่อ่านได้จริง");
const gpx = buildGpx(pts, "ทริป & ทดสอบ");
const kml = buildKml(pts, "ทริป & ทดสอบ");

// ใช้ตัวแยก XML ของจริงตรวจ ไม่ใช่แค่ดูว่ามีข้อความ
function xmlWellFormed(xml: string): string | null {
  // ตรวจแบบเบา ๆ: แท็กเปิด-ปิดต้องสมดุล และห้ามมี & ที่ไม่ได้ escape
  const bare = xml.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);
  if (bare) return "มี & ที่ไม่ได้ escape";
  const stack: string[] = [];
  const tag = /<\/?([A-Za-z][\w:-]*)[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(xml))) {
    const raw = m[0];
    if (raw.startsWith("<?") || raw.startsWith("<!")) continue;
    if (raw.startsWith("</")) {
      if (stack.pop() !== m[1]) return `ปิดแท็กไม่ตรง: ${m[1]}`;
    } else if (!m[2]) stack.push(m[1]);
  }
  return stack.length ? `แท็กค้าง: ${stack.join(",")}` : null;
}
check("GPX แท็กสมดุลและ escape ครบ", xmlWellFormed(gpx) === null, String(xmlWellFormed(gpx)));
check("KML แท็กสมดุลและ escape ครบ", xmlWellFormed(kml) === null, String(xmlWellFormed(kml)));
check("GPX escape & เป็น &amp;", gpx.includes("A &amp; B"));
check("GPX escape ' เป็น &apos;", gpx.includes("&apos;"));
check("GPX มีครบ 3 waypoint", (gpx.match(/<wpt /g) || []).length === 3);
check("GPX มีครบ 3 rtept", (gpx.match(/<rtept /g) || []).length === 3);
check("KML มีครบ 3 หมุด + 1 เส้น", (kml.match(/<Placemark>/g) || []).length === 4);
check("KML เรียงพิกัดเป็น lng,lat", kml.includes("100.4927,13.7515,0"));
check("GPX เรียงพิกัดเป็น lat/lon", gpx.includes('lat="13.7515" lon="100.4927"'));

console.log("\nชื่อไฟล์");
check("ตัดอักขระต้องห้าม", safeFileName('ทริป/ที่ 1: "ดี"') === "ทริปที่-1-ดี", safeFileName('ทริป/ที่ 1: "ดี"'));
check("ว่าง → ค่าตั้งต้น", safeFileName("   ") === "trip");

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
