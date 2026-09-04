"use client";

import { hasMetro } from "@/data/transport";
import { cn } from "@/lib/cn";
import { formatRoute, hasMetroLeg } from "@/lib/legs";
import { useTrip } from "@/lib/trip-context";
import { MetroPlanner } from "./MetroPlanner";
import { ProvinceCombobox } from "./ProvinceCombobox";
import { TravelLegsEditor } from "./TravelLegsEditor";
import { Field, Input } from "./ui";

/**
 * ระบุจังหวัดและช่วงการเดินทางของวันนั้น
 *
 * การเดินทางแยกเป็นช่วง ๆ เพราะวันเดียวมักใช้หลายวิธี
 * เช่น บินลงเชียงใหม่แล้วเช่ารถขึ้นดอยอินทนนท์ต่อ
 */
export function DayPlanCard({ dayIndex }: { dayIndex: number }) {
  const { state, dispatch } = useTrip();
  const { trip } = state;

  const plan = trip.dayPlans[dayIndex] ?? {
    province: "",
    legs: [],
    note: "",
  };

  const route = formatRoute(plan);
  // ตัวช่วยหาเส้นทาง BTS/MRT ใช้ได้เฉพาะ กทม. และปริมณฑล
  const showMetroPlanner = hasMetroLeg(plan) && hasMetro(plan.province);

  function updateProvince(province: string) {
    dispatch({ type: "setDayPlan", dayIndex, patch: { province } });
  }

  return (
    <div
      className={cn(
        "mb-4 rounded-2xl border p-4",
        plan.province || route
          ? "border-accent/35 bg-accent-soft"
          : "border-dashed border-line bg-card",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">วันนี้ไปไหน เดินทางยังไง</h2>
        {plan.province || route ? (
          <span className="text-xs text-accent">
            {route || plan.province}
          </span>
        ) : (
          <span className="text-xs text-faint">ยังไม่ได้ระบุ</span>
        )}
      </div>

      <div className="space-y-3">
        <Field
          label="จังหวัดของวันนี้"
          hint="ใช้เป็นค่าเริ่มต้นของกิจกรรมที่เพิ่มในวันนี้ และใช้แนะนำสถานที่ใกล้เคียง"
        >
          <ProvinceCombobox
            value={plan.province}
            onChange={updateProvince}
            placeholder="พิมพ์ชื่อจังหวัด…"
            aria-label="จังหวัดของวันนี้"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-muted">
            การเดินทางของวันนี้
          </p>
          <TravelLegsEditor dayIndex={dayIndex} />
          <p className="mt-1 text-xs text-faint">
            แยกเป็นช่วง ๆ ได้ เช่น กรุงเทพฯ ✈️ เชียงใหม่ แล้วต่อ เชียงใหม่ 🚗
            ดอยอินทนนท์
          </p>
        </div>

        {showMetroPlanner ? <MetroPlanner /> : null}

        <Field label="บันทึกของวันนี้">
          <Input
            value={plan.note}
            onChange={(e) =>
              dispatch({
                type: "setDayPlan",
                dayIndex,
                patch: { note: e.target.value },
              })
            }
            placeholder="เช่น เช็กอินโรงแรมก่อนบ่ายสาม / นัดไกด์ 8 โมง"
          />
        </Field>
      </div>
    </div>
  );
}
