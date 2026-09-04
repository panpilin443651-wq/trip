/**
 * ทดสอบการแปลข้อผิดพลาดของ Gemini เป็นข้อความให้ผู้ใช้อ่าน
 *
 * ใช้: node --experimental-strip-types --import ./scripts/alias-hooks.mjs scripts/test-gemini-errors.mts
 *
 * ส่วนนี้เป็นสิ่งเดียวที่ผู้ใช้เห็นเวลาผู้ช่วยพัง ถ้าชี้ผิดทางจะพาไปแก้ผิดจุด
 * เจอของจริงมาแล้ว — เดิมบล็อก catch กลืนทุกอย่างแล้วบอกว่า "ตรวจการเชื่อมต่อ
 * อินเทอร์เน็ต" ทั้งที่คำขอวิ่งมาถึงเซิร์ฟเวอร์เราแล้ว เน็ตผู้ใช้จึงใช้ได้แน่ ๆ
 * คนอ่านก็ไปนั่งรีสตาร์ตเราเตอร์ ทั้งที่ปัญหาอยู่ระหว่างเซิร์ฟเวอร์เรากับ Google
 */
import {
  describeFetchError,
  readUpstreamError,
  upstreamHint,
} from "@/lib/gemini/errors";

let pass = 0;
let fail = 0;
const check = (n: string, c: boolean, e = "") =>
  c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.log("  ✗ " + n + " " + e));

const named = (name: string, message: string, cause?: Error) => {
  const e = new Error(message, cause ? { cause } : undefined);
  e.name = name;
  return e;
};

console.log("\nต่อ Gemini ไม่ได้");
{
  const timeout = describeFetchError(
    named("TimeoutError", "The operation was aborted due to timeout"),
  );
  check("หมดเวลาแล้วบอกว่าหมดเวลา", timeout.hint.includes("ไม่ตอบกลับมาภายในเวลา"));
  check("ไม่โทษเน็ตของผู้ใช้", !timeout.hint.includes("ตรวจการเชื่อมต่ออินเทอร์เน็ต"));
  check("แนบชื่อข้อผิดพลาดจริงมาด้วย", timeout.detail.includes("TimeoutError"));

  const aborted = describeFetchError(named("AbortError", "aborted"));
  check("AbortError นับเป็นหมดเวลาเหมือนกัน", aborted.hint === timeout.hint);

  const netFail = describeFetchError(
    named("TypeError", "fetch failed", new Error("getaddrinfo ENOTFOUND")),
  );
  check(
    "ต่อไม่ติดบอกว่าเป็นขาเซิร์ฟเวอร์-Google",
    netFail.hint.includes("ต่อไปหา Google ไม่ได้"),
  );
  // ข้อความจริงของ fetch คือ "fetch failed" ลอย ๆ ซึ่งบอกอะไรไม่ได้เลย
  // สาเหตุจริงอยู่ใน cause ต้องดึงออกมาด้วยไม่งั้นตามไม่ได้
  check("ดึงสาเหตุจาก cause ออกมาด้วย", netFail.detail.includes("ENOTFOUND"), netFail.detail);
  check("บอกชัดว่าไม่ใช่เน็ตของผู้ใช้", netFail.hint.includes("ไม่ใช่เน็ตของคุณ"));

  check("ของที่ไม่ใช่ Error ก็ไม่ล่ม", describeFetchError("พัง").detail.length > 0);
  check("null ก็ไม่ล่ม", describeFetchError(null).detail.length > 0);
}

console.log("\nคำแนะนำตามรหัสสถานะ");
{
  check("429 บอกว่าโควตาเต็ม", upstreamHint(429, "").includes("โควตา"));
  check("503 บอกว่ารุ่นแน่น", upstreamHint(503, "").includes("แน่น"));
  check("403 ชี้ไปที่สิทธิ์ของคีย์", upstreamHint(403, "").includes("สิทธิ์"));

  // 400 มาได้หลายทางมาก ต้องแยกด้วยข้อความจริงจาก Google ไม่งั้นพาไปแก้ผิดจุด
  check(
    "400 + คีย์ผิด ชี้ไปที่คีย์",
    upstreamHint(400, "API key not valid. Please pass a valid API key.").includes(
      "API key ไม่ถูกต้อง",
    ),
  );
  check(
    "400 + ชื่อรุ่นผิดรูป ชี้ไปที่ GEMINI_MODEL",
    upstreamHint(400, "Invalid model name format").includes("GEMINI_MODEL"),
  );
  check("400 อื่น ๆ ไม่เดามั่ว", upstreamHint(400, "something else") === "คำขอถูกปฏิเสธ");
  check("รหัสที่ไม่รู้จักมีข้อความกลาง ๆ", upstreamHint(418, "").length > 0);
}

console.log("\nอ่านข้อความผิดพลาดจาก Google");
{
  const json = new Response(
    JSON.stringify({ error: { message: "  Quota exceeded  ", status: "RESOURCE_EXHAUSTED" } }),
  );
  check("ดึงข้อความจริงออกมาและตัดช่องว่าง", (await readUpstreamError(json)) === "Quota exceeded");

  const html = new Response("<html>502 Bad Gateway</html>");
  check(
    "ไม่ใช่ JSON ก็ยังได้ข้อความดิบมาดู",
    (await readUpstreamError(html)).includes("502"),
  );

  const empty = new Response(JSON.stringify({ error: {} }));
  check("ไม่มีข้อความก็ไม่ล่ม", typeof (await readUpstreamError(empty)) === "string");

  const long = new Response("x".repeat(1000));
  check("ตัดข้อความยาวไม่ให้ท่วมหน้าจอ", (await readUpstreamError(long)).length <= 300);
}

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
