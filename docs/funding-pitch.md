# SatyaNet — Funding Pitch (Draft)

## The problem

Misinformation spreads fastest on platforms where moderation is opaque:
users don't know why content was removed, can't meaningfully contest a
decision, and have no way to verify a post hasn't been silently edited after
the fact. Trust erodes on both sides — people who were moderated feel
unheard, and readers can't verify what they're seeing is authentic.

## The approach

SatyaNet is a social platform built around three commitments:

1. **Content integrity** — every post is cryptographically fingerprinted
   (SHA-256) and anchored to IPFS, a content-addressed, tamper-evident
   storage layer. Anyone can independently verify a post hasn't changed.
2. **Transparent moderation** — automated flags are rule-based and logged
   with the exact reason, not a black-box score. Users see why, not just that.
3. **Real appeals** — a moderation decision isn't final. Authors can appeal,
   a human resolves it, and the outcome is permanently recorded in a public
   audit log.

## Why now

Trust in centralized platforms' moderation is at a low point, and
content-addressed storage (IPFS) has matured enough to anchor integrity
claims without running your own blockchain. SatyaNet combines a
conventional, fast web stack with just enough cryptographic anchoring to
make tampering detectable — without the cost or complexity of a full
decentralized protocol.

## Current state (MVP)

- Working auth, posting, moderation, reporting, and appeals flows
- SQLite-backed for zero-infrastructure deployment; portable to Postgres
- IPFS integration is pluggable — ships in mock mode, swaps to a real node
  or pinning service with a config change
- Full audit trail from day one, not bolted on later

## What funding unlocks

- Production OTP delivery and hosting infrastructure
- A dedicated trust & safety hire to refine moderation rules with real data
- Migration to a scalable datastore as usage grows
- A public transparency API so third parties (researchers, journalists) can
  independently audit moderation outcomes

## Ask

_[Fill in: funding amount, use of funds breakdown, and timeline once finalized
with the founding team — left intentionally blank so this pitch reflects your
actual numbers rather than placeholder figures.]_
