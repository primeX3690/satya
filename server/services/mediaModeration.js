// Content-safety check for uploaded images/video (photos/videos on posts).
//
// SCOPE: this checks for general adult/explicit content (nudity, sexual
// content, graphic violence) using a third-party API. It is NOT a
// child-sexual-abuse-material (CSAM) detector and must not be treated as
// one. CSAM detection requires specialized, legally-regulated hash-matching
// services - Microsoft PhotoDNA, Thorn Safer, or equivalent - plus mandatory
// reporting to NCMEC (US) or the equivalent body in your jurisdiction.
// See docs/content-safety.md before any real/public launch.

const MEDIA_MODERATION_MODE = process.env.MEDIA_MODERATION_MODE || 'mock';

/**
 * Checks a media buffer for explicit/offensive content.
 * Returns { safe: boolean, reasons: string[] }.
 * Throws if the moderation service itself fails (misconfigured, API down) -
 * callers should fail SAFE (reject the upload) on a thrown error, not allow
 * unchecked content through just because the checker was unavailable.
 */
async function checkMedia(buffer, mimeType) {
  if (MEDIA_MODERATION_MODE === 'mock') {
    // Local dev default - no API key needed, always passes. Never use this
    // mode for anything a real stranger can upload to.
    return { safe: true, reasons: [] };
  }

  if (MEDIA_MODERATION_MODE === 'sightengine') {
    return checkWithSightengine(buffer, mimeType);
  }

  throw new Error(`Unknown MEDIA_MODERATION_MODE "${MEDIA_MODERATION_MODE}"`);
}

async function checkWithSightengine(buffer, mimeType) {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) {
    throw new Error('SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET must be set when MEDIA_MODERATION_MODE=sightengine');
  }

  const isVideo = mimeType.startsWith('video/');
  const endpoint = isVideo
    ? 'https://api.sightengine.com/1.0/video/check-sync.json'
    : 'https://api.sightengine.com/1.0/check.json';

  const form = new FormData();
  form.append('media', new Blob([buffer], { type: mimeType }), 'upload');
  form.append('models', 'nudity-2.1,offensive');
  form.append('api_user', apiUser);
  form.append('api_secret', apiSecret);

  const res = await fetch(endpoint, { method: 'POST', body: form });
  const data = await res.json();

  if (data.status !== 'success') {
    throw new Error(`Sightengine error: ${data.error?.message || 'unknown error'}`);
  }

  const reasons = [];

  if (isVideo) {
    // Video response has per-frame data; flag if ANY frame trips a threshold.
    const frames = data.data?.frames || [];
    for (const frame of frames) {
      const explicit = frame.nudity?.sexual_activity ?? frame.nudity?.raw ?? 0;
      if (explicit > 0.5) {
        reasons.push('Explicit content detected in video');
        break;
      }
      if (frame.offensive?.prob > 0.5) {
        reasons.push('Offensive content detected in video');
        break;
      }
    }
  } else {
    const nudity = data.nudity || {};
    const explicit = nudity.sexual_activity ?? nudity.raw ?? 0;
    if (explicit > 0.5) reasons.push('Explicit nudity detected');
    if (data.offensive?.prob > 0.5) reasons.push('Offensive content detected');
  }

  return { safe: reasons.length === 0, reasons };
}

module.exports = { checkMedia };
