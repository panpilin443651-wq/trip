/**
 * เติมพิกัดจาก Nominatim (OpenStreetMap) ให้ทุกจุดที่ยังเป็น 0
 * จำกัดผลลัพธ์ในไทย และปฏิเสธผลที่ไกลจากศูนย์กลางจังหวัดเกินกำหนด
 * เพราะการค้นแบบไม่จำกัดเคยได้พิกัดผิดจังหวัดและผิดประเทศ
 */
const fs = require("fs");
const file = process.argv[2];
const overridePath = process.argv[3];
const overrides = overridePath && fs.existsSync(overridePath)
  ? JSON.parse(fs.readFileSync(overridePath, "utf8")) : {};
const MAX_KM = Number(process.env.MAX_KM || 170);

const hav = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const lines = fs.readFileSync(file, "utf8").split("\n");
const targets = [];
let province = "", center = null, placeName = "";
lines.forEach((l, i) => {
  let m = /^    name: "(.+)",$/.exec(l);
  if (m) { province = m[1]; return; }
  m = /^    center: \{ lat: ([\d.\-]+), lng: ([\d.\-]+) \},$/.exec(l);
  if (m) { center = { lat: +m[1], lng: +m[2] }; return; }
  m = /^        name: "(.+)",$/.exec(l);
  if (m) { placeName = m[1]; return; }
  m = /^(\s*)(lat|lng): (.*),$/.exec(l);
  if (m && (m[3].trim() === "0" || /[^0-9.\-]/.test(m[3].trim()))) {
    targets.push({ line: i, indent: m[1], key: m[2], province, center, placeName });
  }
});

const groups = new Map();
for (const t of targets) {
  const k = `${t.placeName}|${t.province}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(t);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const simplify = (n) => n.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();

async function lookup(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=th&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "travel-planner-data-build/1.0", "Accept-Language": "th,en" },
    signal: AbortSignal.timeout(15000),
  });
  const hits = await res.json();
  return Array.isArray(hits) ? hits : [];
}

(async () => {
  let ok = 0; const fail = [];
  for (const [key, items] of groups) {
    const [name, prov] = key.split("|");
    const center = items[0].center;
    const base = simplify(name);
    const extra = overrides[name]
      ? (Array.isArray(overrides[name]) ? overrides[name] : [overrides[name]])
      : [];
    // ลอง override ก่อน แล้วค่อยไล่รูปแบบมาตรฐาน
    const variants = [...extra, `${base}, ${prov}, ประเทศไทย`, `${base} ${prov}`, base];

    let picked = null;
    for (const q of variants) {
      let hits = [];
      try { hits = await lookup(q); } catch { hits = []; }
      await sleep(2200);
      for (const h of hits) {
        const p = { lat: Number(h.lat), lng: Number(h.lon) };
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const d = center ? hav(p, center) : 0;
        if (d <= MAX_KM) { picked = { ...p, d }; break; }
      }
      if (picked) break;
    }

    if (picked) {
      const lat = picked.lat.toFixed(4), lng = picked.lng.toFixed(4);
      for (const t of items) lines[t.line] = `${t.indent}${t.key}: ${t.key === "lat" ? lat : lng},`;
      ok++; console.log(`OK   ${name} -> ${lat}, ${lng} (ห่าง ${picked.d.toFixed(0)} กม.)`);
    } else { fail.push(name); console.log(`MISS ${name}`); }
  }
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`\nสำเร็จ ${ok} | ไม่พบ ${fail.length}` + (fail.length ? `\nไม่พบ: ${fail.join(", ")}` : ""));
})();
