// Local tests for the Zernio inbox integration — FIXTURES ONLY (tests/fake-zernio.mjs). Not live evidence.
//   npm test
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { fakeZernio } from './fake-zernio.mjs';

const P1 = 'p1_fixture';
const P2 = 'p2_fixture';
const t = (m) => new Date(Date.UTC(2026, 8, 25, 10, m)).toISOString();
const seed = {
  pageSize: 2,
  accounts: [
    { _id: 'ig1', platform: 'instagram', username: 'fixture_ig_one', profileId: P1 },
    { _id: 'wa1', platform: 'whatsapp', username: 'fixture_wa_one', profileId: P1 },
    { _id: 'sms1', platform: 'phone', username: 'fixture_sms_one', profileId: P1 },
    { _id: 'ig2', platform: 'instagram', username: 'fixture_ig_two', profileId: P2, health: 'error', issues: ['Access token was invalidated by Meta'] },
  ],
  conversations: [
    { id: 'c1', accountId: 'ig1', platform: 'instagram', participantName: 'Ada (fixture)', lastMessage: 'hi', updatedTime: t(50), unreadCount: 1 },
    { id: 'c2', accountId: 'wa1', platform: 'whatsapp', participantName: 'Ben (fixture)', lastMessage: 'yo', updatedTime: t(40), unreadCount: 0 },
    { id: 'c3', accountId: 'sms1', platform: 'sms', participantName: '+1 555 0100 (fixture)', lastMessage: 'ok', updatedTime: t(30), unreadCount: 0 },
    { id: 'c4', accountId: 'ig1', platform: 'instagram', participantName: '<script>alert(1)</script>', lastMessage: '<img src=x onerror=alert(2)>', updatedTime: t(20), unreadCount: 0 },
    { id: 'c5', accountId: 'wa1', platform: 'whatsapp', participantName: 'Cy (fixture)', lastMessage: 'bye', updatedTime: t(10), unreadCount: 0 },
    { id: 'x1', accountId: 'ig2', platform: 'instagram', participantName: 'Other tenant (fixture)', lastMessage: 'private to tenant two', updatedTime: t(55), unreadCount: 2 },
  ],
  messages: {
    'ig1:c1': Array.from({ length: 7 }, (_, i) => ({ id: `m${i + 1}`, message: `c1 message ${i + 1}`, direction: i % 2 ? 'outgoing' : 'incoming', createdAt: t(i) })),
    'ig1:c4': [{ id: 'mx', message: '<b onmouseover=alert(3)>hover</b>', direction: 'incoming', createdAt: t(20) }],
    'ig2:x1': [{ id: 'secret1', message: 'private to tenant two', direction: 'incoming', createdAt: t(55) }],
  },
};
const fake = fakeZernio(seed);
let base, server, inbox;

