# Gideon & Faith — Digital Wedding Photo Booth

Guests scan one QR code, take or upload photos in their phone's browser (no app, no account), and the photos appear in a shared gallery that updates live. Gideon and Faith manage everything from a private dashboard and can download all photos afterwards.

Stack: React, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide, Supabase (Postgres, Storage, Realtime, Auth), `qrcode`, hosted on Vercel.

## How it works

- Guests never touch the database. Uploads go through serverless functions in `/api` that validate the request, check rate limits (and an optional CAPTCHA), and hand back a short-lived signed upload URL. The photo only becomes visible after the server has checked that the uploaded file really is a JPEG.
- Photos are stored in a private Storage bucket. The gallery is served through `/api/gallery`, which requires the secret 64-character gallery token and returns short-lived signed image URLs.
- Realtime: the database broadcasts a tiny "something changed" message on a channel named after the gallery token. Open galleries then re-fetch, so new photos appear without a refresh.
- Administrators sign in with Supabase Auth. Row Level Security allows access only to users listed in the `administrators` table.
- The service-role key is used only in `/api` (server side). The browser only ever has the public anon key.

Pages:

| Address | Who | What |
| --- | --- | --- |
| `/wedding/gideon-faith` | Guests (the QR code opens this) | Welcome page, Take a photo, Upload photos, View gallery |
| `/wedding/gideon-faith/upload` | Guests | Camera, file picker, captions, categories, upload |
| `/gallery/<token>` | Anyone with the link | Live gallery, full-screen viewer, slideshow, downloads |
| `/admin/login`, `/admin` | Gideon and Faith | Dashboard, photo management, QR codes, settings |

## What you need before you start

- A free Supabase account: https://supabase.com
- A free GitHub account: https://github.com
- A free Vercel account: https://vercel.com
- Node.js 20 or newer on your computer (only for running locally; Vercel builds it for you)
- Optional: a free Cloudflare account for Turnstile (CAPTCHA), and your own domain name

## 1. Create a Supabase project

1. Sign in at supabase.com and choose **New project**.
2. Name it (for example `gideon-faith`), set and save a database password, and pick the region closest to the wedding guests.
3. Wait about two minutes for it to finish setting up.
4. Open **Project Settings → API** and note these three values. You need them later:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **anon / publishable key** (safe to expose in the browser)
   - **service_role / secret key** (private: never put it in browser code or share it)

## 2. Configure the database

1. In Supabase open **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/0001_schema.sql`, press **Run**.
3. Do the same, in this order, for `0002_rls_storage.sql` and then `0003_functions_realtime.sql`.
4. Paste and run `supabase/seed.sql`. It creates the wedding row with the slug `gideon-faith`.
5. To set the wedding date, run: `update public.weddings set wedding_date = '2026-12-12' where wedding_slug = 'gideon-faith';` using the real date. (It can also be set later in the dashboard.)

## 3. Configure Storage

Migration `0002` already creates the private bucket `wedding-photos` (JPEG only, 15 MB limit) and the access rules. Check it under **Storage**: the bucket should exist and must **not** be marked Public. Nothing else to do.

## 4. Set up administrator accounts

1. In Supabase open **Authentication → Users → Add user → Create new user**.
2. Enter the email and a strong password Gideon and Faith will use. Tick **Auto Confirm User**.
3. Make that user an administrator. In **SQL Editor** run (change the email):

```sql
insert into public.administrators (wedding_id, user_id, role)
select w.id, u.id, 'owner'
from public.weddings w
join auth.users u on u.email = 'couple@example.com'
where w.wedding_slug = 'gideon-faith'
on conflict (wedding_id, user_id) do nothing;
```

4. Repeat steps 1 to 3 for each extra person. Use role `'admin'` for them if you like.
5. Recommended: under **Authentication → Sign In / Providers**, switch off **Allow new users to sign up**, so nobody else can create accounts. Anyone who is signed in but not listed in `administrators` sees "No access" and can read nothing.

## 5. Environment variables

Copy `.env.example` to `.env.local` for local work. The same names go into Vercel (step 7).

| Name | Where to get it | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Same page → anon / publishable key | No |
| `VITE_SITE_URL` | Your live website address, once you know it (step 7) | No |
| `VITE_DEFAULT_WEDDING_SLUG` | Leave as `gideon-faith` | No |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → service_role / secret key | **Yes. Vercel only** |
| `RATE_LIMIT_SALT` | Any long random text (`openssl rand -hex 32`) | **Yes** |
| `CRON_SECRET` | Any long random text | **Yes** |
| `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional CAPTCHA, see below | Secret key: **Yes** |

