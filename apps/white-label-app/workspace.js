// Per-request workspace context. A clients.json entry may carry:
//   keyFile     — absolute path to a file holding that workspace's own API key (bare key or ZERNIO_API_KEY=<key>)
//   platforms   — e.g. ["facebook"]: the only platforms this workspace shows, everywhere in the portal
//   adAccountId — pins the report's paid column to one ad account
// Routes under /w/:profileId, /c/:profileId and /connect/:profileId run inside this context, so every API
// call made while serving them uses the right key and filter without each call site passing them along.
// The key is read at request time, kept in memory only, and never rendered; neither is the file path.
import { AsyncLocalStorage } from 'node:async_hooks';
import { readKeyFile } from './keyfile.js';

const als = new AsyncLocalStorage();

export const current = () => als.getStore() || {};

export const platformsOf = (client) =>
  Array.isArray(client?.platforms) && client.platforms.length ? client.platforms.map(String) : null;

// True when the workspace may show this platform (no list = everything).
export const allows = (platforms, platform) => !platforms || platforms.includes(platform);

// The `&platform=` filter the API understands takes one platform; with several, callers filter results.
export const platformParam = () => {
  const p = current().platforms;
  return p && p.length === 1 ? `&platform=${encodeURIComponent(p[0])}` : '';
};

// The key for the request in flight: the workspace's own file, else the portal's key.
// A workspace whose key file cannot be read fails closed — it never falls back to another key.
export const currentKey = () => {
  const c = current();
  if (c.keyError) throw c.keyError;
  return c.key || process.env.ZERNIO_API_KEY;
};

export function runInWorkspace(client, fn) {
  let key, keyError;
  if (client?.keyFile) {
    try {
      key = readKeyFile(client.keyFile);
    } catch (e) {
      keyError = e;
    }
  }
  return als.run({ client, key, keyError, platforms: platformsOf(client) }, fn);
}

// Express middleware: binds the workspace named by :profileId (unknown ids pass through untouched).
export const bindWorkspace = (clients) => (req, res, next) => {
  const client = clients().find((c) => c.profileId === req.params.profileId);
  if (!client) return next();
  runInWorkspace(client, () => next());
};
