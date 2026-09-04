/**
 * สถานะย่อ/ขยายแถบข้างซ้าย
 *
 * เก็บนอก React เพื่อให้ useSyncExternalStore อ่านได้ตรง ๆ ตั้งแต่เรนเดอร์แรก
 * ถ้าเก็บใน useState แล้วไปอ่าน localStorage ใน effect จะติดกฎ
 * react-hooks/set-state-in-effect และเห็นแถบกระพริบตอนโหลด
 */
const KEY = "sidebar-collapsed";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export function isSidebarCollapsed(): boolean {
  if (cached === null) {
    try {
      cached = localStorage.getItem(KEY) === "1";
    } catch {
      // โหมดส่วนตัวบางตัวบล็อก storage — ถือว่ากางไว้
      cached = false;
    }
  }
  return cached;
}

export function setSidebarCollapsed(value: boolean): void {
  cached = value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // เปลี่ยนได้แต่ไม่จำ
  }
  for (const listener of listeners) listener();
}

export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ยังอ่าน localStorage ไม่ได้ ถือว่ากางไว้ */
export const sidebarServerSnapshot = (): boolean => false;
