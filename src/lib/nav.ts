export interface NavItem {
  href: string;
  label: string;
  emoji: string;
  /** แสดงบนแถบล่างของมือถือหรือไม่ */
  primary: boolean;
  description?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "หน้าหลัก",
    emoji: "🏠",
    primary: true,
    description: "ภาพรวมทริปทั้งหมด",
  },
  {
    href: "/itinerary",
    label: "แผนเที่ยว",
    emoji: "📋",
    primary: true,
    description: "ตารางกิจกรรมรายวัน",
  },
  {
    href: "/map",
    label: "แผนที่",
    emoji: "🗺️",
    primary: true,
    description: "เส้นทางและระยะทาง",
  },
  {
    href: "/budget",
    label: "งบประมาณ",
    emoji: "💰",
    primary: true,
    description: "ค่าใช้จ่ายแยกหมวด",
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
  {
    href: "/explore",
    label: "แนะนำเที่ยว",
    emoji: "🧭",
    primary: false,
    description: "สถานที่และกิจกรรมตามจังหวัด",
  },
  {
    href: "/settings",
    label: "ตั้งค่าทริป",
    emoji: "⚙️",
    primary: false,
    description: "จำนวนวัน งบรวม และข้อมูลทริป",
  },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((item) => !item.primary);
