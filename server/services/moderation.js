// Lightweight, transparent rule-based moderation for the MVP.
// Every rule is auditable (no black-box ML) so appeals can reference exactly
// why a post was flagged. Replace/extend with a real classifier later.

const FLAGGED_KEYWORDS = [
  'scam', 'fraud', 'fake cure', 'guaranteed profit', 'click here now'
];

const EXCESSIVE_CAPS_RATIO = 0.6; // >60% uppercase letters looks shouty/spammy
const MAX_LINK_COUNT = 3;

/**
 * Scores a piece of content for moderation risk.
 * Returns { score, reasons, status } where status is 'published' or 'flagged'.
 */
function evaluateContent(content) {
  const reasons = [];
  let score = 0;

  const lower = content.toLowerCase();
  for (const word of FLAGGED_KEYWORDS) {
    if (lower.includes(word)) {
      score += 30;
      reasons.push(`Contains flagged phrase: "${word}"`);
    }
  }

  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 10) {
    const upper = content.replace(/[^A-Z]/g, '');
    const ratio = upper.length / letters.length;
    if (ratio > EXCESSIVE_CAPS_RATIO) {
      score += 15;
      reasons.push('Excessive use of capital letters');
    }
  }

  const linkMatches = content.match(/https?:\/\/\S+/g) || [];
  if (linkMatches.length > MAX_LINK_COUNT) {
    score += 20;
    reasons.push(`Contains ${linkMatches.length} links (limit ${MAX_LINK_COUNT})`);
  }

  if (content.trim().length === 0) {
    score += 100;
    reasons.push('Empty content');
  }

  const status = score >= 30 ? 'flagged' : 'published';
  return { score, reasons, status };
}

module.exports = { evaluateContent };
