-- ============================================================
-- 0002 — Row Level Security, privileges and Storage
--
-- Security model
--   * Guests (anon role) have NO direct table access at all.
--     They talk only to the serverless /api functions (service role, server-side)
--     and to two narrow, read-only RPC functions (see 0003).
--   * Administrators sign in with Supabase Auth. Their rights come from a row in
--     public.administrators, checked by is_wedding_admin().
-- ============================================================

alter table public.weddings        enable row level security;
alter table public.photos          enable row level security;
alter table public.administrators  enable row level security;
alter table public.upload_attempts enable row level security;   -- no policies = service role only

-- Start from zero privileges for the browser-facing roles, then grant narrowly.
revoke all on public.weddings, public.photos, public.administrators, public.upload_attempts
  from anon, authenticated;

grant select on public.weddings, public.photos, public.administrators to authenticated;
-- Admins may change only these columns (so they can never edit ids, tokens or storage paths).
grant update (bride_name, groom_name, wedding_date, upload_enabled, auto_approve, booth_shows_gallery)
  on public.weddings to authenticated;
grant update (approval_status, category, caption) on public.photos to authenticated;
grant delete on public.photos to authenticated;

-- ---------- helper: is the signed-in user an administrator of this wedding? ----------
create or replace function public.is_wedding_admin(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.administrators a
    where a.wedding_id = wid and a.user_id = auth.uid()
  );
$$;
revoke all on function public.is_wedding_admin(uuid) from public, anon;
grant execute on function public.is_wedding_admin(uuid) to authenticated;

-- ---------- policies ----------
drop policy if exists "admins read their wedding"   on public.weddings;
drop policy if exists "admins update their wedding" on public.weddings;
create policy "admins read their wedding" on public.weddings
  for select to authenticated using (public.is_wedding_admin(id));
create policy "admins update their wedding" on public.weddings
  for update to authenticated
  using (public.is_wedding_admin(id)) with check (public.is_wedding_admin(id));

drop policy if exists "admins read photos"   on public.photos;
drop policy if exists "admins update photos" on public.photos;
drop policy if exists "admins delete photos" on public.photos;
create policy "admins read photos" on public.photos
  for select to authenticated using (public.is_wedding_admin(wedding_id));
create policy "admins update photos" on public.photos
  for update to authenticated
  using (public.is_wedding_admin(wedding_id)) with check (public.is_wedding_admin(wedding_id));
create policy "admins delete photos" on public.photos
  for delete to authenticated using (public.is_wedding_admin(wedding_id));
-- Deliberately NO insert policy: only the server (service role) can create photo rows.

drop policy if exists "users read own admin rows" on public.administrators;
create policy "users read own admin rows" on public.administrators
  for select to authenticated using (user_id = auth.uid());
-- Admin rows are created by you in the SQL editor (service role), never from the browser.

-- ---------- storage bucket (PRIVATE) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', false, 15728640, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at   <wedding_id>/<photo_id>.jpg   and   <wedding_id>/thumbs/<photo_id>.jpg
-- Guests never touch Storage directly: uploads use short-lived signed upload URLs that the
-- server issues after validation, and viewing uses short-lived signed download URLs.
drop policy if exists "admins read wedding files"   on storage.objects;
drop policy if exists "admins delete wedding files" on storage.objects;
create policy "admins read wedding files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] in (
      select a.wedding_id::text from public.administrators a where a.user_id = auth.uid()
    )
  );
create policy "admins delete wedding files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wedding-photos'
    and (storage.foldername(name))[1] in (
      select a.wedding_id::text from public.administrators a where a.user_id = auth.uid()
    )
  );
