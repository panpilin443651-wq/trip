"use client";

import Link from "next/link";
import { ExploreTab } from "@/components/ExploreTab";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SignOutConfirmButton } from "@/components/SignOutConfirmButton";
import { ItineraryPlanner } from "@/components/ItineraryPlanner";
import { ProvincePicker } from "@/components/ProvincePicker";
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  NumberInput,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { TRANSPORTS } from "@/data/transport";
import { buildBreakdown, TONE_CLASSES } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { addDaysISO, formatDateThai, formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";

type TabId = "settings" | "explore";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "settings", label: "ตั้งค่าทริป" },
  { id: "explore", label: "แนะนำเที่ยว" },
];

export default function SettingsPage() {
  const { state, dispatch, exportJSON, importJSON, resetAll } = useTrip();
  const { trip, activities } = state;

  const breakdown = useMemo(() => buildBreakdown(state), [state]);
  const tone = TONE_CLASSES[breakdown.status.tone];

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

  const [tab, setTab] = useState<TabId>("settings");
  /*
   * เปิดแท็บแนะนำเที่ยวครั้งแรกเมื่อไหร่ค่อยเรนเดอร์ แล้วจากนั้นเก็บไว้ในหน้า
   * ซ่อนเอาแทนการถอดทิ้ง
   *
   * ถ้าเรนเดอร์ตั้งแต่แรกจะยิงขอข้อมูลจังหวัดทันทีที่เปิดหน้าตั้งค่า ทั้งที่
   * คนส่วนใหญ่มาแก้ข้อมูลทริปเฉย ๆ · ถ้าถอดทิ้งทุกครั้งที่สลับแท็บ จังหวัด
   * อำเภอ และคำค้นที่เลือกไว้จะหายหมด ต้องเลือกใหม่ทุกรอบ
   */
  const [exploreOpened, setExploreOpened] = useState(false);

  const orphanedCount =
    pendingDayCount === null
      ? 0
      : activities.filter((a) => a.dayIndex > pendingDayCount - 1).length;

  return (
    <>
      <PageHeader
        title="ตั้งค่าทริป"
        subtitle="เลือกที่เที่ยว จัดแผนรายวัน ตั้งงบ และดูข้อมูลที่บันทึกไว้"
      />

      {/* แท็บ ไม่ใช่หน้าละหน้า — เลือกที่เที่ยวกับจัดลงวันเป็นงานเดียวกัน
          คนสลับไปมาบ่อย ถ้าแยกหน้าจะต้องเลื่อนหาตำแหน่งเดิมใหม่ทุกครั้ง */}
      <div
        role="tablist"
        aria-label="มุมมองของหน้าตั้งค่าทริป"
        className="mb-4 flex gap-1.5"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id);
              if (item.id === "explore") setExploreOpened(true);
            }}
            className={cn(
              "min-h-10 flex-1 rounded-full border px-4 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-pick bg-pick text-on-pick"
                : "border-line text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {exploreOpened ? (
        <div className={cn(tab !== "explore" && "hidden")}>
          <ExploreTab />
        </div>
      ) : null}

      <div className={cn("space-y-4", tab === "explore" && "hidden")}>
        <Card as="section">
          <SectionTitle title="รูปแบบการเดินทาง" />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => requestDayCount(1)}
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                isDayTrip
                  ? "border-pick bg-pick-soft"
                  : "border-line bg-card hover:bg-brand-soft",
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
                  ? "border-pick bg-pick-soft"
                  : "border-line bg-card hover:bg-brand-soft",
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

          <div className="mt-4 border-t border-line pt-4">
            <Field
              label="วิธีเดินทางหลัก"
              hint="ใช้คำนวณประมาณการค่าใช้จ่าย — บินกับขับรถไปเองราคาต่างกันมาก"
            >
              <Select
                value={trip.mainTransport}
                onChange={(e) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { mainTransport: e.target.value },
                  })
                }
              >
                <option value="">— ยังไม่ระบุ —</option>
                {TRANSPORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.emoji} {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card as="section">
          <SectionTitle title="ข้อมูลทริป" />
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



            <Field label="จำนวนผู้เดินทาง">
              <NumberInput
                min={1}
                value={trip.travelers}
                onValueChange={(travelers) =>
                  dispatch({
                    type: "updateTrip",
                    patch: { travelers: Math.round(travelers) },
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
          <SectionTitle title="แพลนการเที่ยว" />
          <p className="mb-3 text-sm text-muted">
            เลือกจังหวัดที่จะไปในทริปนี้ ไปหลายจังหวัดในทริปเดียวได้
            ระบบจะใช้จังหวัดเหล่านี้แนะนำสถานที่และกิจกรรมให้
          </p>
          <ProvincePicker
            provinces={trip.provinces}
            districts={trip.districts}
            onChangeProvinces={(provinces) =>
              dispatch({ type: "updateTrip", patch: { provinces } })
            }
            onChangeDistricts={(districts) =>
              dispatch({ type: "updateTrip", patch: { districts } })
            }
          />
        </Card>

        {/* scroll-mt เผื่อไว้ให้หัวข้อไม่ชนขอบบนเวลาเข้าจากลิงก์ #plan */}
        <div id="plan" className="scroll-mt-4 space-y-4">
          <ItineraryPlanner />
        </div>

        <Card as="section">
          <SectionTitle title="งบประมาณ" />

          <Field
            label="งบรวมของทริป (บาท)"
            hint="ตั้งไว้แล้วระบบจะเตือนเมื่อค่าใช้จ่ายใกล้เต็มหรือเกินงบ"
          >
            <NumberInput
              step={100}
              placeholder="เช่น 15000"
              value={trip.totalBudget}
              onValueChange={(totalBudget) =>
                dispatch({ type: "updateTrip", patch: { totalBudget } })
              }
            />
          </Field>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              ใช้ไปแล้ว{" "}
              <span className={cn("font-medium", tone.text)}>
                {formatTHB(breakdown.totalSpent)}
              </span>
              {trip.totalBudget > 0
                ? breakdown.remaining >= 0
                  ? ` • เหลือ ${formatTHB(breakdown.remaining)}`
                  : ` • เกินงบ ${formatTHB(Math.abs(breakdown.remaining))}`
                : null}
            </p>
            <Link href="/budget">
              <Button variant="secondary" size="sm">
                🧮 ประมาณการ / แยกหมวด
              </Button>
            </Link>
          </div>
        </Card>

        <Card as="section">
          <SectionTitle title="ข้อมูลที่บันทึกไว้" />
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
          <SectionTitle title="บัญชี" />
          <SignOutConfirmButton className="w-full justify-center" />
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
        message="กิจกรรม แผนรายวัน และงบประมาณทั้งหมดจะถูกลบและกู้คืนไม่ได้ แนะนำให้ Export เก็บไว้ก่อน"
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
