const express = require('express');

const db = require('../database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

function serializeProfilePost(row, authorName, viewerId) {
  const likedByMe = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;

  return {
    id: row.id,
    authorId: row.author_id,
    authorName,
    content: row.content,
    contentHash: row.content_hash,
    ipfsCid: row.ipfs_cid,
    media: row.media_url
      ? {
          type: row.media_type,
          url: row.media_url,
          cid: row.media_cid,
          hash: row.media_hash,
          mime: row.media_mime
        }
      : null,
    status: row.status,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    likedByMe,
    createdAt: row.created_at
  };
}

/**
 * GET /api/users/:id
 * Public profile: basic (non-sensitive) info + this user's posts.
 * - If the viewer IS this user (checked via optional auth), every post of
 *   theirs is included regardless of status, so you can see your own
 *   flagged/removed posts on your own profile.
 * - Otherwise, only published posts are shown - visitors to someone else's
 *   profile shouldn't see content that's been flagged/removed.
 * No email/phone/role is ever returned here - this is the public view.
 */
router.get('/:id', optionalAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, display_name, trust_score, created_at FROM users WHERE id = ?')
    .get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isSelf = !!(req.user && req.user.id === user.id);

  const rows = isSelf
    ? db.prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC').all(user.id)
    : db
        .prepare(`SELECT * FROM posts WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC`)
        .all(user.id);

  return res.json({
    user: {
      id: user.id,
      displayName: user.display_name,
      trustScore: user.trust_score,
      memberSince: user.created_at
    },
    isSelf,
    posts: rows.map((r) => serializeProfilePost(r, user.display_name, req.user?.id))
  });
});

module.exports = router;