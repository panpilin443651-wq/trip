"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

/**
 * แผนที่เล็กของสถานที่เดียว ใช้ในหน้ารายละเอียด
 *
 * แยกจาก TripMap เพราะคนละงานกัน TripMap วาดหมุดหลายจุดพร้อมเส้นทางและต้อง
 * ขยับมุมมองตามรายการที่เปลี่ยนไป ส่วนตัวนี้แสดงจุดเดียวนิ่ง ๆ ไม่ต้องมีอะไรพวกนั้น
 *
 * ปิดการซูมด้วยลูกกลิ้งไว้ เพราะแผนที่อยู่กลางหน้าที่ต้องเลื่อนอ่าน
 * ถ้าเปิดไว้คนเลื่อนหน้าแล้วจะไปโดนซูมแผนที่แทน
 */
export default function PlaceMiniMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const icon = L.divIcon({
    className: "trip-pin",
    html:
      `<div style="width:26px;height:26px;border-radius:9999px;` +
      `background:#2ba3e3;border:2px solid #071b33;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-48 w-full rounded-2xl"
      aria-label={`แผนที่ ${label}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={icon} />
    </MapContainer>
  );
}
