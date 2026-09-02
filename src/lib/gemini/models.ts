import { GEMINI_API_KEY, GEMINI_MODEL } from "./config";

interface ModelInfo {
  name?: string;
  supportedGenerationMethods?: string[];
}

/**
 * ถามรายชื่อรุ่นที่คีย์นี้ใช้ได้จริง
 *
 * คีย์แต่ละใบเห็นรุ่นไม่เท่ากัน ขึ้นกับโปรเจกต์และช่วงเวลาที่ Google เปิดให้
 * เวลาเจอ 404 จึงต้องบอกได้ว่าให้ใส่ชื่ออะไรแทน ไม่ใช่ปล่อยให้ไปเดาเอง
 * คืนอาร์เรย์ว่างถ้าถามไม่สำเร็จ ผู้เรียกต้องเผื่อกรณีนี้ไว้
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
        (m.supportedGenerationMethods ?? []).includes("streamGenerateContent"),
      )
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * เรียงรุ่นที่น่าจะเหมาะที่สุดขึ้นก่อน
 * flash เร็วและอยู่ในชั้นฟรี ส่วน pro ช้ากว่าและกินโควตามากกว่า
 * ตัดรุ่นเฉพาะทาง (ฝังเวกเตอร์ รูป เสียง) ที่ตอบแชทไม่ได้ออก
 */
export function rankModels(models: string[]): string[] {
  return models
    .filter(
      (m) =>
        !/embedding|aqa|image|imagen|veo|tts|audio|native-audio|live/.test(m),
    )
    .sort((a, b) => {
      const score = (name: string) =>
        (/flash/.test(name) ? 100 : 0) +
        (/lite/.test(name) ? -10 : 0) +
        (/preview|exp/.test(name) ? -30 : 0) +
        (/2\.5/.test(name) ? 20 : /2\.0/.test(name) ? 10 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    });
}

/**
 * รุ่นที่ค้นเจอว่าใช้ได้ จำไว้ตลอดอายุ instance
 * คำขอแรกเท่านั้นที่ต้องจ่ายค่าไปถามรายชื่อ คำขอถัด ๆ ไปใช้ค่านี้เลย
 */
let discovered: string | null = null;

/** รุ่นที่จะลองก่อน — ค่าที่ตั้งใน env มาก่อน แล้วค่อยเป็นรุ่นที่เคยค้นเจอ */
export function pickModel(): string {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  return discovered ?? GEMINI_MODEL;
}

/** หารุ่นที่คีย์นี้ใช้ได้จริง แล้วจำไว้ คืน null ถ้าหาไม่เจอ */
export async function discoverModel(): Promise<string | null> {
  const usable = rankModels(await listUsableModels());
  if (usable.length === 0) return null;
  discovered = usable[0];
  return discovered;
}
