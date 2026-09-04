"use client";

import { useState, useTransition } from "react";
import { signOut } from "@/app/login/actions";
import { ConfirmDialog, cn } from "@/components/ui";

/**
 * ปุ่มออกจากระบบบนแถบบน — กดถึงได้จากทุกหน้า
 *
 * มีคำกำกับไม่ใช่ไอคอนเปล่า เพราะ 🚪 อย่างเดียวเดาได้หลายอย่าง
 * (ออกจากระบบ ปิดหน้า ออกจากทริป) คำบอกชัดกว่าและกดผิดยากขึ้น
 *
 * มีถามยืนยันก่อน ต่างจากปุ่มเต็มในหน้าโปรไฟล์ ที่อยู่ในการ์ดหัวข้อ "บัญชี"
 * ซึ่งกดโดยไม่ตั้งใจได้ยาก ส่วนตรงนี้เป็นไอคอนเล็กข้างปุ่มสลับโหมดสี
 * บนมือถือนิ้วพลาดไปโดนแล้วต้องล็อกอินใหม่ทั้งที่กำลังวางแผนอยู่
 *
 * ข้อมูลไม่หาย — แผนถูกบันทึกขึ้น Supabase ตลอดอยู่แล้ว
 */
export function SignOutIconButton({ className }: { className?: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={pending}
        title="ออกจากระบบ"
        aria-label="ออกจากระบบ"
        className={cn(
          "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line",
          "bg-card px-3 text-[13px] font-medium transition-colors hover:bg-danger-soft",
          "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
          "disabled:opacity-60",
          className,
        )}
      >
        <span aria-hidden>{pending ? "…" : "🚪"}</span>
        <span className="whitespace-nowrap">
          ออก<span className="hidden min-[380px]:inline">จากระบบ</span>
        </span>
      </button>

      <ConfirmDialog
        open={asking}
        title="ออกจากระบบ?"
        message="แผนทริปถูกบันทึกไว้ในบัญชีแล้ว เข้าสู่ระบบใหม่เมื่อไหร่ก็เห็นเหมือนเดิม"
        confirmLabel="ออกจากระบบ"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          // ต้องอยู่ใน transition เพราะเรียก server action นอก <form>
          // ถ้าเรียกตรง ๆ React จะเตือน และหน้าจะไม่มีสถานะกำลังทำงานให้เห็น
          startTransition(() => {
            void signOut();
          });
        }}
      />
    </>
  );
}
