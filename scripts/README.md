# สคริปต์สำหรับดูแลข้อมูลจังหวัด

สคริปต์สองตัวนี้ใช้ตอนแก้ไข `src/data/provinces/*.ts` เท่านั้น
ไม่ได้เป็นส่วนหนึ่งของแอปตอนรัน และไม่ถูกรวมเข้า build

## geofill.js — เติมพิกัดจาก OpenStreetMap

เวลาเพิ่มสถานที่ใหม่ ให้ใส่ `lat: 0, lng: 0` ไว้ก่อน แล้วรัน

```bash
node scripts/geofill.js src/data/provinces/south.ts
```

สคริปต์จะค้นชื่อสถานที่ใน Nominatim (จำกัดเฉพาะประเทศไทย) และ
**ปฏิเสธผลลัพธ์ที่อยู่ไกลจากศูนย์กลางจังหวัดเกิน 170 กม.** เพื่อกันพิกัดผิดจังหวัด
(ตอนพัฒนาเคยได้พิกัดที่ไต้หวันมาจากการค้นแบบไม่จำกัด)

ถ้าสถานที่ไหนค้นด้วยชื่อไทยไม่เจอ ให้ทำไฟล์ override แล้วส่งเป็นอาร์กิวเมนต์ที่สอง

```json
{ "หาดสมิหลา": ["Samila Beach"] }
```

```bash
node scripts/geofill.js src/data/provinces/south.ts overrides.json
```

ชื่ออังกฤษมักค้นเจอมากกว่าชื่อไทยอย่างเห็นได้ชัด

## validate-coords.js — ตรวจพิกัดทั้งชุด

```bash
node scripts/validate-coords.js src/data/provinces/*.ts
```

รายงานจุดที่อยู่ไกลจากศูนย์กลางจังหวัดผิดปกติ ตั้งระยะเองได้ด้วย `LIMIT=200`

## gen-districts.js — สร้างรายชื่ออำเภอ

```bash
node scripts/gen-districts.js <ไฟล์ชื่อจังหวัด.json> src/data/districts.ts
```

ดึงจาก thailand-geography-json (MIT) แล้วสรุปเป็น จังหวัด → รายชื่ออำเภอ
ปัจจุบันได้ครบ 77 จังหวัด / 928 อำเภอ

## fill-districts.js — เติมอำเภอให้สถานที่แนะนำ

```bash
node scripts/fill-districts.js src/data/provinces/north.ts
```

reverse geocode พิกัดของแต่ละสถานที่กับ Nominatim แล้วเติมฟิลด์ `district`
เติมเฉพาะรายการที่ยังไม่มี รันซ้ำได้ไม่ยิงซ้ำ

**ตรวจผลก่อนเขียนเสมอ** — จุดที่ติดชายแดนมักคืนชื่อเขตปกครองของประเทศ
เพื่อนบ้านมา (เช่น บ้านรักไทยเคยได้ "จังหวัดล้างเค้อ" ของเมียนมา)
สคริปต์จะทิ้งผลที่ไม่ตรงกับรายชื่ออำเภอใน `districts.ts` ของจังหวัดนั้น

## gen-metro.js — โครงข่ายรถไฟฟ้า BTS/MRT

```bash
node scripts/gen-metro.js
```

ดึงเส้นทางและสถานีจาก OpenStreetMap ผ่าน Overpass API
ปัจจุบันได้ 7 สาย / 172 สถานี

**สองเรื่องที่ต้องรู้ถ้าจะแก้สคริปต์**

1. กรองสถานีจาก **tag ของ node** ไม่ใช่ `role` ของสมาชิก relation
   หลาย relation ใส่ role ว่างไว้ — BTS สีลมมี 11 จาก 14 สถานีที่ role ว่าง
   ถ้ากรองด้วย role จะเหลือแค่ 3 สถานี
2. บาง relation **ตกสถานีไป** เช่น BTS สุขุมวิทไม่มีหมอชิต
   เติมเองผ่าน `PATCHES` ที่ต้นไฟล์ ตรวจพิกัดจาก node ใน OSM ก่อนใส่เสมอ

Overpass ติด rate limit ง่าย สคริปต์รอ 8 วินาทีระหว่างเส้นทาง
และ retry อัตโนมัติ 3 ครั้ง

## alias-hooks.mjs

ตัวช่วยให้ `node --experimental-strip-types` รู้จัก path alias `@/` ของโปรเจกต์
ใช้ทดสอบตรรกะใน `src/lib` ตรง ๆ โดยไม่ต้องผ่าน Next

```bash
node --experimental-strip-types --import ./scripts/alias-hooks.mjs test.mts
```

## list-gemini-models.js

ดูว่า API key ของ Gemini ใช้รุ่นไหนได้บ้าง ใช้ตอนเจอ error ว่าไม่พบโมเดล

```bash
GEMINI_API_KEY=AIza... node scripts/list-gemini-models.js
```

ปกติไม่ต้องรัน เพราะแอปหารุ่นที่ใช้ได้เองอยู่แล้ว

## ชุดสร้างรายการสถานที่จาก OpenStreetMap

รันตามลำดับนี้เมื่ออยากอัปเดตข้อมูลใน `src/data/osm-places.ts`

```bash
node scripts/fetch-province-boundaries.js boundaries.json
node scripts/fetch-attractions.js attractions.json
node scripts/build-attractions.js attractions.json boundaries.json
node scripts/validate-osm-places.js
```

- **fetch-province-boundaries.js** — ขอบเขต 77 จังหวัดจาก OSM
  ย่อจุดเหลือความละเอียดราว 33 เมตร ได้ไฟล์ราว 12 MB
- **fetch-attractions.js** — ที่เที่ยวทั่วประเทศ ยิงทีเดียวต่อกลุ่มแท็ก
  กรองด้วยขอบเขตประเทศไทย ไม่ใช่กรอบสี่เหลี่ยม (กรอบกินเมียนมา/ลาว/กัมพูชาเข้ามา)
- **geo-provinces.js** — บอกว่าพิกัดอยู่จังหวัดไหน ด้วย ray casting ในเครื่อง
  ไม่ต้องยิง API ทีละจุด แม่นราว 97% เทียบกับ 364 จุดที่ยืนยันด้วย reverse geocode
- **build-attractions.js** — คัด แบ่งจังหวัด สลับประเภท แล้วเขียนไฟล์ข้อมูล
- **validate-osm-places.js** — ตรวจข้อมูลที่ได้ 8 ข้อ

## make-icons.js

สร้างไอคอนทั้งชุด — favicon.ico (16/32/48) และ PNG สำหรับติดตั้งเป็นแอป
(192, 512, maskable 512, apple-icon 180)

```bash
node scripts/make-icons.js
```

เขียน PNG เองด้วย zlib ที่ Node มีอยู่แล้ว ไม่ต้องลงไลบรารีแต่งรูป
รูปเป็นหมุดปักแผนที่สีทองบนพื้นกรมตามธีมเว็บ วาดด้วยสมการจึงคมทุกขนาด
รันใหม่เมื่ออยากเปลี่ยนสีหรือรูปทรง

favicon วาดคนละชุดกับไอคอนแอป — หมุดเต็มกรอบและรูใหญ่กว่า เพราะใช้จริงที่ 16px
ถ้าเว้นขอบเท่าไอคอนแอปจะเหลือไม่กี่พิกเซลจนดูไม่ออกว่าเป็นอะไร
ส่วน .ico เป็นแค่กล่องใส่ PNG หลายขนาด เขียนเองได้ไม่ต้องใช้เครื่องมือแปลง
