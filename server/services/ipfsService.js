const crypto = require('crypto');

const IPFS_MODE = process.env.IPFS_MODE || 'mock';
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';

let httpClient = null;
function getHttpClient() {
  if (!httpClient) {
    // Lazy-require: only needed when IPFS_MODE=http, keeps other modes dependency-free.
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
 * Pins content to IPFS via Pinata's hosted pinning API - no need to run your
 * own IPFS node. Accepts either a string (post text) or a Buffer (media).
 * Returns the real IPFS CID Pinata assigns.
 */
async function pinToPinata(content) {
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT must be set when IPFS_MODE=pinata - see ipfs-node/README.md');
  }

  const isBuffer = Buffer.isBuffer(content);
  const blob = isBuffer ? new Blob([content]) : new Blob([content], { type: 'text/plain' });
  const filename = isBuffer ? 'media' : 'post.txt';

  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.details || data.error?.reason || JSON.stringify(data.error) || 'Pinata pin failed');
  }
  return data.IpfsHash;
}

/**
 * Pins content to IPFS (or the mock/http equivalent) and returns the CID.
 * @param {string|Buffer} content
 * @returns {Promise<string>} cid
 */
async function pinContent(content) {
  if (IPFS_MODE === 'pinata') {
    return pinToPinata(content);
  }
  if (IPFS_MODE === 'http') {
    const client = getHttpClient();
    const { cid } = await client.add(content);
    return cid.toString();
  }
  return mockCid(content);
}

/**
 * Fetches content back from IPFS by CID. In mock mode this is a no-op that
 * signals the caller to fall back to the locally stored copy (SQLite/disk).
 */
async function fetchContent(cid) {
  if (IPFS_MODE === 'pinata') {
    const res = await fetch(`${PINATA_GATEWAY}/${cid}`);
    if (!res.ok) throw new Error(`Pinata gateway fetch failed (${res.status})`);
    return res.text();
  }
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

