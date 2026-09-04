import { ProfileMenu } from "@/components/ProfileMenu";
import { TripSwitcher } from "@/components/TripSwitcher";

/**
 * แถบบนสุดของหน้าในแอป
 *
 * ซ้าย  — ชื่อแผนที่เปิดอยู่ กดเพื่อสลับแผน โชว์ทุกขนาดจอเพราะแถบข้างบอกได้
 *         แค่ชื่อแอป ไม่ได้บอกว่ากำลังเปิดแผนไหน
 * ขวา  — โปรไฟล์ ข้างในมีสวิตช์โหมดมืด ปุ่มออกจากระบบ และเมนูที่เหลือ
 *
 * ทำเป็นแถบจริงแทนที่จะลอยปุ่มไว้มุมขวาบนของจอ เพราะหลายหน้ามีปุ่มของตัวเอง
 * อยู่ขวาบนของเนื้อหาอยู่แล้ว (เช่น "เพิ่มค่าใช้จ่าย" ในหน้างบ) ปุ่มลอยจะไปทับ
 * บนมือถือพอดี
 */
export function TopBar({ email }: { email: string }) {
  return (
    // print-hide เพราะกฎโหมดพิมพ์ซ่อนแค่ nav กับ aside แถบนี้เป็น header
    // ถ้าไม่ซ่อน ปุ่มพวกนี้จะติดไปอยู่หัวกระดาษตอนบันทึก PDF
    <header className="print-hide sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-3 lg:gap-3 lg:px-8">
        <TripSwitcher />
        <ProfileMenu email={email} />
      </div>
    </header>
  );
}