before(async () => {
  const api = await fake.listen();
  const dir = mkdtempSync(join(tmpdir(), 'inbox-test-'));
  writeFileSync(join(dir, 'clients.json'), JSON.stringify([{ name: 'Fixture Tenant One', profileId: P1 }, { name: 'Fixture Tenant Two', profileId: P2 }]));
  Object.assign(process.env, {
    ZERNIO_API_BASE: api, ZERNIO_API_KEY: 'test-key', CLIENTS_FILE: join(dir, 'clients.json'), INBOX_DB: ':memory:',
    WEBHOOK_SECRET: 'test-secret', BASE_URL: 'http://127.0.0.1:1', ZERNIO_SEND_TIMEOUT_MS: '400',
  });
  const mod = await import('../server.js');
  inbox = mod._inbox;
  await new Promise((r) => { server = mod.default.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections?.(); await new Promise((r) => server.close(r)); await fake.close(); });
beforeEach(() => { fake.state.sendMode = 'ok'; fake.state.failedAccounts.clear(); fake.state.skippedAccounts.clear(); });

const page = async (path) => { const r = await fetch(base + path); return { status: r.status, html: await r.text() }; };
const post = async (path, form, headers = {}) => {
  const r = await fetch(base + path, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(form) });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
};
const keyFrom = (html) => html.match(/name="key" value="(rep_[0-9a-f-]{36})"/)[1];
const sign = (body) => createHmac('sha256', 'test-secret').update(body).digest('hex');
const hook = (payload, sig) => {
  const body = JSON.stringify(payload);
  return fetch(`${base}/webhooks/zernio`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Zernio-Signature': sig ?? sign(body) }, body });
};

/* ------------------------------------------------------------------ Read */
test('list: follows every page, scoped to the workspace, newest activity first', async () => {
  const { html } = await page(`/w/${P1}/inbox`);
  const order = ['Ada (fixture)', 'Ben (fixture)', '+1 555 0100 (fixture)', 'Cy (fixture)'].map((n) => html.indexOf(n));
  assert.ok(order.every((i) => i > 0), 'all five tenant-one threads across three pages');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'newest first');
  assert.ok(!html.includes('Other tenant'), 'tenant two thread never listed');
  assert.ok(fake.state.requests.some((r) => r.path.endsWith('/inbox/conversations') && r.query.cursor), 'cursor followed');
});

test('list: partial account failure is shown, not turned into an empty inbox', async () => {
  fake.state.failedAccounts.add('wa1');
  const { html } = await page(`/w/${P1}/inbox`);
  assert.match(html, /could not be read/);
  assert.match(html, /fixture_wa_one/);
  assert.ok(html.includes('Ada (fixture)'), 'healthy accounts still listed');
});

test('list: an account Zernio skips (live: the SMS number) is named, not silently missing', async () => {
  fake.state.skippedAccounts.add('sms1');
  const { html } = await page(`/w/${P1}/inbox`);
  assert.match(html, /not included by Zernio/);
  assert.match(html, /fixture_sms_one/);
  assert.ok(!html.includes('+1 555 0100 (fixture)'), 'its threads are not listed');
});

test('list: empty workspace shows the empty state; upstream error shows an error, not "empty"', async () => {
  const saved = fake.state.conversations;
  fake.state.conversations = saved.filter((c) => c.accountId !== 'ig2');
  let r = await page(`/w/${P2}/inbox`);
  assert.match(r.html, /No conversations/);
  assert.ok(!/Inbox not loaded/.test(r.html), 'empty is not an error');
  fake.state.conversations = saved;
  const realKey = process.env.ZERNIO_API_KEY;
  process.env.ZERNIO_API_KEY = 'wrong';
  try {
    r = await page(`/w/${P1}/inbox`);
    assert.match(r.html, /Inbox not loaded/);
    assert.ok(!/No conversations/.test(r.html), 'an upstream error is never shown as an empty inbox');
  } finally {
    process.env.ZERNIO_API_KEY = realKey;
  }
});

test('list: a late historical import (no webhook) appears on the next load, without a false unread', async () => {
  fake.state.conversations.push({ id: 'c6', accountId: 'ig1', platform: 'instagram', participantName: 'Imported later (fixture)', lastMessage: 'old', updatedTime: t(5), unreadCount: 0 });
  const { html } = await page(`/w/${P1}/inbox`);
  assert.ok(html.includes('Imported later (fixture)'));
  const row = html.slice(html.indexOf('Imported later (fixture)') - 600, html.indexOf('Imported later (fixture)'));
  assert.ok(!/class="thread unread"[^<]*$/.test(row.split('<a').pop() ?? ''), 'imported thread not flagged unread');
  fake.state.conversations = fake.state.conversations.filter((c) => c.id !== 'c6');
});

test('history: chronological display, "load older" pages, no duplicates, and opening sends NO read receipt', async () => {
  const readsBefore = fake.state.reads.length;
  const first = await page(`/w/${P1}/inbox?c=c1&a=ig1`);
  const idx = (n) => first.html.indexOf(`c1 message ${n}<`) > -1 ? first.html.indexOf(`c1 message ${n}`) : first.html.indexOf(`c1 message ${n}\n`);
  assert.ok(first.html.includes('c1 message 7') && first.html.includes('c1 message 5'));
  assert.ok(first.html.indexOf('c1 message 5') < first.html.indexOf('c1 message 7'), 'oldest of the page first');
  assert.ok(!first.html.includes('c1 message 1'), 'older messages wait for "load older"');
  const older = first.html.match(/href="([^"]*before=[^"]+)"/)[1].replace(/&amp;/g, '&');
  const second = await page(older);
  assert.ok(second.html.includes('c1 message 4') && second.html.includes('c1 message 2'));
  assert.equal(fake.state.reads.length, readsBefore, 'viewing history must not mark read');
  void idx;
});

test('mark read happens only on the explicit action', async () => {
  const before = fake.state.reads.length;
  const r = await post(`/w/${P1}/inbox/read`, { conversationId: 'c1', accountId: 'ig1' });
  assert.equal(r.status, 302);
  assert.equal(fake.state.reads.length, before + 1);
});

/* ------------------------------------------------------------------ Send + retry */
test('send: accepted reply goes out once and is labelled accepted, not delivered', async () => {
  const { html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`);
  const key = keyFrom(html);
  const sendsBefore = fake.state.sends.length;
  const r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'hello from fixture', key });
  assert.equal(fake.state.sends.length, sendsBefore + 1);
  const after = await page(r.location);
  assert.match(after.html, /Reply accepted/);
  assert.ok(!/Delivered/.test(after.html.split('Reply accepted')[0]), 'acceptance is not shown as delivery');
  const sent = fake.state.requests.filter((q) => q.method === 'POST' && q.path.endsWith('/c2/messages')).pop();
  assert.equal(sent.headers['idempotency-key'], key, 'idempotency key sent');
});

test('send: a double submit of the same attempt never sends twice', async () => {
  const { html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`);
  const key = keyFrom(html);
  const n = fake.state.sends.length;
  await Promise.all([1, 2, 3].map(() => post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'double click', key })));
  assert.equal(fake.state.sends.length, n + 1);
});

