# Deployment & Setup Guide

This covers everything from a fresh clone to a running dev environment, to
free production deployment, to pushing this project to GitHub.

---

## 1. Prerequisites

- Node.js 18+ and npm 9+ (`node -v`, `npm -v`)
- Git
- A free Supabase account (for the Postgres database) — see Section 2a
- (Optional, for real content-anchoring) a Pinata account — see `ipfs-node/README.md`

---

## 2. First-time setup

From the repo root (`satyanet-mvp/`):

```bash
npm run install:all
```

Then create the environment files from their templates:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 2a. Set up your Postgres database (Supabase, free)

1. Go to https://supabase.com/ and create a free account + a new project
   (pick any name/region; the free plan needs no card).
2. Once the project is ready: **Project Settings → Database → Connection
   string → URI**. Copy it — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres
   ```
3. Paste it into `server/.env` as `DATABASE_URL` (replace `[YOUR-PASSWORD]`
   with the database password you set when creating the project).
4. That's it — the app creates all its tables automatically on first start
   (`db.initSchema()` runs at startup).

Your data now lives on Supabase's servers, not on whatever machine runs the
Express app — so it survives restarts/redeploys of the app itself, which
matters a lot on free hosting tiers (see Section 6).

### 2b. Generate secrets

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "EMAIL_HASH_SECRET=$(openssl rand -hex 32)"
echo "EMAIL_ENCRYPTION_SECRET=$(openssl rand -hex 32)"
```

No `openssl`? Use Node instead:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('EMAIL_HASH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('EMAIL_ENCRYPTION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Set `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` too - this creates
your one admin account on first server start.

**Why two different email secrets?** `EMAIL_HASH_SECRET` produces a one-way
fingerprint used only to look up a user by email — it can never be reversed
back into an email. `EMAIL_ENCRYPTION_SECRET` produces a reversible
ciphertext used only when the real address is genuinely needed (e.g. to
deliver an OTP). Keeping them separate means a leak of one secret doesn't
compromise the other property. **Never reuse the same value for both, and
never commit either to git.**

---

## 3. Running in development

From the repo root:

```bash
npm run dev
```

This starts:
- API at **http://localhost:4000**
- Client at **http://localhost:5173**

On first server start, a bootstrap admin account is created automatically
using `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`.

OTP codes are printed to the server terminal by default
(`EMAIL_OTP_DELIVERY=console`). To send real emails via Gmail (free):

1. Turn on 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. In `server/.env`:
   ```
   EMAIL_OTP_DELIVERY=gmail
   GMAIL_USER=youraddress@gmail.com
   GMAIL_APP_PASSWORD=the16charapppassword
   EMAIL_FROM="SatyaNet <youraddress@gmail.com>"
   ```
4. Restart the server.

If Gmail sending fails for any reason, the server automatically falls back
to logging the code to its own console (tagged `[OTP fallback]`).

---

## 4. Running tests

```bash
npm run test:server
```

**These tests need a real Postgres database** (set `DATABASE_URL` — a
separate Supabase project dedicated to testing is a good idea, so tests
never touch your real data).

---

## 5. Building the client for production

```bash
npm run build:client
```

Produces a static bundle in `client/dist/`. Set `VITE_API_BASE_URL` in
`client/.env` to your deployed API's URL **before** building (Vite bakes env
vars in at build time).

---

## 6. Deploying for free — Render (API) + Vercel (client)

### ⚠️ Read this first: the free-tier disk trade-off

Render's free web services have an **ephemeral filesystem** — anything
written to local disk (like uploaded media saved to `server/uploads/`,
before Pinata pins it) can be wiped whenever the service restarts, which
happens automatically after ~15 minutes of no traffic. This is why this
project's database now lives on Supabase (Section 2a) instead of a local
SQLite file, and why setting up Pinata (`ipfs-node/README.md`) for media is
strongly recommended before real users start uploading photos/videos - it
gives uploaded media a permanent home independent of Render's disk.

The free tier is genuinely fine for launching and getting initial users;
just know that:
- The app "sleeps" after ~15 min idle, and the next visitor waits ~30-60s
  for it to wake up.
- If you skip Pinata, any locally-stored media can be lost on a restart.
- Once there's real traffic (or a few dollars to spare), Render's paid
  Starter plan adds a persistent disk and removes the sleep delay.

### Deploy the API to Render

1. Push this repo to GitHub (see Section 8).
2. Go to https://render.com/, sign up free (no card required), **New → Web Service**.
3. Connect your GitHub repo.
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Add every variable from your `server/.env` under **Environment** in the
   Render dashboard — including `DATABASE_URL`, all the secrets, and set
   `NODE_ENV=production`.
