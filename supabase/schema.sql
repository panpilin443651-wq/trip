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
