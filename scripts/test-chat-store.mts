/**
 * ทดสอบว่าช่องแชทสองช่องเก็บประวัติแยกกันจริง
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-chat-store.mts
 *
 * เดิมที่เก็บประวัติเป็นตัวแปรระดับโมดูลผูกกับคีย์เดียว พอเพิ่มผู้ช่วยแนะนำที่เที่ยว
 * เข้ามาเป็นช่องที่สอง ทั้งสองจะเขียนทับกัน — ถามในหน้าแนะนำเที่ยวแล้วประวัติ
 * ในหน้าผู้ช่วยหายทั้งดุ้น เป็นบั๊กที่ผู้ใช้เจอแน่ถ้าไม่แยก
 */

/** localStorage ปลอม ต้องตั้งก่อน import โมดูลที่อ่านมัน */
const store = new Map<string, string>();
let throwOnWrite = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (throwOnWrite) throw new Error("โควตาเต็ม");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  },
};

const { createChatStore } = await import("@/lib/chat/storage");
import type { ChatMessage } from "@/lib/chat/types";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const msg = (id: string, text: string): ChatMessage => ({
  id,
  role: "user",
  text,
});

console.log("\nสองช่องต้องไม่เขียนทับกัน");
{
  const a = createChatStore("ทดสอบ:ก");
  const b = createChatStore("ทดสอบ:ข");

  a.setMessages([msg("1", "คำถามช่องก")]);
  b.setMessages([msg("2", "คำถามช่องข")]);

  check("ช่อง ก เก็บของตัวเอง", a.getSnapshot()[0]?.text === "คำถามช่องก");
  check("ช่อง ข เก็บของตัวเอง", b.getSnapshot()[0]?.text === "คำถามช่องข");
  check("เขียนคนละคีย์ใน localStorage", store.has("ทดสอบ:ก") && store.has("ทดสอบ:ข"));

  b.clearMessages();
  check("ล้างช่อง ข แล้วช่อง ก ไม่หาย", a.getSnapshot().length === 1);
  check("ล้างช่อง ข แล้วช่อง ข ว่างจริง", b.getSnapshot().length === 0);
}

console.log("\nอ่านของเดิมกลับมาได้");
{
  const again = createChatStore("ทดสอบ:ก");
  check("อ่านจาก localStorage ตอนเรียกครั้งแรก", again.getSnapshot()[0]?.text === "คำถามช่องก");
}

console.log("\nคืน reference เดิมถ้าข้อมูลไม่เปลี่ยน");
{
  // ถ้าคืน array ใหม่ทุกครั้ง useSyncExternalStore จะเรนเดอร์วนไม่จบ
  const s = createChatStore("ทดสอบ:ค");
  check("เรียกซ้ำได้ค่าเดิม", s.getSnapshot() === s.getSnapshot());
  s.setMessages([msg("1", "ก")]);
  check("เรียกซ้ำหลังเซ็ตก็ยังได้ค่าเดิม", s.getSnapshot() === s.getSnapshot());
}

console.log("\nแจ้งผู้ติดตามเฉพาะช่องของตัวเอง");
{
  const a = createChatStore("ทดสอบ:ง");
  const b = createChatStore("ทดสอบ:จ");
  let hitA = 0;
  let hitB = 0;
  const off = a.subscribe(() => hitA++);
  b.subscribe(() => hitB++);

  b.setMessages([msg("1", "ข")]);
  check("เซ็ตช่อง ข แล้วช่อง ก ไม่ถูกแจ้ง", hitA === 0 && hitB === 1);

  a.setMessages([msg("2", "ก")]);
  check("เซ็ตช่อง ก แล้วช่อง ก ถูกแจ้ง", hitA === 1);

  off();
  a.setMessages([msg("3", "ก อีกที")]);
  check("ยกเลิกติดตามแล้วไม่ถูกแจ้งอีก", hitA === 1);
}

console.log("\nกรณีข้อมูลเสีย");
{
  store.set("ทดสอบ:พัง", "{ไม่ใช่ JSON");
  check("JSON พังแล้วเริ่มใหม่แทนที่จะโยน", createChatStore("ทดสอบ:พัง").getSnapshot().length === 0);

  store.set("ทดสอบ:ผิดรูป", JSON.stringify([{ id: 1 }, { role: "ระบบ", text: "x" }]));
  check("ข้อความผิดรูปถูกคัดทิ้ง", createChatStore("ทดสอบ:ผิดรูป").getSnapshot().length === 0);

  store.set("ทดสอบ:ไม่ใช่อาเรย์", JSON.stringify({ a: 1 }));
  check("ไม่ใช่อาเรย์ก็ไม่ล่ม", createChatStore("ทดสอบ:ไม่ใช่อาเรย์").getSnapshot().length === 0);
}

console.log("\nเขียนไม่ได้ก็ต้องใช้ต่อได้");
{
  const s = createChatStore("ทดสอบ:เต็ม");
  throwOnWrite = true;
  s.setMessages([msg("1", "ยังคุยได้")]);
  throwOnWrite = false;
  check("โควตาเต็มแล้วยังคุยต่อได้", s.getSnapshot()[0]?.text === "ยังคุยได้");
  check("แต่ไม่ได้เขียนลง localStorage", !store.has("ทดสอบ:เต็ม"));
}

console.log("\nจำกัดจำนวนข้อความ");
{
  const s = createChatStore("ทดสอบ:ยาว");
  s.setMessages(Array.from({ length: 60 }, (_, i) => msg(String(i), "ข้อความ " + i)));
  const kept = s.getSnapshot();
  check(`เก็บไม่เกิน 40 ข้อความ (ได้ ${kept.length})`, kept.length === 40);
  check("ตัดของเก่าทิ้ง เก็บของใหม่ไว้", kept.at(-1)?.text === "ข้อความ 59");
}

console.log("\nฝั่งเซิร์ฟเวอร์ต้องเห็นรายการว่างเสมอ");
{
  // ไม่งั้น HTML ที่เซิร์ฟเวอร์เรนเดอร์จะไม่ตรงกับฝั่งเบราว์เซอร์
  const s = createChatStore("ทดสอบ:ก");
  check("getServerSnapshot คืนว่าง", s.getServerSnapshot().length === 0);
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);

// เก็บ window ปลอมทิ้งก่อนจบ ไม่งั้น Node บนวินโดวส์ล้มตอนปิดตัว
// (Assertion failed ใน libuv async.c แล้วได้ exit code 127 ทั้งที่เทสต์ผ่านหมด)
delete (globalThis as unknown as { window?: unknown }).window;
process.exitCode = fail === 0 ? 0 : 1;