6. Set `CLIENT_ORIGIN` to your Vercel URL once you have it (Section below) -
   you can come back and update this after deploying the client.
7. Deploy. Render gives you a URL like `https://satyanet-server.onrender.com`.

### Deploy the client to Vercel

1. Go to https://vercel.com/, sign up free, **Add New → Project**, import
   the same GitHub repo.
2. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
3. Add environment variable: `VITE_API_BASE_URL` = `https://satyanet-server.onrender.com/api`
   (your actual Render URL + `/api`).
4. Deploy. Vercel gives you a URL like `https://satyanet.vercel.app`.
5. Go back to Render and update `CLIENT_ORIGIN` to this Vercel URL, then
   redeploy the API (or it'll block the client with a CORS error).

That's it - both are genuinely $0/month.

---

## 7. Running the API yourself with PM2 (alternative to Render)

If you have your own server/VPS instead:

```bash
npm install -g pm2
npm run install:all
cp server/.env.example server/.env   # then edit with production values

npm run pm2:start
pm2 status
pm2 logs satyanet-server
npm run pm2:stop
pm2 startup
pm2 save
```

### Reverse proxy (example: Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /var/www/satyanet-client/dist;
        try_files $uri /index.html;
    }
}
```

Add HTTPS with `certbot --nginx` (Let's Encrypt) once DNS is pointed at the server.

---

## 8. Pushing this project to GitHub

```bash
git init
git add .
git commit -m "Initial commit: SatyaNet MVP"
gh repo create satyanet-mvp --private --source=. --remote=origin
git branch -M main
git push -u origin main
```

For subsequent changes: `git add . && git commit -m "..." && git push`.

**Before your first push:** run `git status` and confirm `server/.env` and
`client/.env` are NOT listed (they're gitignored — never commit real secrets).

---

## 9. Environment variable reference

### `server/.env`

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API port | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `JWT_SECRET` | Signs session tokens — **change in production** | — |
| `JWT_EXPIRES_IN` | Session lifetime | `7d` |
| `BCRYPT_SALT_ROUNDS` | Password hashing cost | `10` |
| `EMAIL_HASH_SECRET` | Keys the one-way email lookup hash — **change in production** | — |
| `EMAIL_ENCRYPTION_SECRET` | Keys reversible email encryption (64 hex chars) — **change in production** | — |
| `DATABASE_URL` | Postgres connection string (Supabase, etc.) | — |
| `OTP_TTL_MINUTES` | OTP validity window | `10` |
| `EMAIL_OTP_DELIVERY` | `console`, `gmail`, or `smtp` | `console` |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Required if `EMAIL_OTP_DELIVERY=gmail` | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Required if `EMAIL_OTP_DELIVERY=smtp` | — |
| `EMAIL_FROM` | "From" address on OTP emails | — |
| `SMS_OTP_DELIVERY` | `console` or `twilio` | `console` |
| `TWILIO_*` | Required only if `SMS_OTP_DELIVERY=twilio` | — |
| `IPFS_MODE` | `mock`, `pinata`, or `http` | `mock` |
| `PINATA_JWT` | Required if `IPFS_MODE=pinata` | — |
| `MEDIA_MODERATION_MODE` | `mock` or `sightengine` | `mock` |
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` | Required if `MEDIA_MODERATION_MODE=sightengine` | — |
| `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD` | Creates one admin account on first run | — |

### `client/.env`

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL the client calls | `http://localhost:4000/api` |

---

## 10. Troubleshooting

- **CORS errors in the browser** — check `CLIENT_ORIGIN` in `server/.env`
  matches the exact origin the client is served from (protocol + host + port,
  no trailing slash).
- **"Account not verified" on login** — the signup OTP wasn't verified yet;
  check the server console for the code (or your email if Gmail delivery is
  configured), or use `/api/auth/resend-otp`.
- **Uploaded media not loading in the browser** — confirm `VITE_API_BASE_URL`
  is correct; if `IPFS_MODE=mock`, media is served from the local `/uploads`
  path, which won't survive a Render restart (see Section 6).
- **"Unsupported media type" on upload** — only JPEG/PNG/GIF/WEBP images and
  MP4/WEBM/MOV videos are accepted; see `server/routes/posts.js` `ALLOWED_MIME`.
- **Database connection errors on startup** — double-check `DATABASE_URL` is
  the full connection string from Supabase (including the password), and that
  you copied the "URI" format, not "psql" or another format.
- **Port already in use** — change `PORT` in `server/.env` or `server.port`
  in `client/vite.config.js`.
