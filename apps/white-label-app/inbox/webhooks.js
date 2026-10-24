// Zernio webhook receiver for inbox events.
// Order of operations (docs/zernio-inbox/CAPABILITIES.md, "Receive"):
//   1. verify X-Zernio-Signature = lowercase hex HMAC-SHA256(raw body, WEBHOOK_SECRET), constant-time
//   2. parse, derive the event id (payload.id, else X-Zernio-Event-Id)
//   3. persist durably (pending) or recognise a duplicate
//   4. answer 200 — within Zernio's short delivery timeout
//   5. a worker processes pending rows; a crash between 3 and 5 leaves the row pending for the next boot
// Tenant routing happens in the worker: the event's profile must be a workspace here AND own the account.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeWebhookMessage, statusFromEvent } from './adapter.js';
import { tenantForEvent } from './tenancy.js';

export function verifySignature(rawBody, header, secret) {
  if (!secret || !header || !Buffer.isBuffer(rawBody)) return false;
  const mine = createHmac('sha256', secret).update(rawBody).digest('hex');
  const theirs = String(header).trim().toLowerCase();
  return theirs.length === mine.length && timingSafeEqual(Buffer.from(theirs), Buffer.from(mine));
}

// Express handler factory. `onLegacy` keeps the portal's existing account/post event log working.
export function webhookHandler({ store, secret = () => process.env.WEBHOOK_SECRET, onLegacy = () => {}, kick = () => {} }) {
  return (req, res) => {
    if (!verifySignature(req.body, req.get('X-Zernio-Signature'), secret())) return res.status(401).send('bad signature');
    let p;
    try {
      p = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).send('invalid json');
    }
    const eventId = p.id || req.get('X-Zernio-Event-Id');
    if (!eventId || !p.event) return res.status(400).send('missing event id');
    const ids = eventIds(p);
    const outcome = store.recordEvent({ eventId: String(eventId), event: p.event, profileId: ids.profileId, accountId: ids.accountId, payload: req.body.toString('utf8') });
    if (outcome === 'new' && !p.event.startsWith('message.')) onLegacy(p);
    res.sendStatus(200);
    if (outcome === 'new') setImmediate(kick);
  };
}

export function eventIds(p) {
  // Spec: inbox events carry account{ id, accountId, profileId? }; account/post events keep their older shape.
  return {
    profileId: p.account?.profileId ?? p.post?.profileId ?? null,
    accountId: p.account?.accountId ?? p.account?.id ?? null,
  };
}

// Process every pending event once. Safe to call repeatedly (and at boot, to resume after a crash).
export async function drainEvents({ store, clients }) {
  let processed = 0;
  for (const row of store.pendingEvents()) {
    try {
      const p = JSON.parse(row.payload);
      if (!p.event.startsWith('message.')) { store.finishEvent(row.event_id, 'done'); continue; }
      const ws = await tenantForEvent(clients(), { profileId: row.profile_id, accountId: row.account_id });
      if (!ws) { store.finishEvent(row.event_id, 'ignored', 'no workspace here owns this account/profile'); continue; }
      const msg = normalizeWebhookMessage(p);
      if (!msg) { store.finishEvent(row.event_id, 'ignored', 'event carries no message identity'); continue; }
      store.upsertMessage({ ...msg, profileId: ws.profileId, status: statusFromEvent(p.event) ?? msg.status, source: 'webhook' });
      store.finishEvent(row.event_id, 'done');
      processed += 1;
    } catch (err) {
      // Leave it pending for the next drain; record why.
      store.db.prepare('UPDATE events SET error = ? WHERE event_id = ?').run(String(err.message).slice(0, 300), row.event_id);
    }
  }
  return processed;
}
