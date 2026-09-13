import React from 'react';
import heroImg from '../assets/hero.png';

export default function TrustPage() {
  return (
    <div className="container" style={{ marginTop: 32, marginBottom: 60 }}>
      <h1>How SatyaNet verifies truth</h1>
      <img
        src={heroImg}
        alt="SatyaNet shield emblem"
        style={{ width: '100%', maxWidth: 480, borderRadius: 3, margin: '12px 0 24px' }}
      />

      <h2>1. Every post is fingerprinted</h2>
      <p>
        The moment you publish, we compute a SHA-256 hash of the exact text and anchor it
        alongside a content identifier. If the stored text ever changes, the hash no longer
        matches — tampering becomes detectable rather than invisible.
      </p>

      <h2>2. Automated moderation is transparent</h2>
      <p>
        Posts are screened by a small set of published, rule-based checks (spammy phrasing,
        excessive links, known scam language). Nothing is a black box: if a post is flagged,
        the specific reason is recorded in the audit log.
      </p>

      <h2>3. Reports feed a human queue</h2>
      <p>
        Any reader can report a post. Reports don't remove content automatically — they land
        in a moderator queue where a person reviews and decides.
      </p>

      <h2>4. Appeals keep moderation accountable</h2>
      <p>
        If your post is flagged or removed, you can file an appeal explaining why. A moderator
        or admin resolves it, and the outcome — approved or rejected, with a note — is
        permanently visible in the audit log.
      </p>

      <h2>5. The audit log is the record of truth</h2>
      <p>
        Every moderation action, role change, and appeal resolution is logged with who did it
        and when. Admins and moderators can review the full history at any time.
      </p>
    </div>
  );
}
