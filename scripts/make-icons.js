/**
 * สร้างไอคอนทั้งชุดของเว็บ — favicon.ico และ PNG สำหรับติดตั้งเป็นแอป
 *
 * ใช้: node scripts/make-icons.js
 *
 * ต้นฉบับคือ assets/logo.png (โลโก้ TripPlan บนพื้นขาว มีตัวหนังสืออยู่ใต้รูป)
 * สคริปต์นี้ตัดเฉพาะสี่เหลี่ยมไอคอน ทำพื้นนอกให้โปร่งใส แล้วย่อเป็นขนาดต่าง ๆ
 * เปลี่ยนโลโก้เมื่อไหร่ ทับไฟล์ต้นฉบับแล้วรันใหม่ได้ทั้งชุด
 *
 * ถอดและเขียน PNG/ICO เองด้วย zlib ที่ Node มีอยู่แล้ว ไม่ต้องลงไลบรารีแต่งรูป
 * (โปรเจกต์นี้ตั้งใจไม่เพิ่ม dependency)
 */
const fs = require("fs");
const zlib = require("zlib");

const SOURCE = "assets/logo.png";

// ── ตัวอ่าน PNG ─────────────────────────────────────────────────────

/**
 * ถอด PNG แบบ 8 บิต ไม่ interlace (ทั้ง RGB และ RGBA)
 *
 * แต่ละแถวถูกกรอง (filter) ก่อนบีบอัด ต้องย้อนกลับทีละแถวตามลำดับ
 * เพราะแถวหลังอ้างอิงค่าที่ถอดแล้วของแถวก่อนหน้า
 */
function decodePng(buf) {
  let offset = 8; // ข้ามลายเซ็น 8 ไบต์
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR") {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
      if (buf[offset + 16] !== 8) throw new Error("รองรับเฉพาะ PNG 8 บิต");
      colorType = buf[offset + 17];
      if (colorType !== 2 && colorType !== 6)
        throw new Error("รองรับเฉพาะ PNG แบบ RGB หรือ RGBA");
      if (buf[offset + 20] !== 0)
        throw new Error("ไม่รองรับ PNG แบบ interlace");
    }
    if (type === "IDAT")
      idat.push(buf.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }

  const bpp = colorType === 2 ? 3 : 4;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? px[y * stride + i - bpp] : 0;
      const up = y > 0 ? px[(y - 1) * stride + i] : 0;
      const upLeft = i >= bpp && y > 0 ? px[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        // Paeth — เลือกเพื่อนบ้านที่ใกล้ค่าทำนายที่สุด
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        v += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      px[y * stride + i] = v & 255;
    }
  }

  return { width, height, px, bpp };
}

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * เลือก filter ของแต่ละแถวแบบอัตโนมัติ
 *
 * ลองครบทั้ง 5 แบบแล้วเอาแบบที่ผลรวมค่าสัมบูรณ์น้อยที่สุด (วิธีมาตรฐานตามสเปก)
 * รูปนี้เป็นภาพไล่เฉดสี ถ้าไม่กรองเลยไฟล์จะใหญ่กว่าเดิมหลายเท่า
 */
function filterRow(line, prev, bpp) {
  const n = line.length;
  let best = null;
  for (let f = 0; f <= 4; f += 1) {
    const out = Buffer.alloc(n);
    let score = 0;
    for (let i = 0; i < n; i += 1) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      const v = (line[i] - pred) & 255;
      out[i] = v;
      score += v < 128 ? v : 256 - v;
    }
    if (!best || score < best.score) best = { f, out, score };
  }
  return best;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // บิตต่อช่องสี
  ihdr[9] = 6; // RGBA

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const line = rgba.subarray(y * stride, (y + 1) * stride);
    const { f, out } = filterRow(line, prev, 4);
    raw[y * (stride + 1)] = f;
    out.copy(raw, y * (stride + 1) + 1);
    prev = line;
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO เป็นแค่กล่องใส่ PNG หลายขนาด เบราว์เซอร์เลือกใช้ขนาดที่เหมาะเอง */
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

// ── ตัดโลโก้ออกจากภาพต้นฉบับ ────────────────────────────────────────

/**
 * ตัดเฉพาะสี่เหลี่ยมไอคอนออกมา แล้วทำพื้นนอกให้โปร่งใส
 *
 * หาขอบจากพิกเซล "มีสี" (ช่องสีต่างกันมาก) ไม่ใช่แค่ "ไม่ขาว" เพราะใต้สี่เหลี่ยม
 * มีเงาสีเทาจาง ๆ ซึ่งไม่ใช่ตัวไอคอน และมองแค่ครึ่งบนของภาพ ไม่งั้นจะไปกิน
 * ตัวหนังสือ TripPlan ที่อยู่ด้านล่างเข้ามาด้วย
 *
 * ส่วนความโปร่งใสหาโดยลามจากขอบภาพเข้ามาตามพิกเซลจาง ๆ ไม่ใช่ไล่เช็กทีละพิกเซล
 * ว่าขาวไหม เพราะถนนกลางรูปก็เป็นสีขาว ถ้าเช็กแค่สีจะทะลุเป็นรูกลางไอคอน
 */
