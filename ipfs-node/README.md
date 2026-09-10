# Running a local IPFS node for SatyaNet

By default SatyaNet runs with `IPFS_MODE=mock` in `server/.env` — content is
still hashed (SHA-256) for integrity, but nothing is actually pinned to IPFS.
This is intentional so the whole app works out of the box with zero external
infrastructure. Switch to a real node when you're ready.

## Option A — Kubo (the reference IPFS implementation)

1. Install Kubo: https://docs.ipfs.tech/install/command-line/
2. Initialize and start the daemon:
   ```bash
   ipfs init
   ipfs daemon
   ```
   By default this exposes the HTTP API on `http://127.0.0.1:5001`.
3. In `server/.env`:
   ```
   IPFS_MODE=http
   IPFS_API_URL=http://127.0.0.1:5001
   ```
4. Install the client library the service expects:
   ```bash
   npm install ipfs-http-client --prefix server
   ```
5. Restart the server. New posts will now be pinned for real, and
   `post.ipfsCid` will be a genuine content identifier you can resolve on any
   public gateway, e.g. `https://ipfs.io/ipfs/<cid>`.

## Option B — Pinning service (Pinata, Infura, web3.storage)

Point `IPFS_API_URL` at your provider's HTTP API endpoint and supply any
required auth headers by extending `server/services/ipfsService.js` (the
`create()` call from `ipfs-http-client` accepts a `headers` option for API
keys).

## Verifying integrity

Given a post's stored `content` and `contentHash` from the API, anyone can
independently confirm nothing was altered:

```bash
echo -n "<the exact post content>" | sha256sum
```

The output should match `contentHash` exactly.
