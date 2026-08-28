import { hasMetro, transportOf, type TransportMeta } from "@/data/transport";
import type { DayPlan, TravelLeg } from "./types";

/** ช่วงที่กรอกอะไรมาบ้างแล้ว ช่วงเปล่า ๆ ไม่ต้องเอาไปแสดง */
export function filledLegs(plan: DayPlan | undefined): TravelLeg[] {
  return (plan?.legs ?? []).filter(
    (leg) => leg.from.trim() || leg.to.trim() || leg.transport,
  );
}

/** วิธีเดินทางที่ใช้ในวันนั้น ไม่ซ้ำ เรียงตามลำดับที่เดินทาง */
export function legTransports(plan: DayPlan | undefined): TransportMeta[] {
  const seen = new Set<string>();
  const list: TransportMeta[] = [];
  for (const leg of plan?.legs ?? []) {
    const meta = transportOf(leg.transport);
    if (meta && !seen.has(meta.id)) {
      seen.add(meta.id);
      list.push(meta);
    }
  }
  return list;
}

/**
 * ต่อเป็นสายเดียว เช่น "กรุงเทพฯ ✈️ เชียงใหม่ 🚗 ดอยอินทนนท์"
 *
 * ถ้าปลายทางของช่วงก่อนตรงกับต้นทางของช่วงถัดไป จะไม่พิมพ์ชื่อซ้ำ
 * คืนสตริงว่างเมื่อยังไม่ได้กรอกอะไรเลย
 */
export function formatRoute(plan: DayPlan | undefined): string {
  const legs = filledLegs(plan);
  if (legs.length === 0) return "";

  const parts: string[] = [];
  for (const leg of legs) {
    const from = leg.from.trim();
    const to = leg.to.trim();
    const meta = transportOf(leg.transport);
    const arrow = meta ? meta.emoji : "→";

    // ต้นทางซ้ำกับปลายทางของช่วงก่อน ไม่ต้องพิมพ์ใหม่
    if (from && parts.at(-1) !== from) parts.push(from);
    parts.push(arrow);
    if (to) parts.push(to);
  }
  return parts.join(" ");
}

/**
 * ควรโชว์ตัวเลือกรถไฟฟ้าในช่วงนี้หรือไม่
 * ดูทั้งต้นทาง ปลายทาง และจังหวัดของวัน เพราะช่วงหนึ่งอาจข้ามจังหวัด
 * เช่น กรุงเทพฯ → นนทบุรี ซึ่งนั่ง MRT ได้
 */
export function legAllowsMetro(
  leg: Pick<TravelLeg, "from" | "to">,
  dayProvince: string,
): boolean {
  return (
    hasMetro(leg.from) ||
    hasMetro(leg.to) ||
    hasMetro(dayProvince) ||
    // ยังไม่กรอกต้นทาง-ปลายทาง ให้ยึดจังหวัดของวันเป็นหลัก
    (!leg.from.trim() && !leg.to.trim() && hasMetro(dayProvince))
  );
}

/** วันนั้นมีช่วงที่นั่งรถไฟฟ้าไหม ใช้ตัดสินว่าจะโชว์ตัวช่วยหาเส้นทาง BTS/MRT */
export function hasMetroLeg(plan: DayPlan | undefined): boolean {
  return (plan?.legs ?? []).some((leg) => leg.transport === "metro");
}

/** ช่วงถัดไปควรเริ่มจากที่ไหน — ต่อจากปลายทางของช่วงล่าสุด */
export function nextLegOrigin(plan: DayPlan | undefined): string {
  const legs = plan?.legs ?? [];
  for (let i = legs.length - 1; i >= 0; i -= 1) {
    const to = legs[i].to.trim();
    if (to) return to;
  }
  return plan?.province ?? "";
}
