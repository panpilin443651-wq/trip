/**
 * เติมฟิลด์ `district` ให้ osm-places.ts และ osm-restaurants.ts
 *
 * ใช้:
 *   node scripts/fetch-district-boundaries.js district-boundaries.json
 *   node scripts/fill-osm-districts.js district-boundaries.json
 *
 * ทำหน้าที่เดียวกับ scripts/fill-districts.js (ที่เติมอำเภอให้สถานที่ที่คัดไว้เอง)
 * แต่ใช้ขอบเขตในเครื่องแทน reverse geocode เพราะสองไฟล์นี้รวมกันเกือบ 4,000 จุด
 * ถ้ายิง Nominatim ทีละจุดที่ 1 คำขอ/วินาที จะใช้เวลาชั่วโมงกว่า
 *
 * แยกเป็นขั้นของตัวเองแทนที่จะไปแทรกใน build-*.js เพราะรันซ้ำได้โดยไม่ต้อง
 * ดึงข้อมูลสถานที่ใหม่ทั้งประเทศ (ซึ่งเป็นก้อนใหญ่และเป็นภาระกับ Overpass)
 *
 * จุดที่หาอำเภอไม่ได้จะได้ district เป็นสตริงว่าง ปล่อยว่างดีกว่าเดา
 * เพราะหน้าเว็บกรองด้วยชื่ออำเภอแบบตรงตัว
 */
const fs = require("fs");
const {
  prepareByProvince,
  districtAt,
  strictLookup,
} = require("./geo-districts.js");

/**
 * อ่านทะเบียนชื่ออำเภอออกจาก src/data/districts.ts
 *
 * ไฟล์นั้นเป็น TypeScript แต่ตัวข้อมูลเป็น JSON ล้วน จึงตัดเอาเฉพาะก้อนวงเล็บปีกกา
 * มาแปลงตรง ๆ ได้ ไม่ต้องพึ่ง transpiler
 */
function readDistrictRegistry() {
  const text = fs.readFileSync("src/data/districts.ts", "utf8");
  const marker = "export const DISTRICTS: Record<string, string[]> = ";
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("หา DISTRICTS ใน districts.ts ไม่เจอ");
  const body = text.slice(start + marker.length);
  const end = body.indexOf("\n};");
  if (end < 0) throw new Error("หาท้ายก้อน DISTRICTS ไม่เจอ");
  return JSON.parse(`${body.slice(0, end)}\n}`);
}

const DISTRICTS = readDistrictRegistry();

/**
 * ชื่อสถานที่ที่คัดไว้เองของแต่ละจังหวัด
 *
 * ตอนสร้างข้อมูล build-attractions.js ตัดตัวที่ซ้ำกับรายการที่คัดไว้เองออกไปแล้ว
 * แต่พอย้ายจุดข้ามจังหวัด การตัดซ้ำเดิมใช้ไม่ได้อีก เพราะจังหวัดปลายทางอาจมี
 * ชื่อเดียวกันอยู่แล้ว (เจอจริง — ตลาดโต้รุ่งหัวหิน กับ วัดขุนอินทประมูล)
 *
 * โหลดด้วยวิธีเดียวกับ build-attractions.js คือถอด import แล้วรันเป็นโมดูล
 */
function readCuratedNames() {
  const dir = "src/data/provinces";
  const byProvince = new Map();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".ts") || file === "types.ts" || file === "index.ts") {
      continue;
    }
    const body = fs
      .readFileSync(`${dir}/${file}`, "utf8")
      .replace(/^import[\s\S]*?;\s*$/m, "")
      .replace(/export const \w+: Province\[\] =/, "module.exports =");
    const mod = { exports: null };
    new Function("module", body)(mod);
    for (const province of mod.exports ?? []) {
      byProvince.set(
        province.name,
        new Set(province.places.map((p) => p.name.trim())),
      );
    }
  }
  return byProvince;
}

const CURATED = readCuratedNames();

const TARGETS = [
  {
    file: "src/data/osm-places.ts",
    marker: "export const OSM_PLACES: Record<string, OsmPlace[]> = ",
    interfaceField: `  /** มีหน้า Wikipedia หรือ Wikidata — ใช้เป็นสัญญาณว่าเป็นที่ที่คนรู้จัก */
  notable: boolean;`,
  },
  {
    file: "src/data/osm-restaurants.ts",
    marker: "export const OSM_RESTAURANTS: Record<string, OsmRestaurant[]> = ",
    interfaceField: `  /** มีหน้า Wikipedia หรือ Wikidata */
  notable: boolean;`,
  },
];

const DISTRICT_DOC = `  /**
   * อำเภอ/เขต เติมด้วย scripts/fill-osm-districts.js
   * ว่างได้ ถ้าหาไม่เจอจากขอบเขตการปกครอง
   */
  district: string;`;

