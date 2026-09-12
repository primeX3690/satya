# Running a local IPFS node for SatyaNet

By default SatyaNet runs with `IPFS_MODE=mock` in `server/.env` — content is
still hashed (SHA-256) for integrity, but nothing is actually pinned to IPFS.
This is intentional so the whole app works out of the box with zero external
infrastructure. Switch to a real option (Pinata is the easiest) when you're ready.

## Option A — Pinata (recommended - no server/node to run)

Pinata is a hosted IPFS pinning service. This is the fastest path to real
decentralized storage since there's no daemon to install or keep running -
your laptop doesn't need to stay online for pinned content to remain
available.

1. Sign up for free: https://www.pinata.cloud/ (free tier includes a
   meaningful storage/request quota, no card required to start)
2. In the Pinata dashboard, go to **API Keys** and create a new key. Copy
   the **JWT** it gives you (a long token starting with `eyJ...`).
3. In `server/.env`:
   ```
   IPFS_MODE=pinata
   PINATA_JWT=your_jwt_here
   ```
4. Restart the server. New posts and media uploads are now pinned for
   real. `post.ipfsCid` / `post.media.cid` will be genuine IPFS content
   identifiers, resolvable at `https://gateway.pinata.cloud/ipfs/<cid>` or
   any public IPFS gateway (e.g. `https://ipfs.io/ipfs/<cid>`).
5. Verify it worked: paste a returned CID into
   `https://gateway.pinata.cloud/ipfs/<cid>` in your browser - you should
   see the exact post text or media file.

No new npm dependency is needed for this mode - it uses Node's built-in
`fetch`/`FormData`/`Blob` (requires Node 18+, already the project's minimum).

## Option B — Kubo (run your own IPFS node)

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

   Note: unlike Pinata, your own node needs to keep running (and stay
   connected to the network) for the content to remain reliably available
   to others - this is the trade-off for not depending on a hosted provider.

## Verifying integrity

Given a post's stored `content` and `contentHash` from the API, anyone can
independently confirm nothing was altered:

```bash
echo -n "<the exact post content>" | sha256sum
```

The output should match `contentHash` exactly.
