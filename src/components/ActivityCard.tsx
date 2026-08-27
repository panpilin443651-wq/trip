"use client";

import { CATEGORY_MAP } from "@/data/categories";
import { addMinutesToTime, formatDuration, formatTHB } from "@/lib/format";
import { hasCoords } from "@/lib/geo";
import type { Activity } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

export function ActivityCard({
  activity,
  index,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = CATEGORY_MAP[activity.category];
  const endTime = addMinutesToTime(activity.startTime, activity.durationMin);

  return (
    <Card as="li" className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {index + 1}
        </span>
        <span className="mt-1 flex-1 border-l border-dashed border-line" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium tabular-nums text-brand">
              {activity.startTime} – {endTime}
              <span className="ml-2 font-normal text-muted">
                ({formatDuration(activity.durationMin)})
              </span>
            </p>
            <h3 className="mt-0.5 font-medium break-words">{activity.title}</h3>
            {activity.placeName ? (
              <p className="mt-0.5 text-sm break-words text-muted">
                📍 {activity.placeName}
                {hasCoords(activity) ? null : (
                  <span className="ml-1 text-xs text-faint">(ยังไม่ปักหมุด)</span>
                )}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`แก้ไข ${activity.title}`}
              onClick={onEdit}
            >
              ✏️
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`ลบ ${activity.title}`}
              onClick={onDelete}
            >
              🗑️
            </Button>
          </div>
        </div>

        {activity.detail ? (
          <p className="mt-2 text-sm leading-relaxed break-words text-muted">
            {activity.detail}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge>
            {category.emoji} {category.label}
          </Badge>
          {activity.cost > 0 ? (
            <Badge className="bg-brand-soft text-brand">
              {formatTHB(activity.cost)}
            </Badge>
          ) : (
            <Badge className="bg-ok-soft text-ok">ไม่มีค่าใช้จ่าย</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
