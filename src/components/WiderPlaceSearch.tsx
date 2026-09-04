"use client";

import { useEffect, useState } from "react";
import { PlaceThumb } from "@/components/PlaceThumb";
import { googleMapsUrl } from "@/lib/place-search";
import {
  rowFromMapSearch,
  rowFromTypedName,
  type SuggestionRow,
} from "@/lib/trip-suggestions";
import { Button } from "./ui";

/**
 * ค้นสถานที่นอกรายการที่การ์ดโหลดมา
 *
 * การ์ด "แนะนำสำหรับทริปนี้" โหลดเฉพาะจังหวัดของวันที่กำลังดู ซึ่งพอสำหรับ
 * การเลือกทั่วไป แต่ถ้าผู้ใช้นึกชื่อที่ไหนได้อยู่แล้วและที่นั่นอยู่คนละจังหวัด
 * หรือคนละอำเภอที่ไม่ได้เจาะไว้ จะหาไม่เจอเลยแล้วเข้าใจว่าเว็บไม่มีข้อมูล
 *
 * ค้นสองชั้น
 *   1. ฐานข้อมูลของเว็บทั้งประเทศ — ได้ครบทุกหมวด กดใส่แผนได้ตามปกติ
 *   2. ถ้าไม่เจอเลย ค่อยไปค้นแผนที่ (Nominatim) เพราะที่ที่เราคัดมามีเฉพาะ
 *      ที่ที่มีร่องรอยว่ามีตัวตนจริงจัง ที่เล็กหรือเพิ่งเปิดจึงไม่อยู่ในนั้น
 */

/** รอให้พิมพ์หยุดก่อนค่อยยิง ตามแบบเดียวกับ PlaceCombobox */
const DEBOUNCE_MS = 400;
const MIN_QUERY = 2;

interface Result {
  key: string;
  rows: SuggestionRow[];
  /** มาจากการค้นแผนที่ ไม่ใช่ฐานข้อมูลของเว็บ */
  fromMap: boolean;
  total: number;
}

