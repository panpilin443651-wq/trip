"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  Select,
} from "@/components/ui";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_TEMPLATE,
} from "@/data/checklist-templates";
import { cn } from "@/lib/cn";
import { useTrip } from "@/lib/trip-context";
import type { ChecklistItem } from "@/lib/types";

export default function ChecklistPage() {
  const { state, dispatch } = useTrip();
  const { checklist } = state;

  const [text, setText] = useState("");
  const [group, setGroup] = useState<string>(CHECKLIST_GROUPS[0]);

  const doneCount = checklist.filter((item) => item.done).length;
  const percent = checklist.length
    ? (doneCount / checklist.length) * 100
    : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of checklist) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    // เรียงกลุ่มตามลำดับในเทมเพลตก่อน แล้วค่อยกลุ่มที่ผู้ใช้สร้างเอง
    return [...map.entries()].sort((a, b) => {
      const ai = CHECKLIST_GROUPS.indexOf(a[0] as (typeof CHECKLIST_GROUPS)[number]);
      const bi = CHECKLIST_GROUPS.indexOf(b[0] as (typeof CHECKLIST_GROUPS)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [checklist]);

  function addItem() {
    const value = text.trim();
    if (!value) return;
    dispatch({
      type: "addChecklistItems",
      items: [{ group, text: value, done: false }],
    });
    setText("");
  }

  return (
    <>
      <PageHeader
        emoji="✅"
        title="Checklist"
        subtitle="ของที่ต้องเตรียมก่อนออกเดินทาง"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              dispatch({
                type: "addChecklistItems",
                items: CHECKLIST_TEMPLATE.map((item) => ({
                  ...item,
                  done: false,
                })),
              })
            }
          >
            ✨ เติมจากเทมเพลต
          </Button>
        }
      />

      {checklist.length > 0 ? (
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted">ความคืบหน้า</span>
            <span className="text-sm font-semibold tabular-nums">
              {doneCount} / {checklist.length} ({Math.round(percent)}%)
            </span>
          </div>
          <ProgressBar
            percent={percent}
            barClass={percent === 100 ? "bg-ok" : "bg-brand"}
          />
          {percent === 100 ? (
            <p className="mt-2 text-sm text-ok">🎉 เตรียมของครบแล้ว พร้อมออกเดินทาง</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="mb-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="sm:w-52"
            aria-label="กลุ่ม"
          >
            {CHECKLIST_GROUPS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem();
            }}
            placeholder="เพิ่มรายการ เช่น หมอนรองคอ"
          />
          <Button onClick={addItem} disabled={!text.trim()} className="sm:w-28">
            เพิ่ม
          </Button>
        </div>
      </Card>

      {checklist.length === 0 ? (
        <EmptyState
          emoji="🧳"
          title="ยังไม่มีรายการ"
          description="กด “เติมจากเทมเพลต” เพื่อได้รายการมาตรฐานทันที แล้วค่อยปรับตามทริป"
          action={
            <Button
              onClick={() =>
                dispatch({
                  type: "addChecklistItems",
                  items: CHECKLIST_TEMPLATE.map((item) => ({
                    ...item,
                    done: false,
                  })),
                })
              }
            >
              ✨ เติมจากเทมเพลต
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([groupName, items]) => {
            const groupDone = items.filter((item) => item.done).length;
            return (
              <section key={groupName}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-muted">
                    {groupName}
                  </h2>
                  <span className="text-xs text-faint tabular-nums">
                    {groupDone}/{items.length}
                  </span>
                </div>

                <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                  {items.map((item, index) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 px-3",
                        index > 0 && "border-t border-line",
                      )}
                    >
                      <label className="flex min-h-13 flex-1 cursor-pointer items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() =>
                            dispatch({
                              type: "updateChecklistItem",
                              id: item.id,
                              patch: { done: !item.done },
                            })
                          }
                          className="h-5 w-5 shrink-0 accent-[var(--color-ok)]"
                        />
                        <span
                          className={cn(
                            "text-sm break-words",
                            item.done && "text-faint line-through",
                          )}
                        >
                          {item.text}
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`ลบ ${item.text}`}
                        onClick={() =>
                          dispatch({ type: "deleteChecklistItem", id: item.id })
                        }
                      >
                        🗑️
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
