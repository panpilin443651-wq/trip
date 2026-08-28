-- =====================================================================
-- Travel Planner — สคีมาสำหรับ Supabase
--
-- วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์ -> Run
-- รันซ้ำได้ ไม่พัง (ใช้ if not exists / drop policy if exists)
-- =====================================================================

-- ---------------------------------------------------------------------
-- ตารางเก็บแผนทริปของผู้ใช้แต่ละคน
--
-- เก็บทั้งแผนเป็น JSONB ก้อนเดียวต่อผู้ใช้ เพราะแอปนี้อ่าน-เขียน
-- ทั้งแผนพร้อมกันเสมอ (กิจกรรม งบ checklist สัมพันธ์กันหมด)
-- ถ้าวันหลังต้องการ query รายกิจกรรมหรือแชร์แผนให้คนอื่นดู
-- ค่อยแตกเป็นตารางย่อยทีหลังได้
-- ---------------------------------------------------------------------
create table if not exists public.trip_states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.trip_states is
  'แผนทริปของผู้ใช้ 1 แถวต่อ 1 ผู้ใช้ คอลัมน์ data คือ AppState ทั้งก้อน';

-- ---------------------------------------------------------------------
-- สิทธิ์ระดับตาราง (GRANT)
--
-- ต้องให้ต่างหากจาก RLS เพราะเป็นคนละชั้นกัน
--   GRANT = role นี้แตะตารางนี้ได้ไหม
--   RLS   = แตะได้แล้ว เห็นแถวไหนบ้าง
-- ถ้าไม่มี GRANT จะขึ้น "permission denied for table trip_states"
-- ทั้งที่ policy ถูกต้องครบแล้ว
--
-- ให้เฉพาะ authenticated ไม่ให้ anon เพราะทุก policy ต้องมี auth.uid()
-- ผู้ใช้ที่ยังไม่ล็อกอินจึงไม่มีเหตุให้แตะตารางนี้ตั้งแต่แรก
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.trip_states to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security — ผู้ใช้เห็นและแก้ได้เฉพาะแถวของตัวเอง
-- สำคัญมาก เพราะเว็บใช้ anon key ซึ่งเปิดเผยในเบราว์เซอร์
-- ถ้าไม่เปิด RLS ใครก็อ่านข้อมูลคนอื่นได้
-- ---------------------------------------------------------------------
alter table public.trip_states enable row level security;

drop policy if exists "อ่านแผนของตัวเอง" on public.trip_states;
create policy "อ่านแผนของตัวเอง"
  on public.trip_states for select
  using (auth.uid() = user_id);

drop policy if exists "สร้างแผนของตัวเอง" on public.trip_states;
create policy "สร้างแผนของตัวเอง"
  on public.trip_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "แก้แผนของตัวเอง" on public.trip_states;
create policy "แก้แผนของตัวเอง"
  on public.trip_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ลบแผนของตัวเอง" on public.trip_states;
create policy "ลบแผนของตัวเอง"
  on public.trip_states for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- อัปเดต updated_at อัตโนมัติทุกครั้งที่แก้
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trip_states_touch_updated_at on public.trip_states;
create trigger trip_states_touch_updated_at
  before update on public.trip_states
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Storage — รูปความทรงจำที่แนบกับจุดแวะ
--
-- bucket เป็นแบบส่วนตัว (public = false) เว็บจึงต้องขอ signed URL
-- ทุกครั้งที่จะแสดงรูป คนที่ไม่มีลิงก์เปิดดูไม่ได้
--
-- โครงสร้างพาธ: <user_id>/<ชื่อไฟล์>
-- policy เช็กโฟลเดอร์ชั้นแรกว่าตรงกับ auth.uid() ไหม
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  5242880,                                  -- 5 MB ต่อไฟล์
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ดูรูปของตัวเอง" on storage.objects;
create policy "ดูรูปของตัวเอง"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "อัปโหลดรูปของตัวเอง" on storage.objects;
create policy "อัปโหลดรูปของตัวเอง"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ลบรูปของตัวเอง" on storage.objects;
create policy "ลบรูปของตัวเอง"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- ตรวจว่าตั้งค่าครบแล้ว — รันแยกได้ ผลลัพธ์ควรเป็นตามคอมเมนต์
-- =====================================================================

-- ควรได้ rowsecurity = true
-- select tablename, rowsecurity
--   from pg_tables where schemaname = 'public' and tablename = 'trip_states';

-- ควรได้ 4 แถว (select / insert / update / delete)
-- select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'trip_states';

-- ควรได้ SELECT, INSERT, UPDATE, DELETE ของ role authenticated
-- ถ้าว่าง แปลว่า GRANT ยังไม่ผ่าน จะเจอ permission denied for table
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'trip_states'
--   order by grantee, privilege_type;
