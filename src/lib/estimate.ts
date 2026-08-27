import { CATEGORIES } from "@/data/categories";
import type { CategoryId, Trip } from "./types";

export type TravelStyle = "budget" | "standard" | "comfort";

export interface TravelStyleMeta {
  id: TravelStyle;
  label: string;
  emoji: string;
  hint: string;
}

export const TRAVEL_STYLES: TravelStyleMeta[] = [
  {
    id: "budget",
    label: "ประหยัด",
    emoji: "🎒",
    hint: "โฮสเทล/เกสต์เฮาส์ ร้านข้างทาง รถสาธารณะ",
  },
  {
    id: "standard",
    label: "ปานกลาง",
    emoji: "🧳",
    hint: "โรงแรม 3 ดาว ร้านอาหารทั่วไป เช่ารถหรือแกร็บ",
  },
  {
    id: "comfort",
    label: "สบาย",
    emoji: "✨",
    hint: "โรงแรม 4 ดาวขึ้นไป ร้านอาหารดี ๆ รถส่วนตัว",
  },
];

/**
 * ฐานคิดของแต่ละหมวดต่างกัน จึงแยกหน่วยไว้ชัด ๆ
 * - ที่พักคิดต่อห้องต่อคืน (2 คน/ห้อง) และทริปวันเดียวไม่มีค่าที่พัก
 * - อาหาร/เดินทาง/ค่าเข้า/อื่น ๆ คิดต่อคนต่อวัน
 * - Shopping คิดต่อคนทั้งทริป เพราะไม่ได้ซื้อทุกวัน
 */
interface Rate {
  perRoomNight?: number;
  perPersonDay?: number;
  perPersonTrip?: number;
}

const RATES: Record<TravelStyle, Record<CategoryId, Rate>> = {
  budget: {
    transport: { perPersonDay: 300 },
    accommodation: { perRoomNight: 700 },
    food: { perPersonDay: 350 },
    attraction: { perPersonDay: 150 },
    shopping: { perPersonTrip: 500 },
    other: { perPersonDay: 100 },
  },
  standard: {
    transport: { perPersonDay: 500 },
    accommodation: { perRoomNight: 1600 },
    food: { perPersonDay: 700 },
    attraction: { perPersonDay: 300 },
    shopping: { perPersonTrip: 1500 },
    other: { perPersonDay: 200 },
  },
  comfort: {
    transport: { perPersonDay: 900 },
    accommodation: { perRoomNight: 3500 },
    food: { perPersonDay: 1400 },
    attraction: { perPersonDay: 500 },
    shopping: { perPersonTrip: 3000 },
    other: { perPersonDay: 400 },
  },
};

export interface EstimateLine {
  id: CategoryId;
  amount: number;
  /** ที่มาของตัวเลข เช่น "2 ห้อง × 2 คืน" */
  basis: string;
}

export interface Estimate {
  lines: EstimateLine[];
  total: number;
  perPerson: number;
  nights: number;
  rooms: number;
}

/** ปัดขึ้นหลักร้อยให้ตัวเลขอ่านง่าย ไม่ได้ตั้งใจให้แม่นถึงหลักบาท */
function roundUp100(value: number): number {
  return Math.ceil(value / 100) * 100;
}

export function estimateTrip(
  trip: Pick<Trip, "dayCount" | "travelers">,
  style: TravelStyle,
): Estimate {
  const days = Math.max(1, trip.dayCount);
  const travelers = Math.max(1, trip.travelers);
  const nights = Math.max(0, days - 1);
  const rooms = Math.ceil(travelers / 2);
  const rates = RATES[style];

  const lines: EstimateLine[] = CATEGORIES.map((category) => {
    const rate = rates[category.id];

    if (rate.perRoomNight !== undefined) {
      return {
        id: category.id,
        amount: roundUp100(rate.perRoomNight * rooms * nights),
        basis:
          nights === 0
            ? "ทริปวันเดียว ไม่มีค่าที่พัก"
            : `${rooms} ห้อง × ${nights} คืน`,
      };
    }

    if (rate.perPersonTrip !== undefined) {
      return {
        id: category.id,
        amount: roundUp100(rate.perPersonTrip * travelers),
        basis: `${travelers} คน (ทั้งทริป)`,
      };
    }

    return {
      id: category.id,
      amount: roundUp100((rate.perPersonDay ?? 0) * travelers * days),
      basis: `${travelers} คน × ${days} วัน`,
    };
  });

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return { lines, total, perPerson: total / travelers, nights, rooms };
}
