const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const db = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { hashContent, hashBuffer } = require('../services/cryptoUtils');
const { pinContent } = require('../services/ipfsService');
const { evaluateContent } = require('../services/moderation');

const router = express.Router();

// --- Media upload (images/video) -------------------------------------------

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname) || ''}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB - MVP limit, see docs/roadmap.md for scaling notes
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error('Unsupported media type. Allowed: JPEG/PNG/GIF/WEBP images, MP4/WEBM/MOV videos.'));
    }
    cb(null, true);
  }
});

function logAudit(actorId, action, targetType, targetId, details) {
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), actorId, action, targetType, targetId, details ? JSON.stringify(details) : null);
}

function serializePost(row, viewerId) {
  const likedByMe = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, viewerId)
    : false;

  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.display_name,
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
    moderationScore: row.moderation_score,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    likedByMe,
    createdAt: row.created_at
  };
}

function serializeComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.display_name,
    content: row.content,
    createdAt: row.created_at
  };
}

function getPostWithAuthor(id) {
  return db
    .prepare(
      `SELECT posts.*, users.display_name FROM posts JOIN users ON users.id = posts.author_id WHERE posts.id = ?`
    )
    .get(id);
}

/**
 * POST /api/posts
 * multipart/form-data: { content?, media? (file) }
 * At least one of content or media is required. Text is moderated and
 * hashed; media (if present) is hashed and pinned to IPFS independently,
 * and also saved locally so it can actually be played/viewed in the MVP
 * (mock IPFS mode doesn't retrieve real bytes - see ipfs-node/README.md).
 */
router.post('/', requireAuth, upload.single('media'), async (req, res) => {
  const { content } = req.body || {};
  const file = req.file;

  if ((!content || !content.trim()) && !file) {
    return res.status(400).json({ error: 'content or media is required' });
  }
  if (content && content.length > 2000) {
    return res.status(400).json({ error: 'content must be 2000 characters or fewer' });
  }

  let score = 0;
  let reasons = [];
  let status = 'published';
  let contentHash = null;
  let ipfsCid = null;

  if (content && content.trim()) {
    const evaluation = evaluateContent(content);
    score = evaluation.score;
    reasons = evaluation.reasons;
    status = evaluation.status;
    contentHash = hashContent(content);
    try {
      ipfsCid = await pinContent(content);
    } catch (err) {
      console.error('IPFS pin (text) failed:', err.message);
    }
  }

  let mediaType = null;
  let mediaUrl = null;
  let mediaCid = null;
  let mediaHash = null;
  let mediaMime = null;

  if (file) {
    mediaType = ALLOWED_MIME[file.mimetype];
    mediaMime = file.mimetype;
    mediaUrl = `/uploads/${file.filename}`;
    const buffer = fs.readFileSync(file.path);
    mediaHash = hashBuffer(buffer);
    try {
      mediaCid = await pinContent(buffer);
    } catch (err) {
      console.error('IPFS pin (media) failed:', err.message);
    }
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO posts (
       id, author_id, content, content_hash, ipfs_cid,
       media_type, media_url, media_cid, media_hash, media_mime,
       status, moderation_score
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user.id, content || null, contentHash, ipfsCid,
    mediaType, mediaUrl, mediaCid, mediaHash, mediaMime,
    status, score
  );

  if (status === 'flagged') {
    logAudit(req.user.id, 'auto_flag', 'post', id, { score, reasons });
  }

  const row = getPostWithAuthor(id);
  return res.status(201).json({ post: serializePost(row, req.user.id), moderation: { score, reasons } });
});

/**
 * GET /api/posts
 * Public timeline - published posts only, newest first.
 * Query params: limit (default 30, max 100), before (ISO timestamp cursor)
 */
router.get('/', optionalAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const before = req.query.before || new Date().toISOString();

  const rows = db
    .prepare(
      `SELECT posts.*, users.display_name FROM posts
       JOIN users ON users.id = posts.author_id
       WHERE posts.status = 'published' AND posts.created_at < ?
       ORDER BY posts.created_at DESC
       LIMIT ?`
    )
    .all(before, limit);

  return res.json({ posts: rows.map((r) => serializePost(r, req.user?.id)) });
});

/**
 * GET /api/posts/mine
 * The current user's own posts, any status.
 */
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT posts.*, users.display_name FROM posts
       JOIN users ON users.id = posts.author_id
       WHERE posts.author_id = ?
       ORDER BY posts.created_at DESC`
    )
    .all(req.user.id);
  return res.json({ posts: rows.map((r) => serializePost(r, req.user.id)) });
});

/**
 * GET /api/posts/:id
 */
router.get('/:id', optionalAuth, (req, res) => {
  const row = getPostWithAuthor(req.params.id);
  if (!row) return res.status(404).json({ error: 'Post not found' });
  return res.json({ post: serializePost(row, req.user?.id) });
});

/**
 * POST /api/posts/:id/like
 * Toggles a like from the current user on this post.
 */
router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db
    .prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    db.prepare('UPDATE posts SET like_count = like_count - 1 WHERE id = ?').run(req.params.id);
    return res.json({ liked: false });
  }

  db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').run(req.params.id);
  return res.json({ liked: true });
});

/**
 * GET /api/posts/:id/comments
 */
router.get('/:id/comments', (req, res) => {
  const rows = db
    .prepare(
      `SELECT comments.*, users.display_name FROM comments
       JOIN users ON users.id = comments.author_id
       WHERE comments.post_id = ?
       ORDER BY comments.created_at ASC`
    )
    .all(req.params.id);
  return res.json({ comments: rows.map(serializeComment) });
});

/**
 * POST /api/posts/:id/comments
 * body: { content }
 */
router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const id = uuidv4();
  db.prepare(
    `INSERT INTO comments (id, post_id, author_id, content) VALUES (?, ?, ?, ?)`
  ).run(id, req.params.id, req.user.id, content.trim());
  db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').run(req.params.id);

  const row = db
    .prepare(
      `SELECT comments.*, users.display_name FROM comments
       JOIN users ON users.id = comments.author_id WHERE comments.id = ?`
    )
    .get(id);
  return res.status(201).json({ comment: serializeComment(row) });
});

/**
 * POST /api/posts/:id/share
 * Logged-in or anonymous - just records that a share happened.
 * Actual "sharing" (re-broadcast) is a client-side action (copy link, etc);
 * this endpoint exists so the share count is genuine, not decorative.
 */
router.post('/:id/share', optionalAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare('INSERT INTO shares (id, post_id, user_id) VALUES (?, ?, ?)').run(
    uuidv4(),
    req.params.id,
    req.user ? req.user.id : null
  );
  db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').run(req.params.id);
  return res.json({ message: 'Share recorded' });
});

module.exports = router;

