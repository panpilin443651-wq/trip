"use client";

import { useState } from "react";
import { CATEGORIES } from "@/data/categories";
import { addDaysISO, addMinutesToTime, formatDateShort } from "@/lib/format";
import type { SuggestionFill } from "@/lib/activity-search";
import type { PlaceOption } from "@/lib/place-search";
import { googleMapsUrl } from "@/lib/place-search";
import { useTrip } from "@/lib/trip-context";
import { ActivityListInput } from "./ActivityListInput";
import { PhotoManager } from "./PhotoManager";
import { PlaceCombobox } from "./PlaceCombobox";
import { PlaceListInput } from "./PlaceListInput";
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

/** เผื่อเวลาเดินทางระหว่างที่ ตอนเรียงเวลาให้อัตโนมัติ */
const TRAVEL_GAP_MIN = 30;

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
  /** เลือกได้หลายสถานที่ในครั้งเดียว จึงคืนเป็นรายการเสมอ */
  onSubmit: (drafts: ActivityDraft[]) => void;
}) {
  const { state, userId } = useTrip();
  const [draft, setDraft] = useState<ActivityDraft>(initial);

  /**
   * สถานที่ที่เลือกไว้ ใช้เฉพาะตอนเพิ่มใหม่
   * ตอนแก้ไขยังเป็นที่เดียวเหมือนเดิม เพราะกำลังแก้รายการที่มีอยู่แล้ว
   */
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const multiple = !isEdit && places.length > 1;

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

  const canSave = isEdit
    ? Boolean(draft.placeName.trim()) || activities.length > 0
    : places.length > 0 || activities.length > 0;

  /**
   * ประกอบรายการที่จะบันทึก — หนึ่งสถานที่ต่อหนึ่งรายการ
   *
   * ช่องเวลา ค่าใช้จ่าย กิจกรรม และรูป มีชุดเดียวในฟอร์ม จึงให้กับที่แรก
   * ส่วนที่ถัด ๆ ไปใช้ข้อมูลที่ติดมากับตัวเอง (เวลาที่ควรเผื่อ ค่าเข้า หมวด)
   * ถ้าไม่มีก็ใช้ค่าเดียวกับที่แรก แล้วผู้ใช้ค่อยไปปรับทีหลัง
   */
  function buildDrafts(): ActivityDraft[] {
    if (isEdit || places.length === 0) {
      const place = draft.placeName.trim();
      return [
        {
          ...draft,
          title: activities[0] ?? place,
          placeName: place,
          activities,
        },
      ];
    }

    let startTime = draft.startTime;
    return places.map((place, index) => {
      const fill = place.fill;
      const durationMin = fill?.durationMin ?? draft.durationMin;
      const item: ActivityDraft = {
        ...draft,
        startTime,
        durationMin,
        placeName: place.name,
        province: place.province || draft.province,
        lat: place.lat,
        lng: place.lng,
        cost: fill?.cost ?? (index === 0 ? draft.cost : 0),
        category: fill?.category ?? draft.category,
        // กิจกรรม รูป และรายละเอียดที่พิมพ์ไว้ ผู้ใช้คิดถึงที่แรกตอนกรอก
        // จึงให้ที่แรกที่เดียว ที่อื่นใช้คำอธิบายของตัวเองแทน
        activities: index === 0 ? activities : [],
        photos: index === 0 ? draft.photos : undefined,
        detail: index === 0 ? draft.detail : (fill?.detail ?? ""),
        title: (index === 0 ? activities[0] : undefined) ?? place.name,
      };
      startTime = addMinutesToTime(startTime, durationMin + TRAVEL_GAP_MIN);
      return item;
    });
  }

  const hasCoords = typeof draft.lat === "number" && typeof draft.lng === "number";

  return (
    <Sheet
      open
      title={isEdit ? "แก้ไขรายการ" : "เพิ่มสถานที่"}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            className="flex-1"
            disabled={!canSave}
            onClick={() => onSubmit(buildDrafts())}
          >
            {places.length > 1 ? `บันทึก ${places.length} ที่` : "บันทึก"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {isEdit ? (
          <Field
            label="สถานที่"
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
        ) : (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">
              สถานที่
            </p>
            <PlaceListInput
              value={places}
              onChange={setPlaces}
              onFirstPick={applyPlace}
              dayProvince={draft.province ?? ""}
              tripProvinces={searchProvinces}
            />
            <p className="mt-1 text-xs text-faint">
              {places.length > 1
                ? `แต่ละที่จะเป็นคนละรายการ เรียงเวลาต่อกันให้อัตโนมัติ เผื่อเดินทาง ${TRAVEL_GAP_MIN} นาที`
                : "เลือกได้หลายที่รวดเดียว แต่ละที่จะเป็นคนละรายการในแผน"}
            </p>
          </div>
        )}

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

        {/*
          กิจกรรมเป็นของย่อยลงมาจากสถานที่ — ไปที่นั่นแล้วทำอะไร
          เลือกมาหลายที่แล้วช่องนี้จะกำกวมว่าเป็นกิจกรรมของที่ไหน จึงซ่อนไว้
          แล้วให้ไปเพิ่มทีหลังจากการ์ดของแต่ละที่แทน
        */}
        {multiple ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-xs leading-relaxed text-muted">
            เลือกไว้ {places.length} ที่ — กิจกรรม รูป และรายละเอียด
            ใส่ได้ทีหลังโดยกด ✏️ ที่การ์ดของแต่ละที่
          </p>
        ) : (
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
        )}

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

        {multiple ? null : (
          <>
            <Field
              label="รูปความทรงจำ"
              hint="รูปจะขึ้นบนหมุดในแผนที่ และอยู่ในไฟล์สรุปแผนด้วย"
            >
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
          </>
        )}
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
