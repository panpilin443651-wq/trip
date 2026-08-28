"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProvinceSelect } from "@/components/ProvinceSelect";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  Select,
  Sheet,
  Textarea,
} from "@/components/ui";
import { PRIORITY_META } from "@/data/categories";
import { cn } from "@/lib/cn";
import { useTrip } from "@/lib/trip-context";
import type { Place, Priority } from "@/lib/types";

type Filter = "all" | "todo" | "done";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "todo", label: "ยังไม่ได้ไป" },
  { id: "done", label: "ไปแล้ว" },
];

type PlaceDraft = Omit<Place, "id">;

function emptyPlace(destination: string): PlaceDraft {
  return {
    name: "",
    province: destination,
    note: "",
    priority: "medium",
    visited: false,
  };
}

export default function PlacesPage() {
  const { state, dispatch } = useTrip();
  const { places, trip } = state;

  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlaceDraft>(emptyPlace(trip.destination));
  const [deleting, setDeleting] = useState<Place | null>(null);

  const visitedCount = places.filter((p) => p.visited).length;

  const visible = useMemo(() => {
    return places
      .filter((place) =>
        filter === "all"
          ? true
          : filter === "done"
            ? place.visited
            : !place.visited,
      )
      .sort(
        (a, b) =>
          Number(a.visited) - Number(b.visited) ||
          PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order ||
          a.name.localeCompare(b.name, "th"),
      );
  }, [places, filter]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyPlace(trip.destination));
    setSheetOpen(true);
  }

  function openEdit(place: Place) {
    setEditingId(place.id);
    setDraft({
      name: place.name,
      province: place.province,
      note: place.note,
      priority: place.priority,
      visited: place.visited,
      lat: place.lat,
      lng: place.lng,
    });
    setSheetOpen(true);
  }

  function save() {
    if (!draft.name.trim()) return;
    const payload = { ...draft, name: draft.name.trim() };
    if (editingId) {
      dispatch({ type: "updatePlace", id: editingId, patch: payload });
    } else {
      dispatch({ type: "addPlace", place: payload });
    }
    setSheetOpen(false);
    setEditingId(null);
  }

  return (
    <>
      <PageHeader
        emoji="📍"
        title="สถานที่ที่อยากไป"
        subtitle="Places to Visit — ตั้งความสำคัญและติ๊กเมื่อไปแล้ว"
        action={
          <Button onClick={openCreate} className="hidden sm:inline-flex">
            ➕ เพิ่มสถานที่
          </Button>
        }
      />

      {places.length > 0 ? (
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">ไปแล้ว</span>
            <span className="font-medium tabular-nums">
              {visitedCount} / {places.length} ที่
            </span>
          </div>
          <ProgressBar
            percent={(visitedCount / places.length) * 100}
            barClass="bg-ok"
          />
        </Card>
      ) : null}

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              filter === item.id
                ? "border-brand bg-brand text-white"
                : "border-line bg-card text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          emoji="🗺️"
          title={
            places.length === 0
              ? "ยังไม่มีสถานที่ในรายการ"
              : "ไม่มีสถานที่ในตัวกรองนี้"
          }
          description="เพิ่มเองได้ หรือกดเพิ่มจากหน้าแนะนำเที่ยวก็ได้เหมือนกัน"
          action={<Button onClick={openCreate}>➕ เพิ่มสถานที่</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((place) => {
            const priority = PRIORITY_META[place.priority];
            return (
              <Card
                as="li"
                key={place.id}
                className={cn(place.visited && "opacity-70")}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={
                      place.visited
                        ? `ทำเครื่องหมายว่ายังไม่ได้ไป ${place.name}`
                        : `ทำเครื่องหมายว่าไปแล้ว ${place.name}`
                    }
                    onClick={() =>
                      dispatch({
                        type: "updatePlace",
                        id: place.id,
                        patch: { visited: !place.visited },
                      })
                    }
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-base transition-colors",
                      place.visited
                        ? "border-ok bg-ok text-white"
                        : "border-line text-transparent hover:border-ok",
                    )}
                  >
                    ✓
                  </button>

                  <div className="min-w-0 flex-1">
                    <h3
                      className={cn(
                        "font-medium break-words",
                        place.visited && "line-through",
                      )}
                    >
                      {place.name}
                    </h3>
                    {place.province ? (
                      <p className="mt-0.5 text-sm text-muted">
                        📍 {place.province}
                      </p>
                    ) : null}
                    {place.note ? (
                      <p className="mt-1.5 text-sm leading-relaxed break-words text-muted">
                        {place.note}
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Badge>
                        {priority.emoji} ความสำคัญ{priority.label}
                      </Badge>
                      {place.visited ? (
                        <Badge className="bg-ok-soft text-ok">✅ ไปแล้ว</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`แก้ไข ${place.name}`}
                      onClick={() => openEdit(place)}
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`ลบ ${place.name}`}
                      onClick={() => setDeleting(place)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={openCreate}
        aria-label="เพิ่มสถานที่"
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-lg transition-colors hover:bg-brand-dark sm:hidden"
      >
        ＋
      </button>

      <Sheet
        open={sheetOpen}
        title={editingId ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
        onClose={() => setSheetOpen(false)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setSheetOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1"
              disabled={!draft.name.trim()}
              onClick={save}
            >
              บันทึก
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="ชื่อสถานที่">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="เช่น วัดร่องขุ่น"
              autoFocus
            />
          </Field>

          <Field label="จังหวัด">
            <ProvinceSelect
              value={draft.province}
              onChange={(province) => setDraft({ ...draft, province })}
            />
          </Field>

          <Field label="ความสำคัญ">
            <Select
              value={draft.priority}
              onChange={(e) =>
                setDraft({ ...draft, priority: e.target.value as Priority })
              }
            >
              {(Object.keys(PRIORITY_META) as Priority[]).map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_META[key].emoji} {PRIORITY_META[key].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="หมายเหตุ">
            <Textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="เช่น ปิดวันจันทร์ / ค่าเข้า 100 บาท / ไปช่วงเช้าคนน้อย"
            />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleting !== null}
        title="ลบสถานที่"
        message={`ต้องการลบ "${deleting?.name ?? ""}" ออกจากรายการหรือไม่?`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) dispatch({ type: "deletePlace", id: deleting.id });
          setDeleting(null);
        }}
      />
    </>
  );
}
