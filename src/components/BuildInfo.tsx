import { BUILD_SHA, BUILD_TIME, IS_LOCAL_BUILD } from "@/lib/build-info";

/**
 * บอกว่าเว็บที่เปิดอยู่มาจากโค้ดชุดไหน
 *
 * เป็น server component เพราะตัวแปรของ Vercel อ่านได้เฉพาะฝั่งเซิร์ฟเวอร์
 * เอาไว้ท้ายหน้า ⋯ เพิ่มเติม เทียบเลขนี้กับ commit ล่าสุดบน GitHub ได้เลย
 * ไม่ตรง = ยังไม่ได้ redeploy · ตรง = กำลังดูของใหม่จริง
 */
export function BuildInfo() {
  // แสดงเป็นเวลาไทยให้ตรงกับที่อื่นในเว็บ
  const built = new Date(BUILD_TIME).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-faint">
      เวอร์ชัน{" "}
      <span className="font-medium tabular-nums">{BUILD_SHA}</span>
      {" · "}
      build {built}
      {IS_LOCAL_BUILD ? (
        <span className="mt-0.5 block">
          (รันในเครื่อง ไม่ใช่ตัวที่ deploy)
        </span>
      ) : null}
    </p>
  );
}
