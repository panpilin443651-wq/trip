import { redirect } from "next/navigation";

/**
 * แผนเที่ยวย้ายไปอยู่ในหน้าตั้งค่าทริปแล้ว
 * เก็บเส้นทางนี้ไว้เปลี่ยนทางต่อ เผื่อมีคนบุ๊กมาร์กหรือแชร์ลิงก์เดิมไว้
 */
export default function ItineraryPage() {
  redirect("/settings#plan");
}
