/**
 * ทดสอบการย้ายข้อมูลของ storage.ts — ตัวสำคัญที่สุดในโปรเจกต์
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-storage.mts
 * (ต้องรันจากรากโปรเจกต์)
 *
 * ถ้าตรงนี้พัง ผู้ใช้ที่มีแผนเดิมอยู่จะเปิดเว็บมาแล้วแผนหาย
 * จึงคุ้มที่จะมีเทสต์ถาวรไว้ ไม่ใช่ทดสอบครั้งเดียวแล้วทิ้ง
 */
import { normalizeLibrary, createDefaultLibrary, activeTrip, isTripEmpty } from "@/lib/storage";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  " + extra : "")); }
}

console.log("ย้ายข้อมูลรุ่นเก่า (ทริปเดียว) มาเป็นคลังแผน");
const legacy = {
  version: 1,
  trip: {
    name: "เชียงใหม่ 3 วัน", provinces: ["เชียงใหม่"], districts: {},
    dayPlans: [{ province: "เชียงใหม่", legs: [], note: "" }],
    mainTransport: "car", startDate: "2026-01-10", dayCount: 3,
    travelers: 2, totalBudget: 15000,
    budgets: { transport: 5000, accommodation: 4000, food: 3000, attraction: 2000, shopping: 1000, other: 0 },
    notes: "", budgetNote: "",
  },
  activities: [{ id: "a1", dayIndex: 0, startTime: "09:00", durationMin: 60, title: "ไหว้พระ", placeName: "วัดพระธาตุดอยสุเทพ", detail: "", cost: 100, category: "attraction", order: 1 }],
  expenses: [{ id: "e1", label: "ค่าน้ำมัน", amount: 2000, category: "transport" }],
  places: [{ id: "p1", name: "ถนนคนเดิน", province: "เชียงใหม่", note: "", priority: "high", visited: false }],
  checklist: [{ id: "c1", group: "เอกสาร", text: "บัตรประชาชน", done: true }],
};
const lib = normalizeLibrary(legacy);
check("ได้คลังที่มีแผนเดียว", lib.trips.length === 1, `ได้ ${lib.trips.length}`);
const only = activeTrip(lib);
check("ชื่อทริปยังอยู่", only.trip.name === "เชียงใหม่ 3 วัน", only.trip.name);
check("กิจกรรมยังอยู่", only.activities.length === 1);
check("ค่าใช้จ่ายยังอยู่", only.expenses.length === 1);
check("สถานที่ยังอยู่", only.places.length === 1);
check("เช็กลิสต์ยังอยู่", only.checklist.length === 1);
check("งบรวมยังอยู่", only.trip.totalBudget === 15000);
check("งบหมวดยังอยู่", only.trip.budgets.transport === 5000);
check("ได้ id ใหม่", typeof only.id === "string" && only.id.length > 0);
check("activeTripId ชี้ถูก", lib.activeTripId === only.id);
check("createdAt ใช้ startDate เดิม", only.createdAt === "2026-01-10", only.createdAt);

console.log("\nรูปแบบใหม่ หลายแผน");
const multi = normalizeLibrary({
  version: 2, activeTripId: "t2",
  trips: [
    { ...legacy, id: "t1", createdAt: "2026-01-01" },
    { ...legacy, id: "t2", createdAt: "2026-02-01", trip: { ...legacy.trip, name: "ภูเก็ต" } },
  ],
});
check("ได้ 2 แผน", multi.trips.length === 2);
check("เปิดแผนที่ถูก", activeTrip(multi).trip.name === "ภูเก็ต");

console.log("\nกรณีข้อมูลพัง");
check("null → คลังเปล่า 1 แผน", normalizeLibrary(null).trips.length === 1);
check("trips ว่าง → คลังเปล่า 1 แผน", normalizeLibrary({ version: 2, activeTripId: "x", trips: [] }).trips.length === 1);
const dup = normalizeLibrary({ version: 2, activeTripId: "same", trips: [{ ...legacy, id: "same" }, { ...legacy, id: "same" }] });
check("id ซ้ำถูกแก้ให้ไม่ซ้ำ", dup.trips[0].id !== dup.trips[1].id, `${dup.trips[0].id} / ${dup.trips[1].id}`);
const badActive = normalizeLibrary({ version: 2, activeTripId: "ไม่มีจริง", trips: [{ ...legacy, id: "t1" }] });
check("activeTripId ที่ไม่มีจริง ถูกดึงกลับมาที่แผนแรก", badActive.activeTripId === "t1", badActive.activeTripId);

console.log("\nisTripEmpty");
check("แผนเปล่า = ว่าง", isTripEmpty(createDefaultLibrary().trips[0]));
check("แผนที่มีของ = ไม่ว่าง", !isTripEmpty(only));

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
