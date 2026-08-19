-- Row Level Security for direct Supabase client access.
-- Prisma uses the database role from DATABASE_URL and typically bypasses RLS;
-- application code still MUST filter by schoolId from the authenticated profile.

alter table "School" enable row level security;
alter table "UserProfile" enable row level security;
alter table "AcademicYear" enable row level security;
alter table "Grade" enable row level security;
alter table "ClassGroup" enable row level security;
alter table "Teacher" enable row level security;
alter table "Subject" enable row level security;
alter table "TeacherSubject" enable row level security;
alter table "Room" enable row level security;
alter table "LessonDurationProfile" enable row level security;
alter table "BellScheduleProfile" enable row level security;
alter table "BellSlot" enable row level security;
alter table "CurriculumNormVersion" enable row level security;
alter table "CurriculumNormItem" enable row level security;
alter table "CurriculumRequirement" enable row level security;
alter table "ScheduleVersion" enable row level security;
alter table "Lesson" enable row level security;
alter table "ImportBatch" enable row level security;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select "role"::text from "UserProfile" where "userId" = auth.uid()::text
$$;

create or replace function public.current_profile_school_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce("currentSchoolId", "schoolId") from "UserProfile" where "userId" = auth.uid()::text
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.current_profile_role() = 'super_admin'
$$;

-- Profiles: a user can read own row; super_admin can read all.
drop policy if exists user_profile_select on "UserProfile";
create policy user_profile_select on "UserProfile"
  for select using (
    "userId" = auth.uid()::text or public.is_super_admin()
  );

drop policy if exists user_profile_update_self on "UserProfile";
create policy user_profile_update_self on "UserProfile"
  for update using ("userId" = auth.uid()::text)
  with check ("userId" = auth.uid()::text);

-- Helper predicate: row belongs to the caller's school (or super_admin).
-- Applied to tables that have schoolId.

do $$
declare
  t text;
begin
  foreach t in array array[
    'School',
    'AcademicYear',
    'Grade',
    'ClassGroup',
    'Teacher',
    'Subject',
    'Room',
    'LessonDurationProfile',
    'BellScheduleProfile',
    'CurriculumNormVersion',
    'CurriculumRequirement',
    'ScheduleVersion',
    'Lesson',
    'ImportBatch'
  ]
  loop
    execute format('drop policy if exists school_isolation_select on %I', t);
    if t = 'School' then
      execute format(
        'create policy school_isolation_select on %I for select using (public.is_super_admin() or id = public.current_profile_school_id())',
        t
      );
      execute format('drop policy if exists school_isolation_write on %I', t);
      execute format(
        'create policy school_isolation_write on %I for all using (public.is_super_admin() or id = public.current_profile_school_id()) with check (public.is_super_admin() or id = public.current_profile_school_id())',
        t
      );
    else
      execute format(
        'create policy school_isolation_select on %I for select using (public.is_super_admin() or "schoolId" = public.current_profile_school_id())',
        t
      );
      execute format('drop policy if exists school_isolation_write on %I', t);
      execute format(
        'create policy school_isolation_write on %I for all using (public.is_super_admin() or "schoolId" = public.current_profile_school_id()) with check (public.is_super_admin() or "schoolId" = public.current_profile_school_id())',
        t
      );
    end if;
  end loop;
end $$;

-- Child tables without schoolId: access via parent.
drop policy if exists teacher_subject_all on "TeacherSubject";
create policy teacher_subject_all on "TeacherSubject"
  for all using (
    exists (
      select 1 from "Teacher" t
      where t.id = "TeacherSubject"."teacherId"
        and (public.is_super_admin() or t."schoolId" = public.current_profile_school_id())
    )
  )
  with check (
    exists (
      select 1 from "Teacher" t
      where t.id = "TeacherSubject"."teacherId"
        and (public.is_super_admin() or t."schoolId" = public.current_profile_school_id())
    )
  );

drop policy if exists bell_slot_all on "BellSlot";
create policy bell_slot_all on "BellSlot"
  for all using (
    exists (
      select 1 from "BellScheduleProfile" p
      where p.id = "BellSlot"."profileId"
        and (public.is_super_admin() or p."schoolId" = public.current_profile_school_id())
    )
  )
  with check (
    exists (
      select 1 from "BellScheduleProfile" p
      where p.id = "BellSlot"."profileId"
        and (public.is_super_admin() or p."schoolId" = public.current_profile_school_id())
    )
  );

drop policy if exists norm_item_all on "CurriculumNormItem";
create policy norm_item_all on "CurriculumNormItem"
  for all using (
    exists (
      select 1 from "CurriculumNormVersion" v
      where v.id = "CurriculumNormItem"."versionId"
        and (public.is_super_admin() or v."schoolId" = public.current_profile_school_id())
    )
  )
  with check (
    exists (
      select 1 from "CurriculumNormVersion" v
      where v.id = "CurriculumNormItem"."versionId"
        and (public.is_super_admin() or v."schoolId" = public.current_profile_school_id())
    )
  );
