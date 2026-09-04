"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import type { DistrictCount } from "@/app/api/districts/route";
import { DistrictPicks } from "@/components/DistrictPicks";
import { ExplorePlaceSearch } from "@/components/ExplorePlaceSearch";
import { PlaceDetailSheet } from "@/components/PlaceDetailSheet";
import {
  Badge,
  Button,
  Card,
  Field,
  Select,
  Sheet,
} from "@/components/ui";
import {
  FEATURED_PROVINCE_IDS,
  PROVINCE_BY_NAME,
  PROVINCES,
  type SuggestedPlace,
} from "@/data/provinces";
import { ProvinceCombobox } from "@/components/ProvinceCombobox";
import { districtsOf } from "@/data/districts";
import { cn } from "@/lib/cn";
import {
  addDaysISO,
  addMinutesToTime,
  formatDateShort,
  formatDuration,
  formatTHB,
} from "@/lib/format";
import { useTrip } from "@/lib/trip-context";

type Tab = "places" | "activities";

/** ทางลัดไปจังหวัดที่คนไปบ่อย ไม่ต้องเลื่อนหาใน dropdown 77 รายการ */
const POPULAR = PROVINCES.filter((p) => FEATURED_PROVINCE_IDS.has(p.id));

export default function ExplorePage() {
  const { state, dispatch, activitiesForDay } = useTrip();
  const { trip, places } = state;

  // ถ้าตั้งปลายทางไว้แล้ว ให้เปิดจังหวัดนั้นก่อน
  // เปิดจังหวัดแรกของทริปก่อน ถ้ายังไม่ได้เลือกค่อยใช้จังหวัดยอดนิยม
  const initialProvince =
    trip.provinces
      .map((name) => PROVINCE_BY_NAME.get(name)?.id)
      .find(Boolean) ?? POPULAR[0].id;

  const [provinceId, setProvinceId] = useState(initialProvince);
  const [tab, setTab] = useState<Tab>("places");
  const [scheduling, setScheduling] = useState<SuggestedPlace | null>(null);
  const [targetDay, setTargetDay] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  /** ขั้นที่ 1 ของโฟลว์ — คำค้น กรองทั้งชื่อ ประเภท และคำอธิบาย */
  const [query, setQuery] = useState("");
  /** ขั้นที่ 3 — สถานที่ที่กำลังเปิดดูรายละเอียด (พร้อมแผนที่ของจุดนั้น) */
  const [detail, setDetail] = useState<SuggestedPlace | null>(null);
  /** ขั้นที่ 5 — ที่ที่ติ๊กไว้เพื่อสร้างเป็นโปรแกรมเที่ยวรวดเดียว */
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const province =
    PROVINCES.find((p) => p.id === provinceId) ?? PROVINCES[0];

  // อำเภอที่เลือกไว้เพื่อกรองสถานที่ ว่าง = ดูทั้งจังหวัด
  const [district, setDistrict] = useState<string>("");

  /**
   * อำเภอที่มีอะไรให้ดูจริง — รวมทั้งที่คัดไว้เองและที่มาจาก OpenStreetMap
   *
   * ผูกผลกับจังหวัดที่ขอไป ผลของจังหวัดเก่าจะถูกมองข้ามเองเมื่อคีย์ไม่ตรง
   * จึงไม่ต้องล้างค่าเก่าใน effect ซึ่งติดกฎ react-hooks/set-state-in-effect
   */
  const [osmDistricts, setOsmDistricts] = useState<{
    province: string;
    rows: DistrictCount[];
  }>({ province: "", rows: [] });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/districts?province=${encodeURIComponent(province.name)}`, {
      signal: AbortSignal.timeout(15000),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("districts"))))
      .then((rows: DistrictCount[]) => {
        if (!cancelled) setOsmDistricts({ province: province.name, rows });
      })
      .catch(() => {
        // ไม่ได้ก็ไม่เป็นไร ยังเหลืออำเภอจากรายการที่คัดไว้เอง
        if (!cancelled) setOsmDistricts({ province: province.name, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [province.name]);

  const districtsWithPlaces = useMemo(() => {
    const known = new Set(districtsOf(province.name));
    const found = new Set(
      province.places
        .map((place) => place.district)
        .filter((d): d is string => !!d && known.has(d)),
    );
    if (osmDistricts.province === province.name) {
      for (const row of osmDistricts.rows) found.add(row.name);
    }
    return [...found].sort((a, b) => a.localeCompare(b, "th"));
  }, [province, osmDistricts]);

  /** จำนวนที่จะโชว์บนชิปอำเภอ — รวมทั้งสองแหล่ง */
  const countInDistrict = (name: string) => {
    const curated = province.places.filter((p) => p.district === name).length;
    const osm =
      osmDistricts.province === province.name
        ? (osmDistricts.rows.find((r) => r.name === name)?.places ?? 0) +
          (osmDistricts.rows.find((r) => r.name === name)?.food ?? 0)
        : 0;
    return curated + osm;
  };

  /**
   * กรองตามอำเภอและคำค้น แล้วดันที่ติดดาวขึ้นบนสุด
   *
   * ค้นทั้งชื่อ ประเภท และคำอธิบาย เพราะคนมักจำได้แค่ว่า "ที่ดูนก" หรือ "นาเกลือ"
   * มากกว่าจะจำชื่อเต็มของสถานที่
   */
  const visiblePlaces = useMemo(() => {
    const byDistrict = district
      ? province.places.filter((place) => place.district === district)
      : province.places;
    const q = query.trim().toLowerCase();
    const matched = q
      ? byDistrict.filter((place) =>
          [place.name, place.tag, place.description].some((field) =>
            field.toLowerCase().includes(q),
          ),
        )
      : byDistrict;
    return [...matched].sort(
      (a, b) => Number(!!b.featured) - Number(!!a.featured),
    );
  }, [province, district, query]);

  /** ที่คัดไว้เองของอำเภอที่เลือก — ส่งให้ช่องค้นหาไปทำรายการ */
  const curatedInDistrict = useMemo(
    () =>
      district
        ? province.places.filter((place) => place.district === district)
        : province.places,
    [province, district],
  );

  const savedNames = useMemo(
    () => new Set(places.map((p) => p.name)),
    [places],
  );

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function addToPlaces(place: SuggestedPlace) {
    if (savedNames.has(place.name)) {
      notify(`"${place.name}" อยู่ในรายการอยู่แล้ว`);
      return;
    }
    dispatch({
      type: "addPlace",
      place: {
        name: place.name,
        province: province.name,
        note: `${place.description} • ${place.tip}`,
        priority: "medium",
        visited: false,
        lat: place.lat,
        lng: place.lng,
      },
    });
    notify(`เพิ่ม "${place.name}" ลงรายการสถานที่แล้ว`);
  }

  /** ต่อท้ายกิจกรรมสุดท้ายของวันนั้น เผื่อเวลาเดินทาง 30 นาที */
  function suggestedStartTime(dayIndex: number): string {
    const existing = activitiesForDay(dayIndex);
    const last = existing.at(-1);
    if (!last) return "09:00";
    return addMinutesToTime(last.startTime, last.durationMin + 30);
  }

  /**
   * ขั้นที่ 5 — เอาที่ติ๊กไว้ทั้งหมดใส่เป็นโปรแกรมของวันเดียว
   *
   * ไล่ต่อเวลาให้เองทีละจุด เผื่อเดินทางระหว่างจุด 30 นาที ผู้ใช้ยังแก้เวลา
   * ทีหลังได้ที่หน้าแผนเที่ยว ที่นี่แค่ทำโครงให้ก่อนจะได้ไม่ต้องกรอกทีละอัน
   */
  function buildProgram() {
    // เลือกจากสถานที่ทั้งจังหวัด ไม่ใช่จากรายการที่กรองอยู่ตอนนี้
    // เพราะคนติ๊กที่หนึ่งไว้แล้วพิมพ์ค้นต่อหรือสลับอำเภอได้
    // ถ้าอ่านจากรายการที่กรองแล้ว ที่ติ๊กไว้ก่อนหน้าจะหายไปเงียบ ๆ
    const chosen = province.places.filter((place) => picked.has(place.id));
    if (chosen.length === 0) return;

    let startTime = suggestedStartTime(targetDay);
    for (const place of chosen) {
      dispatch({
        type: "addActivity",
        activity: {
          dayIndex: targetDay,
          startTime,
          durationMin: place.durationMin,
          title: place.name,
          placeName: `${place.name} ${province.name}`,
          detail: `${place.description}
💡 ${place.tip}`,
          cost: place.fee,
          category: place.fee > 0 ? "attraction" : "other",
          lat: place.lat,
          lng: place.lng,
        },
      });
      startTime = addMinutesToTime(startTime, place.durationMin + 30);
    }

    notify(
      `สร้างโปรแกรม ${chosen.length} จุดในวันที่ ${targetDay + 1} แล้ว`,
    );
    setPicked(new Set());
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function scheduleActivity() {
    if (!scheduling) return;
    dispatch({
      type: "addActivity",
      activity: {
        dayIndex: targetDay,
        startTime: suggestedStartTime(targetDay),
        durationMin: scheduling.durationMin,
        title: scheduling.name,
        placeName: `${scheduling.name} ${province.name}`,
        detail: `${scheduling.description}\n💡 ${scheduling.tip}`,
        cost: scheduling.fee,
        category: scheduling.fee > 0 ? "attraction" : "other",
        lat: scheduling.lat,
        lng: scheduling.lng,
      },
    });
    notify(`ใส่ "${scheduling.name}" ในแผนวันที่ ${targetDay + 1} แล้ว`);
    setScheduling(null);
  }

  return (
    <>
      <PageHeader
        emoji="🧭"
        title="แนะนำเที่ยว"
        subtitle="เลือกจังหวัดแล้วหยิบสถานที่หรือกิจกรรมใส่แผนได้ทันที"
      />

      <Card className="mb-4">
        <Field
          label="เลือกจังหวัด"
          hint={`พิมพ์ชื่อจังหวัดได้เลย มีครบทั้ง ${PROVINCES.length} จังหวัด`}
        >
          <ProvinceCombobox
            value={province.name}
            aria-label="เลือกจังหวัด"
            onChange={(name) => {
              const found = PROVINCE_BY_NAME.get(name);
              if (found) {
                setProvinceId(found.id);
                // เปลี่ยนจังหวัดแล้วอำเภอ คำค้น และที่ติ๊กไว้ใช้ต่อไม่ได้
                // เพราะผูกกับจังหวัดเดิมทั้งหมด
                setDistrict("");
                setQuery("");
                setPicked(new Set());
              }
            }}
          />
        </Field>

        <p className="mt-3 mb-1.5 text-[13px] font-medium text-muted">
          จังหวัดยอดนิยม
        </p>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {POPULAR.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setProvinceId(item.id);
                setDistrict("");
                setQuery("");
                setPicked(new Set());
              }}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                item.id === provinceId
                  ? "border-brand bg-brand text-canvas"
                  : "border-line bg-card text-muted hover:text-ink",
              )}
            >
              {item.emoji} {item.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <Field
          label="ค้นหาสถานที่"
          hint="⭐ = ห้ามพลาด · เลือกอำเภอก่อนได้ รายการจะแคบลงตามอำเภอนั้น"
        >
          <ExplorePlaceSearch
            value={query}
            onChange={setQuery}
            onPickCurated={setDetail}
            province={province.name}
            district={district}
            curatedPlaces={curatedInDistrict}
          />
        </Field>
      </Card>

      <Card className="mb-4 bg-brand-soft ring-1 ring-brand/10">
        <h2 className="font-semibold">
          {province.emoji} {province.name}
        </h2>
        <p className="mt-1 text-sm text-muted">{province.blurb}</p>
        <p className="mt-2 text-xs text-faint">
          {province.region} • {province.places.length} สถานที่ •{" "}
          {province.activities.length} กิจกรรมแนะนำ
        </p>
      </Card>

      {districtsWithPlaces.length > 1 ? (
        <Card className="mb-4">
          <p className="mb-2 text-[13px] font-medium text-muted">
            เลือกอำเภอ
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDistrict("")}
              aria-pressed={district === ""}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs transition-colors",
                district === ""
                  ? "border-brand bg-brand text-canvas"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              ทั้งจังหวัด ({province.places.length})
            </button>
            {districtsWithPlaces.map((name) => {
              const count = countInDistrict(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDistrict(name)}
                  aria-pressed={district === name}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs transition-colors",
                    district === name
                      ? "border-brand bg-brand text-canvas"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {name} ({count})
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="mb-4 flex gap-2 rounded-xl bg-line/50 p-1">
        {(
          [
            ["places", "📍 สถานที่แนะนำ"],
            ["activities", "🎯 กิจกรรมแนะนำ"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors",
              tab === id ? "bg-card text-ink shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "places" ? (
        visiblePlaces.length === 0 ? (
          <Card>
            <p className="text-sm leading-relaxed text-muted">
              ไม่พบสถานที่ที่ตรงกับ &ldquo;{query}&rdquo;
              {district ? ` ในอำเภอ${district}` : ""} — ลองพิมพ์สั้นลง
              หรือกด &ldquo;ทั้งจังหวัด&rdquo; เพื่อดูให้กว้างขึ้น
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {visiblePlaces.map((place) => {
              const isPicked = picked.has(place.id);
              return (
                <Card
                  as="li"
                  key={place.id}
                  className={cn(
                    "transition-colors",
                    isPicked ? "border-brand bg-brand-soft" : null,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => togglePick(place.id)}
                      aria-pressed={isPicked}
                      aria-label={
                        isPicked
                          ? `เอา ${place.name} ออกจากโปรแกรม`
                          : `เลือก ${place.name} ใส่โปรแกรม`
                      }
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                        isPicked
                          ? "border-brand bg-brand text-canvas"
                          : "border-line text-transparent hover:border-brand",
                      )}
                    >
                      ✓
                    </button>

                    {/* กดที่เนื้อการ์ดเพื่อเปิดรายละเอียด + แผนที่ของจุดนี้ */}
                    <button
                      type="button"
                      onClick={() => setDetail(place)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xl leading-none" aria-hidden>
                          {place.emoji}
                        </span>
                        <span className="font-medium">
                          {place.featured ? (
                            <span
                              className="mr-1"
                              title="ที่ที่คนมาอำเภอนี้มักไม่พลาด"
                            >
                              ⭐
                            </span>
                          ) : null}
                          {place.name}
                        </span>
                        <Badge>{place.tag}</Badge>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {place.description}
                      </span>
                      <span className="mt-1.5 block text-xs text-faint">
                        ⏱️ {formatDuration(place.durationMin)} ·{" "}
                        {place.fee > 0
                          ? `🎟️ ~${formatTHB(place.fee)}`
                          : "🎟️ ไม่มีค่าเข้า"}
                        {place.district ? ` · 📍 ${place.district}` : ""}
                      </span>
                      <span className="mt-2 block text-xs text-brand underline">
                        ดูรายละเอียดและแผนที่ ›
                      </span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </ul>
        )
      ) : (
        <ul className="space-y-3">
          {province.activities.map((activity) => (
            <Card as="li" key={activity.id}>
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {activity.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{activity.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {activity.description}
                  </p>

                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">💵 ราคาประมาณ</dt>
                      <dd>{activity.price}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">⏱️ ใช้เวลา</dt>
                      <dd>{activity.duration}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-muted">🎒 ควรเตรียม</dt>
                      <dd>{activity.prepare}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {tab === "places" ? (
        <DistrictPicks
          province={province.name}
          district={district}
          dayIndex={targetDay}
          onAdded={(name) =>
            notify(`ใส่ "${name}" ในแผนวันที่ ${targetDay + 1} แล้ว`)
          }
        />
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-faint">
        ⚠️ ค่าเข้าและระยะเวลาเป็นค่าประมาณสำหรับใช้ตั้งงบและจัดตาราง
        ควรตรวจสอบกับแหล่งข้อมูลทางการอีกครั้งก่อนเดินทางจริง
      </p>

      {/* ขั้นที่ 3-4 — รายละเอียดสถานที่พร้อมแผนที่ของจุดนั้น */}
      <PlaceDetailSheet
        place={detail}
        province={province.name}
        isSaved={detail ? savedNames.has(detail.name) : false}
        onClose={() => setDetail(null)}
        onSaveToList={addToPlaces}
        onAddToTrip={(place) => {
          setDetail(null);
          setScheduling(place);
          setTargetDay(0);
        }}
      />

      {/*
        ขั้นที่ 5 — แถบสร้างโปรแกรม โผล่เมื่อติ๊กอย่างน้อยหนึ่งที่
        อยู่เหนือแถบเมนูล่างบนมือถือ ไม่งั้นจะโดนเมนูทับ
      */}
      {picked.size > 0 ? (
        <div className="fixed inset-x-3 bottom-24 z-40 rounded-3xl border border-line bg-card p-3 shadow-[var(--shadow-lift)] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:w-96">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              เลือกไว้ {picked.size} ที่
            </p>
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="text-xs text-muted underline"
            >
              ล้างที่เลือก
            </button>
          </div>

          {trip.dayCount > 1 ? (
            <Select
              value={targetDay}
              onChange={(e) => setTargetDay(Number(e.target.value))}
              aria-label="ใส่โปรแกรมในวันที่"
              className="mb-2"
            >
              {Array.from({ length: trip.dayCount }, (_, index) => (
                <option key={index} value={index}>
                  วันที่ {index + 1} (
                  {formatDateShort(addDaysISO(trip.startDate, index))})
                </option>
              ))}
            </Select>
          ) : null}

          <Button className="w-full" onClick={buildProgram}>
            🗓️ สร้างโปรแกรมเที่ยว
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            เรียงตามลำดับในรายการ เริ่ม {suggestedStartTime(targetDay)} น.
            เผื่อเดินทางระหว่างจุด 30 นาที แก้เวลาทีหลังได้ที่หน้าแผนเที่ยว
          </p>
        </div>
      ) : null}

      <Sheet
        open={scheduling !== null}
        title="ใส่ในแผนเที่ยว"
        onClose={() => setScheduling(null)}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setScheduling(null)}
            >
              ยกเลิก
            </Button>
            <Button className="flex-1" onClick={scheduleActivity}>
              เพิ่มลงแผน
            </Button>
          </div>
        }
      >
        {scheduling ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-canvas p-3">
              <p className="font-medium">
                {scheduling.emoji} {scheduling.name}
              </p>
              <p className="mt-1 text-sm text-muted">
                ⏱️ {formatDuration(scheduling.durationMin)} • 🎟️{" "}
                {scheduling.fee > 0 ? formatTHB(scheduling.fee) : "ไม่มีค่าเข้า"}
              </p>
            </div>

            {trip.dayCount > 1 ? (
              <Field label="ใส่ในวันที่">
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

            <p className="text-sm text-muted">
              จะเริ่มเวลา{" "}
              <span className="font-medium text-ink">
                {suggestedStartTime(targetDay)}
              </span>{" "}
              (ต่อจากกิจกรรมสุดท้ายของวันนั้น เผื่อเวลาเดินทาง 30 นาที)
              ปรับได้ภายหลังที่หน้าแผนเที่ยว
            </p>
          </div>
        ) : null}
      </Sheet>

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 rounded-xl bg-accent-fill px-4 py-3 text-center text-sm font-medium text-canvas shadow-[var(--shadow-lift)] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:max-w-sm"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
