"use client";

import { useEffect } from "react";

/**
 * ลงทะเบียน service worker เพื่อให้ติดตั้งเว็บเป็นแอปได้
 *
 * ลงทะเบียนเฉพาะตอน production เพราะตอน dev ไฟล์เปลี่ยนตลอด
 * ถ้ามีตัวแคชคั่นอยู่จะไล่หาสาเหตุยากว่าที่เห็นเป็นของใหม่หรือของเก่า
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // รอให้หน้าโหลดเสร็จก่อน จะได้ไม่ไปแย่งแบนด์วิดท์ตอนเปิดเว็บครั้งแรก
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // ลงทะเบียนไม่สำเร็จก็ใช้เว็บได้ตามปกติ แค่ติดตั้งเป็นแอปไม่ได้
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
