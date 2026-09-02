interface GeminiPart {
  text?: string;
}

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * แปลงสตรีม SSE ของ Gemini เป็นสตรีมข้อความล้วน
 *
 * แยกออกมาจาก route handler เพราะเป็นส่วนที่ผิดพลาดง่ายที่สุด — ข้อมูลมาเป็นก้อน
 * ที่ตัดกลางบรรทัดได้ ต้องพักไว้ใน buffer จนกว่าจะเจอบรรทัดว่างที่คั่นอีเวนต์
 * อยู่ตรงนี้แล้วป้อนสตรีมจำลองเข้าไปทดสอบได้โดยไม่ต้องมี API key
 */
export function geminiTextStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      const drain = () => {
        let cut = buffer.indexOf("\n\n");
        while (cut !== -1) {
          const event = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const chunk = JSON.parse(raw) as GeminiChunk;
              if (chunk.promptFeedback?.blockReason) {
                controller.enqueue(
                  encoder.encode("\n(คำตอบถูกระงับโดยตัวกรองเนื้อหาของ Gemini)"),
                );
                continue;
              }
              const text = (chunk.candidates?.[0]?.content?.parts ?? [])
                .map((p) => p.text ?? "")
                .join("");
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // อีเวนต์ที่ JSON ไม่สมบูรณ์ ข้ามไป ดีกว่าทำทั้งสตรีมล้ม
            }
          }
          cut = buffer.indexOf("\n\n");
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // บางตัวส่ง CRLF มา ทำให้หาบรรทัดว่างด้วย \n\n ไม่เจอ
          buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
          drain();
        }
        // ก้อนสุดท้ายอาจไม่มีบรรทัดว่างปิดท้าย เติมให้เองจะได้ไม่ตกข้อความ
        buffer += "\n\n";
        drain();
      } catch {
        controller.enqueue(
          encoder.encode("\n\n(การเชื่อมต่อขาดระหว่างตอบ ลองถามใหม่อีกครั้ง)"),
        );
      } finally {
        controller.close();
      }
    },
  });
}