test('send: the same key with a changed body is refused locally', async () => {
  const { html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`);
  const key = keyFrom(html);
  await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'first body', key });
  const n = fake.state.sends.length;
  const r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'changed body', key });
  assert.equal(fake.state.sends.length, n);
  assert.match(decodeURIComponent(r.location), /different message/);
});

test('send: ambiguous 5xx after the platform accepted → "outcome unknown", no automatic resend, then reconciled', async () => {
  fake.state.sendMode = '5xx-accepted';
  const { html } = await page(`/w/${P1}/inbox?c=c1&a=ig1`);
  const key = keyFrom(html);
  const n = fake.state.sends.length;
  const r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c1', accountId: 'ig1', message: 'maybe sent', key });
  const view = await page(r.location);
  assert.match(view.html, /Outcome unknown/);
  assert.ok(!/Reply not sent/.test(view.html), 'never claims failure for an unknown outcome');
  assert.equal(fake.state.sends.length, n + 1, 'the platform got it exactly once');
  fake.state.sendMode = 'ok';
  const again = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c1', accountId: 'ig1', message: 'maybe sent', key });
  assert.equal(fake.state.sends.length, n + 1, 'resubmitting the unknown attempt does not resend');
  void again;
  const rec = await post(`/w/${P1}/inbox/reconcile`, { key });
  const settled = await page(rec.location);
  assert.match(settled.html, /Reply accepted/, 'found in history and settled');
});

test('send: a lost response (timeout) is unknown, not failed; history absence stays inconclusive', async () => {
  fake.state.sendMode = 'timeout';
  const { html } = await page(`/w/${P1}/inbox?c=c3&a=sms1`);
  const key = keyFrom(html);
  const r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c3', accountId: 'sms1', message: 'lost response', key });
  const view = await page(r.location);
  assert.match(view.html, /Outcome unknown/);
  const row = inbox.store.getSend(key);
  assert.equal(row.state, 'unknown');
});

test('send: in-flight key (409) shows sending, definitive 400 shows not sent with nothing delivered', async () => {
  fake.state.sendMode = 'in-flight';
  let { html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`);
  let r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'in flight', key: keyFrom(html) });
  assert.equal(inbox.store.getSend(new URL(r.location, base).searchParams.get('k')).state, 'pending');
  fake.state.sendMode = '400';
  ({ html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`));
  const n = fake.state.sends.length;
  r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'outside window', key: keyFrom(html) });
  const view = await page(r.location);
  assert.match(view.html, /Reply not sent/);
  assert.match(view.html, /messaging window/);
  assert.equal(fake.state.sends.length, n);
});

/* ------------------------------------------------------------------ New conversations */
test('new thread: Instagram/Facebook refused before any call; WhatsApp needs a template; SMS starts once', async () => {
  const calls = () => fake.state.requests.filter((q) => q.method === 'POST' && q.path.endsWith('/inbox/conversations')).length;
  const n = calls();
  const freshKey = async () => keyFrom((await page(`/w/${P1}/inbox`)).html);
  let r = await post(`/w/${P1}/inbox/new`, { accountId: 'ig1', to: '+1 555 0100', message: 'hi', key: await freshKey() });
  assert.match(decodeURIComponent(r.location ?? r.html), /message first/);
  r = await post(`/w/${P1}/inbox/new`, { accountId: 'wa1', to: '+1 555 0100', message: 'hi', key: await freshKey() });
  assert.match(decodeURIComponent(r.location ?? r.html), /template/);
  r = await post(`/w/${P1}/inbox/new`, { accountId: 'sms1', to: '+1 555 0100', message: 'no key' });
  assert.match(decodeURIComponent(r.location ?? r.html), /form expired/, 'a post without the form attempt key is refused');
  assert.equal(calls(), n, 'nothing reached Zernio for refused starts');
  const form = { accountId: 'sms1', to: '+1 (555) 010-0199', message: 'fixture first text', key: await freshKey() };
  await Promise.all([1, 2].map(() => post(`/w/${P1}/inbox/new`, form)));
  assert.equal(calls(), n + 1, 'a double submit starts one thread');
  assert.equal(fake.state.created.at(-1).participantId, '15550100199', 'digits only');
  r = await post(`/w/${P2}/inbox/new`, { accountId: 'sms1', to: '+15550100', message: 'cross', key: await freshKey() });
  assert.equal(r.status, 403);
});

/* ------------------------------------------------------------------ Receive */
test('webhook: missing/invalid signature is rejected and nothing is stored', async () => {
  const before = inbox.store.recentEvents(100).length;
  assert.equal((await hook({ id: 'evt_bad', event: 'message.received' }, 'deadbeef')).status, 401);
  assert.equal((await hook({ id: 'evt_bad2', event: 'message.received' }, '')).status, 401);
  assert.equal(inbox.store.recentEvents(100).length, before);
});

// Spec shape (docs.zernio.com/webhooks/inbox): message.id / message.conversationId are Zernio-internal ids; an
// Instagram list row is keyed by conversation.platformConversationId. account.profileId is optional.
const acct = (accountId, profileId, platform = 'instagram') => ({ id: accountId, accountId, ...(profileId ? { profileId } : {}), platform, username: `fixture_${accountId}` });
const inbound = (id, { accountId = 'ig1', profileId = P1, platform = 'instagram', thread = 'c1', text = `inbound ${id}` } = {}) => ({
  id, event: 'message.received', timestamp: t(59),
  message: { id: `int_${id}`, conversationId: `int_conv_${thread}`, platform, platformMessageId: `pm_${id}`, direction: 'incoming', text, sentAt: t(59) },
  conversation: { id: `int_conv_${thread}`, platformConversationId: thread, participantName: 'Ada (fixture)' },
  account: acct(accountId, profileId, platform),
});

test('webhook: valid inbound is persisted before 200, deduplicated, and visible in the thread', async () => {
  assert.equal((await hook(inbound('evt_1'))).status, 200);
  assert.equal((await hook(inbound('evt_1'))).status, 200, 'duplicate acknowledged');
  await inbox.kickWorker();
  assert.equal(inbox.store.db.prepare("SELECT COUNT(*) n FROM events WHERE event_id = 'evt_1'").get().n, 1);
  assert.equal(inbox.store.db.prepare("SELECT COUNT(*) n FROM messages WHERE platform_message_id = 'pm_evt_1'").get().n, 1);
  const { html } = await page(`/w/${P1}/inbox?c=c1&a=ig1`);
  assert.equal(html.split('inbound evt_1').length - 1, 1, 'shown once');
  const activity = await page('/events');
  assert.match(activity.html, /Inbox events/);
  assert.match(activity.html, /message\.received · done/);
  assert.ok(!activity.html.includes('inbound evt_1'), 'activity shows ids and state, never message text');
});

test('webhook: an event persisted before a crash is processed on the next drain (restart)', async () => {
  inbox.store.recordEvent({ eventId: 'evt_crash', event: 'message.received', profileId: P1, accountId: 'ig1', payload: JSON.stringify(inbound('evt_crash')) });
  assert.equal(inbox.store.pendingEvents().some((e) => e.event_id === 'evt_crash'), true);
  await inbox.kickWorker();
  assert.equal(inbox.store.pendingEvents().some((e) => e.event_id === 'evt_crash'), false);
});

test('webhook: out-of-order status never regresses (delivered before sent stays delivered)', async () => {
  const status = (id, event) => ({ id, event, timestamp: t(58), statusAt: t(58),
    message: { id: 'int_out_1', conversationId: 'int_conv_c2', platform: 'whatsapp', platformMessageId: 'pm_out_1', direction: 'outgoing', text: null, sentAt: t(57) },
    conversation: { id: 'c2', platformConversationId: 'wamid_thread_c2' }, account: acct('wa1', P1, 'whatsapp') });
  await hook(status('evt_d', 'message.delivered'));
  await hook(status('evt_s', 'message.sent'));
  await inbox.kickWorker();
  assert.equal(inbox.store.db.prepare("SELECT status FROM messages WHERE platform_message_id = 'pm_out_1'").get().status, 'delivered');
});

test('webhook: an event naming tenant one with tenant two\'s account is not routed', async () => {
  const spoof = inbound('evt_cross', { accountId: 'ig2', thread: 'x1', text: 'spoofed' });
  spoof.account.profileId = P1; // names tenant one's profile but carries tenant two's account
  await hook(spoof);
  await inbox.kickWorker();
  assert.equal(inbox.store.db.prepare("SELECT state FROM events WHERE event_id = 'evt_cross'").get().state, 'ignored');
  assert.equal(inbox.store.db.prepare("SELECT COUNT(*) n FROM messages WHERE platform_message_id = 'pm_evt_cross'").get().n, 0);
});

test('webhook: a sandbox-style event without profileId is routed to the workspace that owns the account', async () => {
  await hook(inbound('evt_sandbox', { accountId: 'wa1', profileId: null, platform: 'whatsapp', thread: 'c2', text: 'sandbox inbound' }));
  await inbox.kickWorker();
  const row = inbox.store.db.prepare("SELECT profile_id, conversation_id FROM messages WHERE platform_message_id = 'pm_evt_sandbox'").get();
  assert.equal(row.profile_id, P1);
  assert.equal(row.conversation_id, 'int_conv_c2', 'WhatsApp threads are keyed by the internal conversation id');
});

test('webhook: an Instagram event lands on the list row id (platformConversationId), not the internal id', async () => {
  await hook(inbound('evt_ig', { text: 'ig keyed by thread' }));
  await inbox.kickWorker();
  assert.equal(inbox.store.db.prepare("SELECT conversation_id FROM messages WHERE platform_message_id = 'pm_evt_ig'").get().conversation_id, 'c1');
});

test('webhook: an account no workspace here owns is ignored, not guessed', async () => {
  await hook(inbound('evt_foreign', { accountId: 'someone_else', profileId: null }));
  await inbox.kickWorker();
  assert.equal(inbox.store.db.prepare("SELECT state FROM events WHERE event_id = 'evt_foreign'").get().state, 'ignored');
});

/* ------------------------------------------------------------------ Protect access */
test('access: tenant one cannot read, send, mark read or reconcile with tenant two\'s ids', async () => {
  let r = await page(`/w/${P1}/inbox?c=x1&a=ig2`);
  assert.equal(r.status, 403);
  assert.ok(!r.html.includes('private to tenant two'));
  const n = fake.state.sends.length;
  r = await post(`/w/${P1}/inbox/reply`, { conversationId: 'x1', accountId: 'ig2', message: 'cross-tenant', key: 'rep_00000000-0000-4000-8000-000000000000' });
  assert.equal(r.status, 403);
  r = await post(`/w/${P1}/inbox/x1/reply`, { accountId: 'ig2', message: 'old path cross-tenant' });
  assert.equal(r.status, 403);
  assert.equal(fake.state.sends.length, n, 'nothing sent');
  const reads = fake.state.reads.length;
  assert.equal((await post(`/w/${P1}/inbox/read`, { conversationId: 'x1', accountId: 'ig2' })).status, 403);
  assert.equal(fake.state.reads.length, reads);
  // a tenant-one send key cannot be reconciled from tenant two
  const { html } = await page(`/w/${P1}/inbox?c=c2&a=wa1`);
  const key = keyFrom(html);
  await post(`/w/${P1}/inbox/reply`, { conversationId: 'c2', accountId: 'wa1', message: 'tenant one only', key });
  assert.equal((await post(`/w/${P2}/inbox/reconcile`, { key })).status, 403);
  // tenant one's own account with tenant two's conversation id: Zernio has no such thread on that account
  r = await page(`/w/${P1}/inbox?c=x1&a=ig1`);
  assert.ok(!r.html.includes('private to tenant two'));
});

test('access: incoming HTML/script-like text renders as inert text', async () => {
  const { html } = await page(`/w/${P1}/inbox?c=c4&a=ig1`);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<img src=x onerror'));
  assert.ok(!html.includes('<b onmouseover'));
});

test('access: no secret reaches a page', async () => {
  for (const path of [`/w/${P1}/inbox`, `/w/${P1}/inbox?c=c1&a=ig1`, `/w/${P1}/connections`, '/events']) {
    const { html } = await page(path);
    assert.ok(!html.includes('test-key') && !html.includes('test-secret'), path);
  }
});

/* ------------------------------------------------------------------ Connect */
test('connect: tampered/replayed/foreign callbacks cannot attach an account to a workspace', async () => {
  // unknown nonce, and a profileId typed into the URL, are both refused
  let r = await page(`/callback/instagram?i=forged&profileId=${P2}&connected=1&accountId=ig1`);
  assert.equal(r.status, 400);
  assert.match(r.html, /Start again/);
  // legitimate start sets a browser cookie + nonce; a different browser (no cookie) cannot use it
  const start = await fetch(`${base}/connect/${P1}/instagram`, { redirect: 'manual' });
  const cookie = start.headers.get('set-cookie')?.split(';')[0];
  const nonce = inbox.store.db.prepare('SELECT nonce FROM intents ORDER BY created_at DESC LIMIT 1').get()?.nonce;
  assert.ok(nonce && cookie, 'intent recorded');
  r = await page(`/callback/instagram?i=${nonce}&connected=1&accountId=ig1`);
  assert.equal(r.status, 400, 'other browser refused');
  // same browser, but consent was cancelled: error shown, nothing mapped
  const cancelled = await fetch(`${base}/callback/instagram?i=${nonce}&error=access_denied`, { redirect: 'manual', headers: { cookie } });
  assert.match(decodeURIComponent(cancelled.headers.get('location') || ''), /error=access_denied/);
  // replay of the consumed nonce is refused
  const replay = await fetch(`${base}/callback/instagram?i=${nonce}&connected=1&accountId=ig1`, { redirect: 'manual', headers: { cookie } });
  assert.equal(replay.status, 400);
});

test('connect: success is announced only after the account is confirmed in THAT workspace', async () => {
  const start = await fetch(`${base}/connect/${P1}/instagram`, { redirect: 'manual' });
  const cookie = start.headers.get('set-cookie')?.split(';')[0];
  let nonce = inbox.store.db.prepare('SELECT nonce FROM intents ORDER BY created_at DESC LIMIT 1').get().nonce;
  // callback claims tenant two's account: not found in tenant one -> failure, not "connected"
  let r = await fetch(`${base}/callback/instagram?i=${nonce}&connected=1&accountId=ig2`, { redirect: 'manual', headers: { cookie } });
  assert.match(decodeURIComponent(r.headers.get('location')), /error=/);
  await fetch(`${base}/connect/${P1}/instagram`, { redirect: 'manual', headers: { cookie } });
  nonce = inbox.store.db.prepare('SELECT nonce FROM intents ORDER BY created_at DESC LIMIT 1').get().nonce;
  r = await fetch(`${base}/callback/instagram?i=${nonce}&connected=1&accountId=ig1`, { redirect: 'manual', headers: { cookie } });
  assert.match(decodeURIComponent(r.headers.get('location')), new RegExp(`/c/${P1}/connect\\?connected=instagram`));
});

test('connections: messaging health is read live and an unhealthy account says action required', async () => {
  const { html } = await page(`/w/${P2}/connections`);
  assert.match(html, /Messaging health/);
  assert.match(html, /Action required/);
  assert.match(html, /invalidated by Meta/);
  const one = await page(`/w/${P1}/connections`);
  assert.match(one.html, /inbound subscribed/);
});
