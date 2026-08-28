import { AVG_SPEED_KMH, ROAD_FACTOR, haversine } from "./geo";
import type { LatLng } from "./types";

/**
 * จัดลำดับจุดแวะใหม่ให้เดินทางสั้นที่สุด
 *
 * ใช้ nearest neighbour หาคำตอบตั้งต้น แล้วขัดด้วย 2-opt
 * ไม่ใช่คำตอบที่ดีที่สุดเสมอไป (TSP หาคำตอบที่ดีที่สุดแบบเป๊ะ ๆ ไม่คุ้ม)
 * แต่ในทางปฏิบัติได้ผลดีมากสำหรับจุดแวะระดับ 5-15 จุดต่อวัน
 *
 * ตรึงจุดแรกไว้เสมอ เพราะมักเป็นที่พักหรือจุดนัดพบซึ่งเปลี่ยนไม่ได้
 */

/** ระยะทางประมาณระหว่างสองจุด (เมตร) — ใช้เส้นตรงคูณตัวชดเชยถนน */
function distance(a: LatLng, b: LatLng): number {
  return haversine(a, b) * ROAD_FACTOR;
}

function totalDistance(points: LatLng[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    sum += distance(points[i], points[i + 1]);
  }
  return sum;
}

/** เรียงลำดับดัชนีด้วย nearest neighbour โดยตรึงจุดแรก */
function nearestNeighbour(points: LatLng[]): number[] {
  const order = [0];
  const remaining = new Set(points.map((_, i) => i));
  remaining.delete(0);

  let current = 0;
  while (remaining.size > 0) {
    let best = -1;
    let bestDistance = Infinity;
    for (const candidate of remaining) {
      const d = distance(points[current], points[candidate]);
      if (d < bestDistance) {
        bestDistance = d;
        best = candidate;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = best;
  }
  return order;
}

/** สลับช่วงเส้นทางที่ตัดกันออก จนไม่มีอะไรดีขึ้นแล้ว */
function twoOpt(order: number[], points: LatLng[]): number[] {
  const at = (seq: number[]) => seq.map((i) => points[i]);
  let best = [...order];
  let bestDistance = totalDistance(at(best));
  let improved = true;
  let guard = 0;

  // กันวนไม่จบในกรณีพิกัดซ้ำกันจนระยะทางเท่ากันไปมา
  while (improved && guard < 60) {
    improved = false;
    guard += 1;

    // เริ่มที่ 1 เพราะตรึงจุดแรกไว้
    for (let i = 1; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const candidateDistance = totalDistance(at(candidate));
        if (candidateDistance < bestDistance - 1) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return best;
}

export interface OptimizeResult {
  /** ลำดับดัชนีใหม่ อ้างอิงจาก array ที่ส่งเข้ามา */
  order: number[];
  currentDistance: number;
  optimizedDistance: number;
  /** ระยะทางที่ประหยัดได้ (เมตร) — 0 หรือติดลบแปลว่าลำดับเดิมดีอยู่แล้ว */
  saved: number;
  /** ลำดับเปลี่ยนจริงหรือไม่ */
  changed: boolean;
}

export function optimizeOrder(points: LatLng[]): OptimizeResult {
  const currentDistance = totalDistance(points);

  if (points.length < 3) {
    // 2 จุดสลับยังไงระยะทางก็เท่าเดิม ไม่ต้องเสนอ
    return {
      order: points.map((_, i) => i),
      currentDistance,
      optimizedDistance: currentDistance,
      saved: 0,
      changed: false,
    };
  }

  const order = twoOpt(nearestNeighbour(points), points);
  const optimizedDistance = totalDistance(order.map((i) => points[i]));

  return {
    order,
    currentDistance,
    optimizedDistance,
    saved: currentDistance - optimizedDistance,
    changed: order.some((value, index) => value !== index),
  };
}

/** เวลาเดินทางโดยประมาณระหว่างสองจุด (นาที) */
export function travelMinutes(a: LatLng, b: LatLng): number {
  const km = distance(a, b) / 1000;
  return Math.round((km / AVG_SPEED_KMH) * 60);
}
