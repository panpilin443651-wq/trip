import { GEMINI_API_KEY, GEMINI_MODEL } from "./config";

interface ModelInfo {
  name?: string;
  supportedGenerationMethods?: string[];
}

/**
 * ถามรายชื่อรุ่นที่คีย์นี้เห็น
 *
 * กรองด้วย generateContent ไม่ใช่ streamGenerateContent เพราะ ListModels
 * ไม่เคยรายงานเมธอดสตรีมออกมาเลย (ตรวจกับคีย์จริงแล้ว เห็นแค่ generateContent,
 * countTokens, createCachedContent, batchGenerateContent) รุ่นที่เรียกแบบ
 * ธรรมดาได้ก็สตรีมได้ กรองผิดตัวทำให้ได้รายการว่างเปล่าทุกครั้ง
 *
 * ระวัง: อยู่ในรายการไม่ได้แปลว่าเรียกได้ รุ่นที่ถูกปิดรับผู้ใช้ใหม่แล้ว
 * ยังโผล่อยู่ในรายการแต่ตอบ 404 เวลาเรียกจริง ผู้เรียกจึงต้องลองยิงดูเอง
 */
export async function listUsableModels(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
      {
        headers: { "x-goog-api-key": GEMINI_API_KEY },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: ModelInfo[] };
    return (data.models ?? [])
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** รุ่นเฉพาะทางที่ตอบแชทเป็นข้อความไม่ได้ หรือแพงเกินจำเป็น */
const NOT_FOR_CHAT =
  /embedding|aqa|imagen|image|veo|tts|transcribe|audio|live|robotics|computer-use|lyria|nano-banana|deep-research|antigravity|customtools|omni/;

/** ดึงเลขเวอร์ชันจากชื่อรุ่น เช่น gemini-3.6-flash -> 3.6 */
function versionOf(name: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(name);
  return m ? Number(m[1]) : 0;
}

/**
 * เรียงรุ่นที่น่าจะเหมาะกับแชทขึ้นก่อน
 *
 * ให้คะแนนจากเลขเวอร์ชันแทนการไล่ระบุรุ่นทีละตัว เพราะ Google ออกรุ่นใหม่
 * ถี่มากและปลดรุ่นเก่าออกจากผู้ใช้ใหม่เรื่อย ๆ ถ้าฮาร์ดโค้ดไว้ก็ต้องกลับมาแก้ทุกครั้ง
 * flash มาก่อน pro เพราะเร็วกว่าและถูกกว่าสำหรับงานตอบคำถามสั้น ๆ
 */
export function rankModels(models: string[]): string[] {
  return models
    .filter((m) => m.startsWith("gemini-") && !NOT_FOR_CHAT.test(m))
    .sort((a, b) => {
      const score = (name: string) =>
        versionOf(name) * 100 +
        (/flash/.test(name) ? 50 : 0) +
        (/lite/.test(name) ? -20 : 0) +
        (/preview|exp/.test(name) ? -60 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    });
}

/**
 * รุ่นที่ยิงแล้วผ่านจริง จำไว้ตลอดอายุ instance
 * คำขอแรกเท่านั้นที่ต้องจ่ายค่าไปถามรายชื่อและลองยิง
 */
let confirmed: string | null = null;

/** รุ่นที่จะลองก่อน — ค่าที่ตั้งใน env มาก่อน แล้วค่อยเป็นรุ่นที่ยืนยันแล้ว */
export function pickModel(): string {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  return confirmed ?? GEMINI_MODEL;
}

export function rememberModel(model: string): void {
  confirmed = model;
}

/** รายชื่อรุ่นสำรองเรียงตามความเหมาะสม ไว้ไล่ลองทีละตัว */
export async function candidateModels(): Promise<string[]> {
  return rankModels(await listUsableModels());
}
