/** บทบาทตามที่ Gemini ใช้ — "model" ไม่ใช่ "assistant" */
export type ChatRole = "user" | "model";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** ข้อความนี้เป็นการแจ้งข้อผิดพลาด ไม่ใช่คำตอบจริงจากโมเดล */
  error?: boolean;
}
