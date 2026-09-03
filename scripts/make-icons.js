/**
 * สร้างไอคอน PNG สำหรับติดตั้งเป็นแอป
 *
 * ใช้: node scripts/make-icons.js
 *
 * เขียน PNG เองด้วย zlib ที่ Node มีอยู่แล้ว ไม่ต้องลงไลบรารีแต่งรูป
 * (โปรเจกต์นี้ตั้งใจไม่เพิ่ม dependency) รูปเป็นหมุดปักแผนที่สีทองบนพื้นกรม
 * ตามธีมของเว็บ วาดด้วยสมการวงกลมกับสามเหลี่ยม จึงคมทุกขนาดโดยไม่ต้องมีไฟล์ต้นฉบับ
 */
const fs = require("fs");
const zlib = require("zlib");

const NAVY = [14, 26, 48]; // --color-canvas
const GOLD = [201, 162, 39]; // --color-brand

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

/** rgba คือ Uint8Array ยาว width * height * 4 */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // ไม่ interlace

  // แต่ละแถวต้องมีไบต์บอกวิธี filter นำหน้า ใช้ 0 (ไม่ filter) ให้ง่ายไว้ก่อน
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy
      ? rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
      : Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)).copy(
          raw,
          rowStart + 1,
        );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** จุดอยู่ในสามเหลี่ยมไหม — ใช้เครื่องหมายของ cross product ทั้งสามด้าน */
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const sign = (x1, y1, x2, y2, x3, y3) =>
    (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = sign(px, py, ax, ay, bx, by);
  const d2 = sign(px, py, bx, by, cx, cy);
  const d3 = sign(px, py, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * วาดหมุดปักแผนที่
 * @param size ขนาดด้านของรูป
 * @param inset สัดส่วนขอบที่เว้นไว้ (ไอคอนแบบ maskable ต้องเว้นให้ระบบครอบตัด)
 * @param round มุมโค้ง 0 = สี่เหลี่ยม, 1 = วงกลม
 */
function drawIcon(size, { inset = 0.12, round = 0.22 } = {}) {
  const SS = 4; // วาดใหญ่กว่าจริง 4 เท่าแล้วเฉลี่ยลง ขอบจะได้ไม่หยัก
  const big = size * SS;
  const acc = new Float64Array(size * size * 4);

  const radius = round * big;
  const pinScale = 1 - inset * 2;
  const cx = big / 2;
  const cy = big * (0.5 - 0.06 * pinScale);
  const r = big * 0.19 * pinScale;
  const tip = [cx, cy + big * 0.42 * pinScale];
  const left = [cx - r * 0.86, cy + r * 0.5];
  const right = [cx + r * 0.86, cy + r * 0.5];
  const holeR = r * 0.42;

  for (let by = 0; by < big; by += 1) {
    for (let bx = 0; bx < big; bx += 1) {
      // มุมโค้งของพื้นหลัง
      const dxCorner = Math.max(radius - bx, bx - (big - radius), 0);
      const dyCorner = Math.max(radius - by, by - (big - radius), 0);
      const outside = Math.hypot(dxCorner, dyCorner) > radius;

      let color = null;
      if (!outside) {
        const inCircle = Math.hypot(bx - cx, by - cy) <= r;
        const inHole = Math.hypot(bx - cx, by - cy) <= holeR;
        const inTip = inTriangle(bx, by, left, right, tip);
        color = (inCircle || inTip) && !inHole ? GOLD : NAVY;
      }

      const px = Math.floor(bx / SS);
      const py = Math.floor(by / SS);
      const i = (py * size + px) * 4;
      if (color) {
        acc[i] += color[0];
        acc[i + 1] += color[1];
        acc[i + 2] += color[2];
        acc[i + 3] += 255;
      }
    }
  }

  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;
  for (let i = 0; i < size * size; i += 1) {
    for (let c = 0; c < 4; c += 1) {
      out[i * 4 + c] = Math.round(acc[i * 4 + c] / samples);
    }
  }
  return encodePng(size, size, out);
}


/**
 * ประกอบไฟล์ .ico จาก PNG หลายขนาด
 *
 * .ico เป็นแค่กล่องใส่รูปหลายขนาดในไฟล์เดียว เบราว์เซอร์ยุคนี้อ่าน PNG
 * ที่ฝังอยู่ข้างในได้ จึงไม่ต้องแปลงเป็น BMP แบบสมัยก่อน
 * ใส่หลายขนาดเพราะแต่ละที่ใช้ไม่เท่ากัน — แท็บ 16, บุ๊กมาร์ก 32, ทางลัด 48
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
    // ขนาด 256 ต้องเขียนเป็น 0 ตามสเปก
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; // ไม่ใช้จานสี
    e[3] = 0;
    e.writeUInt16LE(1, 4); // plane
    e.writeUInt16LE(32, 6); // 32 บิตต่อพิกเซล
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/**
 * favicon วาดให้หมุดเต็มกรอบกว่าไอคอนแอป
 *
 * ไอคอนแอปเว้นขอบเยอะได้เพราะแสดงที่ 180px ขึ้นไป แต่ favicon ใช้จริงที่ 16px
 * ถ้าเว้นขอบเท่ากันหมุดจะเหลือไม่กี่พิกเซลจนดูไม่ออกว่าเป็นอะไร
 * รูตรงกลางก็ต้องใหญ่ขึ้นด้วย ไม่งั้นหายไปเลยตอนย่อ
 */
function drawFavicon(size) {
  const SS = 4;
  const big = size * SS;
  const acc = new Float64Array(size * size * 4);
  const radius = big * 0.22;
  const cx = big / 2;
  const cy = big * 0.4;
  const r = big * 0.245;
  const tip = [cx, cy + big * 0.5];
  const left = [cx - r * 0.86, cy + r * 0.5];
  const right = [cx + r * 0.86, cy + r * 0.5];

  for (let by = 0; by < big; by += 1) {
    for (let bx = 0; bx < big; bx += 1) {
      const dx = Math.max(radius - bx, bx - (big - radius), 0);
      const dy = Math.max(radius - by, by - (big - radius), 0);
      if (Math.hypot(dx, dy) > radius) continue;

      const d = Math.hypot(bx - cx, by - cy);
      const onPin = (d <= r || inTriangle(bx, by, left, right, tip)) && d > r * 0.5;
      const color = onPin ? GOLD : NAVY;

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

const TARGETS = [
  // ไอคอนปกติ เว้นขอบน้อยเพื่อให้หมุดเต็มกรอบ
  { file: "public/icon-192.png", size: 192, opts: { inset: 0.08 } },
  { file: "public/icon-512.png", size: 512, opts: { inset: 0.08 } },
  // maskable ระบบจะครอบตัดได้ถึง 20% รอบด้าน ต้องเว้นที่เผื่อไว้
  // และใช้พื้นเต็มสี่เหลี่ยม เพราะมุมโค้งจะถูกครอบทับอยู่แล้ว
  {
    file: "public/icon-maskable-512.png",
    size: 512,
    opts: { inset: 0.22, round: 0 },
  },
  // iOS ครอบมุมให้เอง จึงวาดเป็นสี่เหลี่ยมเต็ม
  { file: "src/app/apple-icon.png", size: 180, opts: { inset: 0.1, round: 0 } },
];

for (const { file, size, opts } of TARGETS) {
  fs.writeFileSync(file, drawIcon(size, opts));
  console.log(`✓ ${file} (${size}x${size}, ${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
}

// favicon ใส่ 3 ขนาดในไฟล์เดียว เบราว์เซอร์เลือกใช้ขนาดที่เหมาะเอง
const FAVICON_SIZES = [16, 32, 48];
const ico = encodeIco(
  FAVICON_SIZES.map((size) => ({ size, png: drawFavicon(size) })),
);
fs.writeFileSync("src/app/favicon.ico", ico);
console.log(
  `✓ src/app/favicon.ico (${FAVICON_SIZES.join(", ")} px, ` +
    `${(ico.length / 1024).toFixed(1)} KB)`,
);
