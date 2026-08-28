/**
 * สร้าง src/data/districts.ts จากชุดข้อมูลภูมิศาสตร์ไทย
 * แหล่ง: thailand-geography-data/thailand-geography-json (MIT)
 */
const fs = require("fs");

const SRC =
  "https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src/geography.json";

(async () => {
  const res = await fetch(SRC, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ: " + res.status);
  const rows = await res.json();

  // จังหวัด -> Set ของอำเภอ (ตัดตำบลออก เอาแค่ระดับอำเภอ)
  const byProvince = new Map();
  for (const row of rows) {
    const province = row.provinceNameTh;
    const district = row.districtNameTh;
    if (!province || !district) continue;
    if (!byProvince.has(province)) byProvince.set(province, new Set());
    byProvince.get(province).add(district);
  }

  // ต้องตรงกับชื่อจังหวัดที่ใช้ในแอป
  const appProvinces = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

  const out = {};
  const missing = [];
  for (const name of appProvinces) {
    // ชื่อในแอปบางอันมีวงเล็บ เช่น "ชลบุรี (พัทยา)" ให้ตัดออกก่อนจับคู่
    const base = name.replace(/\s*\(.*?\)\s*/g, "").trim();
    const set = byProvince.get(base);
    if (!set) {
      missing.push(name);
      continue;
    }
    out[name] = [...set].sort((a, b) => a.localeCompare(b, "th"));
  }

  const total = Object.values(out).reduce((n, list) => n + list.length, 0);

  const body = [
    "/**",
    " * รายชื่ออำเภอของแต่ละจังหวัด",
    " *",
    " * สร้างอัตโนมัติจากชุดข้อมูล thailand-geography-json (MIT)",
    " * ไม่ควรแก้ไฟล์นี้ด้วยมือ — ถ้าจะอัปเดตให้รัน scripts/gen-districts.js ใหม่",
    " */",
    "export const DISTRICTS: Record<string, string[]> = " +
      JSON.stringify(out, null, 2) +
      ";",
    "",
    "/** อำเภอของจังหวัดนั้น คืน array ว่างถ้าไม่รู้จักชื่อจังหวัด */",
    "export function districtsOf(province: string): string[] {",
    "  return DISTRICTS[province] ?? [];",
    "}",
    "",
  ].join("\n");

  fs.writeFileSync(process.argv[3], body);

  console.log("จังหวัดที่มีข้อมูล:", Object.keys(out).length);
  console.log("อำเภอรวม:", total);
  if (missing.length) console.log("จับคู่ไม่ได้:", missing.join(", "));
  console.log(
    "ตัวอย่าง เชียงใหม่:",
    (out["เชียงใหม่"] ?? []).slice(0, 6).join(", "),
    "…",
  );
})();
