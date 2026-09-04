import { NextResponse } from "next/server";
import { isRelevantPage } from "@/lib/place-photo";

/**
 * รูปประกอบของสถานที่ จากวิกิพีเดียภาษาไทย
 *
 * ใช้รูปประจำหน้าวิกิพีเดียเท่านั้น ไม่ได้ค้นรูปตามพิกัดรอบ ๆ
 * ลองแบบค้นตามพิกัดใน Wikimedia Commons แล้วได้รูปที่ไม่เกี่ยวเยอะมาก
 * (ค้นรอบบางตะบูนได้รูปหนังสือพิมพ์กับปลาทู) รูปผิดแย่กว่าไม่มีรูป
 * เพราะผู้ใช้เอาไว้ตัดสินใจว่าจะไปหรือไม่ไป
 *
 * ไม่ต้องใช้ API key และไม่ต้องผูกบัตร ต่างจาก Google Places
 */
export interface PlacePhoto {
  /** ว่างได้ ถ้าไม่มีรูป */
  url: string | null;
  /** ชื่อหน้าวิกิพีเดียที่เจอ ใช้ทำลิงก์ให้เครดิต */
  title: string | null;
  pageUrl: string | null;
}

const EMPTY: PlacePhoto = { url: null, title: null, pageUrl: null };

/** แคชยาว รูปประจำหน้าวิกิพีเดียแทบไม่เปลี่ยน */
const CACHE =
  "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = (params.get("name") ?? "").trim();
  // จังหวัดช่วยแยกชื่อซ้ำ เช่น "วัดใหญ่" มีหลายจังหวัด
  const province = (params.get("province") ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "ต้องระบุชื่อสถานที่" }, { status: 400 });
  }

  /** ค้นหนึ่งครั้ง คืนผลเฉพาะเมื่อหน้าที่เจอเป็นเรื่องเดียวกับสถานที่จริง */
  async function lookup(query: string): Promise<PlacePhoto | null> {
    const api =
      "https://th.wikipedia.org/w/api.php?action=query&format=json" +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1" +
      "&generator=search&gsrlimit=1&gsrsearch=" +
      encodeURIComponent(query);

    const upstream = await fetch(api, {
      headers: { "User-Agent": "travel-planner/1.0 (+trip planner)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 2_592_000 },
    });
    if (!upstream.ok) return null;

    const json = await upstream.json();
    const page = Object.values(json?.query?.pages ?? {})[0] as
      | { title?: string; thumbnail?: { source?: string } }
      | undefined;

    const url = page?.thumbnail?.source;
    const title = page?.title;
    if (!url || !title || !isRelevantPage(title, name)) return null;

    return {
      url,
      title,
      pageUrl: `https://th.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  }

  try {
    /*
     * ค้นด้วยชื่อล้วนก่อน แล้วค่อยเติมจังหวัด
     *
     * เติมจังหวัดตั้งแต่แรกทำให้ผลแย่ลงในหลายเคส — "หาดชะอำ เพชรบุรี"
     * ไปเจอหน้า "อำเภอชะอำ" แทนหน้าของหาดเอง จังหวัดจึงใช้เป็นตัวช่วย
     * เฉพาะตอนชื่อล้วนหาไม่เจอ ซึ่งมักเป็นชื่อที่ซ้ำกันหลายจังหวัด
     */
    const byName = await lookup(name);
    if (byName) {
      return NextResponse.json(byName, { headers: { "Cache-Control": CACHE } });
    }

    if (province) {
      const byProvince = await lookup(`${name} ${province}`);
      if (byProvince) {
        return NextResponse.json(byProvince, {
          headers: { "Cache-Control": CACHE },
        });
      }
    }

    return NextResponse.json(EMPTY, { headers: { "Cache-Control": CACHE } });
  } catch {
    // วิกิพีเดียล่มหรือเน็ตมีปัญหา — ไม่มีรูปก็ยังใช้หน้าเว็บต่อได้
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": CACHE } });
  }
}
