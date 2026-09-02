/**
 * ดูว่า API key ของเราใช้รุ่นไหนได้บ้าง
 *
 * ใช้:
 *   GEMINI_API_KEY=AIza... node scripts/list-gemini-models.js
 * บน PowerShell:
 *   $env:GEMINI_API_KEY="AIza..."; node scripts/list-gemini-models.js
 *
 * คีย์แต่ละใบเห็นรุ่นไม่เท่ากัน และ Google สับเปลี่ยนรุ่นในชั้นฟรีอยู่เรื่อย ๆ
 * เจอ 404 เมื่อไรให้รันตัวนี้ดูว่าตอนนี้มีอะไรให้ใช้
 */
const KEY = process.env.GEMINI_API_KEY;

if (!KEY) {
  console.error("ยังไม่ได้ตั้ง GEMINI_API_KEY");
  process.exit(1);
}

/** เรียงให้ตรงกับที่แอปเลือกใช้ (ดู src/lib/gemini/models.ts) */
function rank(models) {
  return models
    .filter(
      (m) => !/embedding|aqa|image|imagen|veo|tts|audio|native-audio|live/.test(m),
    )
    .sort((a, b) => {
      const score = (name) =>
        (/flash/.test(name) ? 100 : 0) +
        (/lite/.test(name) ? -10 : 0) +
        (/preview|exp/.test(name) ? -30 : 0) +
        (/2\.5/.test(name) ? 20 : /2\.0/.test(name) ? 10 : 0);
      return score(b) - score(a) || a.localeCompare(b);
    });
}

(async () => {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
    { headers: { "x-goog-api-key": KEY } },
  );

  if (!res.ok) {
    console.error(`ถามรายชื่อรุ่นไม่สำเร็จ (HTTP ${res.status})`);
    console.error(await res.text());
    if (res.status === 400 || res.status === 403) {
      console.error(
        "\nคีย์อาจผิด หรือยังไม่ได้เปิดใช้ Generative Language API ในโปรเจกต์นั้น",
      );
    }
    process.exit(1);
  }

  const { models = [] } = await res.json();
  const chat = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("streamGenerateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""));

  console.log(`คีย์นี้เห็นทั้งหมด ${models.length} รุ่น · ใช้แชทได้ ${chat.length} รุ่น\n`);

  const ranked = rank(chat);
  if (ranked.length === 0) {
    console.log("ไม่มีรุ่นที่ใช้แชทได้เลย");
    return;
  }

  console.log("เรียงตามที่แอปจะเลือกใช้:");
  ranked.forEach((m, i) => console.log(`  ${i === 0 ? "→" : " "} ${m}`));

  // ยิงจริงหนึ่งครั้งด้วยเพย์โหลดหน้าตาเดียวกับที่แอปใช้
  // อยู่ในรายชื่อรุ่นไม่ได้แปลว่าเรียกได้ สิทธิ์เป็นคนละชุดกัน
  console.log(`\nลองเรียก "${ranked[0]}" จริง…`);
  const test = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${ranked[0]}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "ตอบสั้น ๆ เป็นภาษาไทย" }] },
        contents: [{ role: "user", parts: [{ text: "ทักทายสั้น ๆ" }] }],
        generationConfig: { maxOutputTokens: 50 },
      }),
    },
  );

  if (test.ok) {
    const data = await test.json();
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((x) => x.text ?? "")
      .join("");
    console.log(`✓ เรียกได้ ตอบว่า: ${text.trim() || "(ว่าง)"}`);
    console.log(`\nแอปจะใช้ "${ranked[0]}" ให้เอง ไม่ต้องตั้ง GEMINI_MODEL`);
  } else {
    console.log(`✗ เรียกไม่ได้ (HTTP ${test.status})`);
    console.log(await test.text());
    console.log("\nเอาข้อความข้างบนนี้ไปหาสาเหตุได้เลย");
  }
})();
