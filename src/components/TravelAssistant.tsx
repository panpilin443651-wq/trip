"use client";

import { useEffect, useState } from "react";
import type { PlacePicks } from "@/app/api/chat/places/route";
import { defaultChatStore } from "@/lib/chat/storage";
import { summarizeTrip } from "@/lib/chat/trip-summary";
import type { ChatMessage } from "@/lib/chat/types";
import type { PlaceRow } from "@/lib/explore-retrieval";
import { addDaysISO, addMinutesToTime, formatDateShort } from "@/lib/format";
import { googleMapsUrl } from "@/lib/place-search";
import { useTrip } from "@/lib/trip-context";
import { ChatPanel } from "./ChatPanel";
import { Button, Field, Select } from "./ui";

/**
 * ผู้ช่วยตัวเดียวของเว็บ — ตอบทั้งเรื่องที่เที่ยวและเรื่องการใช้งาน
 *
 * เดิมมีสองตัวแยกกัน (ผู้ช่วยทั่วไปในปุ่มลอย กับผู้ช่วยแนะนำที่เที่ยวในหน้า
 * แนะนำเที่ยว) ซึ่งทำให้ต้องเดาว่าคำถามนี้ควรถามตัวไหน รวมเป็นตัวเดียวแล้ว
 * ฝั่งเซิร์ฟเวอร์ค้นสถานที่จริงจากคำถามทุกครั้ง ถ้าคำถามไม่ได้ถามถึงที่ไหน
 * ก็จะไม่มีรายการสถานที่ต่อเข้า prompt เลย ผู้ช่วยจึงไม่พูดถึงที่เที่ยว
 * ตอนถูกถามว่า "งบเหลือเท่าไร"
 *
 * ปุ่มใต้คำตอบขึ้นเฉพาะสถานที่ที่อยู่ในฐานข้อมูลของเว็บจริง ๆ ถ้าผู้ช่วยพูดถึง
 * ที่ที่ไม่มีในข้อมูล จะเป็นข้อความเฉย ๆ ไม่มีปุ่ม — ผู้ใช้จึงแยกออกเองว่า
 * อันไหนตรวจสอบแล้ว อันไหนต้องไปเช็กต่อ
 */

const STARTERS = [
  "เขาใหญ่มีที่เที่ยวอะไรบ้าง",
  "บางแสนกินอะไรดี",
  "งบเหลือเท่าไร",
  "ช่วยดูแผนวันแรกให้หน่อย",
];

export function TravelAssistant({ className }: { className?: string }) {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip } = state;
  const [targetDay, setTargetDay] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());

  /*
   * จังหวัดตั้งต้นของคำถามที่ไม่ได้ระบุที่ไหน ("มีอะไรน่ากินบ้าง")
   * ใช้จังหวัดแรกของทริป เพราะเป็นที่ที่ผู้ใช้กำลังวางแผนจะไปอยู่แล้ว
   */
  const province = trip.provinces[0] ?? "";

  /** ต่อท้ายกิจกรรมสุดท้ายของวัน เผื่อเวลาเดินทาง 30 นาที */
  function nextStartTime(): string {
    const last = activitiesForDay(targetDay).at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  function addToPlan(row: PlaceRow) {
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex: targetDay,
        startTime: nextStartTime(),
        durationMin:
          row.category === "accommodation"
            ? 720
            : row.category === "food"
              ? 60
              : 90,
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
  }

  return (
    <div className={className}>
      {trip.dayCount > 1 ? (
        /* บอกไว้ล่วงหน้าว่าปุ่ม "ใส่ในแผน" ใต้คำตอบจะลงวันไหน
           ผู้ช่วยเปิดได้จากทุกหน้า จึงไม่มีบริบทวันจากหน้าที่เปิดอยู่ */
        <Field label="ปุ่มใส่ในแผนจะลงวันที่" className="mb-3">
          <Select
            value={targetDay}
            onChange={(e) => setTargetDay(Number(e.target.value))}
          >
            {Array.from({ length: trip.dayCount }, (_, index) => (
              <option key={index} value={index}>
                วันที่ {index + 1} (
                {formatDateShort(addDaysISO(trip.startDate, index))})
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <ChatPanel
        className="min-h-0 flex-1"
        store={defaultChatStore}
        starters={STARTERS}
        intro="ถามได้ทั้งเรื่องไปเที่ยวไหนดี วิธีใช้เว็บ และทริปที่คุณกรอกไว้"
        privacyNote="คำถามและข้อมูลทริปของคุณถูกส่งไปให้ Gemini (Google) ทุกครั้งที่ถาม"
        buildBody={(messages) => ({
          messages,
          tripSummary: summarizeTrip(state),
          province,
        })}
        afterMessage={(message, info) => (
          <PlacePickRow
            message={message}
            streaming={info.streaming}
            isLast={info.isLast}
            province={province}
            added={added}
            onAdd={addToPlan}
          />
        )}
      />
    </div>
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
  added,
  onAdd,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  province: string;
  added: Set<string>;
  onAdd: (row: PlaceRow) => void;
}) {
  // เก็บผลคู่กับ id ของข้อความที่ขอไป ตามแบบเดียวกับการ์ดอื่นในเว็บ
  // ถ้าเทียบ id ไม่ตรงถือว่ายังไม่ได้โหลด แทนที่จะล้าง state ใน effect
  const [result, setResult] = useState<{ id: string; rows: PlaceRow[] } | null>(
    null,
  );

  useEffect(() => {
    if (streaming || !message.text.trim()) return;
    if (!isLast && !pickCache.has(message.id)) return;

    let cached = pickCache.get(message.id);
    if (!cached) {
      cached = fetch("/api/chat/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: findQuestion(message.id),
          answer: message.text,
          province,
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
  }, [message.id, message.text, streaming, isLast, province]);

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
  const all = defaultChatStore.getSnapshot();
  const at = all.findIndex((m) => m.id === replyId);
  for (let i = at - 1; i >= 0; i -= 1) {
    if (all[i].role === "user") return all[i].text;
  }
  return "";
}
