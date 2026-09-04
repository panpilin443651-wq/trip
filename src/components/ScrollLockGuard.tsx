"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { releaseAllScrollLocks } from "@/components/ui/overlay";

/**
 * ตาข่ายกันหน้าค้างเลื่อนไม่ได้
 *
 * กล่องโมดัลล็อกการเลื่อนหน้าไว้ตอนเปิด แล้วปลดตอนปิด ปกติสมดุลกันอยู่แล้ว
 * แต่ถ้ามีทางไหนที่หลงเหลือการล็อกไว้ ผู้ใช้จะเจอหน้าที่เลื่อนไม่ได้และแก้เอง
 * ไม่ได้นอกจากรีเฟรช
 *
 * เคลียร์ทุกครั้งที่เปลี่ยนหน้า เพราะการเปลี่ยนหน้าคือจังหวะที่กล่องทุกอันควรปิด
 * ไปแล้ว ทำให้ "กดเมนูอื่นแล้วหาย" เป็นทางออกที่ผู้ใช้เดาได้เอง
 */
export function ScrollLockGuard() {
  const pathname = usePathname();

  useEffect(() => {
    releaseAllScrollLocks();
  }, [pathname]);

  return null;
}