(async () => {
  const boundaryFile = process.argv[2];
  if (!boundaryFile) {
    console.error("ใช้: node scripts/fill-osm-districts.js <district-boundaries.json>");
    process.exit(1);
  }

  console.log("อ่านขอบเขตอำเภอ…");
  const raw = JSON.parse(fs.readFileSync(boundaryFile, "utf8"));
  const byProvince = prepareByProvince(raw);
  console.log(
    `  ${raw.length} อำเภอ ใน ${byProvince.size} จังหวัด\n`,
  );

  for (const target of TARGETS) {
    const text = fs.readFileSync(target.file, "utf8");
    const at = text.indexOf(target.marker);
    if (at < 0) throw new Error(`หา marker ใน ${target.file} ไม่เจอ`);

    const jsonStart = at + target.marker.length;
    const json = text.slice(jsonStart).replace(/;\s*$/, "");
    const data = JSON.parse(json);

    let total = 0;
    let found = 0;
    let rejected = 0;
    /** จุดที่จังหวัดเดิมผิด — ย้ายไปจังหวัดที่ขอบเขตอำเภอบอกว่าใช่ */
    const moves = [];

    for (const [province, list] of Object.entries(data)) {
      // ชื่ออำเภอที่ถูกต้องของจังหวัดนี้ ใช้ตรวจผลก่อนรับ
      // ขอบเขตใน OSM บางอำเภอสะกดต่างจากทะเบียนราชการ
      const valid = new Set(DISTRICTS[province] ?? []);

      for (const item of list) {
        total += 1;
        const guess = districtAt(byProvince, province, item.lng, item.lat);
        if (guess && valid.has(guess)) {
          item.district = guess;
          found += 1;
          continue;
        }
        if (guess) rejected += 1;
        item.district = "";

        /*
         * หาอำเภอในจังหวัดที่ระบุไว้ไม่เจอเลย มักแปลว่าจังหวัดเดิมผิด
         * เพราะขอบเขตอำเภอละเอียดกว่าขอบเขตจังหวัดที่ใช้ตอนสร้างข้อมูล
         * (เจอของจริง เช่น ตลาดน้ำอัมพวาถูกจัดอยู่ราชบุรี ทั้งที่อยู่สมุทรสงคราม)
         *
         * ใช้การหาแบบเข้มงวด ต้องอยู่ในรูปจริงเท่านั้น ไม่เดาด้วยระยะทาง
         */
        const strict = strictLookup(byProvince, item.lng, item.lat);
        if (
          strict &&
          strict.province !== province &&
          (DISTRICTS[strict.province] ?? []).includes(strict.district)
        ) {
          moves.push({ item, from: province, to: strict.province, district: strict.district });
        }
      }
    }

    // ย้ายหลังวนจบ จะได้ไม่แก้อาร์เรย์ระหว่างที่กำลังวนอยู่
    let dropped = 0;
    for (const move of moves) {
      const from = data[move.from];
      const at = from.indexOf(move.item);
      if (at >= 0) from.splice(at, 1);

      // จังหวัดปลายทางมีชื่อนี้อยู่แล้ว (ทั้งในรายการที่คัดไว้เองและในชุดนี้)
      // ทิ้งไปเลย ดีกว่าให้ผู้ใช้เห็นสองรายการเหมือนกัน
      const target = (data[move.to] ??= []);
      const duplicate =
        CURATED.get(move.to)?.has(move.item.name.trim()) ||
        target.some((x) => x.name === move.item.name);
      if (duplicate) {
        dropped += 1;
        continue;
      }

      move.item.district = move.district;
      target.push(move.item);
      found += 1;
    }
    if (dropped > 0) moves.dropped = dropped;

    // ใส่ฟิลด์ลงในตัว interface ด้วย ถ้ายังไม่มี
    let out = text.slice(0, jsonStart);
    if (!out.includes("district: string;")) {
      out = out.replace(
        target.interfaceField,
        `${target.interfaceField}\n${DISTRICT_DOC}`,
      );
    }
    out += `${JSON.stringify(data, null, 1)};\n`;
    fs.writeFileSync(target.file, out);

    const pct = ((found / total) * 100).toFixed(1);
    console.log(
      `✓ ${target.file}\n` +
        `    ${found.toLocaleString()}/${total.toLocaleString()} จุด (${pct}%) ได้อำเภอ` +
        (rejected > 0 ? ` · ตกเพราะชื่อไม่ตรงทะเบียน ${rejected}` : ""),
    );
    if (moves.length > 0) {
      console.log(
        `    ย้ายจังหวัดที่ระบุผิด ${moves.length} จุด` +
          (moves.dropped ? ` (ทิ้ง ${moves.dropped} จุดที่ปลายทางมีอยู่แล้ว)` : "") +
          ":",
      );
      for (const m of moves.slice(0, 10)) {
        console.log(`      ${m.item.name}: ${m.from} → ${m.to} (${m.district})`);
      }
      if (moves.length > 10) console.log(`      … อีก ${moves.length - 10} จุด`);
    }
  }
})();
