-- ============================================================
-- 0001 — Core tables
-- Run migrations 0001 → 0002 → 0003 in order (SQL Editor, or `supabase db push`).
-- ============================================================

create table if not exists public.weddings (
  id                  uuid primary key default gen_random_uuid(),
  bride_name          text not null,
  groom_name          text not null,
  wedding_date        date,
  wedding_slug        text not null unique
                        check (wedding_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                               and char_length(wedding_slug) between 3 and 60),
  -- 64 hex characters (~240 bits of randomness): the unguessable gallery link.
  gallery_token       text not null unique
                        default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  upload_enabled      boolean not null default true,
  -- true  = new photos appear in the gallery immediately (admins can still reject later)
  -- false = new photos wait as "pending" until a couple approves them
  auto_approve        boolean not null default true,
  -- true  = the guest booth page shows a "View gallery" button (anyone who scans the QR can see the gallery)
  -- false = the gallery link is only known to people the couple shares it with
  booth_shows_gallery boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists public.photos (
  id              uuid primary key default gen_random_uuid(),
  wedding_id      uuid not null references public.weddings(id) on delete cascade,
  storage_path    text not null,
  thumb_path      text not null,
  caption         text check (caption is null or char_length(caption) <= 200),
  category        text not null default 'other'
                    check (category in ('preparations','bride','groom','ceremony','family',
                                        'friends','reception','dancing','behind_the_scenes','other')),
  guest_name      text check (guest_name is null or char_length(guest_name) <= 60),
  approval_status text not null default 'pending'
                    check (approval_status in ('pending','approved','rejected')),
  uploaded_at     timestamptz not null default now(),
  -- A row is only "real" once the server has verified the uploaded files.
  finalized       boolean not null default false,
  size_bytes      bigint not null default 0,
  width           integer,
  height          integer
);

create index if not exists photos_gallery_idx
  on public.photos (wedding_id, approval_status, finalized, uploaded_at desc);
create index if not exists photos_category_idx
  on public.photos (wedding_id, category);
create index if not exists photos_cleanup_idx
  on public.photos (finalized, uploaded_at) where finalized = false;

create table if not exists public.administrators (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'admin' check (role in ('owner','admin')),
  created_at  timestamptz not null default now(),
  unique (wedding_id, user_id)
);

-- Used only by the server (service role) for upload rate limiting.
-- Stores a salted hash of the visitor's IP, never the IP itself.
create table if not exists public.upload_attempts (
  id          bigint generated always as identity primary key,
  wedding_id  uuid references public.weddings(id) on delete cascade,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists upload_attempts_ip_idx on public.upload_attempts (ip_hash, created_at desc);
create index if not exists upload_attempts_wedding_idx on public.upload_attempts (wedding_id, created_at desc);
