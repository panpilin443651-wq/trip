/**
 * หาพิกัดที่ถูกต้องให้สถานที่ที่ตรวจแล้วพบว่าตกอยู่ในจังหวัดอื่น
 *
 * ใช้: node scripts/fix-coords.js <ไฟล์ผลลัพธ์.json>
 *
 * ขั้นตอนต่อหนึ่งจุด
 *   1. ค้นชื่อ + อำเภอ + จังหวัด กับ Nominatim
 *   2. reverse geocode ผลที่ได้ ยืนยันว่าตกในจังหวัดที่ต้องการจริง
 *   3. ไม่ผ่านก็ลองคำค้นสำรองตัวถัดไป
 * พิมพ์พิกัดเองไม่ได้ เคยพลาดจนได้จุดที่อยู่คนละประเทศมาแล้ว
 */
const fs = require("fs");

const OUT = process.argv[2] || "fixed-coords.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "travel-planner-data-build/1.0" };

/** id ของสถานที่ -> จังหวัดที่ควรอยู่ + คำค้นเรียงตามความน่าจะเจอ */
const TARGETS = [
  {
    id: "yst-phra-that-anon",
    province: "ยโสธร",
    queries: ["วัดมหาธาตุ ยโสธร", "พระธาตุอานนท์ เมืองยโสธร ยโสธร"],
  },
  {
    id: "yst-ban-singha-tha",
    province: "ยโสธร",
    queries: ["บ้านสิงห์ท่า ยโสธร", "ย่านเมืองเก่าบ้านสิงห์ท่า เมืองยโสธร"],
  },
  {
    id: "ssk-pha-mo-i-daeng",
    province: "ศรีสะเกษ",
    queries: ["ผามออีแดง กันทรลักษ์ ศรีสะเกษ", "Pha Mo I Daeng Si Sa Ket"],
  },
  {
    id: "ubn-sam-phan-bok",
    province: "อุบลราชธานี",
    queries: ["สามพันโบก โพธิ์ไทร อุบลราชธานี", "Sam Phan Bok Ubon Ratchathani"],
  },
  {
    id: "mhs-ban-rak-thai",
    province: "แม่ฮ่องสอน",
    queries: ["บ้านรักไทย เมืองแม่ฮ่องสอน", "Ban Rak Thai Mae Hong Son"],
  },
  {
    id: "mhs-pang-oung",
    province: "แม่ฮ่องสอน",
    queries: ["ปางอุ๋ง แม่ฮ่องสอน", "Pang Ung Mae Hong Son"],
  },
  {
    id: "cei-golden-triangle",
    province: "เชียงราย",
    queries: [
      "สามเหลี่ยมทองคำ เชียงแสน เชียงราย",
      "หอฝิ่น สามเหลี่ยมทองคำ เชียงราย",
    ],
  },
  {
    id: "nki-friendship-bridge",
    province: "หนองคาย",
    queries: [
      "ด่านพรมแดนสะพานมิตรภาพไทย-ลาว หนองคาย",
      "สะพานมิตรภาพไทย-ลาว แห่งที่ 1 เมืองหนองคาย",
    ],
  },
  {
    id: "nkp-phu-lang-ka-nkp",
    province: "นครพนม",
    queries: ["ภูลังกา บ้านแพง นครพนม", "อุทยานแห่งชาติภูลังกา นครพนม"],
  },
  {
    id: "nma-khao-yai",
    province: "นครราชสีมา",
    queries: [
      "ที่ทำการอุทยานแห่งชาติเขาใหญ่ ปากช่อง นครราชสีมา",
      "ผากล้วยไม้ เขาใหญ่ นครราชสีมา",
    ],
  },
  {
    id: "pri-thap-lan",
    province: "ปราจีนบุรี",
    queries: [
      "ที่ทำการอุทยานแห่งชาติทับลาน นาดี ปราจีนบุรี",
      "อุทยานแห่งชาติทับลาน นาดี ปราจีนบุรี",
    ],
  },
  {
    // เหวนรกอยู่ฝั่งนครนายกจริง ๆ จึงเปลี่ยนเป็นที่เที่ยวของปราจีนบุรีแทน
    id: "pri-heo-narok",
    province: "ปราจีนบุรี",
    queries: ["แก่งหินเพิง นาดี ปราจีนบุรี", "ล่องแก่งหินเพิง ปราจีนบุรี"],
  },
];

async function search(q) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5` +
    `&countrycodes=th&accept-language=th&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  return res.json();
}

async function reverse(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10` +
    `&lat=${lat}&lon=${lng}&accept-language=th`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`reverse HTTP ${res.status}`);
  const a = (await res.json()).address ?? {};
  return a.province ?? a.state ?? a.city ?? a.county ?? "";
}

(async () => {
  const out = {};
  for (const target of TARGETS) {
    let done = false;
    for (const q of target.queries) {
      if (done) break;
      let hits = [];
      try {
        hits = await search(q);
      } catch (e) {
        console.log(`  ! ${target.id} ค้นไม่สำเร็จ: ${e.message}`);
      }
      await sleep(1100);

      for (const hit of hits.slice(0, 3)) {
        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        let got = "";
        try {
          got = await reverse(lat, lng);
        } catch {
          /* ลองตัวถัดไป */
        }
        await sleep(1100);

        if (got.includes(target.province)) {
          out[target.id] = {
            lat: Number(lat.toFixed(4)),
            lng: Number(lng.toFixed(4)),
            label: hit.display_name.split(",").slice(0, 2).join(",").trim(),
            province: got,
            query: q,
          };
          console.log(
            `✓ ${target.id}  [${lat.toFixed(4)}, ${lng.toFixed(4)}]  ${got}\n    ${out[target.id].label}`,
          );
          done = true;
          break;
        }
      }
    }
    if (!done) console.log(`✗ ${target.id} — ยืนยันไม่ได้ ต้องหาเอง`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\nยืนยันได้ ${Object.keys(out).length}/${TARGETS.length} จุด`);
})();
