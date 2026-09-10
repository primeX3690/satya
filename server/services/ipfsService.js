const crypto = require('crypto');

const IPFS_MODE = process.env.IPFS_MODE || 'mock';
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';

let httpClient = null;
function getHttpClient() {
  if (!httpClient) {
    // Lazy-require: only needed when IPFS_MODE=http, keeps mock mode dependency-free.
    // Install with: npm install ipfs-http-client --prefix server
    const { create } = require('ipfs-http-client');
    httpClient = create({ url: IPFS_API_URL });
  }
  return httpClient;
}

/**
 * Produces a deterministic, CID-shaped mock identifier from content.
 * Not a real IPFS pin, but lets the whole app flow work without a running node.
 */
function mockCid(content) {
  const digest = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return `mock-cid-${digest.slice(0, 46)}`;
}

/**
 * Pins content to IPFS (or the mock equivalent) and returns the resulting CID.
 * @param {string} content
 * @returns {Promise<string>} cid
 */
async function pinContent(content) {
  if (IPFS_MODE === 'http') {
    const client = getHttpClient();
    const { cid } = await client.add(content);
    return cid.toString();
  }
  return mockCid(content);
}

/**
 * Fetches content back from IPFS by CID. In mock mode this is a no-op that
 * signals the caller to fall back to the locally stored copy (SQLite).
 */
async function fetchContent(cid) {
  if (IPFS_MODE === 'http') {
    const client = getHttpClient();
    const chunks = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return null;
}

module.exports = { pinContent, fetchContent };
