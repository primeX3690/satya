// Basic integration tests for the SatyaNet API.
// Run with: npm test  (from the server/ directory)
//
// Requires a real (ideally throwaway/test) Postgres database - set
// DATABASE_URL before running, e.g. a separate Supabase project or a local
// Postgres instance. These tests write real rows to that database; don't
// point this at your production DATABASE_URL.

process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_OTP_DELIVERY = 'console';
process.env.SMS_OTP_DELIVERY = 'console';
process.env.IPFS_MODE = 'mock';
process.env.MEDIA_MODERATION_MODE = 'mock';
process.env.BCRYPT_SALT_ROUNDS = '4'; // faster hashing in tests
process.env.EMAIL_HASH_SECRET = 'test-email-hash-secret';
process.env.EMAIL_ENCRYPTION_SECRET = 'a'.repeat(64); // valid 32-byte hex key for tests

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../database');

test.before(async () => {
  await db.initSchema();
});

const app = require('../app');

test('health check responds ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('signup requires password and identifier', async () => {
  const res = await request(app).post('/api/auth/signup').send({ displayName: 'No Creds' });
  assert.equal(res.status, 400);
});

test('full signup -> verify -> login -> post -> timeline flow', async (t) => {
  const originalLog = console.log;
  let capturedCode = null;
  console.log = (...args) => {
    const line = args.join(' ');
    const match = line.match(/Code for .*?: (\d{6})/);
    if (match) capturedCode = match[1];
    originalLog(...args);
  };

  t.after(() => {
    console.log = originalLog;
  });

  const signupRes = await request(app).post('/api/auth/signup').send({
    email: 'tester@example.com',
    password: 'supersecret123',
    displayName: 'Tester'
  });
  assert.equal(signupRes.status, 201);
  const { userId } = signupRes.body;
  assert.ok(userId);
  assert.ok(capturedCode, 'OTP code should have been captured from console output');

  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({ userId, code: capturedCode });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.token);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'tester@example.com', password: 'supersecret123' });
  assert.equal(loginRes.status, 200);
  const token = loginRes.body.token;

  const postRes = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'This is a perfectly normal, honest post about my day.' });
  assert.equal(postRes.status, 201);
  assert.equal(postRes.body.post.status, 'published');
  assert.ok(postRes.body.post.contentHash);

  const timelineRes = await request(app).get('/api/posts');
  assert.equal(timelineRes.status, 200);
  assert.ok(timelineRes.body.posts.length >= 1);
});

test('flagged content is not published to the public timeline', async () => {
  const signupRes = await request(app).post('/api/auth/signup').send({
    email: 'flagged-user@example.com',
    password: 'supersecret123',
    displayName: 'Flagged User'
  });
  const { userId } = signupRes.body;

  const row = await db.get(`SELECT * FROM otp_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`, [
    userId
  ]);
  assert.ok(row);

  // We can't invert the hash, so directly mark verified for this isolated test
  // of the moderation pipeline (auth flow itself is covered above).
  await db.run('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'flagged-user@example.com', password: 'supersecret123' });
  const token = loginRes.body.token;

  const postRes = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'GUARANTEED PROFIT!!! This is a scam click here now click here now click here now' });

  assert.equal(postRes.status, 201);
  assert.equal(postRes.body.post.status, 'flagged');
  assert.ok(postRes.body.moderation.score >= 30);
});

test('unauthenticated post creation is rejected', async () => {
  const res = await request(app).post('/api/posts').send({ content: 'no token here' });
  assert.equal(res.status, 401);
});

test('like, comment, and share flow on a published post', async () => {
  const originalLog = console.log;
  let capturedCode = null;
  console.log = (...args) => {
    const line = args.join(' ');
    const match = line.match(/Code for .*?: (\d{6})/);
    if (match) capturedCode = match[1];
    originalLog(...args);
  };

  const signupRes = await request(app).post('/api/auth/signup').send({
    email: 'social-user@example.com',
    password: 'supersecret123',
    displayName: 'Social User'
  });
  const { userId } = signupRes.body;
  await request(app).post('/api/auth/verify-otp').send({ userId, code: capturedCode });
  console.log = originalLog;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'social-user@example.com', password: 'supersecret123' });
  const token = loginRes.body.token;

  const postRes = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'A perfectly normal post to like and comment on.' });
  const postId = postRes.body.post.id;
  assert.equal(postRes.body.post.likeCount, 0);
  assert.equal(postRes.body.post.commentCount, 0);

  // Like
  const likeRes = await request(app)
    .post(`/api/posts/${postId}/like`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(likeRes.status, 200);
  assert.equal(likeRes.body.liked, true);

  // Unlike (toggle)
  const unlikeRes = await request(app)
    .post(`/api/posts/${postId}/like`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(unlikeRes.body.liked, false);

  // Comment
  const commentRes = await request(app)
    .post(`/api/posts/${postId}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'Nice post!' });
  assert.equal(commentRes.status, 201);
  assert.equal(commentRes.body.comment.content, 'Nice post!');

  const commentsListRes = await request(app).get(`/api/posts/${postId}/comments`);
  assert.equal(commentsListRes.body.comments.length, 1);

  // Share (works even without auth)
  const shareRes = await request(app).post(`/api/posts/${postId}/share`);
  assert.equal(shareRes.status, 200);

  const finalPost = await request(app).get(`/api/posts/${postId}`);
  assert.equal(finalPost.body.post.commentCount, 1);
  assert.equal(finalPost.body.post.shareCount, 1);
});
