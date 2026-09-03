/**
 * Service worker ของ Travel Planner
 *
 * มีไว้ 2 อย่าง — ทำให้เบราว์เซอร์ยอมให้ติดตั้งเป็นแอป (Chrome บังคับว่าต้องมี
 * ตัวจัดการ fetch) และทำให้เปิดแอปครั้งถัด ๆ ไปเร็วขึ้นเพราะไฟล์คงที่ถูกแคชไว้
 *
 * จงใจแคชเฉพาะไฟล์คงที่เท่านั้น ไม่แคชหน้าเว็บและไม่แคช /api
 * เพราะทุกหน้าในกลุ่ม (app) ผูกกับบัญชีที่ล็อกอินอยู่ ถ้าแคชไว้แล้วสลับบัญชี
 * หรือออกจากระบบ จะมีโอกาสเห็นข้อมูลของคนก่อนหน้าค้างอยู่
 */
// เปลี่ยนเลขนี้ทุกครั้งที่แก้ไอคอนหรือไฟล์ใน PRECACHE ไม่งั้นเครื่องที่ติดตั้ง
// แอปไว้แล้วจะเห็นของเดิมค้างตลอด เพราะไฟล์พวกนี้ชื่อไม่ผูกกับเวอร์ชัน
const VERSION = "v2";
const STATIC_CACHE = `travel-planner-static-${VERSION}`;

/** ไฟล์ที่ดึงไว้ตั้งแต่ติดตั้ง เพื่อให้หน้าออฟไลน์ใช้ได้แน่ ๆ */
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // ไฟล์ใดไฟล์หนึ่งพลาดไม่ควรทำให้ติดตั้ง service worker ไม่สำเร็จทั้งชุด
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("travel-planner-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * ไฟล์ที่เนื้อหาไม่เปลี่ยนตามผู้ใช้
 *
 * ของใน /_next/static มีชื่อผูกกับเวอร์ชันอยู่แล้ว ส่วนไอคอนไม่มี
 * จึงต้องล้างด้วยการเปลี่ยน VERSION ด้านบนเวลาแก้รูป
 */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/favicon.ico" ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // ข้ามคำขอข้ามโดเมนไปเลย เช่นแผนที่จาก OpenStreetMap
  if (url.origin !== self.location.origin) return;

  // ไฟล์คงที่ — เอาจากแคชก่อน ได้แล้วค่อยเก็บเพิ่ม
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // หน้าเว็บ — ต่อเน็ตเสมอ ล้มเหลวค่อยขึ้นหน้าออฟไลน์
  // ไม่แคชไว้เพราะเนื้อหาผูกกับบัญชีที่ล็อกอินอยู่
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          caches.match("/offline.html") ??
          new Response("ออฟไลน์อยู่", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );
  }

  // ที่เหลือ (รวม /api) ปล่อยให้ไปตามปกติ ไม่แตะ
});
