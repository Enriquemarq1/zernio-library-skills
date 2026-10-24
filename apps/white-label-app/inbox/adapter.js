// Zernio inbox adapter. Provider field names live here and nowhere else; the rest of the app sees the
// normalized shapes below. Contracts: docs/zernio-inbox/CAPABILITIES.md (official pages checked 2026-09-25)
// and a read-only probe of a live account (scripts/zernio-readonly-probe.mjs).
import { currentKey } from '../workspace.js';

const base = () => process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1';
const SEND_TIMEOUT_MS = Number(process.env.ZERNIO_SEND_TIMEOUT_MS || 15000);
const READ_TIMEOUT_MS = 20000;

export class ZernioError extends Error {
  // kind: 'rejected' (definitive 4xx — the send did not happen), 'in-flight' (409), 'key-conflict' (422),
  //       'ambiguous' (timeout / network / 5xx — the platform may or may not have accepted it), 'auth'
  constructor(kind, status, message, body) {
    super(message);
    Object.assign(this, { kind, status, body });
  }
}

async function call(path, { method = 'GET', body, headers = {}, timeoutMs = READ_TIMEOUT_MS } = {}) {
  const key = currentKey(); // throws plainly when a workspace's key file can't be read
  let res;
  try {
    res = await fetch(base() + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ZernioError('ambiguous', 0, err.name === 'TimeoutError' ? 'No response from Zernio before the timeout' : 'Network error reaching Zernio');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { data, headers: res.headers };
  const msg = String(data.error || data.message || res.statusText || 'Request failed').slice(0, 300);
  // Send semantics (send-inbox-message): 403 mid-send = Meta refused (e.g. outside the messaging window) or no
  // inbox add-on — nothing was sent. 409 = same key still in flight. 422 = key reused with another body.
  // 429 = rate limited, nothing sent. 500 = "platform rejected/failed, Zernio does not retry, delivery unknown";
  // 502/503 are treated the same way (conservative): never claim failure for an outcome Zernio could not confirm.
  if (res.status === 401) throw new ZernioError('auth', 401, msg, data);
  if (res.status === 409) throw new ZernioError('in-flight', 409, msg, data);
  if (res.status === 422) throw new ZernioError('key-conflict', 422, msg, data);
  if (res.status >= 500) throw new ZernioError('ambiguous', res.status, msg, data);
  throw new ZernioError('rejected', res.status, msg, data);
}

const q = (params) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  return s.toString();
};

/* ---------------------------------------------------------------- normalizers */
export const normalizeConversation = (c) => ({
  id: String(c.id ?? c._id),
  accountId: String(c.accountId),
  platform: c.platform,
  accountUsername: c.accountUsername ?? null,
  participantName: c.participantName ?? c.participantUsername ?? null,
  participantPicture: c.participantPicture ?? null,
  lastMessage: c.lastMessage ?? null,
  updatedTime: c.updatedTime ?? c.updatedAt ?? null,
  unreadCount: Number(c.unreadCount ?? 0),
  status: c.status ?? null,
  url: c.url ?? null,
});

export const normalizeMessage = (m) => ({
  platformMessageId: String(m.id ?? m.platformMessageId ?? m._id),
  conversationId: m.conversationId ?? null,
  accountId: m.accountId ?? null,
  direction: m.direction === 'outgoing' ? 'outgoing' : 'incoming',
  text: m.message ?? m.text ?? null,
  createdAt: m.createdAt ?? m.sentAt ?? null,
  senderName: m.senderName ?? null,
  status: m.deliveryStatus ?? null,
  deliveryError: m.deliveryError ? String(m.deliveryError.title || m.deliveryError.message || m.deliveryError.code || '').slice(0, 160) : null,
  isDeleted: Boolean(m.isDeleted),
  attachments: Array.isArray(m.attachments) ? m.attachments.length : 0,
  noRenderableContent: Boolean(m.noRenderableContent),
});

/* ---------------------------------------------------------------- reads */
// One page of conversations for a workspace. Partial account failure is reported, never hidden.
export async function listConversationsPage({ profileId, accountId, cursor, limit = 50 }) {
  const { data } = await call(`/inbox/conversations?${q({ profileId, accountId, cursor, limit: Math.min(limit, 100), sortOrder: 'desc' })}`);
  return {
    items: (data.data ?? data.conversations ?? []).map(normalizeConversation),
    nextCursor: data.pagination?.hasMore ? data.pagination.nextCursor ?? null : null,
    failedAccounts: (data.meta?.failedAccounts ?? []).map((f) => ({ accountId: f.accountId ?? f.id ?? String(f), error: String(f.error ?? f.reason ?? 'failed').slice(0, 160) })),
    skippedAccounts: data.meta?.accountsSkipped ?? [],
  };
}

// Follow cursors up to maxPages; dedupe by account+conversation; newest activity first.
export async function listConversations({ profileId, accountIds, maxPages = 10, limit = 50 }) {
  const seen = new Map();
  const failed = new Map();
  const skipped = new Map(); // meta.accountsSkipped: platform not supported by the list, or account not enabled for it
  let cursor = null;
  let pages = 0;
  let truncated = false;
  do {
    const page = await listConversationsPage({ profileId, cursor, limit });
    for (const c of page.items) if (!accountIds || accountIds.has(c.accountId)) seen.set(`${c.accountId}:${c.id}`, c);
    for (const f of page.failedAccounts) if (!accountIds || accountIds.has(f.accountId)) failed.set(f.accountId, f);
    for (const k of page.skippedAccounts) if (k?.accountId && (!accountIds || accountIds.has(k.accountId))) skipped.set(k.accountId, { accountId: k.accountId, platform: k.platform ?? null });
    cursor = page.nextCursor;
    pages += 1;
    if (cursor && pages >= maxPages) { truncated = true; break; }
  } while (cursor);
  const items = [...seen.values()].sort((a, b) => String(b.updatedTime ?? '').localeCompare(String(a.updatedTime ?? '')));
  return { items, failedAccounts: [...failed.values()], skippedAccounts: [...skipped.values()], truncated, pages };
}

// One history page. Pages are not universally chronological: order for display without touching cursors.
// The documented default is sortOrder=asc (OLDEST first); a thread opens on its latest messages, so ask for desc
// and page backwards with the returned cursor ("Load older").
export async function messagesPage({ conversationId, accountId, cursor, limit = 30 }) {
  const { data } = await call(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${q({ accountId, cursor, limit: Math.min(limit, 100), sortOrder: 'desc' })}`);
  const items = (data.messages ?? data.data ?? []).map(normalizeMessage);
  return { items, nextCursor: data.pagination?.hasMore ? data.pagination.nextCursor ?? null : null, sortOrderApplied: data.sortOrderApplied ?? null };
}

// Merge pages/sources: dedupe by platform message id, chronological for display.
export function mergeMessages(...lists) {
  const byId = new Map();
  for (const list of lists) for (const m of list) if (m && m.platformMessageId) byId.set(m.platformMessageId, { ...byId.get(m.platformMessageId), ...m });
  return [...byId.values()].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}

export async function accountHealth(accountId) {
  const { data } = await call(`/accounts/${encodeURIComponent(accountId)}/health`);
  return {
    status: data.status ?? 'unknown',
    issues: (data.issues ?? []).map(String),
    tokenValid: data.tokenStatus?.valid ?? null,
    messagingRestriction: data.messagingRestriction ?? null,
    whatsappConnection: data.platformConnection
      ? { status: data.platformConnection.status, phoneStatus: data.platformConnection.phoneStatus ?? null, inboundSubscribed: data.platformConnection.inboundWebhookSubscribed ?? null }
      : null,
  };
}

/* ---------------------------------------------------------------- writes */
// Reply inside an existing conversation. The caller owns the Idempotency-Key (one per logical attempt).
export async function sendReply({ conversationId, accountId, text, idempotencyKey }) {
  const { data, headers } = await call(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: { accountId, message: text },
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    timeoutMs: SEND_TIMEOUT_MS,
  });
  const d = data.data ?? data;
  return { messageId: d.messageId ?? d.id ?? null, replayed: headers.get('idempotent-replayed') === 'true', warnings: data.warnings ?? d.warnings ?? [] };
}

/* ---------------------------------------------------------------- read receipts, new threads */
// Explicit only: history reads never mark read (docs: "Reading messages via GET never marks read").
export async function markConversationRead({ conversationId, accountId }) {
  const { data } = await call(`/inbox/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST', body: { accountId } });
  return { markedCount: data.markedCount ?? null };
}

// Which channels may START a thread (create-inbox-conversation): Instagram/Facebook -> PLATFORM_NOT_SUPPORTED.
// X/Bluesky/Reddit/iMessage/Slack are supported by Zernio but outside this integration's selected scope.
export function newThreadRule(platform) {
  if (platform === 'whatsapp') return { allowed: true, needsTemplate: true, reason: '' };
  if (platform === 'sms' || platform === 'phone') return { allowed: true, needsTemplate: false, reason: '' };
  if (platform === 'instagram' || platform === 'facebook') return { allowed: false, reason: 'the customer must message first' };
  return { allowed: false, reason: 'not part of this integration' };
}

// Starts a thread AND sends its first message. No Idempotency-Key is documented for this operation, so an
// ambiguous outcome must be reconciled, never retried blindly (the caller guards double submits locally).
export async function createConversation({ accountId, platform, to, text, templateName, templateLanguage, templateParams = [] }) {
  const rule = newThreadRule(platform);
  if (!rule.allowed) throw new ZernioError('rejected', 400, `Starting a ${platform} conversation is not supported: ${rule.reason}`);
  const digits = String(to || '').replace(/[^0-9]/g, ''); // WhatsApp/SMS participantId: international format, digits only
  if (digits.length < 8) throw new ZernioError('rejected', 400, 'Enter the recipient number in international format, including the country code.');
  if (rule.needsTemplate && !(templateName && templateLanguage))
    throw new ZernioError('rejected', 400, 'WhatsApp needs an approved template (exact name and language) to start a conversation.');
  if (!rule.needsTemplate && !text) throw new ZernioError('rejected', 400, 'Write the first message.');
  const body = { accountId, participantId: digits };
  if (text) body.message = text;
  if (rule.needsTemplate) Object.assign(body, { templateName, templateLanguage, templateParams });
  const { data } = await call('/inbox/conversations', { method: 'POST', body, timeoutMs: SEND_TIMEOUT_MS });
  const d = data.data ?? data;
  return { messageId: d.messageId ?? null, conversationId: d.conversationId ?? null };
}

/* ---------------------------------------------------------------- webhook payloads */
// Spec (webhooks/inbox): message.* carry message{ id (internal), conversationId (internal), platform,
// platformMessageId, direction, text, sentAt }, conversation{ id (internal), platformConversationId }, account{ accountId, profileId? }.
// REST message id == webhook message.platformMessageId. The inbox LIST row id is the internal id for
// WhatsApp/SMS/Telegram/Slack but the platform thread id (platformConversationId) for Instagram/Facebook/Bluesky/Reddit.
export const statusFromEvent = (event) =>
  ({ 'message.sent': 'sent', 'message.delivered': 'delivered', 'message.read': 'read', 'message.failed': 'failed' })[event] ?? null;

const LIST_ID_IS_PLATFORM_THREAD = new Set(['instagram', 'facebook', 'bluesky', 'reddit']);

export function normalizeWebhookMessage(p) {
  const m = p.message ?? {};
  const c = p.conversation ?? {};
  const platform = m.platform ?? p.account?.platform ?? null;
  const platformMessageId = m.platformMessageId;
  const conversationId = LIST_ID_IS_PLATFORM_THREAD.has(platform) ? c.platformConversationId ?? null : m.conversationId ?? c.id ?? null;
  const accountId = p.account?.accountId ?? p.account?.id ?? null;
  if (!platformMessageId || !conversationId || !accountId) return null;
  return {
    accountId: String(accountId),
    conversationId: String(conversationId),
    platformMessageId: String(platformMessageId),
    direction: m.direction ?? (p.event === 'message.received' ? 'incoming' : 'outgoing'),
    text: m.text ?? null,
    createdAt: m.sentAt ?? p.timestamp ?? null,
    status: statusFromEvent(p.event),
  };
}
