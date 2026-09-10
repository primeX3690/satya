# SatyaNet MVP

SatyaNet is a truth-verification social platform. Users post claims, other users
and an automated moderation layer flag questionable content, and a transparent
appeals + audit trail lets people contest moderation decisions. Content hashes
are anchored to IPFS so posts cannot be silently altered after publication.

## Monorepo layout

```
satyanet-mvp/
├── server/     Express + SQLite API (auth, posts, reports, appeals, admin)
├── client/     React (Vite) single-page app
├── ipfs-node/  Notes on running a local IPFS node for content anchoring
└── docs/       Architecture, roadmap, funding pitch, deployment notes
```

## Quick start

See [docs/deployment.md](docs/deployment.md) for full setup, environment
variables, and production deployment (PM2) instructions.

```bash
npm run install:all   # installs server + client dependencies
npm run dev            # runs API (http://localhost:4000) + client (http://localhost:5173)
```

## Core features

- **Auth** — email/phone signup with OTP verification, JWT sessions, bcrypt password hashing.
- **Posts** — create/read a public timeline; every post is hashed (SHA-256) and the hash is pinned to IPFS.
- **Moderation** — a lightweight rule-based engine flags posts for review before they go fully public.
- **Reports** — any user can report a post; reports feed the moderation queue.
- **Appeals** — a user whose post was actioned can file an appeal; admins resolve appeals with a visible audit trail.
- **Admin** — lookup users/posts, run moderation actions, and review the full audit log.

## Tech stack

- Backend: Node.js, Express, better-sqlite3, jsonwebtoken, bcryptjs
- Frontend: React 18, Vite, plain CSS (no framework lock-in)
- Storage/integrity: IPFS (via `ipfs-http-client`, mockable for local dev)
