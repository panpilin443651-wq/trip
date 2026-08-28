import { transportOf } from "@/data/transport";
import { cn } from "@/lib/cn";
import type { DayPlan } from "@/lib/types";

/**
 * บรรทัดสรุปแผนของวัน — จังหวัด วิธีเดินทาง และบันทึก
 *
 * ใช้ในหน้าหลักและหน้าสรุปแผน ซึ่งแค่โชว์ ไม่ได้ให้แก้
 * (ที่แก้ได้อยู่ในการ์ด DayPlanCard ของหน้าแผนเที่ยว)
 * คืน null เมื่อวันนั้นยังไม่ได้ระบุอะไรเลย จะได้ไม่มีบรรทัดว่างค้าง
 */
export function DayPlanLine({
  plan,
  showNote = false,
  className,
}: {
  plan: DayPlan | undefined;
  showNote?: boolean;
  className?: string;
}) {
  const transport = transportOf(plan?.transport);
  const note = showNote ? plan?.note?.trim() : "";

  if (!plan?.province && !transport && !note) return null;

  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 px-1 text-sm text-muted",
        className,
      )}
    >
      {plan?.province ? <span>📍 {plan.province}</span> : null}
      {transport ? (
        <span>
          {transport.emoji} {transport.label}
        </span>
      ) : null}
      {note ? <span>📝 {note}</span> : null}
    </p>
  );
}
