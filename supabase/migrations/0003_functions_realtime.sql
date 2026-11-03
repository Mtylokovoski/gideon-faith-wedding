-- ============================================================
-- 0003 — Public RPCs, admin RPCs and realtime broadcast trigger
-- ============================================================

-- ---------- public: what the guest booth page needs (no photo data) ----------
create or replace function public.get_public_wedding(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w public.weddings;
  cnt integer;
begin
  select * into w from public.weddings where wedding_slug = lower(p_slug);
  if not found then
    return null;
  end if;

  select count(*) into cnt
  from public.photos
  where wedding_id = w.id and approval_status = 'approved' and finalized = true;

  return jsonb_build_object(
    'bride_name',     w.bride_name,
    'groom_name',     w.groom_name,
    'wedding_date',   w.wedding_date,
    'upload_enabled', w.upload_enabled,
    'photo_count',    cnt,
    -- Only revealed when the couple allows the booth page to link to the gallery.
    'gallery_token',  case when w.booth_shows_gallery then w.gallery_token else null end
  );
end;
$$;
revoke all on function public.get_public_wedding(text) from public;
grant execute on function public.get_public_wedding(text) to anon, authenticated;

-- ---------- admin: dashboard numbers ----------
create or replace function public.admin_stats(p_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_wedding_admin(p_wedding_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'total',    count(*),
      'pending',  count(*) filter (where approval_status = 'pending'),
      'approved', count(*) filter (where approval_status = 'approved'),
      'rejected', count(*) filter (where approval_status = 'rejected'),
      'bytes',    coalesce(sum(size_bytes), 0)
    )
    from public.photos
    where wedding_id = p_wedding_id and finalized = true
  );
end;
$$;
revoke all on function public.admin_stats(uuid) from public, anon;
grant execute on function public.admin_stats(uuid) to authenticated;

-- ---------- admin: replace the gallery link (if it ever leaks) ----------
create or replace function public.regenerate_gallery_token(p_wedding_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_wedding_admin(p_wedding_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.weddings set gallery_token = new_token where id = p_wedding_id;
  return new_token;
end;
$$;
revoke all on function public.regenerate_gallery_token(uuid) from public, anon;
grant execute on function public.regenerate_gallery_token(uuid) to authenticated;

-- ---------- realtime: tell open galleries that something changed ----------
-- Viewers have no table access, so instead of postgres_changes we broadcast a tiny
-- "something changed" message on a channel whose name contains the secret gallery token.
-- Clients then re-fetch through the token-checked /api/gallery endpoint.
create or replace function public.notify_gallery_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec  public.photos;
  tok  text;
begin
  rec := case when tg_op = 'DELETE' then old else new end;

  -- Ignore the first insert of a half-finished upload.
  if tg_op = 'INSERT' and rec.finalized = false then
    return new;
  end if;

  select gallery_token into tok from public.weddings where id = rec.wedding_id;

  if tok is not null then
    begin
      perform realtime.send(
        jsonb_build_object(
          'photo_id',  rec.id,
          'op',        tg_op,
          'status',    rec.approval_status,
          'finalized', rec.finalized
        ),
        'photo_changed',
        'gallery:' || tok,
        false            -- public channel (the unguessable name is the secret)
      );
    exception when others then
      null;              -- never let a realtime hiccup block an upload or an approval
    end;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists photos_notify_gallery on public.photos;
create trigger photos_notify_gallery
  after insert or update or delete on public.photos
  for each row execute function public.notify_gallery_change();
