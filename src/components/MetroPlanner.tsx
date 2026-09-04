"use client";

import { useMemo, useState } from "react";
import { METRO_LINES } from "@/data/metro";
import { cn } from "@/lib/cn";
import { findMetroRoute, STATION_OPTIONS } from "@/lib/metro-route";
import { Button, Field, Select } from "./ui";

/**
 * แนะนำเส้นทาง BTS/MRT ระหว่างสองสถานี
 * แสดงเมื่อผู้ใช้เลือกวิธีเดินทางเป็นรถไฟฟ้า
 */
export function MetroPlanner() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showLines, setShowLines] = useState(false);

  const route = useMemo(
    () => (from && to ? findMetroRoute(from, to) : null),
    [from, to],
  );

  const sameStation = from !== "" && from === to;

  return (
    <div className="mt-3 rounded-xl border border-line bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">🚇 แนะนำเส้นทางรถไฟฟ้า</h3>
        <button
          type="button"
          onClick={() => setShowLines((v) => !v)}
          className="text-xs text-brand underline"
        >
          {showLines ? "ซ่อนรายชื่อสาย" : `ดูทั้ง ${METRO_LINES.length} สาย`}
        </button>
      </div>

      {showLines ? (
        <ul className="mb-3 space-y-1.5">
          {METRO_LINES.map((line) => (
            <li key={line.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: line.color }}
                aria-hidden
              />
              <span className="font-medium">{line.name}</span>
              <span className="text-faint">
                {line.stations.length} สถานี • {line.stations[0].name} –{" "}
                {line.stations.at(-1)?.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ขึ้นที่สถานี">
          <Select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">— เลือกสถานี —</option>
            {STATION_OPTIONS.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
                {option.lines.length > 1 ? " (เปลี่ยนสายได้)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ลงที่สถานี">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— เลือกสถานี —</option>
            {STATION_OPTIONS.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name}
                {option.lines.length > 1 ? " (เปลี่ยนสายได้)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {from && to ? (
        <div className="mt-3">
          {sameStation ? (
            <p className="text-sm text-muted">
              ต้นทางกับปลายทางเป็นสถานีเดียวกัน
            </p>
          ) : route ? (
            <>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">
                  🚉 {route.stops} สถานี
                </span>
                <span className="text-muted">
                  🔄 เปลี่ยนสาย {route.transfers} ครั้ง
                </span>
                <span className="text-muted">~{route.minutes} นาที</span>
              </div>

              <ol className="space-y-2">
                {route.legs.map((leg, index) => (
                  <li
                    key={`${leg.line.id}-${index}`}
                    className="flex gap-2.5 rounded-lg bg-canvas px-3 py-2"
                  >
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: leg.line.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{leg.line.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {leg.stations[0]} → {leg.stations.at(-1)} (
                        {leg.stations.length - 1} สถานี)
                      </p>
                      {route.transferAt[index] ? (
                        <p className="mt-1 text-xs text-accent">
                          ↳ เปลี่ยนสายที่ {route.transferAt[index]}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>

              <p
                className={cn(
                  "mt-2.5 text-xs leading-relaxed text-faint",
                )}
              >
                เวลาเป็นค่าประมาณ (สถานีละ 2 นาที เปลี่ยนสายละ 6 นาที)
                ไม่รวมเวลารอขบวนและซื้อตั๋ว
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              ไม่พบเส้นทางเชื่อมระหว่างสองสถานีนี้ในข้อมูลที่มี
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">
          เลือกสถานีต้นทางและปลายทางเพื่อดูเส้นทางและจำนวนครั้งที่ต้องเปลี่ยนสาย
        </p>
      )}

      {from && to && route ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇄ สลับต้นทาง-ปลายทาง
        </Button>
      ) : null}
    </div>
  );
}
