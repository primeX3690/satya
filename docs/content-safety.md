# Content Safety

## What this covers

Every uploaded image/video is checked **before** it's saved or published,
using a third-party AI content-safety API. If explicit/adult content is
detected, the upload is rejected outright with a clear error message — it
never reaches the database or the public timeline.

This is separate from (and in addition to) the text-based moderation in
`services/moderation.js`, which screens post captions for spammy/scam
language. Together they implement the policy: **calling out someone's
wrongdoing, criticism, and uncomfortable truths are allowed — pornography
and explicit content are not.**

## What this does NOT cover — read before any real/public launch

**`services/mediaModeration.js` is a general adult-content filter. It is
NOT a child-sexual-abuse-material (CSAM) detector, and must never be
described or relied upon as one.**

CSAM detection is a distinct, specialized, and in most countries **legally
regulated** area:

- It works by hash-matching uploads against databases of previously
  identified CSAM (so it can catch known material even when a general
  nudity classifier wouldn't flag it, and vice versa) using tools like:
  - **Microsoft PhotoDNA** (free for qualifying platforms, industry standard)
  - **Thorn Safer**
  - Cloud providers' built-in equivalents (e.g. Google's CSAI Match, AWS's
    equivalent programs)
- Most jurisdictions **require** platforms hosting user-generated content
  to report detected CSAM to a designated body — in the US, the **National
  Center for Missing & Exploited Children (NCMEC)** — and failing to do so
  can itself be a legal violation, independent of the content having been
  uploaded in the first place.
- Registering for and integrating these tools is a deliberate, separate
  step involving legal/compliance sign-up — it is not something that can be
  "coded in" the way a nudity classifier can.

**Before this platform is opened to real strangers on the public internet,
add one of the above CSAM-specific tools and confirm your legal reporting
obligations with a lawyer familiar with your jurisdiction.** This is not
optional infrastructure — treat it as a launch blocker, not a "nice to have."

## Setting up the general content filter (Sightengine)

The default `MEDIA_MODERATION_MODE=mock` allows all media through
unchecked — fine for local development, **never for anything a real
stranger can upload to.**

1. Sign up for a free account: https://sightengine.com/
   (the free tier includes a monthly quota of API calls, no card required
   to start)
2. From your Sightengine dashboard, copy your **API User** and **API
   Secret**.
3. In `server/.env`:
   ```
   MEDIA_MODERATION_MODE=sightengine
   SIGHTENGINE_API_USER=your_api_user
   SIGHTENGINE_API_SECRET=your_api_secret
   ```
4. Restart the server. New uploads are now checked in real time; anything
   flagged as explicit/offensive is rejected with a 400 error before it's
   ever stored.

### What happens if the check itself fails

If Sightengine is unreachable or misconfigured, the upload is **rejected**
(fails safe) rather than published unchecked — the person sees "Media
could not be safety-checked right now - please try again shortly." This is
intentional: it's better to occasionally block a legitimate upload during
an outage than to let unchecked explicit content through.

## Tuning sensitivity

`mediaModeration.js` currently rejects when Sightengine's nudity or
offensive-content score exceeds `0.5`. If you find it's too strict (blocking
legitimate content) or too lenient, adjust the threshold in
`checkWithSightengine()` — lower values reject more aggressively.
