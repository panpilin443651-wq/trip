import { CATEGORY_MAP } from "@/data/categories";
import { buildBreakdown } from "./budget";
import {
  addDaysISO,
  addMinutesToTime,
  formatDateThai,
  formatDuration,
  formatTHB,
  timeToMinutes,
} from "./format";
import type { Activity, AppState } from "./types";

/**
 * วาดสรุปแผนเที่ยวลง canvas เองแทนการใช้ไลบรารีแปลง HTML เป็นรูป
 * ทำแบบนี้เพื่อไม่ต้องเพิ่ม dependency และคุมผลลัพธ์ได้แน่นอนกว่า
 * (html2canvas มักเพี้ยนกับฟอนต์ไทยและ CSS สมัยใหม่)
 */

/** ต้องตรงกับ @theme ใน globals.css เพราะ canvas อ่านตัวแปร CSS ไม่ได้ */
const PALETTE = {
  canvas: "#f8f9fc",
  card: "#ffffff",
  ink: "#15203c",
  muted: "#5a6784",
  faint: "#8791a5",
  line: "#e3e7ef",
  brand: "#1e3159",
  brandSoft: "#eef1f8",
  gold: "#876d1a",
  goldFill: "#c9a227",
  goldSoft: "#fbf5e4",
  ok: "#17795e",
  warn: "#8d6909",
  danger: "#b3261e",
};

const W = 1080;
const PAD = 56;
const SCALE = 2; // เรนเดอร์ 2 เท่าให้คมบนจอความละเอียดสูง

function font(size: number, weight: 400 | 600 | 700 = 400) {
  return `${weight} ${size}px "Noto Sans Thai", "Sarabun", system-ui, sans-serif`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** ตัดข้อความให้พอดีความกว้าง คืนจำนวนบรรทัดที่ใช้ */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const words = text.split(/(\s+)/);
  let line = "";
  let lines = 0;

  for (const word of words) {
    const test = line + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines === maxLines - 1) {
        // บรรทัดสุดท้าย ตัดด้วย …
        let clipped = line.trimEnd();
        while (
          ctx.measureText(`${clipped}…`).width > maxWidth &&
          clipped.length > 1
        ) {
          clipped = clipped.slice(0, -1);
        }
        ctx.fillText(`${clipped}…`, x, y + lines * lineHeight);
        return lines + 1;
      }
      ctx.fillText(line.trimEnd(), x, y + lines * lineHeight);
      lines += 1;
      line = word.trimStart();
    } else {
      line = test;
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trimEnd(), x, y + lines * lineHeight);
    lines += 1;
  }
  return Math.max(1, lines);
}

interface DayBlock {
  index: number;
  date: string;
  activities: Activity[];
  cost: number;
  minutes: number;
}

function buildDays(state: AppState): DayBlock[] {
  const { trip, activities } = state;
  return Array.from({ length: trip.dayCount }, (_, index) => {
    const dayActivities = activities
      .filter((a) => a.dayIndex === index)
      .sort(
        (a, b) =>
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
          a.order - b.order,
      );
    return {
      index,
      date: addDaysISO(trip.startDate, index),
      activities: dayActivities,
      cost: dayActivities.reduce((sum, a) => sum + a.cost, 0),
      minutes: dayActivities.reduce((sum, a) => sum + a.durationMin, 0),
    };
  });
}

/** ความสูงที่ต้องใช้ คำนวณล่วงหน้าเพื่อสร้าง canvas ให้พอดี */
function measureHeight(state: AppState, days: DayBlock[]): number {
  let h = PAD + 150; // หัวเรื่อง
  h += 190; // การ์ดสรุปทริป
  h += 150; // การ์ดงบ
  for (const day of days) {
    h += 64; // หัววัน
    h += Math.max(1, day.activities.length) * 78;
    h += 44; // สรุปท้ายวัน
    h += 24;
  }
  if (state.checklist.length > 0) h += 110;
  if (state.trip.budgetNote.trim()) h += 130;
  h += 110; // ท้ายรูป
  return h;
}

