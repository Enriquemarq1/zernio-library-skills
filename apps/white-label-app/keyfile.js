// Reads a Zernio key from a key file without ever printing it.
// The file holds a bare key on one line, or ZERNIO_API_KEY=<key>.
import { readFileSync } from 'node:fs';

export function readKeyFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // Never echo the path or the OS error: both can end up on a page or in a log.
    throw Object.assign(new Error("This workspace's API key could not be read."), { status: 500 });
  }
  const line = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || '';
  const key = line.replace(/^ZERNIO_API_KEY\s*=\s*/, '').replace(/^["']|["']$/g, '').trim();
  if (!key) throw Object.assign(new Error("This workspace's API key file is empty."), { status: 500 });
  return key;
}
