import type { ReactNode } from "react";

/**
 * หัวหน้าจอ — ชื่อหน้า คำอธิบายสั้น และปุ่มของหน้านั้น
 *
 * ไม่มีอิโมจินำหน้าชื่อหน้าโดยตั้งใจ ทุกหน้ามีอันหนึ่งเท่ากับไม่มีอันไหนเด่น
 * และไปแย่งสายตากับปุ่มที่อยู่ข้าง ๆ ซึ่งเป็นสิ่งที่ควรเด่นกว่า
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
