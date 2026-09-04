export interface NavItem {
  href: string;
  label: string;
  emoji: string;
  /** แสดงบนแถบล่างของมือถือหรือไม่ */
  primary: boolean;
  description?: string;
}

/**
 * เมนูทั้งหมดของแอป
 *
 * สี่อันแรกเป็นแถบล่างบนมือถือ เรียงตามลำดับที่ใช้จริงตอนวางแผนทริป
 * หาแรงบันดาลใจ (แนะนำเที่ยว) → ดูว่าอยู่ตรงไหน (แผนที่) → ลงแผน (แผนเที่ยว)
 * โดยมีหน้าหลักเป็นจุดตั้งต้น
 *
 * โปรไฟล์ไปอยู่เป็นปุ่มมุมขวาบนแทน เพราะไม่ใช่ปลายทางที่คนเข้าบ่อยเท่าสี่เมนูนี้
 * แถบล่างจึงเหลือสี่ช่อง ปุ่มใหญ่ขึ้นและกดถูกง่ายขึ้น
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "หน้าหลัก",
    emoji: "🏠",
    primary: true,
    description: "ภาพรวมทริปทั้งหมด",
  },
  {
    href: "/explore",
    label: "แนะนำเที่ยว",
    emoji: "🧭",
    primary: true,
    description: "สถานที่และกิจกรรมตามจังหวัด",
  },
  {
    href: "/map",
    label: "แผนที่",
    emoji: "🗺️",
    primary: true,
    description: "เส้นทางและระยะทาง",
  },
  {
    href: "/settings",
    label: "แผนเที่ยว",
    emoji: "🧳",
    primary: true,
    description: "ข้อมูลทริป แผนรายวัน จังหวัด และงบรวม",
  },
  {
    // อยู่มุมขวาบน ไม่ได้อยู่บนแถบล่าง แต่ยังอยู่ในแถบข้างของจอใหญ่
    href: "/more",
    label: "โปรไฟล์",
    emoji: "👤",
    primary: false,
    description: "บัญชี งบประมาณ สรุปแผน และเมนูที่เหลือ",
  },
  {
    href: "/budget",
    label: "งบประมาณ",
    emoji: "💰",
    primary: false,
    description: "ค่าใช้จ่ายแยกหมวด",
  },
  {
    href: "/summary",
    label: "สรุปแผน",
    emoji: "📄",
    primary: false,
    description: "ดูแผนทั้งทริป บันทึกเป็นรูปหรือ PDF",
  },
  {
    href: "/chat",
    label: "ผู้ช่วย AI",
    emoji: "💬",
    primary: false,
    description: "ถามวิธีใช้เว็บและเรื่องทริปของคุณ",
  },
  {
    href: "/places",
    label: "สถานที่",
    emoji: "📍",
    primary: false,
    description: "รายการที่อยากไป",
  },
  {
    href: "/checklist",
    label: "Checklist",
    emoji: "✅",
    primary: false,
    description: "ของที่ต้องเตรียม",
  },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary);

/**
 * เมนูของแถบข้างบนจอใหญ่ — ไม่มีโปรไฟล์
 *
 * โปรไฟล์เข้าถึงได้จากปุ่มมุมขวาบนอยู่แล้ว ถ้าใส่ในแถบข้างด้วยจะมีสองทางเข้า
 * ไปที่เดียวกัน ซึ่งทำให้คนลังเลว่าต่างกันยังไง
 */
export const SIDEBAR_NAV = NAV_ITEMS.filter((item) => item.href !== "/more");

/**
 * เมนูที่ไม่ได้อยู่บนแถบล่าง — ไปรวมกันในหน้าโปรไฟล์
 *
 * ตัดหน้าโปรไฟล์เองออก ไม่งั้นหน้านั้นจะมีลิงก์ชี้กลับมาที่ตัวเอง
 */
export const SECONDARY_NAV = NAV_ITEMS.filter(
  (item) => !item.primary && item.href !== "/more",
);
