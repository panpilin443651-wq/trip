"use client";

import { useEffect, useState } from "react";
import type { PlacePicks } from "@/app/api/explore-chat/places/route";
import type { ChatMessage } from "@/lib/chat/types";
import type { PlaceRow } from "@/lib/explore-retrieval";
import { exploreChatStore } from "@/lib/chat/storage";
import { addMinutesToTime } from "@/lib/format";
import { googleMapsUrl } from "@/lib/place-search";
import { useTrip } from "@/lib/trip-context";
import { ChatPanel } from "./ChatPanel";
import { Button, Card, SectionTitle } from "./ui";

/**
 * ถามผู้ช่วยเรื่องที่เที่ยว แล้วกดใส่แผนได้จากคำตอบเลย
 *
 * มีไว้เพราะหน้าแนะนำเที่ยวเลือกได้แค่ จังหวัด → อำเภอ ซึ่งไม่ครอบคลุมที่ที่
 * คนเรียกกันจริง — บางแสน (ต่ำกว่าอำเภอ) โคราช (ชื่อเล่น) เขาใหญ่ (คร่อมสองจังหวัด)
 *
 * ปุ่มใต้คำตอบขึ้นเฉพาะสถานที่ที่อยู่ในฐานข้อมูลของเว็บจริง ๆ ถ้าผู้ช่วยพูดถึง
 * ที่ที่ไม่มีในข้อมูล จะเป็นข้อความเฉย ๆ ไม่มีปุ่ม — ผู้ใช้จึงแยกออกเองว่า
 * อันไหนตรวจสอบแล้ว อันไหนต้องไปเช็กต่อ
 */

const STARTERS = [
  "เขาใหญ่มีที่เที่ยวอะไรบ้าง",
  "บางแสนกินอะไรดี",
  "โคราชมีที่พักแนะนำไหม",
  "ปายเที่ยว 2 วันไปไหนดี",
];

export function ExploreChat({
  province,
  district,
  dayIndex,
  onAdded,
}: {
  province: string;
  district: string;
  dayIndex: number;
  onAdded: (name: string) => void;
}) {
  const { dispatch, activitiesForDay } = useTrip();
  const [added, setAdded] = useState<Set<string>>(new Set());

  /** ต่อท้ายกิจกรรมสุดท้ายของวัน เผื่อเวลาเดินทาง 30 นาที */
  function nextStartTime(): string {
    const last = activitiesForDay(dayIndex).at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function addToPlan(row: PlaceRow) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex,
        startTime: nextStartTime(),
        durationMin:
          row.category === "accommodation" ? 720 : row.category === "food" ? 60 : 90,
        title: row.name,
        placeName: `${row.name} ${row.province}`,
        province: row.province,
        detail: row.district ? `${row.kind} • อ.${row.district}` : row.kind,
        cost: 0,
        category: row.category,
        lat: row.lat,
        lng: row.lng,
      },
    });
    setAdded((prev) => new Set(prev).add(`${row.name}::${row.province}`));
    onAdded(row.name);
  }

  return (
    <Card as="section" className="mt-4">
      <SectionTitle title="ถามผู้ช่วยเรื่องที่เที่ยว" />
      <p className="mt-1 text-sm leading-relaxed text-muted">
        ถามได้ละเอียดกว่าที่เลือกจากรายการ เช่นชื่อย่านอย่างบางแสน ชื่อเล่นอย่างโคราช
        หรือที่ที่คร่อมหลายจังหวัดอย่างเขาใหญ่
      </p>

      <ChatPanel
        className="mt-3 h-[26rem]"
        composerAtTop
        endpoint="/api/explore-chat"
        store={exploreChatStore}
        starters={STARTERS}
        intro="พิมพ์คำถามในช่องด้านบน หรือกดคำถามตัวอย่างข้างล่างนี้ได้เลย"
        privacyNote="คำถามของคุณถูกส่งไปให้ Gemini (Google) พร้อมรายชื่อสถานที่ที่ค้นได้ — ไม่ได้ส่งข้อมูลทริป"
        buildBody={(messages) => ({ messages, province, district })}
        afterMessage={(message, info) => (
          <PlacePickRow
            message={message}
            streaming={info.streaming}
            isLast={info.isLast}
            province={province}
            district={district}
            added={added}
            onAdd={addToPlan}
          />
        )}
      />
    </Card>
  );
}

