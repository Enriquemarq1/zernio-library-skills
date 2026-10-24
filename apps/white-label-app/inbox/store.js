// Durable local state for the inbox integration (node:sqlite, built into Node >= 22.13; no dependency).
// Holds only what the app must remember between requests/restarts:
//   sends     — one row per logical reply attempt, keyed by its Idempotency-Key
//   events    — webhook deliveries, persisted BEFORE the 200 so a crash cannot lose them
//   messages  — deduplicated message cache fed by webhooks and reconciliation (status only moves forward)
//   intents   — single-use, expiring OAuth initiations that bind a callback to its workspace
// Zernio stays the system of record for conversations and history.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const STATUS_RANK = { pending: 0, sent: 1, delivered: 2, read: 3 }; // 'failed' is terminal, handled separately

export const bodyHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function openStore(path = process.env.INBOX_DB || './data/inbox.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sends (
      key TEXT PRIMARY KEY, profile_id TEXT NOT NULL, account_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
      body_hash TEXT NOT NULL, text TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending','accepted','failed','unknown')),
      message_id TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sends_by_thread ON sends (profile_id, conversation_id, created_at);
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY, event TEXT NOT NULL, received_at TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending','done','ignored','failed')),
      profile_id TEXT, account_id TEXT, payload TEXT NOT NULL, processed_at TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS messages (
      account_id TEXT NOT NULL, conversation_id TEXT NOT NULL, platform_message_id TEXT NOT NULL,
      profile_id TEXT NOT NULL, direction TEXT, text TEXT, created_at TEXT,
      status TEXT, status_rank INTEGER, source TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, conversation_id, platform_message_id));
    CREATE TABLE IF NOT EXISTS intents (
      nonce TEXT PRIMARY KEY, profile_id TEXT NOT NULL, platform TEXT NOT NULL, browser_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
  `);
  const now = () => new Date().toISOString();

  return {
    db,
    close: () => db.close(),

    /* ---- sends ---- */
    getSend: (key) => db.prepare('SELECT * FROM sends WHERE key = ?').get(key) ?? null,
    // Claim a key for one logical attempt. Returns { row, created }.
    claimSend({ key, profileId, accountId, conversationId, text }) {
      const hash = bodyHash({ accountId, conversationId, text });
      const t = now();
      const r = db.prepare(`INSERT OR IGNORE INTO sends (key, profile_id, account_id, conversation_id, body_hash, text, state, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).run(key, profileId, accountId, conversationId, hash, text, t, t);
      const row = db.prepare('SELECT * FROM sends WHERE key = ?').get(key);
      return { row, created: r.changes === 1, sameBody: row.body_hash === hash && row.profile_id === profileId };
    },
    settleSend(key, state, { messageId = null, error = null } = {}) {
      db.prepare('UPDATE sends SET state = ?, message_id = COALESCE(?, message_id), error = ?, updated_at = ? WHERE key = ?')
        .run(state, messageId, error, now(), key);
      return db.prepare('SELECT * FROM sends WHERE key = ?').get(key);
    },
    sendsForThread: (profileId, conversationId) =>
      db.prepare('SELECT * FROM sends WHERE profile_id = ? AND conversation_id = ? ORDER BY created_at').all(profileId, conversationId),

    /* ---- webhook events ---- */
    // Durable before acknowledgement. Returns 'new' | 'duplicate'.
    recordEvent({ eventId, event, profileId, accountId, payload, state = 'pending' }) {
      const r = db.prepare(`INSERT OR IGNORE INTO events (event_id, event, received_at, state, profile_id, account_id, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(eventId, event, now(), state, profileId ?? null, accountId ?? null, payload);
      return r.changes === 1 ? 'new' : 'duplicate';
    },
    pendingEvents: () => db.prepare("SELECT * FROM events WHERE state = 'pending' ORDER BY received_at").all(),
    finishEvent(eventId, state, error = null) {
      db.prepare('UPDATE events SET state = ?, processed_at = ?, error = ? WHERE event_id = ?').run(state, now(), error, eventId);
    },
    recentEvents: (limit = 20) => db.prepare('SELECT event_id, event, received_at, state, profile_id, account_id, error FROM events ORDER BY received_at DESC LIMIT ?').all(limit),

    /* ---- message cache ---- */
    // Idempotent upsert keyed by platform message id; delivery status never regresses; 'failed' sticks.
    upsertMessage({ profileId, accountId, conversationId, platformMessageId, direction, text, createdAt, status, source }) {
      const rank = status === 'failed' ? 99 : STATUS_RANK[status] ?? null;
      const t = now();
      db.prepare(`INSERT INTO messages (account_id, conversation_id, platform_message_id, profile_id, direction, text, created_at, status, status_rank, source, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (account_id, conversation_id, platform_message_id) DO UPDATE SET
          direction = COALESCE(messages.direction, excluded.direction),
          text = COALESCE(messages.text, excluded.text),
          created_at = COALESCE(messages.created_at, excluded.created_at),
          status = CASE WHEN excluded.status_rank IS NOT NULL AND (messages.status_rank IS NULL OR (messages.status_rank < excluded.status_rank AND messages.status_rank <> 99))
                        THEN excluded.status ELSE messages.status END,
          status_rank = CASE WHEN excluded.status_rank IS NOT NULL AND (messages.status_rank IS NULL OR (messages.status_rank < excluded.status_rank AND messages.status_rank <> 99))
                        THEN excluded.status_rank ELSE messages.status_rank END,
          updated_at = excluded.updated_at`)
        .run(accountId, conversationId, platformMessageId, profileId, direction ?? null, text ?? null, createdAt ?? null, status ?? null, rank, source ?? null, t);
      return db.prepare('SELECT * FROM messages WHERE account_id = ? AND conversation_id = ? AND platform_message_id = ?').get(accountId, conversationId, platformMessageId);
    },
    messagesForThread: (profileId, accountId, conversationId) =>
      db.prepare('SELECT * FROM messages WHERE profile_id = ? AND account_id = ? AND conversation_id = ? ORDER BY created_at').all(profileId, accountId, conversationId),
    latestInboundAt: (profileId) =>
      db.prepare("SELECT MAX(updated_at) AS at FROM messages WHERE profile_id = ? AND source = 'webhook'").get(profileId)?.at ?? null,

    /* ---- OAuth intents ---- */
    createIntent({ nonce, profileId, platform, browserHash, ttlMs = 15 * 60 * 1000 }) {
      const t = new Date();
      db.prepare('INSERT INTO intents (nonce, profile_id, platform, browser_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(nonce, profileId, platform, browserHash, t.toISOString(), new Date(t.getTime() + ttlMs).toISOString());
    },
    // Single use: returns the intent once, only if unexpired, same platform and same browser.
    consumeIntent({ nonce, platform, browserHash }) {
      const row = db.prepare('SELECT * FROM intents WHERE nonce = ?').get(nonce);
      if (!row) return { ok: false, reason: 'unknown connection attempt' };
      if (row.used_at) return { ok: false, reason: 'this connection link was already used' };
      if (row.platform !== platform) return { ok: false, reason: 'platform mismatch' };
      if (row.browser_hash !== browserHash) return { ok: false, reason: 'started in a different browser' };
      if (row.expires_at < new Date().toISOString()) return { ok: false, reason: 'connection attempt expired' };
      const r = db.prepare('UPDATE intents SET used_at = ? WHERE nonce = ? AND used_at IS NULL').run(now(), nonce);
      return r.changes === 1 ? { ok: true, profileId: row.profile_id } : { ok: false, reason: 'this connection link was already used' };
    },
  };
}
