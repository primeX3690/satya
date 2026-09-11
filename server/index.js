require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = require('./app');
const db = require('./database');
const { hashEmail, encryptEmail } = require('./services/cryptoUtils');

const PORT = process.env.PORT || 4000;

/**
 * On first run, creates a bootstrap admin account so there's always a way
 * into the admin panel. Controlled via ADMIN_BOOTSTRAP_EMAIL/PASSWORD in .env.
 * The email is hashed (for lookup) and separately encrypted (for recovery),
 * exactly like every other user - the admin's address is never stored in
 * plaintext either.
 */
async function bootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const emailHash = hashEmail(email, process.env.EMAIL_HASH_SECRET);
  const existing = db.prepare('SELECT id FROM users WHERE email_hash = ?').get(emailHash);
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
  const emailEncrypted = encryptEmail(email, process.env.EMAIL_ENCRYPTION_SECRET);

  db.prepare(
    `INSERT INTO users (id, email_hash, email_encrypted, password_hash, display_name, role, is_verified)
     VALUES (?, ?, ?, ?, 'Admin', 'admin', 1)`
  ).run(uuidv4(), emailHash, emailEncrypted, passwordHash);

  // eslint-disable-next-line no-console
  console.log(`[bootstrap] Admin account created: ${email}`);
}

bootstrapAdmin()
  .catch((err) => console.error('Admin bootstrap failed:', err))
  .finally(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`SatyaNet server listening on http://localhost:${PORT}`);
    });
  });

