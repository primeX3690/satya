require('dotenv').config();

const http = require('http');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = require('./app');
const db = require('./database');
const { hashEmail, encryptEmail } = require('./services/cryptoUtils');
const { initSocket } = require('./services/socket');

const PORT = process.env.PORT || 4000;

/**
 * In production, refuse to start if critical secrets still look like the
 * placeholder values from .env.example. This catches the common real-world
 * mistake of deploying with example/dev secrets - a cheap check that
 * prevents a serious, silent security hole.
 */
function assertProductionSecretsAreReal() {
  if (process.env.NODE_ENV !== 'production') return;

  const placeholderPatterns = [
    'change-this-to-a-long-random-string',
    'change-this-to-a-random-hex-string',
    'change-this-to-a-64-char-hex-string',
    'change-this-password'
  ];
  const secretsToCheck = {
    JWT_SECRET: process.env.JWT_SECRET,
    EMAIL_HASH_SECRET: process.env.EMAIL_HASH_SECRET,
    EMAIL_ENCRYPTION_SECRET: process.env.EMAIL_ENCRYPTION_SECRET,
    ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD
  };

  for (const [name, value] of Object.entries(secretsToCheck)) {
    if (!value || placeholderPatterns.includes(value)) {
      // eslint-disable-next-line no-console
      console.error(
        `[startup] Refusing to start in production: ${name} is missing or still a placeholder value. ` +
          'Generate a real secret (see docs/security-checklist.md) and set it in your production .env.'
      );
      process.exit(1);
    }
  }
}

assertProductionSecretsAreReal();

/**
 * On first run, creates a bootstrap admin account so there's always a way
 * into the admin panel. Controlled via ADMIN_BOOTSTRAP_EMAIL/PASSWORD in .env.
 */
async function bootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const emailHash = hashEmail(email, process.env.EMAIL_HASH_SECRET);
  const existing = await db.get('SELECT id FROM users WHERE email_hash = ?', [emailHash]);
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
  const emailEncrypted = encryptEmail(email, process.env.EMAIL_ENCRYPTION_SECRET);

  await db.run(
    `INSERT INTO users (id, email_hash, email_encrypted, password_hash, display_name, role, is_verified)
     VALUES (?, ?, ?, ?, 'Admin', 'admin', 1)`,
    [uuidv4(), emailHash, emailEncrypted, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log(`[bootstrap] Admin account created: ${email}`);
}

async function start() {
  // Postgres needs the schema created before anything else touches the DB -
  // unlike the old SQLite setup, this is now an async network call.
  await db.initSchema();
  await bootstrapAdmin();

  // Socket.IO needs the raw HTTP server (not just the Express app) so it
  // can upgrade connections to WebSockets on the same port.
  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`SatyaNet server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