export function drawTripSummary(
  canvas: HTMLCanvasElement,
  state: AppState,
): void {
  const { trip } = state;
  const days = buildDays(state);
  const breakdown = buildBreakdown(state);
  const height = measureHeight(state, days);

  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  // พื้นหลัง
  ctx.fillStyle = PALETTE.canvas;
  ctx.fillRect(0, 0, W, height);

  let y = PAD;
  const innerW = W - PAD * 2;

  // ---------- หัวเรื่อง ----------
  ctx.fillStyle = PALETTE.brand;
  ctx.font = font(30, 700);
  ctx.fillText("✈️ Travel Planner", PAD, y);
  y += 46;

  ctx.fillStyle = PALETTE.ink;
  ctx.font = font(44, 700);
  y += wrapText(ctx, trip.name || "ทริปของฉัน", PAD, y, innerW, 54, 2) * 54;

  // เส้นคาดทอง คั่นหัวเรื่องกับเนื้อหา
  ctx.fillStyle = PALETTE.goldFill;
  roundRect(ctx, PAD, y + 6, 96, 6, 3);
  ctx.fill();
  y += 30;

  // ---------- การ์ดข้อมูลทริป ----------
  const infoH = 170;
  ctx.fillStyle = PALETTE.card;
  roundRect(ctx, PAD, y, innerW, infoH, 24);
  ctx.fill();
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  let iy = y + 26;
  ctx.font = font(24, 600);
  ctx.fillStyle = PALETTE.ink;
  const range =
    trip.dayCount === 1
      ? formatDateThai(trip.startDate)
      : `${formatDateThai(trip.startDate, false)} – ${formatDateThai(
          addDaysISO(trip.startDate, trip.dayCount - 1),
          false,
        )}`;
  ctx.fillText(`🗓️  ${range}`, PAD + 28, iy);
  iy += 40;

  ctx.font = font(23);
  ctx.fillStyle = PALETTE.muted;
  const provinceLine =
    trip.provinces.length > 0
      ? trip.provinces.join("  →  ")
      : "ยังไม่ได้เลือกจังหวัด";
  iy += wrapText(ctx, `📍  ${provinceLine}`, PAD + 28, iy, innerW - 56, 34, 2) * 34;
  iy += 6;

  ctx.fillStyle = PALETTE.muted;
  ctx.font = font(23);
  ctx.fillText(
    `👥  ${trip.travelers} คน   •   ${
      trip.dayCount === 1 ? "ไปกลับวันเดียว" : `${trip.dayCount} วัน`
    }   •   📋 ${state.activities.length} กิจกรรม`,
    PAD + 28,
    iy,
  );

  y += infoH + 20;

  // ---------- การ์ดงบ ----------
  const budgetH = 130;
  const over = breakdown.status.tone === "over";
  ctx.fillStyle = over ? "#fdeceb" : PALETTE.brandSoft;
  roundRect(ctx, PAD, y, innerW, budgetH, 24);
  ctx.fill();

  ctx.fillStyle = PALETTE.muted;
  ctx.font = font(22);
  ctx.fillText(over ? "เกินงบไป" : "งบคงเหลือ", PAD + 28, y + 24);

  ctx.fillStyle = over ? PALETTE.danger : PALETTE.ok;
  ctx.font = font(42, 700);
  ctx.fillText(
    formatTHB(Math.abs(breakdown.remaining)),
    PAD + 28,
    y + 56,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = PALETTE.muted;
  ctx.font = font(22);
  ctx.fillText(`งบทั้งหมด ${formatTHB(breakdown.totalBudget)}`, W - PAD - 28, y + 40);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = font(26, 600);
  ctx.fillText(`ใช้ไป ${formatTHB(breakdown.totalSpent)}`, W - PAD - 28, y + 72);
  ctx.textAlign = "left";

  y += budgetH + 32;

  // ---------- แผนรายวัน ----------
  for (const day of days) {
    if (trip.dayCount > 1) {
      // ป้ายเลขวันสีทอง ตัวเลขสีกรม
      ctx.fillStyle = PALETTE.goldFill;
      roundRect(ctx, PAD, y - 4, 44, 40, 12);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.font = font(24, 700);
      ctx.textAlign = "center";
      ctx.fillText(String(day.index + 1), PAD + 22, y + 5);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = PALETTE.brand;
    ctx.font = font(28, 700);
    ctx.fillText(
      trip.dayCount === 1
        ? "แผนการเที่ยว"
        : `วันที่ ${day.index + 1}  •  ${formatDateThai(day.date)}`,
      trip.dayCount === 1 ? PAD : PAD + 60,
      y,
    );
    y += 48;

    if (day.activities.length === 0) {
      ctx.fillStyle = PALETTE.faint;
      ctx.font = font(23);
      ctx.fillText("— ยังไม่มีกิจกรรมในวันนี้ —", PAD + 8, y + 20);
      y += 78;
    } else {
      for (const activity of day.activities) {
        const rowH = 70;
        ctx.fillStyle = PALETTE.card;
        roundRect(ctx, PAD, y, innerW, rowH, 18);
        ctx.fill();
        ctx.strokeStyle = PALETTE.line;
        ctx.lineWidth = 2;
        ctx.stroke();

        // แถบทองด้านซ้ายของแต่ละกิจกรรม
        ctx.fillStyle = PALETTE.goldFill;
        roundRect(ctx, PAD + 6, y + 16, 5, rowH - 32, 3);
        ctx.fill();

        // เวลา
        ctx.fillStyle = PALETTE.brand;
        ctx.font = font(23, 600);
        ctx.fillText(activity.startTime, PAD + 22, y + 14);
        ctx.fillStyle = PALETTE.faint;
        ctx.font = font(18);
        ctx.fillText(
          addMinutesToTime(activity.startTime, activity.durationMin),
          PAD + 22,
          y + 42,
        );

        // ชื่อกิจกรรม
        ctx.fillStyle = PALETTE.ink;
        ctx.font = font(24, 600);
        const titleMax = innerW - 320;
        let title = activity.title;
        while (ctx.measureText(title).width > titleMax && title.length > 1) {
          title = title.slice(0, -1);
        }
        ctx.fillText(
          title + (title !== activity.title ? "…" : ""),
          PAD + 130,
          y + 13,
        );

        ctx.fillStyle = PALETTE.muted;
        ctx.font = font(19);
        const meta = `${CATEGORY_MAP[activity.category].emoji} ${
          CATEGORY_MAP[activity.category].label
        }${activity.placeName ? `  •  ${activity.placeName}` : ""}`;
        let metaText = meta;
        while (ctx.measureText(metaText).width > titleMax && metaText.length > 1) {
          metaText = metaText.slice(0, -1);
        }
        ctx.fillText(
          metaText + (metaText !== meta ? "…" : ""),
          PAD + 130,
          y + 44,
        );

        // ค่าใช้จ่าย
        ctx.textAlign = "right";
        ctx.fillStyle = activity.cost > 0 ? PALETTE.ink : PALETTE.faint;
        ctx.font = font(23, 600);
        ctx.fillText(
          activity.cost > 0 ? formatTHB(activity.cost) : "ฟรี",
          W - PAD - 22,
          y + 24,
        );
        ctx.textAlign = "left";

        y += rowH + 8;
      }
    }

    // สรุปท้ายวัน
    ctx.fillStyle = PALETTE.muted;
    ctx.font = font(21);
    ctx.fillText(
      `รวม ${day.activities.length} กิจกรรม  •  ⏱️ ${formatDuration(day.minutes)}`,
      PAD + 4,
      y + 4,
    );
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.ink;
    ctx.font = font(22, 600);
    ctx.fillText(`💰 ${formatTHB(day.cost)}`, W - PAD - 4, y + 2);
    ctx.textAlign = "left";
    y += 60;
  }

  // ---------- Checklist ----------
  if (state.checklist.length > 0) {
    const done = state.checklist.filter((c) => c.done).length;
    const percent = Math.round((done / state.checklist.length) * 100);

    ctx.fillStyle = PALETTE.card;
    roundRect(ctx, PAD, y, innerW, 86, 20);
    ctx.fill();
    ctx.strokeStyle = PALETTE.line;
    ctx.stroke();

    ctx.fillStyle = PALETTE.ink;
    ctx.font = font(24, 600);
    ctx.fillText(`✅ Checklist  ${done}/${state.checklist.length}`, PAD + 24, y + 18);

    // แถบความคืบหน้า
    const barW = innerW - 48;
    ctx.fillStyle = PALETTE.line;
    roundRect(ctx, PAD + 24, y + 56, barW, 12, 6);
    ctx.fill();
    ctx.fillStyle = percent === 100 ? PALETTE.ok : PALETTE.brand;
    roundRect(ctx, PAD + 24, y + 56, (barW * percent) / 100, 12, 6);
    ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.muted;
    ctx.font = font(22, 600);
    ctx.fillText(`${percent}%`, W - PAD - 24, y + 18);
    ctx.textAlign = "left";

    y += 110;
  }

  // ---------- บันทึกงบ ----------
  if (trip.budgetNote.trim()) {
    ctx.fillStyle = PALETTE.card;
    roundRect(ctx, PAD, y, innerW, 106, 20);
    ctx.fill();
    ctx.strokeStyle = PALETTE.line;
    ctx.stroke();

    ctx.fillStyle = PALETTE.muted;
    ctx.font = font(20, 600);
    ctx.fillText("📝 บันทึกช่วยจำ", PAD + 24, y + 18);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = font(21);
    wrapText(ctx, trip.budgetNote, PAD + 24, y + 48, innerW - 48, 30, 2);

    y += 130;
  }

  // ---------- ท้ายรูป ----------
  ctx.fillStyle = PALETTE.faint;
  ctx.font = font(19);
  ctx.fillText(
    "สร้างด้วย Travel Planner  •  ค่าใช้จ่ายและเวลาเป็นค่าประมาณ",
    PAD,
    y + 10,
  );
}

/** เซฟ canvas เป็นไฟล์ PNG */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
