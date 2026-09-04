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
import {
  nextThinking,
  preferredThinking,
  rememberThinking,
  resetThinkingMemory,
  THINKING_LADDER,
  thinkingConfigFor,
} from "@/lib/gemini/thinking";

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

console.log("\nลำดับการลองโหมดคิดก่อนตอบ");
{
  /*
   * รุ่นที่ไม่รับค่าโหมดคิดตอบแค่ "Request contains an invalid argument."
   * ไม่ได้บอกว่าฟิลด์ไหนผิด จึงดักด้วยข้อความไม่ได้ ต้องไล่ลองแล้วจำเอา
   * เคยลองดักด้วยคำว่า thinking/thought มาแล้วและพลาด เพราะข้อความจริง
   * ของ Google ไม่มีคำพวกนั้นเลย
   */
  resetThinkingMemory();

  check("รุ่นใหม่เริ่มจากปิดสนิท", preferredThinking("รุ่นก") === 0);
  check("ปิดสนิทไม่ได้ ลองคิดนิดเดียว", nextThinking(0) === 128);
  check("คิดนิดเดียวไม่ได้ ลองไม่ส่งเลย", nextThinking(128) === null);
  check("ไม่ส่งเลยคือขั้นสุดท้าย", nextThinking(null) === undefined);
  check("ค่าที่ไม่อยู่ในลำดับไม่วนไม่จบ", nextThinking(999) === undefined);

  // ค่าที่พิสูจน์แล้วต้องถูกจำ ไม่งั้นทุกคำถามจะเสียรอบลองผิดซ้ำ ๆ
  rememberThinking("รุ่นก", null);
  check("จำค่าที่ใช้ได้แล้ว", preferredThinking("รุ่นก") === null);
  check("รุ่นอื่นไม่ถูกกระทบ", preferredThinking("รุ่นข") === 0);

  // 0 เป็นค่าที่ถูกต้องและต่างจาก "ยังไม่เคยลอง" ต้องไม่สับสนกัน
  resetThinkingMemory();
  rememberThinking("รุ่นค", 0);
  check("จำค่า 0 ได้ ไม่ถูกอ่านเป็นยังไม่เคยลอง", preferredThinking("รุ่นค") === 0);

  check("ปิดสนิทส่งฟิลด์ไปด้วย", "thinkingConfig" in thinkingConfigFor(0));
  check("ไม่ส่งเลยไม่มีฟิลด์", Object.keys(thinkingConfigFor(null)).length === 0);
  check(
    "ค่างบถูกส่งตรงตามที่ขอ",
    JSON.stringify(thinkingConfigFor(128)) === '{"thinkingConfig":{"thinkingBudget":128}}',
    JSON.stringify(thinkingConfigFor(128)),
  );
  check("ทุกขั้นในลำดับต่างกัน", new Set(THINKING_LADDER.map(String)).size === THINKING_LADDER.length);
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
