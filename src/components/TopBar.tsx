import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * แถบบนสุดของหน้าในแอป — มีปุ่มสลับโหมดสีอยู่มุมขวา
 *
 * ทำเป็นแถบจริงแทนที่จะลอยปุ่มไว้มุมขวาบนของจอ เพราะหลายหน้ามีปุ่มของตัวเอง
 * อยู่ขวาบนของเนื้อหาอยู่แล้ว (เช่น "เพิ่มค่าใช้จ่าย" ในหน้างบ) ปุ่มลอยจะไปทับ
 * บนมือถือพอดี
 *
 * ชื่อแอปโชว์เฉพาะจอเล็ก เพราะจอใหญ่มีอยู่ในแถบข้างแล้ว
 */
export function TopBar() {
  return (
    // print-hide เพราะกฎโหมดพิมพ์ซ่อนแค่ nav กับ aside แถบนี้เป็น header
    // ถ้าไม่ซ่อน ปุ่มสลับโหมดจะติดไปอยู่หัวกระดาษตอนบันทึก PDF
    <header className="print-hide sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold lg:hidden"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-base ring-1 ring-accent/25"
            aria-hidden
          >
            ✈️
          </span>
          Travel Planner
        </Link>
        {/* ดันปุ่มไปชิดขวาเมื่อไม่มีชื่อแอปอยู่ทางซ้าย */}
        <div className="hidden lg:block" />
        <ThemeToggle />
      </div>
    </header>
  );
}
