"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { formatTHB } from "@/lib/format";
import type { Activity } from "@/lib/types";

export interface MapPoint {
  activity: Activity;
  lat: number;
  lng: number;
}

/**
 * หมุดหมายเลขวาดด้วย HTML แทนรูป PNG ของ Leaflet ที่พาธมักหลุดตอน build
 *
 * สีตรงนี้ก๊อปมาจาก @theme ใน globals.css เพราะ Leaflet รับเป็นสตริง HTML
 * อ่านตัวแปร CSS ไม่ได้ แก้ธีมเมื่อไหร่ต้องแก้ที่นี่ด้วย
 */
function numberedIcon(index: number, hasPhoto = false) {
  const badge = hasPhoto
    ? `<span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;
        border-radius:9999px;background:#f2f7fb;border:2px solid #071b33;
        font:600 8px/10px system-ui;text-align:center">📷</span>`
    : "";
  return L.divIcon({
    className: "trip-pin",
    html: `<div style="position:relative;
      width:30px;height:30px;border-radius:9999px;
      background:#2ba3e3;color:#071b33;
      display:flex;align-items:center;justify-content:center;
      font:600 13px/1 system-ui,sans-serif;
      border:2px solid #071b33;box-shadow:0 1px 4px rgba(0,0,0,.35);
    ">${index + 1}${badge}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

/** ขยับมุมมองให้ครอบคลุมทุกหมุดเมื่อรายการเปลี่ยน */
function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }

    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
      { padding: [40, 40], maxZoom: 15 },
    );
  }, [map, points]);

  return null;
}

export default function TripMap({
  points,
  geometry,
  center,
  photoUrls = {},
}: {
  points: MapPoint[];
  geometry: Array<[number, number]>;
  center: { lat: number; lng: number };
  /** พาธรูป -> signed URL (bucket เป็นแบบส่วนตัว จึงเปิดตรง ๆ ไม่ได้) */
  photoUrls?: Record<string, string>;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={11}
      scrollWheelZoom
      className="h-[60dvh] min-h-80 w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {geometry.length > 1 ? (
        <Polyline
          positions={geometry}
          pathOptions={{ color: "#1b8ac6", weight: 5, opacity: 0.9 }}
        />
      ) : null}

      {points.map((point, index) => (
        <Marker
          key={point.activity.id}
          position={[point.lat, point.lng]}
          icon={numberedIcon(index, (point.activity.photos?.length ?? 0) > 0)}
        >
          <Popup>
            <strong>{point.activity.title}</strong>
            <br />
            {point.activity.startTime} น.
            {point.activity.placeName ? (
              <>
                <br />
                📍 {point.activity.placeName}
              </>
            ) : null}
            {point.activity.cost > 0 ? (
              <>
                <br />
                💰 {formatTHB(point.activity.cost)}
              </>
            ) : null}

            {(point.activity.photos ?? []).length > 0 ? (
              <span style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {(point.activity.photos ?? []).slice(0, 3).map((path) =>
                  photoUrls[path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={path}
                      src={photoUrls[path]}
                      alt="รูปความทรงจำ"
                      style={{
                        width: 62,
                        height: 62,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : null,
                )}
              </span>
            ) : null}
          </Popup>
        </Marker>
      ))}

      <FitBounds points={points} />
    </MapContainer>
  );
}
