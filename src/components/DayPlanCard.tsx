"use client";

import { PROVINCES_BY_REGION } from "@/data/provinces";
import { TRANSPORTS, hasMetro, transportOf } from "@/data/transport";
import { MetroPlanner } from "./MetroPlanner";
import { cn } from "@/lib/cn";
import { useTrip } from "@/lib/trip-context";
import { Field, Input, Select } from "./ui";

/**
 * ระบุจังหวัดและวิธีเดินทางของวันนั้น
 *
 * จังหวัดที่เลือกไว้ในแพลนการเที่ยวจะขึ้นก่อน เพราะเป็นตัวเลือกที่ใช้จริง
 * แต่ยังเลือกจังหวัดอื่นได้ เผื่อแวะระหว่างทางโดยไม่ได้วางแผนไว้
 */
export function DayPlanCard({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch } = useTrip();
  const { trip } = state;

  const plan = trip.dayPlans[dayIndex] ?? {
    province: "",
    transport: "",
    note: "",
  };
  const transport = transportOf(plan.transport);

  // รถไฟฟ้ามีเฉพาะ กทม. และปริมณฑล ไม่ควรโผล่ให้เลือกในจังหวัดอื่น
  const metroAvailable = hasMetro(plan.province);
  const options = TRANSPORTS.filter(
    (item) => item.id !== "metro" || metroAvailable,
  );
  const showMetroPlanner = metroAvailable && plan.transport === "metro";

  function update(patch: Partial<typeof plan>) {
    dispatch({ type: "setDayPlan", dayIndex, patch });
  }

  function updateProvince(province: string) {
    // ย้ายไปจังหวัดที่ไม่มีรถไฟฟ้าแล้วยังค้างตัวเลือกไว้จะสับสน
    const dropMetro =
      plan.transport === "metro" && !hasMetro(province);
    update(dropMetro ? { province, transport: "" } : { province });
  }

  return (
    <div
      className={cn(
        "mb-4 rounded-2xl border p-4",
        plan.province || plan.transport
          ? "border-gold/35 bg-gold-soft"
          : "border-dashed border-line bg-card",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          🧳 วันนี้ไปไหน เดินทางยังไง
        </h2>
        {plan.province || transport ? (
          <span className="text-xs text-gold">
            {transport ? `${transport.emoji} ${transport.label}` : null}
            {plan.province && transport ? " • " : null}
            {plan.province}
          </span>
        ) : (
          <span className="text-xs text-faint">ยังไม่ได้ระบุ</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="จังหวัดของวันนี้">
          <Select
            value={plan.province}
            onChange={(e) => updateProvince(e.target.value)}
          >
            <option value="">— ยังไม่ระบุ —</option>

            {trip.provinces.length > 0 ? (
              <optgroup label="จังหวัดในแผนของคุณ">
                {trip.provinces.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ) : null}

            {PROVINCES_BY_REGION.map((group) => (
              <optgroup key={group.region} label={group.region}>
                {group.provinces
                  .filter((p) => !trip.provinces.includes(p.name))
                  .map((province) => (
                    <option key={province.id} value={province.name}>
                      {province.emoji} {province.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        <Field label="วิธีเดินทาง" hint={transport?.hint}>
          <Select
            value={plan.transport}
            onChange={(e) => update({ transport: e.target.value })}
          >
            <option value="">— ยังไม่ระบุ —</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.emoji} {item.label}
              </option>
            ))}
          </Select>
        </Field>

        {showMetroPlanner ? (
          <div className="sm:col-span-2">
            <MetroPlanner />
          </div>
        ) : null}

        <Field label="บันทึกการเดินทาง" className="sm:col-span-2">
          <Input
            value={plan.note}
            onChange={(e) => update({ note: e.target.value })}
            placeholder="เช่น เที่ยวบิน TG104 09:30 / รถไฟขบวน 109 / เช่ารถที่สนามบิน"
          />
        </Field>
      </div>
    </div>
  );
}
