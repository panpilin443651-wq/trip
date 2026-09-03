import { ThemeToggle } from "@/components/ThemeToggle";
import { TripSwitcher } from "@/components/TripSwitcher";

/**
 * แถบบนสุดของหน้าในแอป — มีปุ่มสลับโหมดสีอยู่มุมขวา
 *
 * ทำเป็นแถบจริงแทนที่จะลอยปุ่มไว้มุมขวาบนของจอ เพราะหลายหน้ามีปุ่มของตัวเอง
 * อยู่ขวาบนของเนื้อหาอยู่แล้ว (เช่น "เพิ่มค่าใช้จ่าย" ในหน้างบ) ปุ่มลอยจะไปทับ
 * บนมือถือพอดี
 *
 * ทางซ้ายเป็นปุ่มสลับแผนเที่ยว โชว์ทุกขนาดจอ เพราะแถบข้างบอกได้แค่ชื่อแอป
 * ไม่ได้บอกว่ากำลังเปิดแผนไหนอยู่
 */
export function TopBar() {
  return (
    // print-hide เพราะกฎโหมดพิมพ์ซ่อนแค่ nav กับ aside แถบนี้เป็น header
    // ถ้าไม่ซ่อน ปุ่มสลับโหมดจะติดไปอยู่หัวกระดาษตอนบันทึก PDF
    <header className="print-hide sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 lg:px-8">
        <TripSwitcher />
        <ThemeToggle className="shrink-0" />
      </div>
    </header>
  );
}
