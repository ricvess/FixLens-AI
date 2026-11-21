-- =====================================================================
-- FixLens AI - Supabase security hardening
-- Run in: Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Review each block first: it assumes the table/column names used in script.js:
--   diagnoses(id, user_id, image_path, object_name, problem, urgency, confidence, diagnosis_json, created_at)
--   saved_diagnoses(user_id, diagnosis_id)
-- =====================================================================

-- 1) Row Level Security: users can only touch their own rows ----------
alter table public.diagnoses       enable row level security;
alter table public.saved_diagnoses enable row level security;

drop policy if exists "diagnoses_select_own" on public.diagnoses;
drop policy if exists "diagnoses_insert_own" on public.diagnoses;
drop policy if exists "diagnoses_delete_own" on public.diagnoses;
create policy "diagnoses_select_own" on public.diagnoses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "diagnoses_insert_own" on public.diagnoses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "diagnoses_delete_own" on public.diagnoses
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No UPDATE policy on purpose: saved results are immutable from the browser.

drop policy if exists "saved_select_own" on public.saved_diagnoses;
drop policy if exists "saved_insert_own" on public.saved_diagnoses;
drop policy if exists "saved_delete_own" on public.saved_diagnoses;
create policy "saved_select_own" on public.saved_diagnoses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved_insert_own" on public.saved_diagnoses
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.diagnoses d
                where d.id = diagnosis_id and d.user_id = (select auth.uid()))
  );
create policy "saved_delete_own" on public.saved_diagnoses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 2) Storage: private bucket, size + type limits, per-user folders ----
update storage.buckets
   set public             = false,
       file_size_limit    = 8388608,                                   -- 8 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'diagnosis-images';

drop policy if exists "diag_images_select_own" on storage.objects;
drop policy if exists "diag_images_insert_own" on storage.objects;
drop policy if exists "diag_images_delete_own" on storage.objects;
create policy "diag_images_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'diagnosis-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "diag_images_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'diagnosis-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "diag_images_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'diagnosis-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) Data sanity constraints (NOT VALID = do not fail on old rows) ----
alter table public.diagnoses drop constraint if exists diagnoses_urgency_chk;
alter table public.diagnoses add  constraint diagnoses_urgency_chk
  check (urgency in ('low','medium','high','critical')) not valid;
alter table public.diagnoses drop constraint if exists diagnoses_text_len_chk;
alter table public.diagnoses add  constraint diagnoses_text_len_chk
  check (char_length(object_name) <= 200 and char_length(problem) <= 300) not valid;

-- 4) Daily AI quota (each call costs money) - used by the Edge Function
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  calls   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;   -- no policies = browser cannot read/write

create or replace function public.bump_ai_usage(uid uuid, max_calls int)
returns boolean language plpgsql security definer set search_path = public as $$
declare used int;
begin
  insert into public.ai_usage(user_id, day, calls) values (uid, current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into used;
  return used <= max_calls;        -- false = quota exceeded
end $$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;

-- 5) Account deletion support: make sure user rows disappear with the account
-- diagnoses.user_id and saved_diagnoses.user_id should reference auth.users(id) ON DELETE CASCADE.