/**
 * จำผลไว้ในหน่วยความจำของแท็บ ตามแบบเดียวกับ PlaceThumb
 * คำตอบหนึ่งให้ผลเดิมเสมอ ยิงซ้ำตอนเรนเดอร์ใหม่จึงเปล่าประโยชน์
 */
const pickCache = new Map<string, Promise<PlaceRow[]>>();

/**
 * แถวปุ่มใส่แผน ใต้คำตอบหนึ่ง ๆ
 *
 * ต้องรอจนสตรีมจบก่อนถึงจะรู้ว่าผู้ช่วยพูดถึงที่ไหนบ้าง จึงยิงหาตอน streaming
 * เป็น false แล้วเท่านั้น ไม่งั้นจะยิงซ้ำทุก token
 *
 * ยิงเฉพาะคำตอบล่าสุด — ประวัติเก็บได้ถึง 40 ข้อความ ถ้ายิงให้ทุกคำตอบ
 * แค่เปิดหน้าเว็บก็จะยิงพร้อมกันเป็นสิบคำขอทันที ทั้งที่ผู้ใช้ยังไม่ได้ถามอะไร
 * คำตอบเก่าที่เคยหาไว้แล้วในแท็บนี้ยังมีปุ่มอยู่ เพราะอ่านจาก pickCache ได้เลย
 */
function PlacePickRow({
  message,
  streaming,
  isLast,
  province,
  district,
  added,
  onAdd,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  province: string;
  district: string;
  added: Set<string>;
  onAdd: (row: PlaceRow) => void;
}) {
  // เก็บผลคู่กับ id ของข้อความที่ขอไป ตามแบบเดียวกับการ์ดอื่นในหน้านี้
  // ถ้าเทียบ id ไม่ตรงถือว่ายังไม่ได้โหลด แทนที่จะล้าง state ใน effect
  const [result, setResult] = useState<{ id: string; rows: PlaceRow[] } | null>(
    null,
  );

  useEffect(() => {
    if (streaming || !message.text.trim()) return;
    if (!isLast && !pickCache.has(message.id)) return;

    let cached = pickCache.get(message.id);
    if (!cached) {
      cached = fetch("/api/explore-chat/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: findQuestion(message.id),
          answer: message.text,
          province,
          district,
        }),
        signal: AbortSignal.timeout(15000),
      })
        .then((r) => (r.ok ? (r.json() as Promise<PlacePicks>) : { places: [] }))
        .then((data) => data.places)
        .catch(() => [] as PlaceRow[]);
      pickCache.set(message.id, cached);
    }

    let cancelled = false;
    void cached.then((rows) => {
      if (!cancelled) setResult({ id: message.id, rows });
    });
    return () => {
      cancelled = true;
    };
  }, [message.id, message.text, streaming, isLast, province, district]);

  const rows = result?.id === message.id ? result.rows : null;
  if (!rows || rows.length === 0) return null;

  return (
    <div className="mt-2 flex max-w-[85%] flex-wrap gap-1.5">
      {rows.map((row) => {
        const key = `${row.name}::${row.province}`;
        const done = added.has(key);
        return (
          <span key={key} className="flex items-center gap-1">
            <Button
              size="sm"
              variant={done ? "ghost" : "secondary"}
              onClick={() => onAdd(row)}
              disabled={done}
              title={`เพิ่ม ${row.name} ลงในแผน`}
            >
              {done ? "✓ " : "+ "}
              {row.name}
            </Button>
            <a
              href={googleMapsUrl(row.name, row.lat, row.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted underline underline-offset-2 hover:text-brand"
              title={`ดู ${row.name} ใน Google Maps`}
            >
              แผนที่
            </a>
          </span>
        );
      })}
    </div>
  );
}

/**
 * คำถามที่ทำให้เกิดคำตอบนี้ ใช้ค้นสถานที่ซ้ำฝั่งเซิร์ฟเวอร์
 * อ่านจากที่เก็บโดยตรง เพราะ ChatPanel ส่งมาให้แค่ข้อความเดียว
 */
function findQuestion(replyId: string): string {
  const all = exploreChatStore.getSnapshot();
  const at = all.findIndex((m) => m.id === replyId);
  for (let i = at - 1; i >= 0; i -= 1) {
    if (all[i].role === "user") return all[i].text;
  }
  return "";
}
