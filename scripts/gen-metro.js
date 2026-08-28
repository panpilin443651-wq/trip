/**
 * สร้าง src/data/metro.ts — โครงข่ายรถไฟฟ้ากรุงเทพฯ และปริมณฑล
 * ดึงจาก OpenStreetMap ผ่าน Overpass API
 *
 * ใช้: node scripts/gen-metro.js
 *
 * ดึงจาก OSM แทนการพิมพ์เอง เพราะสถานีมีเกือบ 200 แห่ง
 * พิมพ์มือมีโอกาสผิดสูงและอัปเดตยากเมื่อมีสายใหม่
 */
const fs = require("fs");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** เส้นทางที่ต้องการ: ชื่อใน OSM -> ข้อมูลที่จะใช้ในแอป */
const WANTED = [
  {
    match: "รถไฟฟ้าบีทีเอส สายสุขุมวิท (คูคต → เคหะ)",
    id: "bts-sukhumvit",
    name: "BTS สุขุมวิท",
    color: "#7ac143",
    system: "BTS",
  },
  {
    match: "รถไฟฟ้าบีทีเอส สายสีลม (สนามกีฬาแห่งชาติ → บางหว้า)",
    id: "bts-silom",
    name: "BTS สีลม",
    color: "#2e7d32",
    system: "BTS",
  },
  {
    match: "รถไฟฟ้าสายสีทอง (กรุงธนบุรี → คลองสาน)",
    id: "bts-gold",
    name: "BTS สายสีทอง",
    color: "#b8860b",
    system: "BTS",
  },
  {
    match: "รถไฟฟ้ามหานคร สายสีน้ำเงิน",
    id: "mrt-blue",
    name: "MRT สายสีน้ำเงิน",
    color: "#1e3a8a",
    system: "MRT",
  },
  {
    match: "รถไฟฟ้ามหานคร สายสีม่วง (คลองบางไผ่ → เตาปูน)",
    id: "mrt-purple",
    name: "MRT สายสีม่วง",
    color: "#7c3aed",
    system: "MRT",
  },
  {
    match: "รถไฟฟ้าสายสีเหลือง (ลาดพร้าว - สำโรง)",
    id: "mrt-yellow",
    name: "MRT สายสีเหลือง",
    color: "#eab308",
    system: "MRT",
  },
  {
    match: "รถไฟฟ้ามหานคร สายสีชมพู (ศูนย์ราชการนนทบุรี → มีนบุรี)",
    id: "mrt-pink",
    name: "MRT สายสีชมพู",
    color: "#ec4899",
    system: "MRT",
  },
];

/**
 * สถานีที่มีอยู่จริงใน OSM แต่ไม่ได้ถูกใส่เป็นสมาชิกของ route relation
 * ต้องเติมเอง ไม่งั้นเส้นทางจะขาดตอนและหาทางเปลี่ยนสายไม่เจอ
 * เช็กพิกัดจาก node ใน OSM โดยตรงก่อนใส่ทุกครั้ง
 */
const PATCHES = [
  {
    lineId: "bts-sukhumvit",
    after: "ห้าแยกลาดพร้าว",
    station: { name: "หมอชิต", lat: 13.8026, lng: 100.55379 },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, attempt = 0) {
  for (const host of MIRRORS) {
    try {
      const res = await fetch(host, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "travel-planner-data-build/1.0",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(180000),
      });
      const text = await res.text();
      if (text.trim().startsWith("{")) return JSON.parse(text);
      console.log("  ", host.split("/")[2], "->", res.status);
      // 429 = ยิงถี่เกินไป รอแล้วค่อยลองใหม่
      if (res.status === 429) await sleep(20000);
    } catch (e) {
      console.log("  ", host.split("/")[2], "ERR", e.message.slice(0, 50));
    }
  }
  if (attempt < 3) {
    console.log("   รอ 30 วินาทีแล้วลองใหม่ (ครั้งที่", attempt + 2, ")");
    await sleep(30000);
    return overpass(query, attempt + 1);
  }
  throw new Error("Overpass ใช้ไม่ได้ทุก mirror");
}

/** ชื่อสถานีสั้น ๆ ตัดคำว่า "สถานี" และวงเล็บออก */
function cleanName(name) {
  return name
    .replace(/^สถานี\s*/, "")
    .replace(/^BTS\s*/i, "")
    .replace(/^MRT\s*/i, "")
    .trim();
}

