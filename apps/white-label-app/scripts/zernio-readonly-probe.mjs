// Read-only Zernio probe for the inbox integration (GET requests only — never sends, marks read or edits).
//   node --env-file=.env scripts/zernio-readonly-probe.mjs [--json out.json]
// Prints sanitized facts: no API key, masked handles/phone numbers, opaque ids kept (they are not secrets).
import { writeFileSync } from 'node:fs';

const BASE = process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1';
const KEY = process.env.ZERNIO_API_KEY;
if (!KEY) {
  console.error('ZERNIO_API_KEY is not set (use --env-file=.env).');
  process.exit(2);
}

const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
};
const mask = (s) => {
  if (!s) return s;
  const t = String(s);
  if (/^\+?\d[\d\s-]{6,}$/.test(t)) return t.replace(/\d(?=[\d\s-]{4})/g, '•');
  return t.length <= 3 ? t[0] + '••' : t.slice(0, 2) + '•'.repeat(Math.min(6, t.length - 3)) + t.slice(-1);
};
const keysOf = (o) => (o && typeof o === 'object' ? Object.keys(o).sort() : []);

const out = { at: new Date().toISOString(), base: BASE };
const profiles = await get('/profiles');
out.profiles = { status: profiles.status, items: (profiles.body.profiles ?? profiles.body.data ?? []).map((p) => ({ id: p._id ?? p.id, name: p.name })) };

out.accounts = [];
for (const p of out.profiles.items) {
  const r = await get(`/accounts?profileId=${encodeURIComponent(p.id)}`);
  for (const a of r.body.accounts ?? r.body.data ?? []) {
    out.accounts.push({ profileId: p.id, profile: p.name, accountId: a._id ?? a.id, platform: a.platform, handle: mask(a.username ?? a.displayName ?? a.phoneNumber), isActive: a.isActive, status: a.status });
  }
}
const messaging = new Set(['whatsapp', 'sms', 'instagram', 'facebook', 'imessage', 'telegram', 'twitter', 'bluesky', 'reddit', 'linkedin']);
out.health = [];
for (const a of out.accounts.filter((x) => messaging.has(x.platform))) {
  const r = await get(`/accounts/${encodeURIComponent(a.accountId)}/health`);
  out.health.push({ accountId: a.accountId, platform: a.platform, status: r.status, keys: keysOf(r.body), summary: r.body.status ?? r.body.health ?? r.body.overall ?? null, issues: r.body.issues ?? r.body.problems ?? null });
}
const convos = await get('/inbox/conversations?limit=20');
const list = convos.body.data ?? convos.body.conversations ?? [];
out.inbox = {
  status: convos.status,
  topKeys: keysOf(convos.body),
  pagination: convos.body.pagination ?? null,
  meta: convos.body.meta ?? null,
  count: list.length,
  itemKeys: keysOf(list[0]),
  byPlatform: list.reduce((m, c) => ((m[c.platform] = (m[c.platform] || 0) + 1), m), {}),
  sample: list.slice(0, 6).map((c) => ({ id: c.id ?? c._id, platform: c.platform, accountId: c.accountId, participant: mask(c.participantName ?? c.participantUsername), updated: c.updatedTime ?? c.updatedAt, unread: c.unreadCount })),
};
const first = list[0];
if (first) {
  const h = await get(`/inbox/conversations/${encodeURIComponent(first.id ?? first._id)}/messages?accountId=${encodeURIComponent(first.accountId)}&limit=5`);
  const msgs = h.body.messages ?? h.body.data ?? [];
  out.history = { status: h.status, topKeys: keysOf(h.body), pagination: h.body.pagination ?? null, sortOrderApplied: h.body.sortOrderApplied ?? h.body.pagination?.sortOrderApplied ?? null, messageKeys: keysOf(msgs[0]), count: msgs.length };
}
const hooks = await get('/webhooks/settings');
out.webhooks = { status: hooks.status, items: (hooks.body.webhooks ?? []).map((w) => ({ id: w._id, name: w.name, host: (() => { try { return new URL(w.url).host; } catch { return 'invalid'; } })(), events: w.events, isActive: w.isActive })) };

console.log(JSON.stringify(out, null, 2));
const i = process.argv.indexOf('--json');
if (i > 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 2));
