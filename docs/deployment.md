# Deployment & Setup Guide

This covers everything from a fresh clone to a running dev environment,
to production with PM2, to pushing this project to GitHub.

---

## 1. Prerequisites

- Node.js 18+ and npm 9+ (`node -v`, `npm -v`)
- Git
- (Optional, for real content-anchoring) a running IPFS node — see `ipfs-node/README.md`

---

## 2. First-time setup

From the repo root (`satyanet-mvp/`):

```bash
# Install dependencies for both server and client in one go
npm run install:all
```

Then create the environment files from their templates:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Open `server/.env` and set at least:

```
JWT_SECRET=<generate a long random string, e.g. `openssl rand -hex 32`>
EMAIL_HASH_SECRET=<generate with `openssl rand -hex 32`>
EMAIL_ENCRYPTION_SECRET=<must be exactly 64 hex chars - generate with `openssl rand -hex 32`>
ADMIN_BOOTSTRAP_EMAIL=<your email>
ADMIN_BOOTSTRAP_PASSWORD=<a strong password>
```

Generate all three secrets at once:

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

**Why two different email secrets?** `EMAIL_HASH_SECRET` produces a one-way
fingerprint used only to look up a user by email (login, duplicate-signup
checks) — it can never be reversed back into an email. `EMAIL_ENCRYPTION_SECRET`
produces a reversible ciphertext used only when the real address is genuinely
needed, e.g. to deliver an OTP. Keeping them separate means a leak of one
secret doesn't compromise the other property. **Never reuse the same value
for both, and never commit either to git.**

Everything else has sensible defaults for local development (SQLite file
database, console-logged OTPs, mock IPFS).

---

## 3. Running in development

From the repo root, run both server and client together:

```bash
npm run dev
```

This starts:
- API at **http://localhost:4000** (health check: `curl http://localhost:4000/api/health`)
- Client at **http://localhost:5173**

On first server start, a bootstrap admin account is created automatically
using `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` from `server/.env`
— log in with those credentials to reach `/admin` and `/moderation`.

To run them separately instead:

```bash
npm run dev:server     # just the API
npm run dev:client     # just the client
```

OTP codes are printed straight to the server's terminal output in the
default `OTP_MODE=console`, e.g.:

```
[OTP] Code for you@example.com: 483920 (expires in 10m)
```

---

## 4. Running tests

```bash
npm run test:server
```

This runs the API integration tests in `server/tests/api.test.js` against an
in-memory SQLite database — it never touches your real `server/data/*.sqlite` file.

---

## 5. Building for production

```bash
npm run build:client
```

This produces a static bundle in `client/dist/`. Serve it with any static
file host (Nginx, Vercel, Netlify, Cloudflare Pages, or a simple `serve -s dist`).
Point it at your deployed API by setting `VITE_API_BASE_URL` in `client/.env`
**before** building (Vite bakes env vars in at build time).

---

## 6. Running the API in production with PM2

```bash
npm install -g pm2          # one-time, if not already installed
npm run install:all
cp server/.env.example server/.env   # then edit with production values

npm run pm2:start           # starts the API via ecosystem.config.js
pm2 status                  # check it's running
pm2 logs satyanet-server    # tail logs
npm run pm2:stop            # stop it
pm2 startup                 # (optional) make PM2 survive server reboots
pm2 save
```

`ecosystem.config.js` runs `server/index.js`, restarts on crash, and caps
memory at 300MB (`max_memory_restart`) as a safety net.

---

## 7. Reverse proxy (example: Nginx)

If you're serving the client as static files and proxying the API on the
same domain:

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

From the repo root (`satyanet-mvp/`):

```bash
git init
git add .
git commit -m "Initial commit: SatyaNet MVP"
```

Create an empty repository on GitHub (via the web UI, or the `gh` CLI below),
**without** initializing it with a README/license (to avoid a merge conflict
with your first commit):

```bash
# Using GitHub CLI (recommended if installed: gh auth login first)
gh repo create satyanet-mvp --private --source=. --remote=origin

# OR, if you created the repo manually on github.com, connect it manually:
git remote add origin https://github.com/<your-username>/satyanet-mvp.git
```

Then push:

```bash
git branch -M main
git push -u origin main
```

For subsequent changes:

```bash
git add .
git commit -m "Describe what changed"
git push
```

### Double-check before your first push

- `server/.env` and `client/.env` are in `.gitignore` — confirm they're **not**
  staged (`git status` should not list them). Never commit real secrets.
- `server/data/*.sqlite` is also ignored, so your local dev database won't be
  pushed.

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
| `DATABASE_PATH` | SQLite file location | `./data/satyanet.sqlite` |
| `OTP_MODE` | `console` or `twilio` | `console` |
| `OTP_TTL_MINUTES` | OTP validity window | `10` |
| `TWILIO_*` | Required only if `OTP_MODE=twilio` | — |
| `IPFS_MODE` | `mock` or `http` | `mock` |
| `IPFS_API_URL` | Real IPFS node/gateway URL | `http://127.0.0.1:5001` |
| `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD` | Creates one admin account on first run | — |

### `client/.env`

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL the client calls | `http://localhost:4000/api` |

---

## 10. Troubleshooting

- **`better-sqlite3` fails to install / native build error** — you need a
  C++ build toolchain. On Ubuntu/Debian: `sudo apt-get install build-essential python3`.
  On macOS: `xcode-select --install`.
- **CORS errors in the browser** — check `CLIENT_ORIGIN` in `server/.env`
  matches the exact origin the client is served from (protocol + host + port).
- **"Account not verified" on login** — the signup OTP wasn't verified yet;
  check the server console for the code, or use `/api/auth/resend-otp`.
- **Uploaded media not loading in the browser (blocked/blank image or video)** —
  confirm the server is running with the updated `app.js` that serves `/uploads`
  and sets a relaxed `Cross-Origin-Resource-Policy` for it; also check
  `VITE_API_BASE_URL` in `client/.env` is correct so `resolveMediaUrl()` can
  build the right absolute URL.
- **"Unsupported media type" on upload** — only JPEG/PNG/GIF/WEBP images and
  MP4/WEBM/MOV videos are accepted in the MVP; see `server/routes/posts.js`
  `ALLOWED_MIME` to extend this.
- **Port already in use** — change `PORT` in `server/.env` or `server.port`
  in `client/vite.config.js`.
