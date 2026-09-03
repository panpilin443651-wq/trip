"use client";

import { useMemo, useState } from "react";
import { BudgetCategoryCard } from "@/components/BudgetCategoryCard";
import { BudgetEstimator } from "@/components/BudgetEstimator";
import { FuelEstimate } from "@/components/FuelEstimate";
import { BudgetSummary } from "@/components/BudgetSummary";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  Field,
  Input,
  NumberInput,
  SectionTitle,
  Select,
  Sheet,
  Textarea,
} from "@/components/ui";
import { CATEGORIES } from "@/data/categories";
import { buildBreakdown } from "@/lib/budget";
import { formatTHB } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import type { CategoryId } from "@/lib/types";

export default function BudgetPage() {
  const { state, dispatch, saveNow, lastSavedAt } = useTrip();
  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<CategoryId>("accommodation");

  // เก็บบันทึกไว้ในเครื่องก่อน แล้วค่อยลง state ตอนกดปุ่ม
  // ปุ่มบันทึกจะได้มีความหมายจริง ไม่ใช่ปุ่มหลอก
  const [note, setNote] = useState(state.trip.budgetNote);
  const [saved, setSaved] = useState(false);
  const noteDirty = note !== state.trip.budgetNote;

  const savedAtLabel = lastSavedAt
    ? `เมื่อ ${new Date(lastSavedAt).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })} น.`
    : "";

  function saveBudget() {
    if (noteDirty) {
      dispatch({ type: "updateTrip", patch: { budgetNote: note } });
      saveNow({ budgetNote: note });
    } else {
      saveNow();
    }
    setSaved(true);
  }

  const plannedTotal = breakdown.byCategory.reduce((sum, c) => sum + c.budget, 0);
  const perPerson =
    state.trip.travelers > 1
      ? breakdown.totalSpent / state.trip.travelers
      : null;

  function addExpense() {
    if (!label.trim() || amount <= 0) return;
    dispatch({
      type: "addExpense",
      expense: { label: label.trim(), amount, category },
    });
    setLabel("");
    setAmount(0);
    setSheetOpen(false);
  }

  return (
    <>
      <PageHeader
        emoji="💰"
        title="งบประมาณ"
        subtitle="ค่าใช้จ่ายจากกิจกรรมจะถูกรวมเข้ามาอัตโนมัติ"
        action={
          <Button onClick={() => setSheetOpen(true)} className="hidden sm:inline-flex">
            ➕ เพิ่มค่าใช้จ่าย
          </Button>
        }
      />

      <div className="space-y-4">
        <BudgetSummary breakdown={breakdown} />

        <Card>
          <Field
            label="งบรวมของทริป (บาท)"
            hint={
              plannedTotal > state.trip.totalBudget && state.trip.totalBudget > 0
                ? `⚠️ งบที่ตั้งรายหมวดรวมกัน ${formatTHB(plannedTotal)} ซึ่งมากกว่างบรวม`
                : undefined
            }
          >
            <NumberInput
              step={100}
              placeholder="เช่น 15000"
              value={state.trip.totalBudget}
              onValueChange={(totalBudget) =>
                dispatch({ type: "updateTrip", patch: { totalBudget } })
              }
            />
          </Field>

          {perPerson !== null ? (
            <p className="mt-3 text-sm text-muted">
              👥 เฉลี่ยคนละ{" "}
              <span className="font-medium text-ink">{formatTHB(perPerson)}</span>{" "}
              ({state.trip.travelers} คน)
            </p>
          ) : null}
        </Card>

        <section>
          <SectionTitle
            emoji="🗂️"
            title="แยกตามหมวด"
            action={
              <span className="text-xs text-muted">ช่องขวา = งบที่ตั้งไว้</span>
            }
          />
          <div className="space-y-3">
            {breakdown.byCategory.map((row) => (
              <BudgetCategoryCard
                key={row.id}
                row={row}
                onBudgetChange={(categoryId, value) =>
                  dispatch({
                    type: "updateTrip",
                    patch: {
                      budgets: { ...state.trip.budgets, [categoryId]: value },
                    },
                  })
                }
                onDeleteExpense={(expenseId) =>
                  dispatch({ type: "deleteExpense", id: expenseId })
                }
              />
            ))}
          </div>
        </section>

        <BudgetEstimator />

        <FuelEstimate />

        <Card as="section">
          <SectionTitle emoji="📝" title="บันทึกช่วยจำเรื่องงบ" />

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น จ่ายมัดจำที่พักไปแล้ว 2,000 / หารกัน 4 คน / ยังไม่รวมค่าน้ำมันขากลับ"
            className="min-h-24"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={saveBudget}>
              💾 บันทึก
            </Button>

            <span className="text-sm">
              {noteDirty ? (
                <span className="text-warn">● มีการแก้ไขที่ยังไม่ได้บันทึก</span>
              ) : saved ? (
                <span className="text-ok">✓ บันทึกแล้ว {savedAtLabel}</span>
              ) : (
                <span className="text-muted">
                  ระบบบันทึกอัตโนมัติอยู่แล้ว กดปุ่มนี้เพื่อบันทึกทันที
                </span>
              )}
            </span>
          </div>
        </Card>

        <p className="text-xs leading-relaxed text-faint">
          รายการที่ขึ้นต้นด้วย 📋 มาจากกิจกรรมในหน้าแผนเที่ยว
          แก้ไขจำนวนเงินได้ที่กิจกรรมนั้นโดยตรง ส่วน 💵 คือค่าใช้จ่ายที่เพิ่มในหน้านี้
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="เพิ่มค่าใช้จ่าย"
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-canvas shadow-lg transition-colors hover:bg-brand-dark sm:hidden"
      >
        ＋
      </button>

      <Sheet
        open={sheetOpen}
        title="เพิ่มค่าใช้จ่าย"
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setSheetOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1"
              disabled={!label.trim() || amount <= 0}
              onClick={addExpense}
            >
              บันทึก
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="รายการ">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="เช่น ค่าที่พัก 2 คืน / ค่าน้ำมัน"
              autoFocus
            />
          </Field>

          <Field label="หมวด">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
            >
              {CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.emoji} {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="จำนวนเงิน (บาท)">
            <NumberInput
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
