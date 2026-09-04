/**
 * แปลข้อผิดพลาดของ Gemini เป็นข้อความที่ผู้ใช้อ่านแล้วรู้ว่าต้องแก้ตรงไหน
 *
 * แยกจาก chat-stream.ts เพราะไฟล์นั้น import next/server ซึ่งโหลดใน Node
 * เปล่า ๆ ไม่ได้ ตรรกะแปลข้อความเป็นส่วนที่พลาดง่ายและตรวจด้วยตาไม่ออก
 * จึงต้องอยู่ในที่ที่เขียนเทสต์ได้
 */

/**
 * ดึงข้อความผิดพลาดจริงที่ Google ส่งมา
 *
 * ต้องเอามาโชว์ด้วยเสมอ เพราะรหัสสถานะเดียวกันมาได้จากหลายสาเหตุมาก
 * โดยเฉพาะ 400 ที่เป็นได้ทั้งคีย์ผิด รูปแบบคำขอผิด และรุ่นไม่รองรับฟีเจอร์
 * ถ้าเดาเองจะพาไปแก้ผิดจุด
 */
export async function readUpstreamError(res: Response): Promise<string> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return "";
  }

  /*
   * แยก try ของการอ่าน body กับการแปลง JSON ออกจากกัน
   *
   * เดิมรวมเป็น try เดียว พอ Google หรือพร็อกซีตอบมาเป็น HTML (เช่นหน้า
   * 502 Bad Gateway) JSON.parse จะโยน แล้วเราคืนสตริงว่าง — ทิ้งเบาะแส
   * เดียวที่มีไปเฉย ๆ ทั้งที่คอมเมนต์ของฟังก์ชันบอกเองว่าต้องเอาข้อความดิบมาโชว์
   */
  try {
    const data = JSON.parse(text) as {
      error?: { message?: string; status?: string };
    };
    const detail = data.error?.message?.trim();
    if (detail) return detail;
  } catch {
    // ไม่ใช่ JSON — ตกไปใช้ข้อความดิบด้านล่าง
  }
  return text.slice(0, 300);
}

/** คำแนะนำตามรหัสสถานะ ใช้คู่กับข้อความจริงจาก Google เสมอ */
export function upstreamHint(status: number, detail: string): string {
  if (status === 429) {
    return "โควตาฟรีของ Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่";
  }
  if (status === 503) {
    return "รุ่นที่ใช้อยู่มีคนใช้แน่นชั่วคราว รอสักครู่แล้วลองใหม่";
  }
  if (status === 403) {
    return "คีย์ไม่มีสิทธิ์เรียก — ตรวจว่าเปิดใช้ Generative Language API แล้ว และคีย์ไม่ได้ถูกจำกัดโดเมน/IP";
  }
  if (status === 400) {
    // 400 มาได้หลายทาง แยกด้วยข้อความที่ Google ส่งมา
    if (/API key not valid|API_KEY_INVALID/i.test(detail)) {
      return "API key ไม่ถูกต้อง — คัดลอกคีย์จาก Google AI Studio มาใหม่";
    }
    if (/model name format|GenerateContentRequest.model/i.test(detail)) {
      return (
        "ชื่อรุ่นผิดรูป — ถ้าตั้ง GEMINI_MODEL ไว้ ให้ลบทิ้งแล้ว redeploy " +
        "(แอปหารุ่นที่ใช้ได้เอง) หรือใส่แค่ชื่อล้วน ๆ เช่น gemini-3.6-flash " +
        "ห้ามมีเครื่องหมายคำพูด ช่องว่าง หรือคำนำหน้า models/"
      );
    }
    return "คำขอถูกปฏิเสธ";
  }
  return "ผู้ช่วยไม่ตอบสนอง ลองใหม่อีกครั้ง";
}

/**
 * 400 นี้เกิดจากรุ่นไม่รู้จัก thinkingConfig หรือเปล่า
 *
 * เราปิดโหมดคิดก่อนตอบเพื่อให้ตอบไวขึ้น แต่รุ่นเก่าที่ไม่มีโหมดนี้จะตอบ 400
 * กลับมาแทนที่จะเมินฟิลด์ที่ไม่รู้จัก ต้องจับให้ได้แล้วยิงใหม่แบบไม่ส่ง
 * ไม่งั้นผู้ช่วยจะพังทั้งตัวกับรุ่นที่ไม่รองรับ
 */
export function isThinkingUnsupported(detail: string): boolean {
  return /thinking|thought/i.test(detail);
}

/**
 * แปลงข้อผิดพลาดของ fetch เป็นข้อความที่บอกได้ว่าเกิดอะไรขึ้นจริง
 *
 * เดิมบล็อก catch กลืนทุกอย่างแล้วบอกว่า "ตรวจการเชื่อมต่ออินเทอร์เน็ต"
 * ซึ่งชี้ผิดทางเสมอ เพราะกว่าจะมาถึงบรรทัดนี้ได้ คำขอของผู้ใช้ต้องวิ่งถึง
 * เซิร์ฟเวอร์เราแล้ว เน็ตของผู้ใช้จึงใช้ได้อยู่แน่ ๆ ที่ต่อไม่ติดคือ
 * ขาระหว่างเซิร์ฟเวอร์เรากับ Google ต่างหาก
 */
export function describeFetchError(error: unknown): { hint: string; detail: string } {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? ` (${error.cause.message})`
      : "";
  const detail = `${name || "Error"}: ${message}${cause}`;

  if (name === "TimeoutError" || name === "AbortError") {
    return {
      hint:
        "Gemini ไม่ตอบกลับมาภายในเวลาที่รอ ลองใหม่อีกครั้ง " +
        "ถ้าเป็นบ่อยแปลว่าคำถามยาวเกินไปหรือรุ่นที่ใช้อยู่กำลังแน่น",
      detail,
    };
  }
  return {
    hint:
      "เซิร์ฟเวอร์ของเว็บต่อไปหา Google ไม่ได้ " +
      "(ไม่ใช่เน็ตของคุณ เพราะคำขอวิ่งมาถึงเซิร์ฟเวอร์แล้ว)",
    detail,
  };
}
