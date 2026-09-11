// Basic integration tests for the SatyaNet API.
// Run with: npm test  (from the server/ directory)
//
// Uses a throwaway in-memory-style SQLite file so tests never touch dev data.

process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_OTP_DELIVERY = 'console';
process.env.SMS_OTP_DELIVERY = 'console';
process.env.IPFS_MODE = 'mock';
process.env.BCRYPT_SALT_ROUNDS = '4'; // faster hashing in tests
process.env.EMAIL_HASH_SECRET = 'test-email-hash-secret';
process.env.EMAIL_ENCRYPTION_SECRET = 'a'.repeat(64); // valid 32-byte hex key for tests

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../app');
const db = require('../database');
const { verifyOtp } = require('../services/otpProvider');

// Patch verifyOtp is not needed - we read the OTP directly from the otp_codes
// table via a helper, since console mode only logs it.
function getLatestRawOtpForUser() {
  // We cannot recover the raw code from the hash, so for tests we issue our
  // own OTP flow through a spy-free approach: call the auth endpoints and
  // intercept console output.
  return null;
}

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

  const row = db
    .prepare(`SELECT * FROM otp_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(userId);
  assert.ok(row);

  // We can't invert the hash, so directly mark verified for this isolated test
  // of the moderation pipeline (auth flow itself is covered above).
  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);

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