Rate-limit defaults are generous on purpose, because a whole wedding often shares one venue Wi-Fi address. See `.env.example` for the optional tuning values.

Optional CAPTCHA: in the Cloudflare dashboard open **Turnstile → Add widget**, enter your website's domain, and copy the site key and secret key into the variables above. If they are left empty the CAPTCHA is simply off; rate limiting and server-side validation still apply.

If the two `VITE_SUPABASE_*` values are missing, the website shows a "Setup needed" page listing exactly what is missing, instead of pretending to work.

## 6. Push the project to GitHub

```bash
cd gideon-faith-wedding
git init
git add .
git commit -m "Gideon & Faith wedding photo booth"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/gideon-faith-wedding.git
git push -u origin main
```

Create the empty repository on github.com first (**New repository**, no README). `.gitignore` already keeps `.env` files and `node_modules` out of GitHub. Never commit real keys.

## 7. Deploy to Vercel

1. On vercel.com choose **Add New → Project** and import the GitHub repository.
2. Vercel detects Vite. The build settings in `vercel.json` are already correct. Leave them.
3. Open **Environment Variables** and add every variable from step 5. For `VITE_SITE_URL` use `https://temporary.vercel.app` for now.
4. Press **Deploy**. When it finishes, copy your website address (for example `https://gideon-faith.vercel.app`) or attach your own domain under **Settings → Domains**.
5. Set `VITE_SITE_URL` to the final address, then **Deployments → Redeploy** so it takes effect.
6. Open `https://YOUR-ADDRESS/wedding/gideon-faith` on a phone. You should see the welcome page with a photo counter.

`vercel.json` also schedules a daily cleanup job (`/api/cron-cleanup`) that removes half-finished uploads and old rate-limit records. It uses `CRON_SECRET`.

## 8. Generate the final wedding QR code

1. Go to `https://YOUR-ADDRESS/admin` and sign in.
2. Open the **QR code & sharing** tab.
3. Check that **Website address** is your live address. The page refuses to build a QR code for `localhost`, private network addresses or plain `http`, so a test code can never be printed by mistake.
4. The QR code points to `https://YOUR-ADDRESS/wedding/gideon-faith`.
5. Before printing, scan it with an ordinary phone camera and confirm the welcome page opens.

Downloads: **PNG** (3000 × 3000 pixels, for print), **SVG** (scales to any size, ideal for a print shop), and a **designed QR card** (PNG).

## 9. Download and print the QR sign

On the same tab:

- **Print A4 wedding sign** opens the print dialog with one A4 page: names, "Help Us Capture Our Beautiful Day!", the QR code, "SCAN TO SHARE YOUR PHOTOS 📸" and "Your memories are part of our story."
- **Print table cards** prints one A4 page with four small cards (cut along the dashed lines).

In the print dialog choose paper size **A4**, scale **100% / Default**, and switch **Background graphics** on if it is offered. Choose **Save as PDF** to keep a file or take it to a print shop. Print one test page and scan it before printing many.

## 10. Share the gallery link with the couple

In the **QR code & sharing** tab, **Private gallery link** shows `https://YOUR-ADDRESS/gallery/<long secret token>`. Copy it and send it to Gideon and Faith.

- Anyone who has this link can see the approved photographs. The page says so, too. Only send it to people you trust.
- The link keeps working after the wedding, even when uploads are switched off.
- If it is shared by mistake, **Create a new gallery link** makes the old one stop working at once. The guest QR code is not affected.
- By default the guest welcome page also shows a **View wedding gallery** button. To keep the gallery private to people you send the link to, switch off **Show the gallery button on the guest page** in Settings.

## Using the dashboard

