import { cn } from "@/lib/cn";
import { filledLegs, formatRoute } from "@/lib/legs";
import type { DayPlan } from "@/lib/types";

/**
 * บรรทัดสรุปแผนของวัน — จังหวัด เส้นทางการเดินทาง และบันทึก
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
  const route = formatRoute(plan);
  const note = showNote ? plan?.note?.trim() : "";
  // บันทึกรายช่วง เช่น เลขเที่ยวบิน มีประโยชน์ตอนพิมพ์เป็นไฟล์
  const legNotes = showNote
    ? filledLegs(plan)
        .map((leg) => leg.note.trim())
        .filter(Boolean)
    : [];

  if (!plan?.province && !route && !note && legNotes.length === 0) return null;

  return (
    <div className={cn("px-1 text-sm text-muted", className)}>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        {plan?.province ? <span>📍 {plan.province}</span> : null}
        {route ? <span>{route}</span> : null}
      </p>
      {note || legNotes.length > 0 ? (
        <p className="mt-0.5 text-xs">
          📝 {[note, ...legNotes].filter(Boolean).join(" • ")}
        </p>
      ) : null}
    </div>
  );
}
