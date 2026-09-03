"use client";

import { useId, useMemo } from "react";
import { PROVINCES, PROVINCE_BY_NAME } from "@/data/provinces";
import { TRANSPORTS } from "@/data/transport";
import { newId } from "@/lib/id";
import { legAllowsMetro, nextLegOrigin } from "@/lib/legs";
import { useTrip } from "@/lib/trip-context";
import type { TravelLeg } from "@/lib/types";
import { Button, Input, Select } from "./ui";

/**
 * แก้ช่วงการเดินทางของวันหนึ่ง
 *
 * วันเดียวมักใช้หลายวิธี เช่น บินลงเชียงใหม่ตอนเช้าแล้วเช่ารถขึ้นดอยอินทนนท์ต่อ
 * จึงเก็บเป็นรายการช่วงแทนวิธีเดินทางเดียวต่อวัน
 */
export function TravelLegsEditor({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch } = useTrip();
  const { trip, activities } = state;
  const listId = useId();

  const plan = trip.dayPlans[dayIndex];
  const legs = plan?.legs ?? [];

  /**
   * ตัวช่วยเติมชื่อสถานที่ — จังหวัดในแผน สถานที่แนะนำของจังหวัดวันนั้น
   * สถานที่ที่อยู่ในแผนแล้ว แล้วค่อยตามด้วยจังหวัดที่เหลือ
   */
  const options = useMemo(() => {
    const dayProvince = PROVINCE_BY_NAME.get(plan?.province ?? "");
    const names = [
      ...trip.provinces,
      ...(dayProvince?.places ?? []).map((place) => place.name),
      ...activities.map((a) => a.placeName.trim()).filter(Boolean),
      ...PROVINCES.map((p) => p.name),
    ];
    return [...new Set(names)].slice(0, 150);
  }, [trip.provinces, plan?.province, activities]);

  function commit(next: TravelLeg[]) {
    dispatch({ type: "setDayPlan", dayIndex, patch: { legs: next } });
  }

  function addLeg() {
    commit([
      ...legs,
      {
        id: newId(),
        // ต่อจากปลายทางของช่วงก่อน จะได้ไม่ต้องพิมพ์ซ้ำ
        from: nextLegOrigin(plan),
        to: "",
        transport: "",
        note: "",
      },
    ]);
  }

  function patchLeg(id: string, patch: Partial<TravelLeg>) {
    commit(legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));
  }

  function removeLeg(id: string) {
    commit(legs.filter((leg) => leg.id !== id));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= legs.length) return;
    const next = [...legs];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <div>
      <datalist id={listId}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {legs.length === 0 ? (
        <p className="mb-2 rounded-xl border border-dashed border-line px-3 py-3 text-sm text-muted">
          ยังไม่ได้ระบุการเดินทาง — เพิ่มได้ทีละช่วง เช่น กรุงเทพฯ → เชียงใหม่
          ด้วยเครื่องบิน แล้วต่อด้วย เชียงใหม่ → ดอยอินทนนท์ ด้วยรถยนต์
        </p>
      ) : (
        <ol className="mb-2 space-y-2">
          {legs.map((leg, index) => (
            <li
              key={leg.id}
              className="rounded-xl border border-line bg-card px-3 py-2.5"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-fill text-xs font-semibold text-canvas">
                  {index + 1}
                </span>
                <span className="flex-1 text-xs text-faint">
                  ช่วงที่ {index + 1}
                </span>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`เลื่อนช่วงที่ ${index + 1} ขึ้น`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`เลื่อนช่วงที่ ${index + 1} ลง`}
                    disabled={index === legs.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`ลบช่วงที่ ${index + 1}`}
                    onClick={() => removeLeg(leg.id)}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  list={listId}
                  value={leg.from}
                  onChange={(e) => patchLeg(leg.id, { from: e.target.value })}
                  placeholder="จาก"
                  aria-label={`ต้นทางของช่วงที่ ${index + 1}`}
                />
                <span className="shrink-0 text-muted" aria-hidden>
                  →
                </span>
                <Input
                  list={listId}
                  value={leg.to}
                  onChange={(e) => patchLeg(leg.id, { to: e.target.value })}
                  placeholder="ถึง"
                  aria-label={`ปลายทางของช่วงที่ ${index + 1}`}
                />
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Select
                  value={leg.transport}
                  onChange={(e) =>
                    patchLeg(leg.id, { transport: e.target.value })
                  }
                  aria-label={`วิธีเดินทางของช่วงที่ ${index + 1}`}
                >
                  <option value="">— เลือกวิธีเดินทาง —</option>
                  {TRANSPORTS.filter(
                    // รถไฟฟ้ามีเฉพาะ กทม. และปริมณฑล
                    (item) =>
                      item.id !== "metro" ||
                      legAllowsMetro(leg, plan?.province ?? ""),
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.emoji} {item.label}
                    </option>
                  ))}
                </Select>

                <Input
                  value={leg.note}
                  onChange={(e) => patchLeg(leg.id, { note: e.target.value })}
                  placeholder="เช่น TG104 09:30"
                  aria-label={`บันทึกของช่วงที่ ${index + 1}`}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button variant="secondary" size="sm" onClick={addLeg}>
        ➕ เพิ่มช่วงการเดินทาง
      </Button>
    </div>
  );
}
