# Security Checklist — Before Going Live

Read this once, top to bottom, before deploying SatyaNet anywhere the
public internet can reach it. Items marked ✅ are already built in; items
marked 🔲 are things **you** need to do at deploy time.

## Already built in (nothing to do)

- ✅ Passwords hashed with bcrypt, never stored in plain text
- ✅ Email stored hashed (lookup) + separately encrypted (recovery) — never in plaintext
- ✅ JWT session tokens, not stored server-side, sent via `Authorization` header
  (not cookies — this also means the app isn't vulnerable to CSRF, since a
  malicious site can't make the browser attach your token automatically)
- ✅ All database queries use parameterized statements (`db.prepare(...).run(...)`)
  — SQL injection isn't possible through normal input
- ✅ Rate limiting on auth endpoints (20 req/10min) and globally (300 req/15min)
- ✅ Helmet security headers (clickjacking, MIME-sniffing protections, etc.)
- ✅ CORS restricted to a specific origin (not "allow everyone")
- ✅ Upload file types allow-listed (only specific image/video MIME types —
  no SVG, no HTML, no executables)
- ✅ Upload file size capped at 50MB
- ✅ React auto-escapes rendered content by default — no raw HTML injection
  risk from user-generated post/comment text
- ✅ Error responses never leak stack traces to the client
- ✅ Role-gated admin/moderator actions (`requireRole`)

## 🔲 Things you must do before deploying

### 1. Generate FRESH secrets for production — never reuse your dev `.env`

Your local `.env` secrets have been visible in this conversation's zip files
at various points. Generate brand new ones for the live deployment:

```bash
openssl rand -hex 32   # run this 3 times for JWT_SECRET, EMAIL_HASH_SECRET, EMAIL_ENCRYPTION_SECRET
```

Set a strong, unique `ADMIN_BOOTSTRAP_PASSWORD` too — not the one from dev.

### 2. Set `CLIENT_ORIGIN` to your real deployed frontend URL

Not `http://localhost:5173` — e.g. `https://satyanet.example.com`. If it's
wrong, the browser will silently block all API requests (CORS error).

### 3. Turn on real content-safety and email delivery

- `MEDIA_MODERATION_MODE=sightengine` (not `mock`) — otherwise **any**
  image/video gets published unchecked. This is the single most important
  setting to get right before real strangers can upload.
- `EMAIL_OTP_DELIVERY=gmail` or `smtp` (not `console`) — otherwise nobody
  can actually receive their verification code.

### 4. ⚠️ Critical SQLite gotcha — read this before picking a host

**Many free hosting tiers (Render free web services, Heroku, some Railway
configurations) wipe the entire filesystem on every restart or redeploy.**
Since SatyaNet stores its database (`server/data/satyanet.sqlite`) and
uploaded media (`server/uploads/`) as files on disk, this means **all
users, posts, and uploaded photos/videos disappear** the next time the
service restarts — which can happen automatically at any time on a free
tier.

Before deploying, confirm your host gives you a **persistent disk/volume**
that survives restarts:
- Render: requires a paid "Persistent Disk" add-on on the service
- Railway: supports persistent volumes (check it's attached to the service)
- Fly.io: supports persistent volumes
- A basic VPS (DigitalOcean, Linode, etc.): the disk is persistent by default

If you can't get persistent storage on your chosen host, the fallback is to
migrate from SQLite to a hosted database (Postgres) before launch — a
bigger step, so it's much cheaper to just pick a host with a real disk.

### 5. Enable HTTPS

Almost every modern hosting platform (Render, Railway, Fly.io, Vercel,
Netlify) gives you free HTTPS automatically via their reverse proxy — you
usually don't need to configure certificates yourself. Just confirm your
final URL is `https://`, not `http://`.

### 6. Run `npm audit` in both `server/` and `client/`

```bash
cd server && npm audit
cd ../client && npm audit
```

Fix anything marked "high" or "critical" (usually `npm audit fix`).
Moderate/low findings in dev dependencies are generally fine to leave for now.

### 7. Double-check `.env` is never committed

```bash
git status
```

`server/.env` and `client/.env` should **never** appear in the list of
files to commit — they're in `.gitignore`, but it's worth a manual check
before your first push to a public repo.

## Known limitations (acceptable for a launch-and-iterate MVP, revisit later)

- No 2FA beyond the signup OTP (no ongoing 2FA on login)
- No account lockout after repeated failed logins (rate limiting slows
  brute force but doesn't lock accounts)
- No automated dependency-vulnerability monitoring (run `npm audit`
  manually before each deploy for now; tools like Dependabot can automate
  this later)
- No web application firewall (WAF) — acceptable at small scale, worth
  adding via your hosting provider (e.g. Cloudflare) once you have real traffic
