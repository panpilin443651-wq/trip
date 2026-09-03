/**
 * ประมาณค่าน้ำมันจากระยะทางจริง
 *
 * ระยะทางมาจาก OSRM ผ่าน fetchRoute() ซึ่งเป็นระยะตามถนนจริง ไม่ใช่เส้นตรง
 * ถ้าเรียกไม่สำเร็จจะได้ค่าประมาณจากเส้นตรงคูณ 1.3 แทน ตัวเลขจึงยังใช้ได้อยู่
 * แต่ต้องบอกผู้ใช้ว่าเป็นค่าประมาณ
 */

export interface Vehicle {
  id: string;
  label: string;
  emoji: string;
  /** อัตราสิ้นเปลือง กม./ลิตร */
  kmPerLitre: number;
}

/**
 * อัตราสิ้นเปลืองโดยประมาณของรถที่คนไทยใช้เที่ยวบ่อย
 *
 * เป็นค่ากลาง ๆ ของการขับทางไกล ซึ่งกินน้ำมันน้อยกว่าขับในเมือง
 * ผู้ใช้แก้ตัวเลขเองได้ เพราะรถแต่ละคันต่างกันมาก
 */
export const VEHICLES: Vehicle[] = [
  { id: "eco", label: "อีโคคาร์", emoji: "🚗", kmPerLitre: 20 },
  { id: "sedan", label: "เก๋ง", emoji: "🚙", kmPerLitre: 15 },
  { id: "suv", label: "SUV", emoji: "🚐", kmPerLitre: 11 },
  { id: "pickup", label: "กระบะ", emoji: "🛻", kmPerLitre: 12 },
  { id: "van", label: "รถตู้", emoji: "🚌", kmPerLitre: 9 },
  { id: "motorcycle", label: "มอเตอร์ไซค์", emoji: "🏍️", kmPerLitre: 40 },
];

/**
 * ราคาน้ำมันตั้งต้น (บาท/ลิตร)
 *
 * ราคาจริงขึ้นลงทุกสัปดาห์ ตัวเลขนี้เป็นแค่ค่าเริ่มต้นให้ไม่ต้องกรอกจากศูนย์
 * ผู้ใช้ควรแก้ให้ตรงกับราคาหน้าปั๊มวันที่เดินทาง
 */
export const DEFAULT_FUEL_PRICE = 35;
export const DEFAULT_KM_PER_LITRE = 15;

export interface FuelEstimate {
  /** ระยะทางที่ใช้คิด (กม.) */
  distanceKm: number;
  litres: number;
  cost: number;
}

/**
 * คิดค่าน้ำมันจากระยะทาง
 *
 * @param distanceMetres ระยะทางรวมหน่วยเมตร (ตามที่ OSRM คืนมา)
 * @param roundTrip ขับกลับทางเดิมด้วยไหม — เส้นทางในแผนเป็นขาไปอย่างเดียว
 */
export function estimateFuel(
  distanceMetres: number,
  kmPerLitre: number,
  pricePerLitre: number,
  roundTrip: boolean,
): FuelEstimate {
  // กัน 0 และค่าติดลบที่หลุดมาจากช่องกรอก ไม่งั้นได้ Infinity หรือค่าติดลบ
  const rate = kmPerLitre > 0 ? kmPerLitre : DEFAULT_KM_PER_LITRE;
  const price = pricePerLitre > 0 ? pricePerLitre : DEFAULT_FUEL_PRICE;

  const distanceKm = (Math.max(0, distanceMetres) / 1000) * (roundTrip ? 2 : 1);
  const litres = distanceKm / rate;

  return { distanceKm, litres, cost: litres * price };
}

/** ทริปนี้มีช่วงไหนขับรถเองไหม — ใช้ตัดสินว่าจะโชว์ตัวคิดค่าน้ำมันหรือเปล่า */
const DRIVING = new Set(["car", "motorcycle", "van"]);

export function isDriving(transportId: string | undefined): boolean {
  return !!transportId && DRIVING.has(transportId);
}
