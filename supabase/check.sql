-- =====================================================================
-- เช็กว่าตั้งค่า Supabase ครบหรือยัง
-- วางทั้งไฟล์ใน SQL Editor แล้ว Run — ดูคอลัมน์ status
-- =====================================================================
select
  '1. ตาราง trip_states' as "รายการ",
  case when exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'trip_states'
  ) then '✅ มีแล้ว' else '❌ ยังไม่มี — รัน schema.sql' end as "status"

union all
select
  '2. เปิด RLS',
  case when exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'trip_states' and rowsecurity
  ) then '✅ เปิดแล้ว' else '❌ ยังไม่เปิด' end

union all
select
  '3. RLS policy (ต้องมี 4)',
  case count(*)
    when 4 then '✅ ครบ 4'
    else '❌ มี ' || count(*) || ' อัน — รัน schema.sql ซ้ำ'
  end
from pg_policies
where schemaname = 'public' and tablename = 'trip_states'

union all
select
  '4. GRANT ให้ authenticated (ต้องมี 4)',
  case count(*)
    when 4 then '✅ ครบ 4'
    else '❌ มี ' || count(*) || ' อัน — สาเหตุของ permission denied'
  end
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'trip_states'
  and grantee = 'authenticated'
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')

union all
select
  '5. จำนวนผู้ใช้ที่สมัครแล้ว',
  count(*) || ' คน'
from auth.users;
