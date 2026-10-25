// Automations tab tests: FIXTURES ONLY (tests/fake-automations.mjs). Never the real API.
//   npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fakeAutomations } from './fake-automations.mjs';

const A = 'pa_bakery';   // the workspace under test: Instagram + Facebook
const B = 'pb_other';    // another client: its automations must never show or change from A
const seed = {
  accounts: [
    { _id: 'ig_a', platform: 'instagram', username: 'harbour.bakery', profileId: A, platformUserId: '1784' },
    { _id: 'fb_a', platform: 'facebook', username: 'Harbour Bakery', profileId: A, platformUserId: '1100' },
    { _id: 'tt_a', platform: 'tiktok', username: 'harbour.tt', profileId: A },
    { _id: 'ig_b', platform: 'instagram', username: 'other.brand', profileId: B },
  ],
  posts: [
    { id: '1806', accountId: 'ig_a', platform: 'instagram', content: '¿Para cuántos alcanza? 🧁\nsecond line', createdTime: '2026-08-18T16:04:40.000Z', picture: 'https://cdn.example/p.jpg', permalink: 'https://www.instagram.com/p/x/', commentCount: 0 },
    { id: '9999', accountId: 'ig_b', platform: 'instagram', content: 'Other brand post', createdTime: '2026-08-18T16:04:40.000Z', commentCount: 0 },
  ],
  misses: { total: 2, retentionDays: 7, samples: [{ commentText: 'so cute', commenterName: 'Fixture', at: new Date().toISOString() }] },
};
const fake = fakeAutomations(seed);
const dir = mkdtempSync(join(tmpdir(), 'automations-test-'));
let server, base;

