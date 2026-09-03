import { PROVINCE_BY_NAME, PROVINCES } from "@/data/provinces";
import { placeFill, type SuggestionFill } from "./activity-search";

export interface PlaceOption {
  key: string;
  name: string;
  emoji: string;
  province: string;
  /** บรรทัดรองบอกประเภทและเวลาที่ควรเผื่อ */
  hint: string;
  /** มาจากข้อมูลที่เราคัดไว้ หรือมาจากการค้นสด */
  source: "curated" | "search";
  lat?: number;
  lng?: number;
  /** ค่าที่จะเติมลงฟอร์ม — มีเฉพาะที่มาจากข้อมูลที่คัดไว้ */
  fill?: SuggestionFill;
}

/** ลิงก์เปิดใน Google Maps เพื่อดูรูป รีวิว และเวลาเปิดปิดต่อ */
export function googleMapsUrl(name: string, lat?: number, lng?: number): string {
  const query = lat !== undefined && lng !== undefined ? `${lat},${lng}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function toOption(provinceName: string, place: {
  id: string;
  name: string;
  emoji: string;
  tag: string;
  lat: number;
  lng: number;
  durationMin: number;
  fee: number;
}): PlaceOption {
  const province = PROVINCE_BY_NAME.get(provinceName);
  const full = province?.places.find((p) => p.id === place.id);
  return {
    key: `curated:${place.id}`,
    name: place.name,
    emoji: place.emoji,
    province: provinceName,
    hint: `${place.tag} • เผื่อเวลา ${Math.round(place.durationMin / 60 * 10) / 10} ชม.${
      place.fee > 0 ? ` • ค่าเข้า ${place.fee} บาท` : " • ไม่มีค่าเข้า"
    }`,
    source: "curated",
    lat: place.lat,
    lng: place.lng,
    fill: full ? placeFill(provinceName, full) : undefined,
  };
}

/**
 * สถานที่ดังของจังหวัดหนึ่ง ใช้เป็นรายการที่โผล่ทันทีตอนกดที่ช่อง
 * ยังไม่ต้องพิมพ์อะไร คนที่ยังไม่รู้ว่าจะไปไหนจะได้เห็นตัวเลือกก่อน
 */
export function placesInProvince(provinceName: string): PlaceOption[] {
  const province = PROVINCE_BY_NAME.get(provinceName);
  if (!province) return [];
  return province.places.map((place) => toOption(province.name, place));
}

/** สถานที่ของทุกจังหวัดในทริป เรียงตามลำดับที่เลือกจังหวัดไว้ */
export function placesInTrip(provinceNames: string[]): PlaceOption[] {
  return provinceNames.flatMap((name) => placesInProvince(name));
}

/**
 * ค้นสถานที่จากข้อมูลที่คัดไว้ทั้ง 77 จังหวัด
 * จังหวัดในทริปได้แต้มพิเศษจึงลอยขึ้นก่อน ส่วนจังหวัดอื่นตามหลังพร้อมป้ายบอก
 */
export function searchCuratedPlaces(
  query: string,
  provinceNames: string[],
  limit = 8,
): PlaceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const selected = new Set(provinceNames.filter(Boolean));

  const scored: Array<{ option: PlaceOption; score: number }> = [];
  for (const province of PROVINCES) {
    for (const place of province.places) {
      const name = place.name.toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score = 100;
      else if (name.includes(q)) score = 80;
      else if (place.tag.toLowerCase().includes(q)) score = 55;
      else if (place.description.toLowerCase().includes(q)) score = 40;
      if (score === 0) continue;
      if (selected.has(province.name)) score += 1000;
      scored.push({ option: toOption(province.name, place), score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name, "th"))
    .slice(0, limit)
    .map((row) => row.option);
}
