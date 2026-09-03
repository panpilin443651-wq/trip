/**
 * สร้างไอคอนทั้งชุดของเว็บ — favicon.ico และ PNG สำหรับติดตั้งเป็นแอป
 *
 * ใช้: node scripts/make-icons.js
 *
 * เขียน PNG กับ ICO เองด้วย zlib ที่ Node มีอยู่แล้ว ไม่ต้องลงไลบรารีแต่งรูป
 * (โปรเจกต์นี้ตั้งใจไม่เพิ่ม dependency) รูปวาดด้วยสมการล้วน จึงคมทุกขนาด
 * โดยไม่ต้องมีไฟล์ต้นฉบับ แก้สีหรือสัดส่วนแล้วรันใหม่ได้ทั้งชุด
 *
 * รูป: กระเป๋าเดินทางสีทองบนพื้นกรม มีเครื่องบินกับรถเจาะอยู่ข้างใน
 */
const fs = require("fs");
const zlib = require("zlib");

const NAVY = [14, 26, 48]; // --color-canvas
const GOLD = [201, 162, 39]; // --color-brand

// ── ตัวเขียน PNG ────────────────────────────────────────────────────

/** ตารางค่า CRC32 สำหรับตรวจสอบความถูกต้องของแต่ละ chunk ใน PNG */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA

  // แต่ละแถวต้องมีไบต์บอกวิธี filter นำหน้า ใช้ 0 (ไม่ filter) ให้ง่ายไว้ก่อน
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * ประกอบไฟล์ .ico จาก PNG หลายขนาด
 *
 * .ico เป็นแค่กล่องใส่รูปหลายขนาดในไฟล์เดียว เบราว์เซอร์ยุคนี้อ่าน PNG
 * ที่ฝังอยู่ข้างในได้ จึงไม่ต้องแปลงเป็น BMP แบบสมัยก่อน
 */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // สงวนไว้
  header.writeUInt16LE(1, 2); // 1 = ไอคอน
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // ขนาด 256 ต้องเขียนเป็น 0 ตามสเปก
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // plane
    e.writeUInt16LE(32, 6); // 32 บิตต่อพิกเซล
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

// ── รูปทรงพื้นฐาน ใช้พิกัด 0..1 จะได้ไม่ผูกกับขนาดจริง ────────────────

function roundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
  const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
  return Math.hypot(dx, dy) <= r;
}

const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

