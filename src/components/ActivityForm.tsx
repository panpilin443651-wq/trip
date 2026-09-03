"use client";

import { useState } from "react";
import { CATEGORIES } from "@/data/categories";
import { addDaysISO, formatDateShort } from "@/lib/format";
import type { SuggestionFill } from "@/lib/activity-search";
import type { PlaceOption } from "@/lib/place-search";
import { googleMapsUrl } from "@/lib/place-search";
import { useTrip } from "@/lib/trip-context";
import { ActivityListInput } from "./ActivityListInput";
import { PhotoManager } from "./PhotoManager";
import { PlaceCombobox } from "./PlaceCombobox";
import { ProvinceCombobox } from "./ProvinceCombobox";
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

export function emptyDraft(
  dayIndex: number,
  province = "",
): ActivityDraft {
  return {
    dayIndex,
    startTime: "09:00",
    durationMin: 60,
    title: "",
    placeName: "",
    activities: [],
    province,
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
  const { state, userId } = useTrip();
  const [draft, setDraft] = useState<ActivityDraft>(initial);

  function patch(next: Partial<ActivityDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  /** ข้อมูลรุ่นเก่าไม่มีฟิลด์นี้ อ่านผ่านตัวช่วยจะได้ไม่ต้องเช็ก undefined ทุกที่ */
  const activities = draft.activities ?? [];

  /**
   * จังหวัดที่ใช้จัดอันดับผลค้นหา — จังหวัดของกิจกรรมนี้มาก่อน
   * เพราะเจาะจงกว่าจังหวัดทั้งหมดของทริป
   */
  const searchProvinces = draft.province
    ? [draft.province, ...state.trip.provinces]
    : state.trip.provinces;

  /**
   * เลือกสถานที่จากรายการ — เติมพิกัด เวลาที่ควรเผื่อ และค่าเข้าให้เลย
   * ที่ที่มาจากการค้นสดจะมีแค่ชื่อกับพิกัด ไม่มีเวลา/ค่าเข้า จึงไม่ไปทับของเดิม
   */
  function applyPlace(option: PlaceOption) {
    const fill = option.fill;
    patch({
      placeName: option.name,
      province: option.province || draft.province,
      lat: option.lat,
      lng: option.lng,
      ...(fill
        ? {
            detail: draft.detail.trim() ? draft.detail : fill.detail,
            durationMin: fill.durationMin,
            cost: fill.cost,
            category: fill.category,
          }
        : {}),
    });
  }

  /**
   * เลือกกิจกรรม "แรก" จากรายการแนะนำ — เอาเวลาและค่าใช้จ่ายที่แนะนำมาเติมให้
   * กิจกรรมที่เพิ่มทีหลังจะไม่เข้าทางนี้ เพราะรายการนี้มีช่องค่าใช้จ่ายช่องเดียว
   * ถ้าให้ทุกกิจกรรมมาทับ ตัวเลขที่ผู้ใช้ปรับเองไว้จะหายทุกครั้งที่เพิ่มอันใหม่
   */
  function applyFirstActivity(fill: SuggestionFill) {
    patch({
      detail: draft.detail.trim() ? draft.detail : fill.detail,
      durationMin: fill.durationMin,
      cost: fill.cost,
      category: fill.category,
      // ยังไม่ได้เลือกสถานที่ ค่อยใช้ของกิจกรรมมาเติมให้
      ...(draft.placeName.trim()
        ? {}
        : { placeName: fill.placeName, lat: fill.lat, lng: fill.lng }),
      ...(draft.province ? {} : { province: fill.province }),
    });
  }

  const hasCoords = typeof draft.lat === "number" && typeof draft.lng === "number";

  return (
    <Sheet
      open
      title={isEdit ? "แก้ไขรายการ" : "เพิ่มสถานที่"}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="flex-1"
            disabled={!draft.placeName.trim() && activities.length === 0}
            onClick={() => {
              // title ใช้ในที่แคบ ๆ อย่างหมุดบนแผนที่และรายการค่าใช้จ่าย
              // จึงเก็บแค่ชื่อเดียว เอากิจกรรมแรกก่อน ไม่มีค่อยใช้ชื่อสถานที่
              const place = draft.placeName.trim();
              onSubmit({
                ...draft,
                title: activities[0] ?? place,
                placeName: place,
                activities,
              });
            }}
          >
            บันทึก
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="📍 สถานที่"
          hint="กดที่ช่องแล้วเลือกจากที่ดังในจังหวัดนี้ หรือพิมพ์ชื่อเองก็ได้"
        >
          <PlaceCombobox
            value={draft.placeName}
            onChange={(placeName) => patch({ placeName })}
            onPick={applyPlace}
            dayProvince={draft.province ?? ""}
            tripProvinces={searchProvinces}
          />
        </Field>

        {hasCoords ? (
          <p className="-mt-2 flex flex-wrap items-center gap-x-3 text-xs text-ok">
            <span>
              ปักหมุดแล้ว ({draft.lat?.toFixed(4)}, {draft.lng?.toFixed(4)})
            </span>
            <a
              href={googleMapsUrl(draft.placeName, draft.lat, draft.lng)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              🗺️ เปิดใน Google Maps
            </a>
            <button
              type="button"
              className="underline"
              onClick={() => patch({ lat: undefined, lng: undefined })}
            >
              ล้างหมุด
            </button>
          </p>
        ) : null}

        {/* กิจกรรมเป็นของย่อยลงมาจากสถานที่ — ไปที่นั่นแล้วทำอะไร */}
        <div className="border-l-2 border-line pl-3">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">
              🎯 กิจกรรมที่นี่
            </p>
            <ActivityListInput
              value={activities}
              onChange={(next) => patch({ activities: next })}
              onFirstPick={applyFirstActivity}
              provinces={searchProvinces}
            />
          </div>
        </div>

        <Field
          label="จังหวัด"
          hint="ค่าเริ่มต้นมาจากจังหวัดของวันนั้น เปลี่ยนได้ถ้ากิจกรรมนี้อยู่คนละจังหวัด"
        >
          <ProvinceCombobox
            value={draft.province ?? ""}
            onChange={(province) => patch({ province })}
            placeholder="พิมพ์ชื่อจังหวัด…"
          />
        </Field>

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
    activities: activity.activities ?? [],
    province: activity.province,
    detail: activity.detail,
    cost: activity.cost,
    category: activity.category,
    lat: activity.lat,
    lng: activity.lng,
    photos: activity.photos,
  };
}