function loadLogo(file) {
  const { width, height, px, bpp } = decodePng(fs.readFileSync(file));
  const isVivid = (x, y) => {
    const i = (y * width + x) * bpp;
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    return Math.max(r, g, b) - Math.min(r, g, b) > 25;
  };

  const searchLimit = Math.floor(height * 0.75);
  let x0 = width;
  let x1 = 0;
  let y0 = height;
  let y1 = 0;
  for (let y = 0; y < searchLimit; y += 1)
    for (let x = 0; x < width; x += 1)
      if (isVivid(x, y)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < x0) throw new Error(`หาสี่เหลี่ยมไอคอนใน ${file} ไม่เจอ`);

  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const s = ((y0 + y) * width + x0 + x) * bpp;
      const d = (y * w + x) * 4;
      rgba[d] = px[s];
      rgba[d + 1] = px[s + 1];
      rgba[d + 2] = px[s + 2];
      rgba[d + 3] = 255;
    }

  const isPale = (p) => {
    const i = p * 4;
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    return (
      r > 205 && g > 205 && b > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 18
    );
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x += 1) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 1) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !isPale(p)) continue;
    seen[p] = 1;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  for (let p = 0; p < w * h; p += 1) if (seen[p]) rgba[p * 4 + 3] = 0;

  return { w, h, rgba };
}

// ── แปลงขนาด ────────────────────────────────────────────────────────

/**
 * ย่อด้วยการเฉลี่ยพื้นที่ (box filter)
 *
 * ต้องคูณอัลฟาเข้าไปก่อนเฉลี่ย ไม่งั้นสีของพิกเซลโปร่งใสจะถูกนับด้วย
 * แล้วขอบไอคอนจะมีขลิบขาวบาง ๆ
 */
function resize(src, size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sy0 = (y * src.h) / size;
    const sy1 = ((y + 1) * src.h) / size;
    for (let x = 0; x < size; x += 1) {
      const sx0 = (x * src.w) / size;
      const sx1 = ((x + 1) * src.w) / size;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let total = 0;
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy += 1) {
        const fy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx += 1) {
          const f = (Math.min(sx + 1, sx1) - Math.max(sx, sx0)) * fy;
          if (f <= 0) continue;
          const i = (sy * src.w + sx) * 4;
          const al = src.rgba[i + 3] / 255;
          r += src.rgba[i] * al * f;
          g += src.rgba[i + 1] * al * f;
          b += src.rgba[i + 2] * al * f;
          a += al * f;
          total += f;
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        out[i] = Math.round(r / a);
        out[i + 1] = Math.round(g / a);
        out[i + 2] = Math.round(b / a);
      }
      out[i + 3] = Math.round((a / total) * 255);
    }
  }
  return { w: size, h: size, rgba: out };
}

/** ตัดขอบเข้ามาก่อนย่อ ทำให้เส้นทางกลางรูปใหญ่ขึ้นตอนไอคอนเล็ก */
function cropInset(src, inset) {
  const dx = Math.round(src.w * inset);
  const dy = Math.round(src.h * inset);
  const w = src.w - dx * 2;
  const h = src.h - dy * 2;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1)
    src.rgba.copy(
      rgba,
      y * w * 4,
      ((y + dy) * src.w + dx) * 4,
      ((y + dy) * src.w + dx + w) * 4,
    );
  return { w, h, rgba };
}

/** ชดเชยความเบลอที่เกิดจากการย่อ (unsharp mask แบบง่าย) */
function sharpen(img, amount) {
  const { w, h, rgba } = img;
  const out = Buffer.from(rgba);
  for (let y = 1; y < h - 1; y += 1)
    for (let x = 1; x < w - 1; x += 1) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const blur =
          (rgba[i + c] * 4 +
            rgba[i - 4 + c] +
            rgba[i + 4 + c] +
            rgba[i - w * 4 + c] +
            rgba[i + w * 4 + c]) /
          8;
        const v = Math.round(rgba[i + c] + (rgba[i + c] - blur) * amount);
        out[i + c] = Math.max(0, Math.min(255, v));
      }
    }
  return { w, h, rgba: out };
}

/** ทับอัลฟาของอีกภาพ ใช้เอามุมโค้งของต้นฉบับกลับมาหลังซูมเข้า */
function applyAlphaOf(img, mask) {
  for (let i = 0; i < img.w * img.h; i += 1)
    img.rgba[i * 4 + 3] = Math.round(
      (img.rgba[i * 4 + 3] * mask.rgba[i * 4 + 3]) / 255,
    );
  return img;
}