/** จุดอยู่ในสามเหลี่ยมไหม — ใช้เครื่องหมายของ cross product ทั้งสามด้าน */
function triangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const sign = (x1, y1, x2, y2, x3, y3) =>
    (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

// ── ชิ้นส่วนของรูป ──────────────────────────────────────────────────

/** เครื่องบินมองจากด้านบน หันขึ้น — ลำตัว ปีกกวาดหลัง และแพนหาง */
function plane(x, y, cx, cy, s) {
  return (
    roundRect(x, y, cx - 0.028 * s, cy - 0.075 * s, cx + 0.028 * s, cy + 0.06 * s, 0.028 * s) ||
    triangle(x, y, [cx - 0.15 * s, cy + 0.028 * s], [cx + 0.15 * s, cy + 0.028 * s], [cx, cy - 0.05 * s]) ||
    triangle(x, y, [cx - 0.06 * s, cy + 0.075 * s], [cx + 0.06 * s, cy + 0.075 * s], [cx, cy + 0.02 * s])
  );
}

/**
 * รถมองจากด้านข้าง — ตัวถัง ห้องโดยสาร และล้อ
 *
 * ล้อต้องยื่นพ้นตัวถังลงมา ไม่งั้นทั้งคันรวมเป็นก้อนเดียวแล้วดูเหมือนเนินเขา
 * (แบบแรกที่ลองใช้สามเหลี่ยมเป็นหลังคาออกมาเป็นแบบนั้นพอดี)
 */
function car(x, y, cx, cy, s) {
  return (
    roundRect(x, y, cx - 0.15 * s, cy - 0.012 * s, cx + 0.15 * s, cy + 0.035 * s, 0.018 * s) ||
    roundRect(x, y, cx - 0.082 * s, cy - 0.072 * s, cx + 0.062 * s, cy + 0.005 * s, 0.022 * s) ||
    circle(x, y, cx - 0.09 * s, cy + 0.045 * s, 0.038 * s) ||
    circle(x, y, cx + 0.09 * s, cy + 0.045 * s, 0.038 * s)
  );
}

/** ช่องกระจกของรถ เจาะกลับเป็นสีทองให้อ่านออกว่าเป็นรถ ไม่ใช่ก้อนสี่เหลี่ยม */
function carWindow(x, y, cx, cy, s) {
  return roundRect(x, y, cx - 0.062 * s, cy - 0.055 * s, cx + 0.042 * s, cy - 0.012 * s, 0.012 * s);
}

/**
 * กระเป๋าเดินทาง — ตัวกระเป๋าสีทอง เจาะเครื่องบินกับรถเป็นสีกรม
 *
 * @param withVehicles ใส่รถกับเครื่องบินไหม
 *   ที่ขนาด 16-32 px รายละเอียดพวกนี้เละจนดูไม่ออก ใช้กระเป๋าเปล่าแทน
 *   ซึ่งยังบอกได้ว่าเป็นเว็บอะไร
 * @param scale ย่อ/ขยายทั้งภาพรอบจุดกึ่งกลาง — maskable ต้องเว้นขอบให้ระบบครอบตัด
 * @param round มุมโค้งของพื้นหลัง 0 = สี่เหลี่ยมเต็ม
 */
function drawIcon(size, { withVehicles = true, scale = 1, round = 0.22 } = {}) {
  const SS = 4; // วาดใหญ่กว่าจริง 4 เท่าแล้วเฉลี่ยลง ขอบจะได้ไม่หยัก
  const big = size * SS;
  const acc = new Float64Array(size * size * 4);

  for (let by = 0; by < big; by += 1) {
    for (let bx = 0; bx < big; bx += 1) {
      const x = bx / big;
      const y = by / big;
      if (round > 0 && !roundRect(x, y, 0, 0, 1, 1, round)) continue;

      const gx = 0.5 + (x - 0.5) / scale;
      const gy = 0.5 + (y - 0.5) / scale;

      // หูหิ้ว — สี่เหลี่ยมโค้งวงนอกลบวงใน เอาเฉพาะส่วนเหนือตัวกระเป๋า
      const handle =
        gy < 0.345 &&
        roundRect(gx, gy, 0.375, 0.155, 0.625, 0.36, 0.075) &&
        !roundRect(gx, gy, 0.435, 0.225, 0.565, 0.4, 0.045);
      const body = roundRect(gx, gy, 0.155, 0.335, 0.845, 0.85, 0.09);

      let color = NAVY;
      if (handle || body) {
        color = GOLD;
        if (body && withVehicles) {
          if (plane(gx, gy, 0.5, 0.455, 0.95)) color = NAVY;
          else if (car(gx, gy, 0.5, 0.715, 1)) {
            color = carWindow(gx, gy, 0.5, 0.715, 1) ? GOLD : NAVY;
          } else if (gy > 0.575 && gy < 0.593) {
            // เส้นซิปกลางกระเป๋า คั่นสองช่องให้ดูเป็นกระเป๋าจริง
            color = NAVY;
          }
        }
      }

      const i = (Math.floor(by / SS) * size + Math.floor(bx / SS)) * 4;
      acc[i] += color[0];
      acc[i + 1] += color[1];
      acc[i + 2] += color[2];
      acc[i + 3] += 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 1) out[i] = Math.round(acc[i] / (SS * SS));
  return encodePng(size, size, out);
}

// ── ไฟล์ที่ต้องสร้าง ────────────────────────────────────────────────

const TARGETS = [
  { file: "public/icon-192.png", size: 192, opts: {} },
  { file: "public/icon-512.png", size: 512, opts: {} },
  // maskable ระบบครอบตัดได้ถึง 20% รอบด้าน ต้องย่อรูปให้เนื้อหาอยู่ตรงกลาง
  // และใช้พื้นเต็มสี่เหลี่ยม เพราะมุมโค้งจะถูกครอบทับอยู่แล้ว
  { file: "public/icon-maskable-512.png", size: 512, opts: { scale: 0.72, round: 0 } },
  // iOS ครอบมุมให้เอง จึงวาดเป็นสี่เหลี่ยมเต็ม
  { file: "src/app/apple-icon.png", size: 180, opts: { round: 0 } },
];

for (const { file, size, opts } of TARGETS) {
  fs.writeFileSync(file, drawIcon(size, opts));
  console.log(
    `✓ ${file} (${size}x${size}, ${(fs.statSync(file).size / 1024).toFixed(1)} KB)`,
  );
}

/**
 * favicon ใส่ 3 ขนาดในไฟล์เดียว เบราว์เซอร์เลือกใช้ขนาดที่เหมาะเอง
 *
 * 16 กับ 32 ใช้กระเป๋าเปล่า เพราะเครื่องบินกับรถเหลือไม่กี่พิกเซลจนเละ
 * ส่วน 48 ใส่ครบได้ การลดรายละเอียดตามขนาดเป็นเรื่องปกติของงานไอคอน
 */
const FAVICON = [
  { size: 16, opts: { withVehicles: false, scale: 1.1 } },
  { size: 32, opts: { withVehicles: false, scale: 1.1 } },
  { size: 48, opts: { scale: 1.1 } },
];
const ico = encodeIco(
  FAVICON.map(({ size, opts }) => ({ size, png: drawIcon(size, opts) })),
);
fs.writeFileSync("src/app/favicon.ico", ico);
console.log(
  `✓ src/app/favicon.ico (${FAVICON.map((f) => f.size).join(", ")} px, ` +
    `${(ico.length / 1024).toFixed(1)} KB)`,
);
