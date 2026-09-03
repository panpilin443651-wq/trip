/**
 * ทดสอบการผูกงบรายหมวดเข้ากับงบรวม
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-budget.mts
 */
import { buildAllocation, distributeRemaining } from "@/lib/budget";
import { createDefaultState } from "@/lib/storage";
import type { CategoryId, Trip } from "@/lib/types";

let pass = 0, fail = 0;
const check = (n: string, c: boolean, e = "") => c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const base = createDefaultState().trip;
const make = (totalBudget: number, budgets: Partial<Record<CategoryId, number>>): Trip =>
  ({ ...base, totalBudget, budgets: { ...base.budgets, ...budgets } });

const sum = (b: Record<CategoryId, number>) => Object.values(b).reduce((s, v) => s + v, 0);

console.log("เทียบงบหมวดกับงบรวม");
let a = buildAllocation(make(10000, { food: 3000, transport: 2000 }));
check("แบ่งแล้ว 5000", a.allocated === 5000, String(a.allocated));
check("เหลือ 5000", a.unallocated === 5000, String(a.unallocated));
check("สถานะ = ยังแบ่งไม่ครบ", a.tone === "warn", a.tone);
check("เปอร์เซ็นต์ 50", a.percent === 50, String(a.percent));

a = buildAllocation(make(10000, { food: 12000 }));
check("แบ่งเกิน → tone over", a.tone === "over", a.tone);
check("เกินเป็นค่าติดลบ", a.unallocated === -2000, String(a.unallocated));
check("เปอร์เซ็นต์ตัดที่ 100", a.percent === 100, String(a.percent));

a = buildAllocation(make(10000, { food: 4000, transport: 6000 }));
check("แบ่งพอดี → tone ok", a.tone === "ok", a.tone);
check("เหลือ 0", a.unallocated === 0);

a = buildAllocation(make(0, { food: 500 }));
check("ยังไม่ตั้งงบรวม → empty", a.tone === "empty", a.tone);

console.log("\nเกลี่ยส่วนที่เหลือ");
let t = make(12000, { food: 3000, transport: 3000 });
let b = distributeRemaining(t);
check("ผลรวมเท่างบรวมเป๊ะ", sum(b) === 12000, String(sum(b)));
check("หมวดที่ตั้งไว้แล้วไม่ถูกแตะ", b.food === 3000 && b.transport === 3000, `${b.food}/${b.transport}`);
check("เกลี่ยลงหมวดที่ว่าง 4 หมวด", b.accommodation > 0 && b.attraction > 0 && b.shopping > 0 && b.other > 0);

// เศษหารไม่ลง: 10000 เหลือ 3 หมวดว่าง หาร 3 ไม่ลงตัว
t = make(10000, { food: 1000, transport: 1000, accommodation: 1000 });
b = distributeRemaining(t);
check("เศษไม่หาย ผลรวมยังเท่างบรวม", sum(b) === 10000, String(sum(b)));

// ตั้งครบทุกหมวดแล้ว → เกลี่ยตามสัดส่วนเดิม
t = make(20000, { food: 5000, transport: 5000, accommodation: 0, attraction: 0, shopping: 0, other: 0 });
b = distributeRemaining(t);
check("ยังมีหมวดว่าง → ลงหมวดว่างก่อน", b.food === 5000, String(b.food));

t = make(20000, { food: 6000, transport: 2000, accommodation: 1000, attraction: 500, shopping: 300, other: 200 });
b = distributeRemaining(t);
check("ตั้งครบทุกหมวด → เกลี่ยตามสัดส่วน ผลรวมตรง", sum(b) === 20000, String(sum(b)));
check("หมวดที่มากที่สุดยังมากที่สุด", b.food === Math.max(...Object.values(b)), String(b.food));

t = make(5000, { food: 8000 });
b = distributeRemaining(t);
check("แบ่งเกินอยู่แล้ว ไม่เกลี่ยเพิ่ม", b.food === 8000);

t = make(0, {});
b = distributeRemaining(t);
check("ไม่มีงบรวม ไม่เกลี่ย", sum(b) === 0);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
