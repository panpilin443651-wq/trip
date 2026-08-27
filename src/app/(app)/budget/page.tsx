"use client";

import { useMemo, useState } from "react";
import { BudgetCategoryCard } from "@/components/BudgetCategoryCard";
import { BudgetSummary } from "@/components/BudgetSummary";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  Field,
  Input,
  SectionTitle,
  Select,
  Sheet,
} from "@/components/ui";
import { CATEGORIES } from "@/data/categories";
import { buildBreakdown } from "@/lib/budget";
import { formatTHB, toNumber } from "@/lib/format";
import { useTrip } from "@/lib/trip-context";
import type { CategoryId } from "@/lib/types";

export default function BudgetPage() {
  const { state, dispatch } = useTrip();
  const breakdown = useMemo(() => buildBreakdown(state), [state]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<CategoryId>("accommodation");

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
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={state.trip.totalBudget}
              onChange={(e) =>
                dispatch({
                  type: "updateTrip",
                  patch: { totalBudget: Math.max(0, toNumber(e.target.value)) },
                })
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

        <Button
          variant="secondary"
          className="w-full sm:hidden"
          onClick={() => setSheetOpen(true)}
        >
          ➕ เพิ่มค่าใช้จ่ายที่ไม่ได้อยู่ในแผน
        </Button>

        <p className="text-xs leading-relaxed text-faint">
          รายการที่ขึ้นต้นด้วย 📋 มาจากกิจกรรมในหน้าแผนเที่ยว
          แก้ไขจำนวนเงินได้ที่กิจกรรมนั้นโดยตรง ส่วน 💵 คือค่าใช้จ่ายที่เพิ่มในหน้านี้
        </p>
      </div>

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
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Math.max(0, toNumber(e.target.value)))}
              placeholder="0"
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
