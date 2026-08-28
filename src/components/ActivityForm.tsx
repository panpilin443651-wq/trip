"use client";

import { useState } from "react";
import { CATEGORIES } from "@/data/categories";
import { addDaysISO, formatDateShort } from "@/lib/format";
import { searchPlaces, type GeocodeHit } from "@/lib/routing";
import { useTrip } from "@/lib/trip-context";
import { PhotoManager } from "./PhotoManager";
import type { Activity, CategoryId } from "@/lib/types";
import {
  Button,
  Field,
  Input,
  NumberInput,
  Select,
  Sheet,
  Textarea,
} from "./ui";

export type ActivityDraft = Omit<Activity, "id" | "order">;

export function emptyDraft(dayIndex: number): ActivityDraft {
  return {
    dayIndex,
    startTime: "09:00",
    durationMin: 60,
    title: "",
    placeName: "",
    detail: "",
    cost: 0,
    category: "attraction",
  };
}

const DURATION_PRESETS = [30, 60, 90, 120, 180, 240];

/**
 * ผู้เรียกต้อง mount คอมโพเนนต์นี้เฉพาะตอนเปิดฟอร์ม และใส่ `key` ที่เปลี่ยนทุกครั้ง
 * ที่เปิดใหม่ เพื่อให้ค่าเริ่มต้นถูกรีเซ็ตด้วยการ remount แทนการ setState ใน effect
 */
export function ActivityForm({
  initial,
  isEdit,
  dayCount,
  startDate,
  onClose,
  onSubmit,
}: {
  initial: ActivityDraft;
  isEdit: boolean;
  dayCount: number;
  startDate: string;
  onClose: () => void;
  onSubmit: (draft: ActivityDraft) => void;
}) {
  const { userId } = useTrip();
  const [draft, setDraft] = useState<ActivityDraft>(initial);
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  function patch(next: Partial<ActivityDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function handleSearch() {
    const query = draft.placeName.trim() || draft.title.trim();
    if (!query) {
      setSearchNote("พิมพ์ชื่อสถานที่ก่อนค้นหา");
      return;
    }
    setSearching(true);
    setSearchNote(null);
    try {
      const results = await searchPlaces(query);
      setHits(results);
      if (results.length === 0) setSearchNote("ไม่พบสถานที่ที่ตรงกับคำค้นนี้");
    } catch {
      setSearchNote("ค้นหาไม่สำเร็จ — ตรวจการเชื่อมต่ออินเทอร์เน็ต");
    } finally {
      setSearching(false);
    }
  }

  const hasCoords = typeof draft.lat === "number" && typeof draft.lng === "number";

  return (
    <Sheet
      open
      title={isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="flex-1"
            disabled={!draft.title.trim()}
            onClick={() => onSubmit({ ...draft, title: draft.title.trim() })}
          >
            บันทึก
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อกิจกรรม">
          <Input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="เช่น ไหว้พระธาตุดอยสุเทพ"
            autoFocus
          />
        </Field>

        <Field label="สถานที่" hint="กดค้นหาเพื่อปักหมุดลงแผนที่">
          <div className="flex gap-2">
            <Input
              value={draft.placeName}
              onChange={(e) => patch({ placeName: e.target.value })}
              placeholder="เช่น วัดพระธาตุดอยสุเทพ เชียงใหม่"
            />
            <Button
              variant="secondary"
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching}
              className="shrink-0"
            >
              {searching ? "…" : "🔍"}
            </Button>
          </div>
        </Field>

        {hasCoords ? (
          <p className="-mt-2 text-xs text-ok">
            📍 ปักหมุดแล้ว ({draft.lat?.toFixed(4)}, {draft.lng?.toFixed(4)})
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => patch({ lat: undefined, lng: undefined })}
            >
              ล้างหมุด
            </button>
          </p>
        ) : null}

        {searchNote ? (
          <p className="-mt-2 text-xs text-muted">{searchNote}</p>
        ) : null}

        {hits.length > 0 ? (
          <ul className="-mt-1 space-y-1 rounded-xl border border-line bg-canvas p-2">
            {hits.map((hit) => (
              <li key={`${hit.lat},${hit.lng}`}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-brand-soft"
                  onClick={() => {
                    patch({
                      lat: hit.lat,
                      lng: hit.lng,
                      placeName: draft.placeName.trim() || hit.name,
                    });
                    setHits([]);
                  }}
                >
                  <span className="font-medium">{hit.name}</span>
                  <span className="block text-xs text-muted">{hit.display}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {dayCount > 1 ? (
          <Field label="วันที่">
            <Select
              value={draft.dayIndex}
              onChange={(e) => patch({ dayIndex: Number(e.target.value) })}
            >
              {Array.from({ length: dayCount }, (_, index) => (
                <option key={index} value={index}>
                  วันที่ {index + 1} ({formatDateShort(addDaysISO(startDate, index))})
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="เวลาเริ่ม">
            <Input
              type="time"
              value={draft.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
            />
          </Field>

          <Field label="ใช้เวลา (นาที)">
            <NumberInput
              step={5}
              placeholder="0"
              value={draft.durationMin}
              onValueChange={(durationMin) => patch({ durationMin })}
            />
          </Field>
        </div>

        <div className="-mt-2 flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => patch({ durationMin: minutes })}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand"
            >
              {minutes >= 60 ? `${minutes / 60} ชม.` : `${minutes} นาที`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="หมวดค่าใช้จ่าย">
            <Select
              value={draft.category}
              onChange={(e) =>
                patch({ category: e.target.value as CategoryId })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="ค่าใช้จ่าย (บาท)">
            <NumberInput
              placeholder="0"
              value={draft.cost}
              onValueChange={(cost) => patch({ cost })}
            />
          </Field>
        </div>

        <Field label="รูปความทรงจำ" hint="รูปจะขึ้นบนหมุดในแผนที่ และอยู่ในไฟล์สรุปแผนด้วย">
          <PhotoManager
            userId={userId}
            paths={draft.photos ?? []}
            onChange={(photos) => patch({ photos })}
          />
        </Field>

        <Field label="รายละเอียด">
          <Textarea
            value={draft.detail}
            onChange={(e) => patch({ detail: e.target.value })}
            placeholder="เช่น จองล่วงหน้าแล้ว / แต่งกายสุภาพ / ที่จอดรถอยู่ด้านหลัง"
          />
        </Field>
      </div>
    </Sheet>
  );
}

/** แปลงกิจกรรมที่บันทึกแล้วกลับเป็นค่าตั้งต้นของฟอร์ม */
export function toDraft(activity: Activity): ActivityDraft {
  return {
    dayIndex: activity.dayIndex,
    startTime: activity.startTime,
    durationMin: activity.durationMin,
    title: activity.title,
    placeName: activity.placeName,
    detail: activity.detail,
    cost: activity.cost,
    category: activity.category,
    lat: activity.lat,
    lng: activity.lng,
    photos: activity.photos,
  };
}
