# Roadmap

## Shipped in this MVP

- Email/phone signup with OTP verification
- JWT session auth, bcrypt password hashing
- Email stored hashed (lookup) + separately encrypted (recovery) — never plaintext
- Public timeline of published posts, with photo/video upload
- Likes, comments, and shares on every post
- SHA-256 content fingerprinting + IPFS anchoring (mock or real) — for text and media
- Rule-based auto-moderation with transparent, logged reasons
- User-filed reports → moderator queue
- Author-filed appeals → moderator/admin resolution → automatic restoration
- Admin user lookup, role management, manual post actions
- Full audit log covering every moderation/admin action

## Near-term (v1.1)

- Real OTP delivery in production (Twilio wired, needs account + verified sender)
- Pagination cursor on the public timeline (`before` param already supported server-side;
  add "load more" in the client)
- Password reset flow (token generation already available via `cryptoUtils.randomToken`)
- Rich text on posts (bold/links); comment replies/threading
- Per-user notification when an appeal is resolved or a post is liked/commented on
- True decentralization: multiple independent hosting nodes (see docs/architecture.md
  "Decentralization roadmap" section) so no single server is a takedown target

## Mid-term (v1.2–1.3)

- Replace keyword-based moderation with a lightweight classifier, keeping the
  same `{ score, reasons, status }` contract so nothing downstream changes
- Reputation system: `trust_score` currently exists in the schema but isn't
  yet adjusted automatically — tie it to report/appeal outcomes
- Public "transparency" API so third parties can independently audit
  moderation decisions and hash integrity without needing an account
- Move from SQLite to Postgres once concurrent write volume warrants it
  (schema is already written in portable SQL)

## Longer-term

- Federation / cross-instance verification (other SatyaNet-compatible nodes
  can attest to the same content hash)
- Mobile clients (the REST API is already client-agnostic)
- Formal appeals SLA + moderator workload dashboard
