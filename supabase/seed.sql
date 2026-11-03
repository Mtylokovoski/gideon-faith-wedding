-- ============================================================
-- Seed: creates Gideon & Faith's wedding row.
-- Run once, after the three migrations. Safe to re-run.
-- ============================================================

insert into public.weddings (bride_name, groom_name, wedding_slug)
values ('Faith', 'Gideon', 'gideon-faith')
on conflict (wedding_slug) do nothing;

-- Set the date when you know it (format YYYY-MM-DD):
-- update public.weddings set wedding_date = '2026-12-12' where wedding_slug = 'gideon-faith';

-- ------------------------------------------------------------
-- Make someone an administrator
--   1. Supabase dashboard → Authentication → Users → Add user → Create new user
--      (tick "Auto Confirm User"). Use the email + password you'll sign in with.
--   2. Replace the email below with that user's email and run:
-- ------------------------------------------------------------
-- insert into public.administrators (wedding_id, user_id, role)
-- select w.id, u.id, 'owner'
-- from public.weddings w
-- join auth.users u on u.email = 'couple@example.com'
-- where w.wedding_slug = 'gideon-faith'
-- on conflict (wedding_id, user_id) do nothing;

-- Check the result (should show one row per administrator):
-- select u.email, a.role from public.administrators a join auth.users u on u.id = a.user_id;

-- The private gallery link token (build the link as https://YOUR-DOMAIN/gallery/<token>):
-- select gallery_token from public.weddings where wedding_slug = 'gideon-faith';
