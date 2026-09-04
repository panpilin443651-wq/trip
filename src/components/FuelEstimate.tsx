"use client";

import { useEffect, useMemo, useState } from "react";
import { transportOf } from "@/data/transport";
import { formatDistance, hasCoords } from "@/lib/geo";
import { formatTHB } from "@/lib/format";
import {
  DEFAULT_FUEL_PRICE,
  DEFAULT_KM_PER_LITRE,
  VEHICLES,
  estimateFuel,
  isDriving,
} from "@/lib/fuel";
import { fetchRoute } from "@/lib/routing";
import { useTrip } from "@/lib/trip-context";
import { Button, Card, Field, NumberInput, SectionTitle, cn } from "./ui";

/** ระยะทางรวมทุกวัน พร้อมบอกว่าเป็นค่าประมาณหรือระยะถนนจริง */
interface Distance {
  metres: number;
  estimated: boolean;
  /** จำนวนจุดที่ยังไม่ได้ปักหมุด — ระยะทางจึงยังไม่ครบ */
  missing: number;
}

export function FuelEstimate() {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip } = state;

  /**
   * ทริปนี้ขับรถเองไหม — ดูทั้งวิธีเดินทางหลักและช่วงเดินทางรายวัน
   * เพราะบางทริปบินไปแล้วเช่ารถต่อ วิธีหลักจะเป็นเครื่องบิน
   */
  const driving = useMemo(() => {
    if (isDriving(trip.mainTransport)) return true;
    return trip.dayPlans.some((day) =>
      day.legs.some((leg) => isDriving(leg.transport)),
    );
  }, [trip.mainTransport, trip.dayPlans]);

  /** พิกัดของแต่ละวัน ทำเป็นสตริงเพื่อใช้เป็น key ของ effect ได้ */
  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    for (let day = 0; day < trip.dayCount; day += 1) {
      const coords = activitiesForDay(day)
        .filter(hasCoords)
        .map((a) => `${(a.lat as number).toFixed(5)},${(a.lng as number).toFixed(5)}`);
      if (coords.length >= 2) keys.push(coords.join(";"));
    }
    return keys;
  }, [trip.dayCount, activitiesForDay]);

  const missing = useMemo(() => {
    let n = 0;
    for (let day = 0; day < trip.dayCount; day += 1)
      n += activitiesForDay(day).filter((a) => !hasCoords(a)).length;
    return n;
  }, [trip.dayCount, activitiesForDay]);

  const routeKey = dayKeys.join("|");
  // ผูกผลลัพธ์กับชุดพิกัดที่ขอไป ผลเก่าจะถูกมองข้ามเองเมื่อ key ไม่ตรง
  const [result, setResult] = useState<{ key: string; value: Distance } | null>(
    null,
  );

  useEffect(() => {
    if (!driving || !routeKey) return;
    let cancelled = false;

    const days = routeKey.split("|").map((day) =>
      day.split(";").map((pair) => {
        const [lat, lng] = pair.split(",").map(Number);
        return { lat, lng };
      }),
    );

    Promise.all(days.map((points) => fetchRoute(points))).then((routes) => {
      if (cancelled) return;
      setResult({
        key: routeKey,
        value: {
          metres: routes.reduce((sum, r) => sum + r.totalDistance, 0),
          estimated: routes.some((r) => r.estimated),
          missing,
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [driving, routeKey, missing]);

  const distance = result?.key === routeKey ? result.value : null;
  const loading = !!routeKey && distance === null;

  const fuel = estimateFuel(
    distance?.metres ?? 0,
    trip.fuel.kmPerLitre,
    trip.fuel.pricePerLitre,
    trip.fuel.roundTrip,
  );

  function patchFuel(patch: Partial<typeof trip.fuel>) {
    dispatch({
      type: "updateTrip",
      patch: { fuel: { ...trip.fuel, ...patch } },
    });
  }

  const [added, setAdded] = useState(false);

  // ไม่ได้ขับรถก็ไม่ต้องรกหน้าจอ
  if (!driving) return null;

  const mainLabel = transportOf(trip.mainTransport)?.label;

  return (
    <Card as="section">
      <SectionTitle title="ค่าน้ำมันตามระยะทางจริง" />

      <p className="mb-3 text-sm text-muted">
        คิดจากระยะทางตามถนนจริงของทุกวันในแผนรวมกัน
        {mainLabel ? ` • เดินทางหลักด้วย${mainLabel}` : null}
      </p>

      {!routeKey ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn">
          ⚠️ ยังคำนวณไม่ได้ ต้องมีจุดแวะที่ปักหมุดแล้วอย่างน้อย 2 จุดในวันเดียวกัน
          ปักหมุดได้ที่หน้าตั้งค่าทริป
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-canvas px-2 py-3">
              <span className="block text-xs text-muted">ระยะทาง</span>
              <span className="mt-0.5 block font-semibold tabular-nums">
                {loading ? "…" : formatDistance(fuel.distanceKm * 1000)}
              </span>
            </div>
            <div className="rounded-xl bg-canvas px-2 py-3">
              <span className="block text-xs text-muted">น้ำมัน</span>
              <span className="mt-0.5 block font-semibold tabular-nums">
                {loading ? "…" : `${fuel.litres.toFixed(1)} ลิตร`}
              </span>
            </div>
            <div className="rounded-xl bg-brand-soft px-2 py-3">
              <span className="block text-xs text-muted">ค่าน้ำมัน</span>
              <span className="mt-0.5 block font-semibold text-brand tabular-nums">
                {loading ? "…" : formatTHB(fuel.cost)}
              </span>
            </div>
          </div>

          {distance?.estimated ? (
            <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs leading-relaxed text-warn">
              ⚠️ เรียกบริการเส้นทางไม่สำเร็จ ระยะทางนี้ประมาณจากเส้นตรงคูณ 1.3
            </p>
          ) : null}

          {distance && distance.missing > 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-faint">
              ยังมีอีก {distance.missing} จุดที่ไม่ได้ปักหมุด
              ระยะทางจริงจะมากกว่านี้
            </p>
          ) : null}
        </>
      )}

      <div className="mt-4">
        <span className="mb-2 block text-sm font-medium">เลือกประเภทรถ</span>
        <div className="grid grid-cols-3 gap-2">
          {VEHICLES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => patchFuel({ kmPerLitre: v.kmPerLitre })}
              aria-pressed={trip.fuel.kmPerLitre === v.kmPerLitre}
              className={cn(
                "min-h-14 rounded-xl border px-2 py-2 text-center text-sm transition-colors",
                trip.fuel.kmPerLitre === v.kmPerLitre
                  ? "border-pick bg-pick-soft"
                  : "border-line bg-card hover:bg-brand-soft",
              )}
            >
              <span className="block leading-none" aria-hidden>
                {v.emoji}
              </span>
              <span className="mt-1 block">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="อัตราสิ้นเปลือง (กม./ลิตร)">
          <NumberInput
            step={1}
            value={trip.fuel.kmPerLitre}
            onValueChange={(kmPerLitre) =>
              patchFuel({ kmPerLitre: kmPerLitre || DEFAULT_KM_PER_LITRE })
            }
          />
        </Field>
        <Field label="ราคาน้ำมัน (บาท/ลิตร)" hint="ใส่ราคาหน้าปั๊มวันที่จะไป">
          <NumberInput
            step={1}
            value={trip.fuel.pricePerLitre}
            onValueChange={(pricePerLitre) =>
              patchFuel({ pricePerLitre: pricePerLitre || DEFAULT_FUEL_PRICE })
            }
          />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={trip.fuel.roundTrip}
          onChange={(e) => patchFuel({ roundTrip: e.target.checked })}
          className="h-5 w-5 accent-[var(--color-brand)]"
        />
        คิดขากลับด้วย (คูณ 2)
      </label>

      <Button
        className="mt-4 w-full"
        disabled={loading || fuel.cost <= 0}
        onClick={() => {
          dispatch({
            type: "addExpense",
            expense: {
              label: `ค่าน้ำมัน ${fuel.distanceKm.toFixed(0)} กม.`,
              amount: Math.round(fuel.cost),
              category: "transport",
            },
          });
          setAdded(true);
          window.setTimeout(() => setAdded(false), 3000);
        }}
      >
        ➕ เพิ่มเป็นค่าใช้จ่ายหมวดเดินทาง
      </Button>

      {added ? (
        <p role="status" className="mt-2.5 text-sm text-ok">
          ✓ เพิ่มค่าน้ำมันเข้างบหมวดเดินทางแล้ว
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-faint">
        ⚠️ ไม่รวมค่าทางด่วนและค่าจอดรถ และคิดเฉพาะระยะระหว่างจุดแวะในแผน
        ยังไม่รวมระยะจากบ้านไปจังหวัดปลายทาง
      </p>
    </Card>
  );
}