export function WiderPlaceSearch({
  query,
  province,
  exclude,
  onAdd,
  added,
}: {
  query: string;
  /** จังหวัดของทริป ใช้ดันผลของจังหวัดนั้นขึ้นก่อน */
  province: string;
  /** คีย์ของแถวที่การ์ดแสดงอยู่แล้ว จะได้ไม่ขึ้นซ้ำ */
  exclude: Set<string>;
  onAdd: (row: SuggestionRow) => void;
  added: Set<string>;
}) {
  const q = query.trim();
  const wanted = `${q}::${province}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      const qs = `q=${encodeURIComponent(q)}&province=${encodeURIComponent(province)}`;
      fetch(`/api/search-places?${qs}`, { signal: AbortSignal.timeout(15000) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("search"))))
        .then(async (data: { rows: SuggestionRow[]; total: number }) => {
          if (data.total > 0) {
            return { rows: data.rows, fromMap: false, total: data.total };
          }
          // ไม่มีในฐานข้อมูลเลย ค่อยไปถามแผนที่
          const geo = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
            signal: AbortSignal.timeout(15000),
          })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []);
          const rows = (
            geo as Array<{
              name: string;
              display: string;
              lat: number;
              lng: number;
            }>
          ).map(rowFromMapSearch);
          return { rows, fromMap: true, total: rows.length };
        })
        .then((data) => {
          if (!cancelled) setResult({ key: wanted, ...data });
        })
        .catch(() => {
          if (!cancelled) {
            setResult({ key: wanted, rows: [], fromMap: false, total: 0 });
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, province, wanted]);

  if (q.length < MIN_QUERY) return null;

  const current = result?.key === wanted ? result : null;
  // ตัดที่ที่การ์ดแสดงอยู่แล้วออก ไม่งั้นจะเห็นชื่อเดิมสองรอบในหน้าเดียว
  const rows = current?.rows.filter((row) => !exclude.has(row.key)) ?? [];

  return (
    <section className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-medium">ค้นเพิ่มนอกรายการนี้</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">
        ค้นทั้งประเทศ ทุกหมวด — ที่พัก วัด ร้านอาหาร คาเฟ่ สถานที่ และกิจกรรม
      </p>

      {current === null ? (
        <p className="mt-3 text-sm text-muted">กำลังค้น…</p>
      ) : rows.length === 0 ? (
        /*
         * ไม่เจอที่ไหนเลย — ที่พักเล็ก ๆ ที่เพิ่งเปิดมักไม่มีทั้งในข้อมูลที่เราคัดมา
         * และใน OpenStreetMap ถ้าปิดทางแค่บอกให้พิมพ์ใหม่ ผู้ใช้จะใส่ที่ที่ตัวเอง
         * รู้จักลงแผนไม่ได้เลย ทั้งที่รู้ว่ามีจริง จึงให้เพิ่มเองด้วยชื่อที่พิมพ์ได้
         */
        <div className="mt-3 rounded-xl border border-dashed border-line px-3 py-4">
          <p className="text-sm leading-relaxed text-muted">
            ไม่พบ &ldquo;{q}&rdquo; ทั้งในฐานข้อมูลของเว็บและในแผนที่ —
            ที่พักหรือร้านที่เพิ่งเปิดมักยังไม่มีใครลงข้อมูลไว้
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onAdd(rowFromTypedName(q))}>
              ➕ เพิ่ม &ldquo;{q}&rdquo; เอง
            </Button>
            <a
              href={googleMapsUrl(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand underline underline-offset-2"
            >
              ค้นชื่อนี้ใน Google Maps
            </a>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            เพิ่มเองจะยังไม่มีพิกัด จึงปักหมุดบนแผนที่ไม่ได้
            แต่แก้ชื่อ เวลา และหมวดได้ที่หน้าแผนเที่ยว
          </p>
        </div>
      ) : (
        <>
          {current.fromMap ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              ไม่มีในฐานข้อมูลของเว็บ — ผลด้านล่างมาจากการค้นแผนที่
              จึงไม่มีประเภทและเวลาที่ควรเผื่อ ใส่แล้วปรับเองได้ที่หน้าแผนเที่ยว
            </p>
          ) : current.total > current.rows.length ? (
            <p className="mt-2 text-xs text-muted">
              แสดง {current.rows.length} จาก {current.total} รายการ —
              พิมพ์ให้เจาะจงขึ้นเพื่อให้แคบลง
            </p>
          ) : null}

          <ul className="mt-3 space-y-2">
            {rows.map((row) => {
              const inPlan = added.has(row.key);
              return (
                <li
                  key={row.key}
                  className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5"
                >
                  {row.mapsUrl ? (
                    <PlaceThumb
                      name={row.name}
                      province={row.province}
                      mapsUrl={row.mapsUrl}
                      skipLookup={!row.notable}
                      className="h-14 w-14"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">
                      {row.notable ? "⭐ " : ""}
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                      {row.group}
                      {row.hint && row.hint !== row.group ? ` · ${row.hint}` : ""}
                    </p>
                    {row.province ? (
                      <p className="mt-0.5 text-xs text-faint">
                        {row.province}
                        {row.district ? ` · อ.${row.district}` : ""}
                      </p>
                    ) : null}
                    {row.mapsUrl ? (
                      <a
                        href={row.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-brand underline underline-offset-2"
                      >
                        เปิดใน Google Maps
                      </a>
                    ) : null}
                  </div>

                  <Button
                    size="sm"
                    variant={inPlan ? "secondary" : "primary"}
                    disabled={inPlan}
                    onClick={() => onAdd(row)}
                    className="shrink-0"
                  >
                    {inPlan ? "✓ อยู่ในแผน" : "➕ ใส่"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
