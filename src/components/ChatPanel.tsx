"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ChatStore, defaultChatStore } from "@/lib/chat/storage";
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
 * ตัวแชทจริง ใช้ซ้ำทั้งในปุ่มลอย หน้าเต็ม และการ์ดในหน้าแนะนำเที่ยว
 *
 * ประวัติเก็บใน localStorage ฝั่งเบราว์เซอร์ ส่วนคำตอบสตรีมมาจากเซิร์ฟเวอร์
 * ซึ่งเป็นฝั่งเดียวที่แตะ API key ของ Gemini
 *
 * prop ทุกตัวมีค่าเริ่มต้นเป็นพฤติกรรมเดิม ที่เรียกใช้อยู่แล้วจึงไม่ต้องแก้
 *
 * @param endpoint เส้นทาง API ที่จะยิงไป
 * @param store ที่เก็บประวัติ แต่ละช่องต้องใช้คนละตัว ไม่งั้นเขียนทับกัน
 * @param buildBody ประกอบ body ของคำขอ ค่าเริ่มต้นคือแนบสรุปทริปไปด้วย
 * @param afterMessage เรนเดอร์เพิ่มใต้ฟองคำตอบที่พิมพ์จบแล้ว (ปุ่มใส่แผน)
 */
export function ChatPanel({
  className,
  endpoint = "/api/chat",
  store = defaultChatStore,
  starters = STARTERS,
  intro = "👋 ถามได้ทั้งเรื่องวิธีใช้เว็บ และเรื่องทริปที่คุณกรอกไว้",
  privacyNote = "ข้อมูลทริปของคุณถูกส่งไปให้ Gemini (Google) ทุกครั้งที่ถาม",
  buildBody,
  afterMessage,
  composerAtTop = false,
}: {
  className?: string;
  endpoint?: string;
  store?: ChatStore;
  starters?: string[];
  intro?: string;
  privacyNote?: string;
  buildBody?: (messages: Array<{ role: string; text: string }>) => unknown;
  afterMessage?: (
    message: ChatMessage,
    info: { streaming: boolean; isLast: boolean },
  ) => ReactNode;
  /**
   * วางช่องพิมพ์ไว้บนสุดแทนที่จะเป็นล่างสุด
   *
   * ใช้กับการ์ดที่ฝังกลางหน้าเว็บ ในป๊อปอัปช่องพิมพ์อยู่ล่างสุดแล้วหาเจอง่าย
   * เพราะกล่องลอยเด่นอยู่กลางจอ แต่พอฝังในหน้าที่ยาว ช่องพิมพ์จะไปจมอยู่
   * ท้ายการ์ด ใต้กล่องข้อความ และใกล้กับแถบลอยที่ยึดขอบล่างจอ
   */
  composerAtTop?: boolean;
}) {
  const { state } = useTrip();
  // เก็บใน external store ไม่ใช่ useState ดูเหตุผลใน lib/chat/storage.ts
  const messages = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * เลื่อนเฉพาะกล่องข้อความ ไม่ใช่ทั้งหน้า
   *
   * เดิมใช้ scrollIntoView ซึ่งเลื่อน "ทุกชั้นที่เลื่อนได้" รวมถึงตัวหน้าเว็บด้วย
   * ตอนแชทอยู่ในป๊อปอัปไม่มีปัญหาเพราะหน้าเว็บข้างหลังถูกล็อกไม่ให้เลื่อนอยู่แล้ว
   * แต่พอเอามาวางกลางหน้าแนะนำเที่ยวที่ยาว ๆ ทุกก้อนข้อความที่สตรีมเข้ามา
   * จะกระชากทั้งหน้าเลื่อนตาม จนแตะช่องพิมพ์แทบไม่ทัน
   */
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    const history = [...messages, userMessage];
    store.setMessages(history);
    setInput("");
    setBusy(true);

    const replyId = newId();
    let reply = "";

    try {
      const wire = history.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildBody
            ? buildBody(wire)
            : { messages: wire, tripSummary: summarizeTrip(state) },
        ),
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
        store.setMessages(failed);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      // ใส่ฟองเปล่าไว้ก่อน แล้วเติมข้อความเข้าไปทีละก้อนระหว่างสตรีม
      store.setMessages([...history, { id: replyId, role: "model", text: "" }], false);

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        store.setMessages(
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
      store.setMessages(done);
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
      store.setMessages(failed);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    store.clearMessages();
  }

  const conversation = (
        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="px-1 py-1">
              <p className="text-sm leading-relaxed text-muted">{intro}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {starters.map((q) => (
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
                  "flex flex-col",
                  m.role === "user" ? "items-end" : "items-start",
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
                {/* ปุ่มเสริมใต้คำตอบ เช่น ปุ่มใส่แผนในหน้าแนะนำเที่ยว
                    streaming ให้รอจนพิมพ์จบก่อนค่อยไปหาชื่อสถานที่
                    isLast ให้รู้ว่าอันไหนคือคำตอบล่าสุด จะได้ไม่ยิงคำขอย้อนหลัง
                    ให้ทุกคำตอบเก่าที่โหลดมาจาก localStorage ตอนเปิดหน้า */}
                {m.role === "model" && !m.error
                  ? afterMessage?.(m, {
                      streaming: busy && m.id === messages.at(-1)?.id,
                      isLast: m.id === messages.at(-1)?.id,
                    })
                  : null}
              </div>
            ))
          )}

          {busy && messages.at(-1)?.role === "user" ? (
            <p className="px-1 text-xs text-faint">ผู้ช่วยกำลังพิมพ์…</p>
          ) : null}

        </div>
  );

  const composer = (
        <div
          className={cn(
            "shrink-0",
            composerAtTop
              ? "mb-3 border-b border-line pb-3"
              : "mt-3 border-t border-line pt-3",
          )}
        >
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
              {privacyNote}
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
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {composerAtTop ? composer : null}
      {conversation}
      {composerAtTop ? null : composer}
    </div>
  );
}
