import { METRO_LINES, type MetroLine, type MetroStation } from "@/data/metro";
import { haversine } from "./geo";

/**
 * ค้นเส้นทางรถไฟฟ้ากรุงเทพฯ และปริมณฑล
 *
 * จุดเปลี่ยนสายหาจาก "ระยะทาง" ไม่ใช่ชื่อ เพราะสถานีเดียวกันมักคนละชื่อ
 * ข้ามระบบ เช่น อโศก (BTS) กับ สุขุมวิท (MRT) หรือ ศาลาแดง กับ สีลม
 */

/** ค่าเฉลี่ยคร่าว ๆ สำหรับประมาณเวลา */
const MINUTES_PER_STOP = 2;
const MINUTES_PER_TRANSFER = 6;

/**
 * ระยะที่ถือว่าเดินเชื่อมกันได้
 * 350 ม. ให้จุดเปลี่ยนสายที่ถูกต้องทั้งหมดโดยไม่มีคู่ผิด
 * ถ้าขยายถึง 700 ม. จะได้คู่ที่เดินเชื่อมกันไม่ได้จริงติดมาด้วย
 * เช่น ราชเทวี–สนามกีฬาแห่งชาติ หรือ ศาลาแดง–สามย่าน
 */
const TRANSFER_METRES = 350;

/**
 * จุดเปลี่ยนสายที่ไกลกว่าเกณฑ์แต่เดินเชื่อมกันได้จริง
 * ต้องระบุเองเพราะระยะเส้นตรงไม่สะท้อนทางเดินเชื่อมที่มีอยู่
 */
const EXTRA_TRANSFERS: Array<[string, string]> = [
  ["ห้าแยกลาดพร้าว", "พหลโยธิน"],
];

export interface StationRef {
  key: string;
  name: string;
  line: MetroLine;
  station: MetroStation;
}

/** สถานีทุกแห่งแบบแยกตามสาย (สถานีเปลี่ยนสายจะปรากฏหลายครั้ง) */
const ALL: StationRef[] = METRO_LINES.flatMap((line) =>
  line.stations.map((station) => ({
    key: `${line.id}|${station.name}`,
    name: station.name,
    line,
    station,
  })),
);

/** ชื่อสถานีแบบไม่ซ้ำ สำหรับให้ผู้ใช้เลือก */
export interface StationOption {
  name: string;
  lines: MetroLine[];
}

export const STATION_OPTIONS: StationOption[] = (() => {
  const map = new Map<string, MetroLine[]>();
  for (const ref of ALL) {
    const list = map.get(ref.name) ?? [];
    if (!list.includes(ref.line)) list.push(ref.line);
    map.set(ref.name, list);
  }
  return [...map.entries()]
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
})();

/** key -> รายการ key ที่เดินเปลี่ยนสายถึงกันได้ */
const TRANSFERS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    map.set(a, [...(map.get(a) ?? []), b]);
    map.set(b, [...(map.get(b) ?? []), a]);
  };

  for (let i = 0; i < ALL.length; i += 1) {
    for (let j = i + 1; j < ALL.length; j += 1) {
      const a = ALL[i];
      const b = ALL[j];
      if (a.line.id === b.line.id) continue;

      const near = haversine(a.station, b.station) <= TRANSFER_METRES;
      const listed = EXTRA_TRANSFERS.some(
        ([x, y]) =>
          (a.name === x && b.name === y) || (a.name === y && b.name === x),
      );
      if (near || listed) link(a.key, b.key);
    }
  }
  return map;
})();

export interface RouteLeg {
  line: MetroLine;
  /** สถานีที่นั่งบนสายนี้ เรียงจากขึ้นถึงลง */
  stations: string[];
}