before(async () => {
  const api = await fake.listen();
  writeFileSync(join(dir, 'clients.json'), JSON.stringify([{ name: 'Harbour Bakery', profileId: A }, { name: 'Other Brand', profileId: B }]));
  Object.assign(process.env, {
    ZERNIO_API_BASE: api, ZERNIO_API_KEY: 'test-key', CLIENTS_FILE: join(dir, 'clients.json'), INBOX_DB: ':memory:',
    WEBHOOK_SECRET: 'test-secret', BASE_URL: 'http://127.0.0.1:1',
  });
  delete process.env.PORTAL_AGENT_TOKEN;
  const mod = await import('../server.js');
  await new Promise((r) => { server = mod.default.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections?.(); await new Promise((r) => server.close(r)); await fake.close(); });

const page = async (path) => { const r = await fetch(base + path, { redirect: 'manual' }); return { status: r.status, html: await r.text(), location: r.headers.get('location') }; };
const form = async (path, fields) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) body.append(k, x);
  const r = await fetch(base + path, { method: 'POST', body, redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
};
const apiCall = async (method, path, body, headers = {}) => {
  const r = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};
const lastTo = (method, path) => [...fake.state.requests].reverse().find((r) => r.method === method && r.path.endsWith(path));
const sentCount = (method, pathPart) => fake.state.requests.filter((r) => r.method === method && r.path.includes(pathPart)).length;

test('the tab is in the workspace menu and starts on templates', async () => {
  const r = await page(`/w/${A}/automations`);
  assert.equal(r.status, 200);
  assert.match(r.html, /href="\/w\/pa_bakery\/automations" aria-current="page"/);
  assert.match(r.html, /Your own ManyChat, for Harbour Bakery/);
  for (const t of ['Comment → DM', 'Followers only', 'Story mention → DM', 'Link or QR → flow', 'Comment → ask first']) assert.ok(r.html.includes(t), t);
  assert.match(r.html, /first 10,000 a month are free, then \$1 per 10,000/);
});

test('the builder shows the account, the posts to pick and a live preview', async () => {
  const r = await page(`/w/${A}/automations/new/comment_dm`);
  assert.equal(r.status, 200);
  assert.match(r.html, /@harbour.bakery · Instagram/);
  assert.match(r.html, /Any post or reel/);
  assert.match(r.html, /¿Para cuántos alcanza\?/);
  assert.ok(!r.html.includes('Other brand post'), 'another workspace’s post is not offered');
  assert.ok(!r.html.includes('harbour.tt'), 'TikTok has no DMs to automate');
  assert.match(r.html, /js-chat/);
  assert.match(r.html, /ax-iphone/);
});

let commentId;
test('comment → DM from the form sends exactly what Zernio documents', async () => {
  const r = await form(`/w/${A}/automations/new/comment_dm`, {
    name: 'Guide giveaway', accountId: 'ig_a', platformPostId: 'any', keywords: 'GUIDE, link', matchMode: 'word', typoTolerance: '1',
    alsoMatchInDms: '1', dmMessage: 'Hey {{first_name}}! Here it is 👇', btnTitle: 'Get the guide', btnUrl: 'https://example.com/g',
    commentReply: 'Sent to your DMs 📩', repeat: 'once', cooldownHours: '', isActive: '1',
  });
  assert.equal(r.status, 302, r.html.slice(0, 400));
  const sent = lastTo('POST', '/comment-automations').body;
  assert.deepEqual(
    { profileId: sent.profileId, accountId: sent.accountId, trigger: sent.trigger, keywords: sent.keywords, matchMode: sent.matchMode, typoTolerance: sent.typoTolerance, alsoMatchInDms: sent.alsoMatchInDms, isActive: sent.isActive, publicReplyPolicy: sent.publicReplyPolicy, repeatPolicy: sent.repeatPolicy },
    { profileId: A, accountId: 'ig_a', trigger: 'comment', keywords: ['GUIDE', 'link'], matchMode: 'word', typoTolerance: true, alsoMatchInDms: true, isActive: true, publicReplyPolicy: 'after_dm', repeatPolicy: { mode: 'once' } });
  assert.deepEqual(sent.buttons, [{ type: 'url', title: 'Get the guide', url: 'https://example.com/g' }]);
  assert.equal(sent.commentReply, 'Sent to your DMs 📩');
  assert.equal('platformPostId' in sent, false, 'any post = no binding');
  assert.equal('audience' in sent, false);
  commentId = r.location.match(/comment\/([^?]+)/)[1];
  const d = await page(r.location);
  assert.match(d.html, /is live/);
  assert.match(d.html, /Someone comments “GUIDE”, “link” on any post, or DMs it/);
  assert.match(d.html, /Once per person, ever/);
});

test('followers only adds the audience rule and the one-tap check', async () => {
  const r = await apiCall('POST', `/w/${A}/automations`, {
    recipe: 'followers_only', name: 'VIP', accountId: 'ig_a', keywords: ['VIP'], dmMessage: 'You’re in!',
    buttons: [{ title: 'Claim', url: 'https://example.com/vip' }], gateMessage: 'Follow, then tap 👇', gateButton: 'I’m following ✅', gateNotFollowing: 'Not yet 🙌',
    platformPostId: '1806', postTitle: '¿Para cuántos alcanza?',
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const sent = lastTo('POST', '/comment-automations').body;
  assert.deepEqual(sent.audience, { followerStatus: 'follower', whenUnknown: 'verify' });
  assert.deepEqual(sent.followGate, { message: 'Follow, then tap 👇', buttonLabel: 'I’m following ✅', notFollowingMessage: 'Not yet 🙌' });
  assert.equal(sent.publicReplyPolicy, 'always');
  assert.equal(sent.platformPostId, '1806');
  assert.equal(r.json.recipe, 'followers_only');
  assert.match(r.json.then[0], /one-tap “I’m following” check/);
});

test('story mentions take no keywords and are Instagram only', async () => {
  const ok = await apiCall('POST', `/w/${A}/automations`, { recipe: 'story_mention', name: 'Thanks', accountId: 'ig_a', dmMessage: 'Thank you {{first_name}}!', repeat: 'every', cooldownHours: 24 });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const sent = lastTo('POST', '/comment-automations').body;
  assert.equal(sent.trigger, 'story_mention');
  assert.deepEqual(sent.keywords, []);
  assert.deepEqual(sent.repeatPolicy, { mode: 'every_comment', cooldownHours: 24 });
  const before = sentCount('POST', '/comment-automations');
  const fb = await apiCall('POST', `/w/${A}/automations`, { recipe: 'story_mention', name: 'Thanks', accountId: 'fb_a', dmMessage: 'Hi' });
  assert.equal(fb.status, 400);
  assert.match(fb.json.error, /Instagram only/);
  assert.equal(sentCount('POST', '/comment-automations'), before, 'refused before it reached Zernio');
});

let flowId;
test('a ref link is a live workflow with its link and QR code', async () => {
  const r = await apiCall('POST', `/w/${A}/automations`, {
    recipe: 'ref_link', name: 'QR at the counter', accountId: 'ig_a', ref: 'counter', dmMessage: 'Hi {{contact.name}}!',
    buttons: [{ title: 'Menu', url: 'https://example.com/menu' }], tag: 'came-from-qr', cooldownHours: 24,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  flowId = r.json.id;
  const made = lastTo('POST', '/workflows').body;
  const trigger = made.nodes.find((n) => n.type === 'trigger');
  assert.deepEqual(trigger.config, { triggerType: 'referral', referral: { ref: 'counter', matchType: 'exact' }, cooldownHours: 24 });
  assert.deepEqual(made.nodes.map((n) => n.type), ['trigger', 'send_message', 'add_tag', 'end']);
  assert.deepEqual(made.nodes[1].config.buttons, [{ type: 'url', title: 'Menu', url: 'https://example.com/menu' }]);
  assert.equal(made.platform, 'instagram');
  assert.ok(lastTo('POST', `/workflows/${flowId}/activate`), 'activated after create');
  assert.equal(r.json.status, 'live');
  assert.equal(r.json.link, 'https://ig.me/m/harbour.bakery?ref=counter');
  const d = await page(`/w/${A}/automations/flow/${flowId}`);
  assert.match(d.html, /<svg[^>]*viewBox/);
  assert.match(d.html, /ig\.me\/m\/harbour.bakery\?ref=counter/);
  const png = await fetch(`${base}/w/${A}/automations/flow/${flowId}/qr.png`);
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await png.arrayBuffer()).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test('ask first opens with plain text and sends the button after the reply', async () => {
  const r = await apiCall('POST', `/w/${A}/automations`, {
    recipe: 'ask_first', name: 'Ask first', accountId: 'ig_a', keywords: 'GUIDE', opener: 'Reply YES 🙌', dmMessage: 'Here it is',
    buttons: [{ title: 'Guide', url: 'https://example.com/g' }], isActive: false,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const made = lastTo('POST', '/workflows').body;
  const byId = Object.fromEntries(made.nodes.map((n) => [n.id, n]));
  assert.equal(byId.n_trigger.config.triggerType, 'comment');
  assert.equal(byId.n_open.config.buttons, undefined, 'the private reply has no buttons');
  assert.ok(made.edges.some((e) => e.source === 'n_wait' && e.sourceHandle === 'reply' && e.target === 'n_dm'));
  assert.ok(made.edges.some((e) => e.source === 'n_wait' && e.sourceHandle === 'timeout'));
  assert.equal(r.json.status, 'draft', 'saved paused: never activated');
  assert.ok(!lastTo('POST', `/workflows/${r.json.id}/activate`));
});

test('bad input is explained and never reaches Zernio', async () => {
  const before = sentCount('POST', '/comment-automations');
  const r = await form(`/w/${A}/automations/new/comment_dm`, {
    name: 'Too long', accountId: 'ig_a', keywords: 'X', matchMode: 'word', dmMessage: 'x'.repeat(700),
    btnTitle: 'This label is far too long', btnUrl: 'http://not-https.example', repeat: 'once', isActive: '1',
  });
  assert.equal(r.status, 400);
  assert.match(r.html, /over 20 characters/);
  assert.match(r.html, /https:\/\//);
  assert.match(r.html, /limit is 640 with buttons/);
  assert.match(r.html, /value="Too long"/, 'what they typed stays in the form');
  assert.equal(sentCount('POST', '/comment-automations'), before);
  const kw = await apiCall('POST', `/w/${A}/automations`, { recipe: 'comment_dm', name: 'n', accountId: 'ig_a', dmMessage: 'd', alsoMatchInDms: true, keywords: [] });
  assert.equal(kw.status, 400);
  assert.match(kw.json.error, /needs at least one keyword/);
});

test('editing replaces the settings, clears buttons and keeps live/paused', async () => {
  fake.state.comment.get(commentId).isActive = false;
  const r = await form(`/w/${A}/automations/comment/${commentId}/edit`, {
    name: 'Guide giveaway v2', platformPostId: '1806', postTitle: '¿Para cuántos alcanza?', keywords: 'PDF', matchMode: 'exact',
    dmMessage: 'New text', repeat: 'every', cooldownHours: '12', commentReply: '', accountId: 'ig_a',
  });
  assert.equal(r.status, 302, r.html.slice(0, 300));
  const patch = lastTo('PATCH', `/comment-automations/${commentId}`).body;
  assert.equal(patch.isActive, false, 'a paused automation stays paused after an edit');
  assert.deepEqual(patch.buttons, []);
  assert.deepEqual(patch.keywords, ['PDF']);
  assert.equal(patch.matchMode, 'exact');
  assert.equal(patch.typoTolerance, false);
  assert.equal(patch.alsoMatchInDms, false);
  assert.equal(patch.platformPostId, '1806');
  assert.deepEqual(patch.repeatPolicy, { mode: 'every_comment', cooldownHours: 12 });
  assert.equal('accountId' in patch, false, 'the account is never changed');
  // Back to any post: the binding is cleared as a unit.
  await form(`/w/${A}/automations/comment/${commentId}/edit`, { name: 'x', platformPostId: 'any', keywords: 'PDF', matchMode: 'word', dmMessage: 'd', repeat: 'once' });
  const p2 = lastTo('PATCH', `/comment-automations/${commentId}`).body;
  assert.deepEqual([p2.platformPostId, p2.postTitle, p2.postId], [null, null, null]);
  assert.deepEqual(p2.repeatPolicy, { mode: 'once' });
});

test('the switch turns comment automations and flows on and off', async () => {
  let r = await form(`/w/${A}/automations/comment/${commentId}/live`, { on: '1', back: `/w/${A}/automations` });
  assert.equal(r.status, 302);
  assert.equal(lastTo('PATCH', `/comment-automations/${commentId}`).body.isActive, true);
  assert.match(decodeURIComponent(r.location), /is live/);
  r = await form(`/w/${A}/automations/flow/${flowId}/live`, { on: '0', back: 'https://evil.example/' });
  assert.ok(lastTo('POST', `/workflows/${flowId}/pause`));
  assert.ok(r.location.startsWith(`/w/${A}/automations`), 'never redirects off the portal');
  const api = await apiCall('POST', `/w/${A}/automations/flow/${flowId}/activate`);
  assert.equal(api.json.status, 'live');
});

test('another client’s automations never show and can’t be touched', async () => {
  const other = await apiCall('POST', `/w/${B}/automations`, { recipe: 'comment_dm', name: 'Other', accountId: 'ig_b', keywords: 'X', dmMessage: 'd' });
  assert.equal(other.status, 200);
  const list = await apiCall('GET', `/w/${A}/automations`);
  assert.ok(!list.json.automations.some((a) => a.id === other.json.id));
  assert.ok(!(await page(`/w/${A}/automations`)).html.includes('>Other<'));
  assert.equal((await page(`/w/${A}/automations/comment/${other.json.id}`)).status, 404);
  assert.equal((await apiCall('GET', `/w/${A}/automations/comment/${other.json.id}`)).status, 404);
  const del = await apiCall('DELETE', `/w/${A}/automations/comment/${other.json.id}`);
  assert.equal(del.status, 404);
  assert.ok(fake.state.comment.has(other.json.id), 'still there');
  const patch = await apiCall('PATCH', `/w/${A}/automations/comment/${other.json.id}`, { dmMessage: 'hijack' });
  assert.equal(patch.status, 404);
  assert.notEqual(fake.state.comment.get(other.json.id).dmMessage, 'hijack');
  // Creating on another workspace's account is refused too.
  const steal = await apiCall('POST', `/w/${A}/automations`, { recipe: 'comment_dm', name: 'n', accountId: 'ig_b', keywords: 'X', dmMessage: 'd' });
  assert.equal(steal.status, 404);
});

test('live activity reads the log in words, and the agent never gets what people wrote', async () => {
  fake.state.logs.set(commentId, [
    { id: 'l1', commenterUsername: 'sam.test', commentText: 'GUIDE please', source: 'comment', status: 'sent', commentReplyStatus: 'sent', commenterIsFollower: true, clickCount: 2, createdAt: new Date().toISOString() },
    { id: 'l2', commenterUsername: 'sam.test', commentText: 'GUIDE again', source: 'comment', status: 'skipped', error: 'already sent (repeatPolicy once)', createdAt: new Date().toISOString() },
    { id: 'l3', commenterUsername: 'new.person', commentText: 'VIP', source: 'comment', status: 'gated', audienceOutcome: 'gate_sent', gateButtonStatus: 'delivered', commenterIsFollower: null, createdAt: new Date().toISOString() },
    { id: 'l4', commenterUsername: 'mention.er', source: 'story_mention', status: 'failed', error: 'outside the messaging window', createdAt: new Date().toISOString() },
  ]);
  const r = await page(`/w/${A}/automations/comment/${commentId}/activity`);
  assert.equal(r.status, 200);
  assert.match(r.html, /DM sent/);
  assert.match(r.html, /Skipped: already sent \(repeatPolicy once\)/);
  assert.match(r.html, /Waiting for the “I’m following” tap/);
  assert.match(r.html, /Story mention/);
  assert.match(r.html, /Failed: outside the messaging window/);
  assert.match(r.html, /Matched no keyword/);
  const a = await apiCall('GET', `/w/${A}/automations/comment/${commentId}/activity`);
  assert.equal(a.json.rows.length, 4);
  assert.ok(a.json.rows.every((x) => !('text' in x)), 'no comment text for the agent');
  assert.equal(a.json.missesTotal, 2);
});

test('an automation made elsewhere with extra features is flagged before editing', async () => {
  const made = await apiCall('POST', `/w/${A}/automations`, { recipe: 'comment_dm', name: 'Card', accountId: 'ig_a', keywords: 'CARD', dmMessage: 'd' });
  Object.assign(fake.state.comment.get(made.json.id), { template: { type: 'generic', elements: [] }, buttons: [{ type: 'postback', title: 'Go', payload: 'x' }] });
  const d = await page(`/w/${A}/automations/comment/${made.json.id}`);
  assert.match(d.html, /Made outside this tab/);
  assert.match(d.html, /a product card, a postback or phone button/);
});

test('the JSON API: recipes, a guard against other sites, and the agent token', async () => {
  const rec = await apiCall('GET', '/recipes');
  assert.deepEqual(Object.keys(rec.json.recipes).sort(), ['ask_first', 'comment_dm', 'followers_only', 'ref_link', 'story_mention']);
  const cross = await apiCall('GET', `/w/${A}/automations`, null, { origin: 'https://evil.example' });
  assert.equal(cross.status, 403);
  process.env.PORTAL_AGENT_TOKEN = 'tok-123';
  try {
    assert.equal((await apiCall('GET', '/workspaces')).status, 401);
    assert.equal((await apiCall('GET', '/workspaces', null, { authorization: 'Bearer tok-123' })).status, 200);
  } finally {
    delete process.env.PORTAL_AGENT_TOKEN;
  }
  assert.equal((await apiCall('GET', `/w/nope/automations`)).status, 404);
  assert.equal((await apiCall('GET', `/w/${A}/automations/bogus/1`)).status, 404);
});

test('the MCP server gives an agent the same actions', async () => {
  const child = spawn(process.execPath, ['mcp/automations-mcp.mjs'], { env: { ...process.env, PORTAL_URL: base }, stdio: ['pipe', 'pipe', 'inherit'] });
  const replies = new Map();
  let buf = '';
  child.stdout.on('data', (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); replies.get(m.id)?.(m); }
  });
  let n = 0;
  const rpc = (method, params) => new Promise((r) => { const id = ++n; replies.set(id, r); child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); });
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.serverInfo.name, 'futuro-automations');
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const tools = await rpc('tools/list');
    assert.deepEqual(tools.result.tools.map((t) => t.name).sort(), ['create_automation', 'delete_automation', 'get_activity', 'get_automation', 'get_recipes', 'list_automations', 'list_posts', 'list_workspaces', 'set_automation_live', 'update_automation']);
    const made = await rpc('tools/call', { name: 'create_automation', arguments: { profileId: A, recipe: 'comment_dm', settings: { name: 'From the agent', accountId: 'ig_a', keywords: ['PRICE'], dmMessage: 'Here are our prices', isActive: false } } });
    assert.equal(made.result.isError, undefined, made.result.content?.[0]?.text);
    assert.equal(made.result.structuredContent.status, 'paused');
    const listed = await rpc('tools/call', { name: 'list_automations', arguments: { profileId: A } });
    assert.ok(listed.result.structuredContent.automations.some((a) => a.name === 'From the agent'));
    const refused = await rpc('tools/call', { name: 'create_automation', arguments: { profileId: A, recipe: 'comment_dm', settings: { name: 'x', accountId: 'ig_a', dmMessage: '' } } });
    assert.equal(refused.result.isError, true);
    assert.match(refused.result.content[0].text, /The DM is empty/);
  } finally {
    child.kill();
  }
});

test('deleting removes it in Zernio and says so', async () => {
  const r = await form(`/w/${A}/automations/comment/${commentId}/delete`, {});
  assert.equal(r.status, 302);
  assert.ok(!fake.state.comment.has(commentId));
  assert.match(decodeURIComponent(r.location), /is deleted/);
});
