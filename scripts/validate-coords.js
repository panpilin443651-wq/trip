// ตรวจว่าพิกัดแต่ละสถานที่อยู่ใกล้ศูนย์กลางจังหวัดของตัวเองพอสมควร
const fs = require("fs");
const R = 6371;
const hav = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const LIMIT = Number(process.env.LIMIT || 160);
let issues = 0, checked = 0;
for (const f of process.argv.slice(2)) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  let province = "", center = null, placeName = "", lat = null, lng = null, placeLine = 0;
  lines.forEach((l, i) => {
    let m = /^    name: "(.+)",$/.exec(l);
    if (m) { province = m[1]; center = null; return; }
    m = /^    center: \{ lat: ([\d.\-]+), lng: ([\d.\-]+) \},$/.exec(l);
    if (m) { center = { lat: +m[1], lng: +m[2] }; return; }
    m = /^        name: "(.+)",$/.exec(l);
    if (m) { placeName = m[1]; lat = lng = null; placeLine = i + 1; return; }
    m = /^        lat: ([\d.\-]+),$/.exec(l); if (m) { lat = +m[1]; }
    m = /^        lng: ([\d.\-]+),$/.exec(l); if (m) { lng = +m[1]; }
    if (lat !== null && lng !== null && center) {
      const d = hav({ lat, lng }, center);
      checked++;
      if (d > LIMIT) {
        issues++;
        console.log(`${f}:${placeLine}  ${placeName} (${province}) ห่างศูนย์กลางจังหวัด ${d.toFixed(0)} กม.  [${lat}, ${lng}]`);
      }
      lat = lng = null;
    }
  });
}
console.log(issues ? `\nน่าสงสัย ${issues} จาก ${checked}` : `\nพิกัดสมเหตุสมผลทั้งหมด ${checked} จุด`);