export interface MetroRoute {
  legs: RouteLeg[];
  /** จำนวนสถานีที่นั่ง ไม่รวมสถานีต้นทาง */
  stops: number;
  transfers: number;
  /** เวลาโดยประมาณ (นาที) */
  minutes: number;
  /** ชื่อสถานีที่ต้องเดินเปลี่ยน เช่น ["อโศก → สุขุมวิท"] */
  transferAt: string[];
}

/** ทุก key ของสถานีชื่อนี้ (สถานีเปลี่ยนสายมีหลาย key) */
function keysOf(name: string): string[] {
  return ALL.filter((r) => r.name === name).map((r) => r.key);
}

function refOf(key: string): StationRef | undefined {
  return ALL.find((r) => r.key === key);
}

/** สถานีถัดไป-ก่อนหน้าบนสายเดียวกัน */
function alongLine(key: string): string[] {
  const ref = refOf(key);
  if (!ref) return [];
  const index = ref.line.stations.findIndex((s) => s.name === ref.station.name);
  return [ref.line.stations[index - 1], ref.line.stations[index + 1]]
    .filter((s): s is MetroStation => s !== undefined)
    .map((s) => `${ref.line.id}|${s.name}`);
}

export function findMetroRoute(
  fromName: string,
  toName: string,
): MetroRoute | null {
  if (!fromName || !toName || fromName === toName) return null;

  const starts = keysOf(fromName);
  const goals = new Set(keysOf(toName));
  if (starts.length === 0 || goals.size === 0) return null;

  // Dijkstra อย่างง่าย จำนวนสถานีหลักร้อย ไม่ต้องใช้ heap
  const cost = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue: Array<{ key: string; cost: number }> = starts.map((key) => ({
    key,
    cost: 0,
  }));
  for (const key of starts) cost.set(key, 0);

  let goal: string | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift() as { key: string; cost: number };
    if ((cost.get(current.key) ?? Infinity) < current.cost) continue;

    if (goals.has(current.key)) {
      goal = current.key;
      break;
    }

    const moves: Array<[string, number]> = [
      ...alongLine(current.key).map(
        (k) => [k, MINUTES_PER_STOP] as [string, number],
      ),
      ...(TRANSFERS.get(current.key) ?? []).map(
        (k) => [k, MINUTES_PER_TRANSFER] as [string, number],
      ),
    ];

    for (const [next, weight] of moves) {
      const candidate = current.cost + weight;
      if (candidate < (cost.get(next) ?? Infinity)) {
        cost.set(next, candidate);
        prev.set(next, current.key);
        queue.push({ key: next, cost: candidate });
      }
    }
  }

  if (!goal) return null;

  // ไล่ย้อนเส้นทาง
  const path: string[] = [];
  for (let at: string | undefined = goal; at; at = prev.get(at)) {
    path.unshift(at);
  }

  // แบ่งเป็นช่วงตามสาย
  const legs: RouteLeg[] = [];
  const transferAt: string[] = [];

  for (const key of path) {
    const ref = refOf(key);
    if (!ref) continue;
    const last = legs.at(-1);
    if (last && last.line.id === ref.line.id) {
      if (last.stations.at(-1) !== ref.name) last.stations.push(ref.name);
      continue;
    }
    if (last) {
      const off = last.stations.at(-1);
      transferAt.push(off === ref.name ? ref.name : `${off} → ${ref.name}`);
    }
    legs.push({ line: ref.line, stations: [ref.name] });
  }

  // ตัดช่วงที่ไม่ได้นั่งจริง (แตะสายเดียวแล้วเปลี่ยนต่อทันที)
  const realLegs = legs.filter((leg) => leg.stations.length > 1);
  if (realLegs.length === 0) return null;

  const stops = realLegs.reduce((sum, leg) => sum + leg.stations.length - 1, 0);
  const transfers = realLegs.length - 1;

  return {
    legs: realLegs,
    stops,
    transfers,
    minutes: stops * MINUTES_PER_STOP + transfers * MINUTES_PER_TRANSFER,
    transferAt: transferAt.slice(0, transfers),
  };
}
