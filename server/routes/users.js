const express = require('express');

const db = require('../database');
const { optionalAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

async function serializeProfilePost(row, authorName, viewerId) {
  const likedByMe = viewerId
    ? !!(await db.get('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?', [row.id, viewerId]))
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
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = await db.get('SELECT id, display_name, trust_score, created_at FROM users WHERE id = ?', [
      req.params.id
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = !!(req.user && req.user.id === user.id);

    const rows = isSelf
      ? await db.all('SELECT * FROM posts WHERE author_id = ? ORDER BY created_at DESC', [user.id])
      : await db.all(
          `SELECT * FROM posts WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC`,
          [user.id]
        );

    const posts = await Promise.all(rows.map((r) => serializeProfilePost(r, user.display_name, req.user?.id)));

    return res.json({
      user: {
        id: user.id,
        displayName: user.display_name,
        trustScore: user.trust_score,
        memberSince: user.created_at
      },
      isSelf,
      posts
    });
  })
);

module.exports = router;

