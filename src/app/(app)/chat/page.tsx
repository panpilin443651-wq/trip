import { TravelAssistant } from "@/components/TravelAssistant";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { isGeminiConfigured } from "@/lib/gemini/config";

/**
 * หน้าผู้ช่วย AI แบบเต็มหน้า
 *
 * เป็น Server Component เพื่ออ่าน isGeminiConfigured ได้ตรง ๆ
 * คีย์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น ฝั่งเบราว์เซอร์จึงเช็กเองไม่ได้
 */
export default function ChatPage() {
  return (
    <>
      <PageHeader
        title="ผู้ช่วย AI"
        subtitle="ถามได้ทั้งไปเที่ยวไหนดี วิธีใช้เว็บ และทริปที่คุณวางไว้"
      />

      {isGeminiConfigured ? (
        // หักความสูงของหัวหน้าและ padding ของ main ออก ให้ช่องพิมพ์อยู่ติดล่างพอดี
        <TravelAssistant className="flex h-[calc(100dvh-17rem)] min-h-80 flex-col lg:h-[calc(100dvh-15rem)]" />
      ) : (
        <Card as="section">
          <h2 className="text-base font-semibold">ยังไม่ได้ตั้งค่าผู้ช่วย AI</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            ส่วนอื่นของเว็บใช้ได้ปกติ แค่ผู้ช่วยยังไม่ทำงานเพราะยังไม่มี API key
          </p>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              1. ขอคีย์ฟรีที่{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-brand underline"
              >
                Google AI Studio
              </a>
            </li>
            <li>
              2. บน Vercel ไปที่ Project Settings → Environment Variables แล้วเพิ่ม{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">
                GEMINI_API_KEY
              </code>
            </li>
            <li>3. Redeploy หนึ่งครั้ง</li>
          </ol>
          <p className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-faint">
            ⚠️ อย่าใส่ <code>NEXT_PUBLIC_</code> นำหน้าชื่อตัวแปร คีย์นี้ต่างจาก
            anon key ของ Supabase ตรงที่ไม่มีอะไรคุ้มกัน ถ้าหลุดไปอยู่ในเบราว์เซอร์
            ใครก็เอาไปยิงจนโควตาหมดได้
          </p>
        </Card>
      )}
    </>
  );
}
