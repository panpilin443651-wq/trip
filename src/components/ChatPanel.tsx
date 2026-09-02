"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clearMessages,
  getServerSnapshot,
  getSnapshot,
  setMessages,
  subscribe,
} from "@/lib/chat/storage";
import { summarizeTrip } from "@/lib/chat/trip-summary";
import type { ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";
import { useTrip } from "@/lib/trip-context";
import { Button, Textarea } from "./ui";

/** คำถามตั้งต้น ให้กดถามได้เลยโดยไม่ต้องคิดว่าจะเริ่มยังไง */
const STARTERS = [
  "เว็บนี้ทำอะไรได้บ้าง",
  "งบเหลือเท่าไร",
  "เพิ่มรูปความทรงจำยังไง",
  "ช่วยดูแผนวันแรกให้หน่อย",
];

/**
 * ตัวแชทจริง ใช้ซ้ำทั้งในปุ่มลอยและหน้าเต็ม
 *
 * ประวัติเก็บใน localStorage ฝั่งเบราว์เซอร์ ส่วนคำตอบสตรีมมาจาก /api/chat
 * ซึ่งเป็นตัวเดียวที่แตะ API key ของ Gemini
 */
export function ChatPanel({ className }: { className?: string }) {
  const { state } = useTrip();
  // เก็บใน external store ไม่ใช่ useState ดูเหตุผลใน lib/chat/storage.ts
  const messages = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setBusy(true);

    const replyId = newId();
    let reply = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, text: m.text })),
          tripSummary: summarizeTrip(state),
        }),
      });

      if (!res.ok || !res.body) {
        // เซิร์ฟเวอร์คืน JSON ตอนพลาด แต่ถ้าโดน redirect จะได้ HTML มาแทน
        let message = "ผู้ช่วยไม่พร้อมใช้งานตอนนี้";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          if (res.status === 401) message = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
        }
        const failed = [
          ...history,
          { id: replyId, role: "model" as const, text: message, error: true },
        ];
        setMessages(failed);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // ใส่ฟองเปล่าไว้ก่อน แล้วเติมข้อความเข้าไปทีละก้อนระหว่างสตรีม
      setMessages([...history, { id: replyId, role: "model", text: "" }], false);

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages(
          [...history, { id: replyId, role: "model", text: reply }],
          false,
        );
      }

      const done: ChatMessage[] = [
        ...history,
        {
          id: replyId,
          role: "model",
          text: reply.trim() || "ผู้ช่วยไม่ได้ตอบอะไรกลับมา ลองถามใหม่อีกครั้ง",
        },
      ];
      setMessages(done);
    } catch {
      const failed: ChatMessage[] = [
        ...history,
        {
          id: replyId,
          role: "model",
          text: "ส่งคำถามไม่สำเร็จ — ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่",
          error: true,
        },
      ];
      setMessages(failed);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    clearMessages();
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-5">
            <p className="text-sm leading-relaxed text-muted">
              👋 ถามได้ทั้งเรื่องวิธีใช้เว็บ และเรื่องทริปที่คุณกรอกไว้
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="min-h-9 rounded-full border border-line px-3 text-xs text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-brand text-canvas"
                    : m.error
                      ? "border border-danger/40 bg-card text-danger"
                      : "border border-line bg-card text-ink",
                )}
              >
                {m.text || "…"}
              </div>
            </div>
          ))
        )}

        {busy && messages.at(-1)?.role === "user" ? (
          <p className="px-1 text-xs text-faint">ผู้ช่วยกำลังพิมพ์…</p>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="mt-3 shrink-0 border-t border-line pt-3">
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="พิมพ์คำถาม…"
            aria-label="คำถามถึงผู้ช่วย"
            className="flex-1"
          />
          <Button
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            className="shrink-0"
          >
            {busy ? "…" : "ส่ง"}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-faint">
            ข้อมูลทริปของคุณถูกส่งไปให้ Gemini (Google) ทุกครั้งที่ถาม
          </p>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-xs text-muted underline"
            >
              ล้างแชท
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
