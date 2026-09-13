# Architecture

## Overview

SatyaNet is a monorepo with two deployable units and one supporting service:

```
┌──────────────┐      REST/JSON       ┌───────────────┐      HTTP API      ┌───────────┐
│  React client │ ───────────────────▶│  Express API   │ ──────────────────▶│  IPFS node │
│  (Vite, SPA)  │◀─────────────────── │  + Postgres    │◀────────────────── │ (optional) │
└──────────────┘                      └───────────────┘                    └───────────┘
```

## Server layers

- **routes/** — HTTP handlers only: parse input, call services/db, shape the response.
- **services/** — business logic with no HTTP knowledge, so it's independently testable:
  - `cryptoUtils.js` — hashing (SHA-256), OTP generation, constant-time comparisons
  - `otpProvider.js` — OTP issuance/verification, pluggable delivery (console, Gmail/SMTP, or Twilio)
  - `ipfsService.js` — content anchoring, pluggable backend (mock, Pinata, or a raw IPFS node)
  - `moderation.js` — rule-based content scoring, fully auditable
  - `mediaModeration.js` — image/video content-safety check (see docs/content-safety.md)
- **middleware/** — cross-cutting concerns: `auth.js` (JWT + role guard), `rateLimit.js`, `asyncHandler.js`
- **database.js** — a `pg` connection pool + schema creation, with a thin `.get()/.all()/.run()`
  wrapper that converts `?`-style placeholders to Postgres's `$1, $2, ...` - this keeps every
  route file's queries readable without hand-numbering placeholders

## Data model

- `users` — credentials, role (`user`/`moderator`/`admin`), verification + trust score
- `otp_codes` — hashed, time-limited, single-use codes tied to a purpose
- `posts` — content, its SHA-256 hash, optional IPFS CID, moderation status/score
- `reports` — user-filed reports against a post, queued for moderator review
- `appeals` — user-filed appeals against a moderation action, resolved by mod/admin
- `audit_log` — append-only record of every moderation/admin action
- `notifications`, `connection_requests`, `conversations`, `messages` — the social/messaging layer

## Why Postgres (via a hosted provider like Supabase)

Early on this ran on SQLite for zero-infrastructure simplicity. It moved to
Postgres specifically to survive on free hosting tiers: many free
application-hosting plans (Render's free web services, for example) wipe
their local disk on every restart, which would silently delete a SQLite
file. A separately-hosted Postgres database (Supabase's free tier, in
particular) persists independently of the app server's own restarts/redeploys.
Every query in the codebase goes through `database.js`'s `db.get/all/run()`
wrapper rather than talking to Postgres directly, so if a future move to a
different database engine is ever needed, it's contained to that one file
plus the SQL text in each route (not a rearchitecture).

## Auth flow

1. `POST /api/auth/signup` creates an unverified user, issues an OTP.
2. `POST /api/auth/verify-otp` consumes the OTP, marks the user verified, returns a JWT.
3. Subsequent requests send `Authorization: Bearer <jwt>`; `middleware/auth.js` validates
   it and attaches `req.user`.
4. `middleware/auth.js`'s `requireRole()` gates moderator/admin-only routes.

## Content integrity flow

1. Client submits post content and/or a media file (image/video).
2. Server runs `moderation.evaluateContent()` on any text → score + reasons + status.
3. Server computes `hashContent()`/`hashBuffer()` (SHA-256) and calls `ipfsService.pinContent()`
   for text and media independently.
4. Media is also saved to `server/uploads/` and served statically, so it's actually
   playable in the MVP without requiring a real IPFS gateway.
5. All values (content, hash, CID, media metadata, status) are stored together in `posts`.
6. Anyone can recompute the hash from the returned content/media and confirm it matches —
   see `ipfs-node/README.md` for the exact command.

## Social graph

- `likes` — one row per (post, user), toggled on/off; `posts.like_count` is a denormalized
  counter kept in sync by the like/unlike route (avoids a `COUNT()` on every timeline load).
- `comments` — flat (no threading yet, see roadmap), one row per comment.
- `shares` — logged per share action (even anonymous shares), also denormalized into
  `posts.share_count`.

## Decentralization roadmap (honest assessment)

The current architecture (one Express server + one Postgres database) is **not**
censorship-resistant, regardless of what the application logic allows. It is
a single point of control: whoever controls that server's hosting/ISP/DNS
can take it offline, and whoever operates it can be legally compelled
regardless of what buttons exist in the admin panel. "Only the author can
delete their own post" is an *application-level* guarantee — useful for
preventing arbitrary moderator overreach — but it doesn't protect against
the server itself being seized or blocked.

Getting to genuine resistance against unilateral takedown is a distinct,
larger engineering effort:

1. **Real IPFS pinning across multiple independent nodes/pinning services**
   (not just one), so content survives any single node disappearing.
2. **Federation** — multiple independently-operated SatyaNet instances that
   mirror/relay each other's public posts (similar in spirit to Mastodon/
   ActivityPub), so no single operator's server is a single point of failure.
3. **No single admin key** — today, an `admin` role can flag/remove posts and
   change roles. A decentralized version would need this power distributed
   (e.g. multi-party approval) or removed from the network layer entirely,
   with moderation happening only at the level of what an individual node
   chooses to *relay*, not what exists.
4. **Alternative access paths** (IPFS gateways, `.onion`) so DNS/domain
   seizure doesn't cut off access entirely.

None of this removes legal responsibility for what's hosted — it changes
*who* has to make hosting decisions and *how resistant the network is to a
single point of pressure*. This is intentionally left as a phased roadmap
item rather than built into the MVP, since it's a materially different
(and much larger) system than a single-server social app.

## Moderation → report → appeal lifecycle

```
new post ──▶ auto-moderation ──▶ published            (score < 30)
                              └─▶ flagged ──▶ author appeals ──▶ mod/admin resolves
                                                               ├─▶ approved → published
                                                               └─▶ rejected → stays flagged/removed
published post ──▶ user reports ──▶ mod queue ──▶ mod dismisses OR manually actions the post
```

Every transition writes a row to `audit_log`, so the full history of any post
or user is reconstructable.
