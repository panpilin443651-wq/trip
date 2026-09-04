/**
 * ไอคอนเส้นเรียบสำหรับแถบเมนู
 *
 * ใช้แทนอิโมจิเพราะอิโมจิเป็นภาพสี หน้าตาต่างกันไปตามระบบปฏิบัติการ
 * และเอาไปทำให้กลมกลืนกับสีของธีมไม่ได้ ไอคอนเส้นใช้ currentColor
 * จึงเปลี่ยนสีตามสถานะ active และตามโหมดมืด/สว่างได้เอง
 *
 * วาดเป็น SVG ในโค้ดเลย ไม่ลงไลบรารีไอคอน (โปรเจกต์นี้ตั้งใจไม่เพิ่ม dependency)
 * ทุกอันอยู่ในกรอบ 24x24 เส้นหนา 1.75 ปลายมนเท่ากันหมด จะได้ดูเป็นชุดเดียวกัน
 */
export type NavIconName =
  | "home"
  | "compass"
  | "map"
  | "suitcase"
  | "user"
  | "wallet"
  | "document"
  | "chat"
  | "pin"
  | "checklist";

/** เส้นของแต่ละไอคอน — เก็บแค่ path จะได้ไม่ต้องเขียน <svg> ซ้ำทุกอัน */
const PATHS: Record<NavIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.5 10.6 12 3.8l8.5 6.8" />
      <path d="M5.8 9.6V20h12.4V9.6" />
      <path d="M9.8 20v-5.2h4.4V20" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" />
    </>
  ),
  map: (
    <>
      <path d="M9 5.2 3.8 7.4v11.4L9 16.6l6 2.2 5.2-2.2V5.2L15 7.4z" />
      <path d="M9 5.2v11.4" />
      <path d="M15 7.4v11.4" />
    </>
  ),
  suitcase: (
    <>
      <rect x="3.4" y="7.6" width="17.2" height="12" rx="2.4" />
      <path d="M9 7.6V5.8a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 5.8v1.8" />
      <path d="M3.4 13.2h17.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.9 20.2c0-3.9 3.2-7.1 7.1-7.1 3.9 0 7.1 3.2 7.1 7.1" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.4" y="6.4" width="17.2" height="12.4" rx="2.4" />
      <path d="M3.4 10.4h17.2" />
      <circle cx="16.6" cy="14.6" r="1.1" />
    </>
  ),
  document: (
    <>
      <path d="M6.2 3.8h7.4l4.2 4.2v12.2H6.2z" />
      <path d="M13.4 3.8V8h4.4" />
      <path d="M9.2 12.6h5.6M9.2 16h5.6" />
    </>
  ),
  chat: (
    <>
      <rect x="3.4" y="5.2" width="17.2" height="11.6" rx="2.6" />
      <path d="M8.6 16.8 8 20.4l4.4-3.6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20.8C8.3 16.2 6.4 13.1 6.4 11.3 6.4 8.2 8.9 5.7 12 5.7 15.1 5.7 17.6 8.2 17.6 11.3c0 1.8-1.9 4.9-5.6 9.5z" />
      <circle cx="12" cy="11.2" r="2.1" />
    </>
  ),
  checklist: (
    <>
      <rect x="4.6" y="4.4" width="14.8" height="15.4" rx="2.2" />
      <path d="m8.4 10.2 1.6 1.6 3-3" />
      <path d="M13.6 15.4h3" />
      <path d="M8.4 15.4h1.4" />
    </>
  ),
};

export function NavIcon({
  name,
  className,
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
