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

/** หมุดหมายเลขวาดด้วย HTML แทนรูป PNG ของ Leaflet ที่พาธมักหลุดตอน build */
function numberedIcon(index: number) {
  return L.divIcon({
    className: "trip-pin",
    html: `<div style="
      width:30px;height:30px;border-radius:9999px;
      background:#af4c72;color:#fff;
      display:flex;align-items:center;justify-content:center;
      font:600 13px/1 system-ui,sans-serif;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);
    ">${index + 1}</div>`,
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
}: {
  points: MapPoint[];
  geometry: Array<[number, number]>;
  center: { lat: number; lng: number };
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
          pathOptions={{ color: "#af4c72", weight: 4, opacity: 0.75 }}
        />
      ) : null}

      {points.map((point, index) => (
        <Marker
          key={point.activity.id}
          position={[point.lat, point.lng]}
          icon={numberedIcon(index)}
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
          </Popup>
        </Marker>
      ))}

      <FitBounds points={points} />
    </MapContainer>
  );
}
