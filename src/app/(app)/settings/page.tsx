"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  SectionTitle,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { addDaysISO, formatDateThai, toNumber } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";

export default function SettingsPage() {
  const { state, dispatch, exportJSON, importJSON, resetAll } = useTrip();
  const { trip, activities } = state;

  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingDayCount, setPendingDayCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isDayTrip = trip.dayCount === 1;
  const lastDate = addDaysISO(trip.startDate, Math.max(0, trip.dayCount - 1));

  function requestDayCount(next: number) {
    const clamped = Math.min(30, Math.max(1, next));
    if (clamped === trip.dayCount) return;

    // ลดจำนวนวันแล้วมีกิจกรรมค้างอยู่ในวันที่จะหายไป — ต้องถามก่อน
    const orphaned = activities.filter((a) => a.dayIndex > clamped - 1).length;
    if (orphaned > 0) {
      setPendingDayCount(clamped);
      return;
    }
    dispatch({ type: "setDayCount", dayCount: clamped });
  }

  async function handleImport(file: File) {
    setImportError(null);
    try {
      await importJSON(file);
    } catch {
      setImportError(
        "อ่านไฟล์ไม่สำเร็จ — ต้องเป็นไฟล์ JSON ที่ export จากแอปนี้",
      );
    }
  }

  const orphanedCount =
    pendingDayCount === null
      ? 0
      : activities.filter((a) => a.dayIndex > pendingDayCount - 1).length;

  return (
    <>
      <PageHeader
        emoji="⚙️"
        title="ตั้งค่าทริป"
        subtitle="กำหนดข้อมูลพื้นฐานของทริปและจัดการข้อมูลที่บันทึกไว้"
      />

      <div className="space-y-4">
        <Card as="section">
          <SectionTitle emoji="🧳" title="ข้อมูลทริป" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อทริป" className="sm:col-span-2">
              <Input
                value={trip.name}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { name: e.target.value },
                  })
                }
                placeholder="เช่น เที่ยวเชียงใหม่ปีใหม่"
              />
            </Field>

            <Field label="จังหวัด / ปลายทาง">
              <Input
                value={trip.destination}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { destination: e.target.value },
                  })
                }
                placeholder="เช่น เชียงใหม่"
              />
            </Field>

            <Field label="จำนวนผู้เดินทาง">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={trip.travelers}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: {
                      travelers: Math.max(
                        1,
                        Math.round(toNumber(e.target.value, 1)),
                      ),
                    },
                  })
                }
              />
            </Field>

            <Field label="วันที่เริ่มเดินทาง">
              <Input
                type="date"
                value={trip.startDate}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { startDate: e.target.value },
                  })
                }
              />
            </Field>

            <Field label="วันสุดท้าย" hint="คำนวณจากวันเริ่ม + จำนวนวัน">
              <Input value={formatDateThai(lastDate, false)} readOnly disabled />
            </Field>

            <Field label="บันทึกเพิ่มเติม" className="sm:col-span-2">
              <Textarea
                value={trip.notes}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { notes: e.target.value },
                  })
                }
                placeholder="เช่น เบอร์ที่พัก ทะเบียนรถ นัดเจอกันกี่โมง"
              />
            </Field>
          </div>
        </Card>

        <Card as="section">
          <SectionTitle emoji="📅" title="รูปแบบการเดินทาง" />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => requestDayCount(1)}
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                isDayTrip
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-white hover:bg-canvas",
              )}
            >
              <div className="text-2xl leading-none" aria-hidden>
                ☀️
              </div>
              <div className="mt-2 font-medium">1 Day Trip</div>
              <div className="text-xs text-muted">ไป-กลับภายในวันเดียว</div>
            </button>

            <button
              type="button"
              onClick={() =>
                requestDayCount(trip.dayCount > 1 ? trip.dayCount : 2)
              }
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                !isDayTrip
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-white hover:bg-canvas",
              )}
            >
              <div className="text-2xl leading-none" aria-hidden>
                🌙
              </div>
              <div className="mt-2 font-medium">หลายวัน</div>
              <div className="text-xs text-muted">ค้างคืน 2 วันขึ้นไป</div>
            </button>
          </div>

          {!isDayTrip ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted">จำนวนวัน</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="ลดจำนวนวัน"
                  onClick={() => requestDayCount(trip.dayCount - 1)}
                >
                  −
                </Button>
                <span className="min-w-14 text-center text-lg font-semibold tabular-nums">
                  {trip.dayCount}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="เพิ่มจำนวนวัน"
                  onClick={() => requestDayCount(trip.dayCount + 1)}
                >
                  +
                </Button>
              </div>
              <span className="text-sm text-muted">
                ถึง {formatDateThai(lastDate, false)}
              </span>
            </div>
          ) : null}
        </Card>

        <Card as="section">
          <SectionTitle emoji="💾" title="ข้อมูลที่บันทึกไว้" />
          <p className="mb-4 text-sm leading-relaxed text-muted">
            ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น
            หากเปลี่ยนเครื่องหรือล้างข้อมูลเบราว์เซอร์ ให้ใช้ Export
            เก็บไฟล์ไว้ก่อน
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportJSON}>
              ⬇️ Export JSON
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              ⬆️ Import JSON
            </Button>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              🗑️ ล้างข้อมูลทั้งหมด
            </Button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />

          {importError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              ⚠️ {importError}
            </p>
          ) : null}
        </Card>

        <Card as="section">
          <SectionTitle emoji="🔐" title="บัญชี" />
          <form action="/api/logout" method="post">
            <Button variant="secondary" type="submit">
              ออกจากระบบ
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDayCount !== null}
        title="ลดจำนวนวัน"
        message={`มีกิจกรรม ${orphanedCount} รายการอยู่ในวันที่กำลังจะถูกตัดออก ระบบจะย้ายกิจกรรมเหล่านั้นไปไว้วันสุดท้ายให้แทนการลบทิ้ง ต้องการดำเนินการต่อหรือไม่?`}
        confirmLabel="ย้ายและลดวัน"
        onCancel={() => setPendingDayCount(null)}
        onConfirm={() => {
          if (pendingDayCount !== null) {
            dispatch({ type: "setDayCount", dayCount: pendingDayCount });
          }
          setPendingDayCount(null);
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="ล้างข้อมูลทั้งหมด"
        message="กิจกรรม งบประมาณ สถานที่ และ Checklist ทั้งหมดจะถูกลบและกู้คืนไม่ได้ แนะนำให้ Export เก็บไว้ก่อน"
        confirmLabel="ล้างข้อมูล"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
        }}
      />
    </>
  );
}
