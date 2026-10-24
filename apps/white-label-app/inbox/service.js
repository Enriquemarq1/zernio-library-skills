// Reply orchestration: one Idempotency-Key per logical attempt, claimed in the store before calling Zernio.
// Outcomes the UI must keep distinct:
//   accepted  — Zernio accepted the send (not proof of delivery; delivery/read come later, per platform)
//   failed    — a definitive rejection; nothing was sent, safe to edit and send as a NEW attempt
//   pending   — this attempt is in flight (a double submit lands here instead of sending twice)
//   unknown   — timeout / network / 5xx: the platform may have accepted it. Never resent automatically.
//               reconcile() looks for it in history; only the user can choose to send again (new key).
import { randomUUID } from 'node:crypto';
import { sendReply, messagesPage } from './adapter.js';

export const newAttemptKey = () => `rep_${randomUUID()}`;

const publicMessage = (e) =>
  e.kind === 'auth' ? 'Zernio refused the API credentials (check ZERNIO_API_KEY).' : String(e.message || 'Send failed').slice(0, 200);

export async function reply({ store, profileId, conversationId, accountId, text, key }) {
  const claim = store.claimSend({ key, profileId, accountId, conversationId, text });
  if (!claim.created) {
    if (!claim.sameBody) return { state: 'conflict', row: claim.row, note: 'This send was already used for a different message. Reload and send again.' };
    return { state: claim.row.state, row: claim.row, duplicateSubmit: true };
  }
  try {
    const r = await sendReply({ conversationId, accountId, text, idempotencyKey: key });
    return { state: 'accepted', row: store.settleSend(key, 'accepted', { messageId: r.messageId }), replayed: r.replayed, warnings: r.warnings };
  } catch (e) {
    if (e.kind === 'rejected' || e.kind === 'auth' || e.kind === 'key-conflict')
      return { state: 'failed', row: store.settleSend(key, 'failed', { error: `${e.status || ''} ${publicMessage(e)}`.trim() }) };
    if (e.kind === 'in-flight') return { state: 'pending', row: store.getSend(key) };
    return { state: 'unknown', row: store.settleSend(key, 'unknown', { error: `${e.status || 'no response'} — ${publicMessage(e)}` }) };
  }
}

// For an unknown outcome: look for the exact text as an outgoing message at/after the attempt.
// Finding it settles the attempt as accepted. Not finding it stays unknown: an empty or lagging history
// is inconclusive, so this never marks it failed and never resends.
export async function reconcile({ store, key, pages = 2, skewMs = 120000 }) {
  const row = store.getSend(key);
  if (!row || row.state !== 'unknown') return { state: row?.state ?? 'missing', row };
  const since = new Date(new Date(row.created_at).getTime() - skewMs).toISOString();
  let cursor = null;
  for (let i = 0; i < pages; i += 1) {
    const page = await messagesPage({ conversationId: row.conversation_id, accountId: row.account_id, cursor, limit: 30 });
    const hit = page.items.find((m) => m.direction === 'outgoing' && m.text === row.text && String(m.createdAt ?? '') >= since);
    if (hit) return { state: 'accepted', row: store.settleSend(key, 'accepted', { messageId: hit.platformMessageId, error: null }), evidence: 'found in history' };
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return { state: 'unknown', row, evidence: 'not found yet — history can lag; do not assume it failed' };
}