/**
 * ลากสีของขอบไอคอนออกไปเติมมุมโค้ง แล้วปิดความโปร่งใสทั้งใบ
 *
 * ไอคอนที่ระบบครอบมุมให้เอง (iOS, maskable) ต้องทึบเต็มสี่เหลี่ยม จะเอาอัลฟา
 * ไปยัดเป็น 255 เฉย ๆ ไม่ได้ เพราะพิกเซลโปร่งใสไม่มีสีเก็บไว้ มุมจะกลายเป็นสีดำ
 *
 * อีกทางคือตัดขอบเข้ามาให้พ้นมุมโค้ง แต่ลองแล้วต้องตัดถึง 8% ต่อด้าน
 * ซึ่งดันหมุดเครื่องบินออกไปนอกวงปลอดภัยของ maskable จนโดนครอบหัวขาด
 * การลากสีขอบออกไปแทนจึงดีกว่า เพราะกรอบภาพไม่ขยับเลย
 */
function fillCorners(img) {
  const { w, h, rgba } = img;
  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x += 1)
      if (rgba[(row + x) * 4 + 3] > 200) {
        if (first < 0) first = x;
        last = x;
      }
    if (first < 0) continue; // ทั้งแถวโปร่งใส — ไม่มีสีให้ลาก
    for (let x = 0; x < first; x += 1)
      rgba.copy(rgba, (row + x) * 4, (row + first) * 4, (row + first) * 4 + 3);
    for (let x = last + 1; x < w; x += 1)
      rgba.copy(rgba, (row + x) * 4, (row + last) * 4, (row + last) * 4 + 3);
  }
  for (let i = 0; i < w * h; i += 1) rgba[i * 4 + 3] = 255;
  return img;
}

// ── สร้างไฟล์ ───────────────────────────────────────────────────────

const logo = loadLogo(SOURCE);
console.log(`ต้นฉบับ ${SOURCE} → ตัดสี่เหลี่ยมไอคอนได้ ${logo.w}x${logo.h}`);

/**
 * ไอคอนขนาดเล็ก (favicon) — ซูมเข้านิดหน่อยแล้วเพิ่มความคม
 *
 * ที่ 16 px ถ้าย่อทั้งใบตรง ๆ ตึกกับภูเขารอบนอกจะกลายเป็นจุดสีมั่ว ๆ
 * ตัดขอบออก 10% ทำให้เส้นทางสีขาวกลางรูปใหญ่ขึ้นจนยังอ่านออก
 * ส่วนอัลฟาเอาของภาพเต็มมาครอบ มุมโค้งจะได้เหมือนเดิม
 */
function smallIcon(size) {
  const zoomed = sharpen(resize(cropInset(logo, 0.1), size), 1);
  return applyAlphaOf(zoomed, resize(logo, size));
}

/** ไอคอนขนาดใหญ่ — ย่อทั้งใบ เก็บรายละเอียดต้นฉบับไว้ครบ */
function largeIcon(size) {
  return sharpen(resize(logo, size), 0.35);
}

/**
 * ไอคอนเต็มกรอบ ไม่มีมุมโค้ง — สำหรับที่ที่ระบบครอบมุมให้เอง
 *
 * ใช้กรอบเดียวกับไอคอนปกติ หมุดทั้งสองจึงยังอยู่ในวงปลอดภัยของ maskable
 * (รัศมี 40% จากจุดกึ่งกลาง) ไม่ต้องย่อรูปให้เล็กลงอีก
 */
function fullBleedIcon(size) {
  return fillCorners(largeIcon(size));
}

const TARGETS = [
  { file: "public/icon-192.png", img: () => largeIcon(192) },
  { file: "public/icon-512.png", img: () => largeIcon(512) },
  // maskable ระบบครอบตัดเหลือวงกลมกลางภาพได้ จึงต้องทึบเต็มสี่เหลี่ยม
  { file: "public/icon-maskable-512.png", img: () => fullBleedIcon(512) },
  // iOS ครอบมุมให้เอง และไม่รองรับพื้นโปร่งใส (จะกลายเป็นสีดำ)
  { file: "src/app/apple-icon.png", img: () => fullBleedIcon(180) },
];

for (const { file, img } of TARGETS) {
  const image = img();
  fs.writeFileSync(file, encodePng(image.w, image.h, image.rgba));
  console.log(
    `✓ ${file} (${image.w}x${image.h}, ` +
      `${(fs.statSync(file).size / 1024).toFixed(1)} KB)`,
  );
}

/** favicon ใส่ 3 ขนาดในไฟล์เดียว เบราว์เซอร์เลือกใช้ขนาดที่เหมาะเอง */
const FAVICON_SIZES = [16, 32, 48];
const ico = encodeIco(
  FAVICON_SIZES.map((size) => {
    const image = smallIcon(size);
    return { size, png: encodePng(image.w, image.h, image.rgba) };
  }),
);
fs.writeFileSync("src/app/favicon.ico", ico);
console.log(
  `✓ src/app/favicon.ico (${FAVICON_SIZES.join(", ")} px, ` +
    `${(ico.length / 1024).toFixed(1)} KB)`,
);
