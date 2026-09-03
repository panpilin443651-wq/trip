/**
 * ทดสอบเงื่อนไขที่ทำให้ป๊อปอัปเตือนเกินงบเด้ง
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-budget-alert.mts
 *
 * สำคัญเพราะเด้งพร่ำเพรื่อจะน่ารำคาญจนคนปิดทิ้งโดยไม่อ่าน
 * ส่วนไม่เด้งตอนควรเด้งก็เสียประโยชน์ทั้งหมด
 */
import { buildBreakdown } from "@/lib/budget";
import { createDefaultState } from "@/lib/storage";
import type { AppState, CategoryId } from "@/lib/types";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, e = "") => c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

function make(totalBudget: number, budgets: Partial<Record<CategoryId, number>>,
              spend: Array<[CategoryId, number]>): AppState {
  const s = createDefaultState();
  s.trip.totalBudget = totalBudget;
  s.trip.budgets = { ...s.trip.budgets, ...budgets };
  s.expenses = spend.map(([category, amount], i) => ({ id: `e${i}`, label: "x", amount, category }));
  return s;
}

/** ตรรกะเดียวกับที่ BudgetAlert ใช้ตัดสินว่าจะเด้งไหม */
function alertState(s: AppState) {
  const b = buildBreakdown(s);
  const overCategories = b.byCategory.filter((r) => r.budget > 0 && r.spent > r.budget);
  const overTotal = b.status.tone === "over";
  return { open: overTotal || overCategories.length > 0, overTotal, overCategories: overCategories.length };
}

console.log("เกินงบรวม");
let a = alertState(make(10000, { food: 5000 }, [["food", 12000]]));
check("เด้ง", a.open);
check("บอกว่าเกินงบรวม", a.overTotal);

console.log("\nเกินเฉพาะหมวด งบรวมยังเหลือ (เคสที่เดิมไม่เตือน)");
a = alertState(make(20000, { food: 3000 }, [["food", 5000]]));
check("เด้ง", a.open, "ใช้ไป 5000 จาก 20000 งบรวมยังเหลือ");
check("ไม่ใช่เกินงบรวม", !a.overTotal);
check("มี 1 หมวดที่เกิน", a.overCategories === 1);

console.log("\nอยู่ในงบทุกทาง");
a = alertState(make(20000, { food: 8000 }, [["food", 5000]]));
check("ไม่เด้ง", !a.open);

console.log("\nหมวดที่ยังไม่ได้ตั้งงบ ไม่ควรนับว่าเกิน");
a = alertState(make(20000, {}, [["food", 5000]]));
check("ไม่เด้ง เพราะยังไม่ได้ตั้งงบหมวดไหนเลย", !a.open);

console.log("\nยังไม่ได้ตั้งงบรวมเลย");
a = alertState(make(0, {}, [["food", 5000]]));
check("ไม่เด้ง", !a.open);

console.log("\nเกินหลายหมวดพร้อมกัน");
a = alertState(make(50000, { food: 1000, transport: 1000 }, [["food", 3000], ["transport", 2500]]));
check("เด้ง", a.open);
check("นับได้ 2 หมวด", a.overCategories === 2, String(a.overCategories));

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
