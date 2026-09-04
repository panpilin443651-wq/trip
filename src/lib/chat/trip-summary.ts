import { CATEGORY_MAP } from "@/data/categories";
import { transportOf } from "@/data/transport";
import { buildBreakdown } from "@/lib/budget";
import { addDaysISO, addMinutesToTime, formatDateThai } from "@/lib/format";
import { formatRoute } from "@/lib/legs";
import type { AppState } from "@/lib/types";

/**
 * แปลงข้อมูลทริปเป็นข้อความให้โมเดลอ่าน
 *
 * ตัดสิ่งที่ไม่ช่วยตอบคำถามออก — พาธรูป พิกัด lat/lng และ id ทั้งหมด
 * เพราะกินที่และไม่มีคำถามไหนต้องใช้ ยิ่งข้อความสั้นโมเดลยิ่งตอบตรง
 * และข้อมูลก้อนนี้ถูกส่งออกไปที่ Google ทุกครั้งที่ถาม จึงส่งเท่าที่จำเป็น
 */

/** กันทริปยาว ๆ ทำ prompt บวม ตัดที่ราวหนึ่งหมื่นตัวอักษร */
const MAX_CHARS = 8000;

export function summarizeTrip(state: AppState): string {
  const { trip, activities } = state;
  const breakdown = buildBreakdown(state);
  const lines: string[] = [];

  const lastDate = addDaysISO(trip.startDate, Math.max(0, trip.dayCount - 1));
  lines.push(`ชื่อทริป: ${trip.name || "ยังไม่ได้ตั้งชื่อ"}`);
  lines.push(
    `จังหวัด: ${trip.provinces.length > 0 ? trip.provinces.join(" → ") : "ยังไม่ได้เลือก"}`,
  );
  lines.push(
    `ช่วงวันที่: ${
      trip.dayCount === 1
        ? formatDateThai(trip.startDate)
        : `${formatDateThai(trip.startDate, false)} – ${formatDateThai(lastDate, false)}`
    } (${trip.dayCount} วัน)`,
  );
  lines.push(`จำนวนผู้เดินทาง: ${trip.travelers} คน`);
  // เก็บเป็น id เช่น "plane" ต้องแปลงเป็นชื่อไทยก่อน ไม่งั้นโมเดลตอบทับศัพท์
  const mainTransport = transportOf(trip.mainTransport);
  if (mainTransport) lines.push(`วิธีเดินทางหลัก: ${mainTransport.label}`);
  if (trip.notes.trim()) lines.push(`บันทึกทริป: ${trip.notes.trim()}`);

  lines.push("");
  lines.push("## งบประมาณ (บาท)");
  lines.push(
    `งบรวมที่ตั้งไว้ ${breakdown.totalBudget} · ใช้ไปแล้ว ${breakdown.totalSpent} · ` +
      (breakdown.remaining >= 0
        ? `เหลือ ${breakdown.remaining}`
        : `เกินงบ ${Math.abs(breakdown.remaining)}`),
  );
  for (const row of breakdown.byCategory) {
    if (row.budget === 0 && row.spent === 0) continue;
    lines.push(
      `- ${CATEGORY_MAP[row.id].label}: ตั้งไว้ ${row.budget} ใช้ไป ${row.spent}`,
    );
  }
  if (trip.budgetNote.trim()) lines.push(`บันทึกเรื่องงบ: ${trip.budgetNote.trim()}`);

  lines.push("");
  lines.push("## แผนรายวัน");
  for (let day = 0; day < trip.dayCount; day += 1) {
    const plan = trip.dayPlans[day];
    const route = formatRoute(plan);
    const header = [
      `วันที่ ${day + 1} (${formatDateThai(addDaysISO(trip.startDate, day), false)})`,
      plan?.province ? `จังหวัด ${plan.province}` : null,
      route ? `เส้นทาง ${route}` : null,
      plan?.note?.trim() ? `บันทึก ${plan.note.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(header);

    const dayActivities = activities
      .filter((a) => a.dayIndex === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.order - b.order);

    if (dayActivities.length === 0) {
      lines.push("  (ยังไม่มีกิจกรรม)");
      continue;
    }
    for (const a of dayActivities) {
      const end = addMinutesToTime(a.startTime, a.durationMin);
      const doing = a.activities ?? [];
      const bits = [
        `  ${a.startTime}–${end} ${a.placeName || a.title}`,
        // ที่เดียวทำได้หลายอย่าง ส่งไปให้ครบ ไม่งั้นถามว่าวันนี้ทำอะไรบ้าง
        // แล้วจะตอบได้แค่กิจกรรมแรก
        doing.length > 0 ? `ทำ ${doing.join(", ")}` : null,
        `หมวด ${CATEGORY_MAP[a.category].label}`,
        `ค่าใช้จ่าย ${a.cost}`,
      ].filter(Boolean);
      lines.push(bits.join(" · "));
    }
  }

  const text = lines.join("\n");
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS)}\n…(ตัดข้อมูลส่วนที่เหลือออกเพราะยาวเกิน)`
    : text;
}