- **Overview:** totals (uploaded, pending, approved, rejected, storage used), recent uploads, and settings.
- **Photos:** search captions and names, filter by status and category, approve, reject, delete (with a confirmation), change category, view full size, and download one photo, a selection, everything, or approved only. Downloads are ZIP files arranged in folders by category, plus a `photos.csv` listing. Very large collections are split into several ZIP files.
- **Settings:** switch uploads off after the wedding (the gallery stays available), choose whether new photos appear immediately or wait for approval, and set the wedding date.

## Running it on your own computer

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:5173
npm test                       # unit tests
npm run build                  # type-check and production build
```

The `/api` functions run on Vercel. For a full local test of uploads use `npx vercel dev` (needs the Vercel CLI and `vercel link`). Note that phone cameras only work on HTTPS or `localhost`, so test the camera on the deployed site.

## Testing checklist

Automated (`npm test`): QR address safety (rejects localhost, private networks, plain http), upload request validation, JPEG signature check, pagination cursor check, formatting helpers.

Checked in a browser against a mocked backend: the welcome page, redirect of signed-out visitors away from `/admin`, dashboard numbers, approve and delete, uploads switch, and generation of the QR PNG, SVG, card and A4 print pages (the QR codes were decoded and read back correctly).

Not possible without your real Supabase project and real phones. Please run these once after deploying, before the wedding:

1. Scan the printed QR code with an Android phone and an iPhone.
2. Tap **TAKE A PHOTO**, allow the camera, switch front and rear cameras, take a photo, retake it, add a caption, and submit.
3. Tap **TAKE A PHOTO** and deny camera permission. A friendly message and the file-picker fallback should appear.
4. Upload several photos from the phone gallery at once, including a failed one (turn on airplane mode mid-upload) and press retry.
5. Open the gallery link on a second device and upload from the first: the photo should appear without refreshing.
6. In the dashboard, set **Show new photos straight away** off, upload, then approve and reject photos.
7. Download one photo and download all photos.
8. Delete a photo.
9. Visit `/admin` while signed out, and while signed in with an account that is not in `administrators`. Neither may see anything.
10. Switch uploads off. The guest page should say sharing has closed, and the gallery must still open.

## Security summary

- No service-role key in browser code; it lives only in Vercel server variables.
- Guests have no table or storage access. They can only call the validated `/api` upload endpoints and two read-only functions.
- Admin actions are enforced by Row Level Security, not just hidden buttons. Admins can change only photo status, category and caption, and a limited set of wedding settings.
- Uploads: JPEG only, size limits, dimension limits, server-side signature check, text cleaned and length-limited, per-visitor and global rate limits (IP addresses are stored only as salted hashes), optional Turnstile CAPTCHA.
- Storage bucket is private; images are shown through short-lived signed URLs.
- The gallery needs a 64-character random token. Hidden photos (pending or rejected) are never returned.

## Privacy

Before uploading, guests see: "By submitting your photographs, you agree to share them with Gideon and Faith and other people who have access to the wedding gallery." No account is needed, the name is optional, and nothing else about guests is collected. Administrators can delete any photo, which also removes the files from storage.

## Project structure

```
api/                 Vercel serverless functions (upload-init, upload-complete, gallery, cron-cleanup)
src/components/      Hero, CameraCapture, PhotoUploader, UploadProgress, PhotoGallery, PhotoViewer,
                     QRGenerator, PrintSheets, AdminPhotos, AdminSettings, SharingTab, WeddingHeader …
src/pages/           Home, GuestUpload, Gallery, AdminLogin, AdminDashboard
src/services/        supabase.ts, photoService.ts, uploadService.ts, adminService.ts
src/hooks/           camera, gallery, wedding, admin session, Turnstile
supabase/            migrations (0001–0003) and seed.sql
tests/               unit tests
```

## Troubleshooting

- **"Setup needed" page:** a `VITE_SUPABASE_*` variable is missing. Add it in Vercel and redeploy.
- **Sign-in works but says "No access":** the user is not in `administrators`. Re-run the SQL in step 4.
- **Uploads fail with a server error:** check `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `RATE_LIMIT_SALT` in Vercel (server variables, no `VITE_` prefix), then redeploy.
- **Gallery does not update live:** in Supabase, check that Realtime is enabled for the project. The page still shows new photos when reloaded.
- **QR generator says the address is not valid:** enter your live `https://` address in the Website address box.