(async () => {
  console.log("ดึงเส้นทางรถไฟฟ้าจาก OSM…");
  const routes = await overpass(
    `[out:json][timeout:120];` +
      `relation["type"="route"]["route"~"^(subway|light_rail|monorail)$"]` +
      `(13.4,100.2,14.3,100.9);out tags;`,
  );

  const lines = [];

  for (const want of WANTED) {
    const rel = routes.elements.find((e) => e.tags?.name === want.match);
    if (!rel) {
      console.log("!! ไม่พบเส้นทาง:", want.match);
      continue;
    }

    // ดึงสมาชิกของ relation แบบเรียงลำดับ เอาเฉพาะป้ายสถานี
    const detail = await overpass(
      `[out:json][timeout:120];relation(${rel.id});out body;node(r);out body;`,
    );

    const nodes = new Map(
      detail.elements
        .filter((e) => e.type === "node")
        .map((e) => [e.id, e]),
    );
    const relation = detail.elements.find(
      (e) => e.type === "relation" && e.id === rel.id,
    );

    const stations = [];
    const seen = new Set();
    for (const member of relation.members ?? []) {
      if (member.type !== "node") continue;
      const node = nodes.get(member.ref);
      const raw = node?.tags?.name;
      if (!raw) continue;

      // ดูจาก tag ของ node แทน role เพราะหลาย relation ใส่ role ว่างไว้
      // (BTS สีลมมี 11 จาก 14 สถานีที่ role ว่าง ถ้ากรองด้วย role จะหายเกือบหมด)
      const t = node.tags ?? {};
      const isStation =
        /^(station|halt|stop|tram_stop)$/.test(t.railway ?? "") ||
        /^(stop_position|station|platform)$/.test(t.public_transport ?? "");
      if (!isStation) continue;
      const name = cleanName(raw);
      if (seen.has(name)) continue;
      seen.add(name);
      stations.push({
        name,
        lat: Number(node.lat.toFixed(5)),
        lng: Number(node.lon.toFixed(5)),
      });
    }

    // เติมสถานีที่ relation ตกหล่น
    for (const patch of PATCHES.filter((x) => x.lineId === want.id)) {
      if (stations.some((st) => st.name === patch.station.name)) continue;
      const at = stations.findIndex((st) => st.name === patch.after);
      if (at === -1) {
        console.log("   !! หาจุดแทรกไม่เจอ:", patch.after);
        continue;
      }
      stations.splice(at + 1, 0, patch.station);
      console.log("   เติมสถานีที่ขาด:", patch.station.name);
    }

    console.log(`  ${want.name}: ${stations.length} สถานี`);
    lines.push({ ...want, stations });
    await sleep(8000);
  }

  const body = [
    "/**",
    " * โครงข่ายรถไฟฟ้ากรุงเทพฯ และปริมณฑล",
    " *",
    " * สร้างอัตโนมัติจาก OpenStreetMap ด้วย scripts/gen-metro.js",
    " * ไม่ควรแก้ไฟล์นี้ด้วยมือ — ถ้ามีสายใหม่ให้เพิ่มใน WANTED แล้วรันสคริปต์ใหม่",
    " */",
    "export interface MetroStation {",
    "  name: string;",
    "  lat: number;",
    "  lng: number;",
    "}",
    "",
    "export interface MetroLine {",
    "  id: string;",
    "  name: string;",
    "  /** สีประจำสาย ใช้แสดงบน UI */",
    "  color: string;",
    '  system: "BTS" | "MRT";',
    "  stations: MetroStation[];",
    "}",
    "",
    "export const METRO_LINES: MetroLine[] = " +
      JSON.stringify(
        lines.map(({ id, name, color, system, stations }) => ({
          id,
          name,
          color,
          system,
          stations,
        })),
        null,
        2,
      ) +
      ";",
    "",
  ].join("\n");

  fs.writeFileSync("src/data/metro.ts", body);
  const total = lines.reduce((n, l) => n + l.stations.length, 0);
  console.log(`\nเขียน src/data/metro.ts แล้ว — ${lines.length} สาย / ${total} สถานี`);
})();
