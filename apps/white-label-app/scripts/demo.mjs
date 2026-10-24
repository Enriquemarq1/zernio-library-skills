// Demo mode: the whole portal on made-up data, no Zernio account and no key needed.
//   npm run demo            then open http://127.0.0.1:3000
// It starts the test fixture API (tests/fake-zernio.mjs) with three invented clients, adds the few routes the
// fixture does not answer (the posting queue, the calendar, best time), and runs the app against it.
// Nothing here talks to Zernio. Posting, connecting and replying are answered by the fake and change nothing real.
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeZernio } from '../tests/fake-zernio.mjs';

const DAY = 864e5;
const iso = (ms) => new Date(ms).toISOString();
const ago = (d, h = 10) => iso(Date.now() - d * DAY + (h - 10) * 36e5);
const ahead = (d, h = 10) => iso(Date.now() + d * DAY + (h - 10) * 36e5);
const date = (ms) => iso(ms).slice(0, 10);
const from30 = date(Date.now() - 29 * DAY);

const CLIENTS = [
  { name: 'Harbour Dental', profileId: 'demo_harbour', adAccountId: 'act_demo_harbour' },
  { name: 'Northside Bakery', profileId: 'demo_bakery' },
  { name: 'Summit Fitness', profileId: 'demo_summit' },
];
const [H, B, S] = CLIENTS.map((c) => c.profileId);

const accounts = [
  { _id: 'h_ig', platform: 'instagram', username: 'harbour.dental.demo', profileId: H },
  { _id: 'h_fb', platform: 'facebook', username: 'Harbour Dental', profileId: H },
  { _id: 'h_li', platform: 'linkedin', username: 'Harbour Dental', profileId: H },
  { _id: 'h_ads', platform: 'metaads', username: 'Harbour Dental Ads', profileId: H },
  { _id: 'b_ig', platform: 'instagram', username: 'northside.bakery.demo', profileId: B },
  { _id: 'b_tt', platform: 'tiktok', username: 'northside.bakery.demo', profileId: B },
  { _id: 's_ig', platform: 'instagram', username: 'summit.fit.demo', profileId: S },
  { _id: 's_yt', platform: 'youtube', username: 'Summit Fitness', profileId: S, health: 'error', issues: ['Token expired: reconnect'] },
];

const conversations = [
  { id: 'hc1', accountId: 'h_ig', platform: 'instagram', participantName: 'Maya R.', lastMessage: 'Do you have anything open Saturday morning?', updatedTime: ago(0, 9), unreadCount: 1 },
  { id: 'hc2', accountId: 'h_fb', platform: 'facebook', participantName: 'Tom B.', lastMessage: 'Thanks, see you Thursday!', updatedTime: ago(1), unreadCount: 0 },
  { id: 'hc3', accountId: 'h_ig', platform: 'instagram', participantName: 'Lena K.', lastMessage: 'How much is whitening?', updatedTime: ago(2), unreadCount: 1 },
  { id: 'bc1', accountId: 'b_ig', platform: 'instagram', participantName: 'Chris P.', lastMessage: 'Can I order a cake for Friday?', updatedTime: ago(0, 8), unreadCount: 1 },
];
const messages = {
  'h_ig:hc1': [
    { id: 'hm1', message: 'Hi! Do you have anything open Saturday morning?', direction: 'incoming', createdAt: ago(0, 9) },
  ],
  'h_fb:hc2': [
    { id: 'hm2', message: 'Can I move my cleaning to Thursday?', direction: 'incoming', createdAt: ago(1, 8) },
    { id: 'hm3', message: 'Of course. Thursday 4 pm is yours.', direction: 'outgoing', createdAt: ago(1, 9) },
    { id: 'hm4', message: 'Thanks, see you Thursday!', direction: 'incoming', createdAt: ago(1) },
  ],
  'h_ig:hc3': [{ id: 'hm5', message: 'How much is whitening?', direction: 'incoming', createdAt: ago(2) }],
  'b_ig:bc1': [{ id: 'bm1', message: 'Can I order a cake for Friday?', direction: 'incoming', createdAt: ago(0, 8) }],
};

const analyticsPost = (id, platform, mediaType, content, days, a) => ({
  _id: id, platform, mediaType, content, publishedAt: ago(days), status: 'published', isAd: false,
  platforms: [{ platform, status: 'published' }],
  analytics: { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, engagementRate: 0, ...a },
});
const dashboard = (scale, byAccount) => ({
  dateRange: { fromDate: from30, toDate: date(Date.now()) },
  totals: { impressions: 48200 * scale, reach: 31900 * scale, likes: 2140 * scale, comments: 312 * scale, shares: 188 * scale, saves: 240 * scale, clicks: 905 * scale, views: 22600 * scale, engagementRate: 5.9 },
  previousTotals: { impressions: 39100 * scale, reach: 27000 * scale, likes: 1720 * scale, comments: 260 * scale, shares: 150 * scale, saves: 170 * scale, clicks: 700 * scale, views: 18200 * scale, engagementRate: 5.4 },
  followers: { current: byAccount.reduce((n, a) => n + a.current, 0), gained: byAccount.reduce((n, a) => n + a.gained, 0), byAccount },
  previousFollowers: { current: byAccount.reduce((n, a) => n + a.current - a.gained, 0), gained: Math.round(byAccount.reduce((n, a) => n + a.gained, 0) * 0.7) },
  daily: Array.from({ length: 30 }, (_, i) => ({ date: date(Date.parse(from30) + i * DAY), impressions: Math.round((1300 + 400 * Math.sin(i / 3) + i * 20) * scale), reach: Math.round(900 * scale), engagement: 60 + (i % 7) * 9, views: Math.round(700 * scale), followersGained: 3 + (i % 4) })),
  topPosts: [],
  dataAsOf: iso(Date.now() - 2 * 36e5),
});
const histogram = [
  { bucket: '0-1m', lowerSeconds: 0, upperSeconds: 60, count: 9 },
  { bucket: '1-5m', lowerSeconds: 60, upperSeconds: 300, count: 14 },
  { bucket: '5-15m', lowerSeconds: 300, upperSeconds: 900, count: 8 },
  { bucket: '15-60m', lowerSeconds: 900, upperSeconds: 3600, count: 5 },
  { bucket: '1-4h', lowerSeconds: 3600, upperSeconds: 14400, count: 3 },
  { bucket: '4-24h', lowerSeconds: 14400, upperSeconds: 86400, count: 1 },
  { bucket: '1d+', lowerSeconds: 86400, upperSeconds: null, count: 0 },
];
const comment = (id, message, days, name, owner = false) => ({ id, message, createdTime: ago(days), from: { id: `u_${id}`, name, isOwner: owner }, replies: [] });
const ad = (id, name, metrics, status = 'active') => ({
  _id: id, platformAdId: `9${id}`, platform: 'facebook', platformAdAccountId: 'act_demo_harbour', name, status, currency: 'USD',
  metrics: { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, purchaseValue: 0, ...metrics },
});

const harbourPosts = [
  analyticsPost('hp1', 'instagram', 'carousel', '5 signs it is time for a check-up', 3, { impressions: 9800, reach: 7200, likes: 640, comments: 58, shares: 41, saves: 120, engagementRate: 8.8 }),
  analyticsPost('hp2', 'instagram', 'video', 'Meet Dr. Ana: a day at the clinic', 8, { impressions: 12400, reach: 9100, views: 8800, likes: 710, comments: 64, shares: 52, engagementRate: 6.7 }),
  analyticsPost('hp3', 'facebook', 'image', 'Saturday appointments are back', 12, { impressions: 6100, reach: 4300, likes: 220, comments: 31, shares: 18, clicks: 140, engagementRate: 4.4 }),
  analyticsPost('hp4', 'linkedin', 'text', 'We are hiring a dental hygienist', 17, { impressions: 3900, reach: 2600, likes: 96, comments: 12, shares: 9, clicks: 210, engagementRate: 3.0 }),
  analyticsPost('hp5', 'facebook', 'video', 'How we keep every visit pain-free', 22, { impressions: 7400, reach: 5100, views: 5200, likes: 300, comments: 27, shares: 22, engagementRate: 4.7 }),
];

const seed = {
  pageSize: 20,
  accounts,
  conversations,
  messages,
  report: {
    [H]: {
      windowStart: from30,
      adAccountId: 'act_demo_harbour',
      dashboard: { ...dashboard(1, [{ accountId: 'h_ig', platform: 'instagram', current: 4820, gained: 312 }, { accountId: 'h_fb', platform: 'facebook', current: 2210, gained: 64 }, { accountId: 'h_li', platform: 'linkedin', current: 890, gained: 41 }]), topPosts: harbourPosts.slice(0, 3).map((p) => ({ postId: p._id, platform: p.platform, publishedAt: p.publishedAt, content: p.content, metrics: p.analytics })) },
      posts: harbourPosts,
      breakdown: [
        { platform: 'instagram', postCount: 14, impressions: 31200, reach: 22100, likes: 1650, comments: 210, shares: 120, saves: 210, clicks: 300, views: 15800 },
        { platform: 'facebook', postCount: 9, impressions: 13100, reach: 7900, likes: 390, comments: 80, shares: 58, saves: 20, clicks: 395, views: 6800 },
        { platform: 'linkedin', postCount: 4, impressions: 3900, reach: 1900, likes: 100, comments: 22, shares: 10, saves: 10, clicks: 210, views: 0 },
      ],
      ads: [
        ad('d1', 'New patient offer: free whitening consult', { impressions: 41000, reach: 26000, clicks: 1240, spend: 612.4, conversions: 38 }),
        ad('d2', 'Saturday appointments', { impressions: 18500, reach: 12100, clicks: 410, spend: 210, conversions: 11 }),
        ad('d3', 'Invisalign explainer video', { impressions: 9000, reach: 7000, clicks: 150, spend: 95.5, conversions: 2 }, 'paused'),
      ],
      responseTime: { summary: { sampleSize: 40, medianSeconds: 260, p90Seconds: 5400, fastestSeconds: 12, slowestSeconds: 61000 }, histogram },
      volume: { summary: { received: 96, sent: 71, read: 88, uniqueConversations: 44 }, byPlatform: [{ platform: 'instagram', received: 70, sent: 52 }, { platform: 'facebook', received: 26, sent: 19 }] },
      commentPosts: [
        { id: 'hp1', platform: 'instagram', accountId: 'h_ig', createdTime: ago(3), commentCount: 4 },
        { id: 'hp3', platform: 'facebook', accountId: 'h_fb', createdTime: ago(12), commentCount: 3 },
      ],
      comments: {
        hp1: [
          comment('k1', 'Love this, so helpful!', 2, 'Maya R.'),
          comment('k2', 'Best dentist in town, the team is amazing', 2, 'Sam T.'),
          comment('k3', 'Thank you Maya, glad it helped!', 1, 'Harbour Dental', true),
          comment('k4', 'Waited 40 minutes last time, really frustrating', 3, 'Jo L.'),
        ],
        hp3: [
          comment('k5', 'Finally! Saturdays are perfect for us', 11, 'Priya N.'),
          comment('k6', 'Do you take new patients?', 10, 'Alex D.'),
          comment('k7', 'Great news, thanks', 10, 'Chris M.'),
        ],
      },
    },
    [B]: {
      windowStart: from30,
      dashboard: dashboard(0.4, [{ accountId: 'b_ig', platform: 'instagram', current: 2950, gained: 188 }, { accountId: 'b_tt', platform: 'tiktok', current: 6100, gained: 940 }]),
      posts: [
        analyticsPost('bp1', 'tiktok', 'video', '4 a.m. at the bakery', 2, { views: 41000, likes: 3900, comments: 210, shares: 380, engagementRate: 10.9 }),
        analyticsPost('bp2', 'instagram', 'image', 'Sourdough Saturday is back', 6, { impressions: 5200, reach: 3900, likes: 410, comments: 36, saves: 80, engagementRate: 8.7 }),
      ],
      breakdown: [
        { platform: 'tiktok', postCount: 11, impressions: 0, reach: 0, likes: 8200, comments: 420, shares: 900, saves: 0, clicks: 0, views: 96000 },
        { platform: 'instagram', postCount: 8, impressions: 21000, reach: 15200, likes: 1600, comments: 140, shares: 60, saves: 300, clicks: 120, views: 4000 },
      ],
      responseTime: { summary: { sampleSize: 12, medianSeconds: 1500, p90Seconds: 14000 }, histogram },
      volume: { summary: { received: 30, sent: 18, uniqueConversations: 14 }, byPlatform: [{ platform: 'instagram', received: 30, sent: 18 }] },
    },
    [S]: { windowStart: from30, dashboard: dashboard(0.2, [{ accountId: 's_ig', platform: 'instagram', current: 1200, gained: 35 }]) },
  },
};

// The queue and the calendar (GET /posts), best time and the composer: routes the test fixture leaves out.
const queue = [
  { _id: 'q_h1', profileId: H, status: 'scheduled', content: 'Back-to-school check-ups: book before the rush', scheduledFor: ahead(2, 9), platforms: [{ platform: 'instagram', status: 'scheduled' }, { platform: 'facebook', status: 'scheduled' }] },
  { _id: 'q_h2', profileId: H, status: 'scheduled', content: 'Ask the dentist: your questions, answered live', scheduledFor: ahead(5, 18), platforms: [{ platform: 'instagram', status: 'scheduled' }] },
  { _id: 'q_h3', profileId: H, status: 'failed', content: 'Team photo day', scheduledFor: ago(1, 12), platforms: [{ platform: 'linkedin', status: 'failed', error: 'Image too large for LinkedIn' }] },
  { _id: 'q_h4', profileId: H, status: 'draft', content: 'Halloween candy: what to know (draft)', platforms: [{ platform: 'instagram', status: 'draft' }] },
  ...harbourPosts.map((p) => ({ _id: `q_${p._id}`, profileId: H, status: 'published', content: p.content, publishedAt: p.publishedAt, platforms: [{ platform: p.platform, status: 'published' }] })),
  { _id: 'q_b1', profileId: B, status: 'scheduled', content: 'Pumpkin loaf drops Friday', scheduledFor: ahead(3, 7), platforms: [{ platform: 'tiktok', status: 'scheduled' }, { platform: 'instagram', status: 'scheduled' }] },
  { _id: 'q_b2', profileId: B, status: 'published', content: '4 a.m. at the bakery', publishedAt: ago(2), platforms: [{ platform: 'tiktok', status: 'published' }] },
];
const bestTimeSlots = [
  { day_of_week: 2, hour: 18, avg_engagement: 9.4, post_count: 6 },
  { day_of_week: 4, hour: 12, avg_engagement: 8.1, post_count: 5 },
  { day_of_week: 6, hour: 10, avg_engagement: 7.6, post_count: 4 },
  { day_of_week: 0, hour: 19, avg_engagement: 6.2, post_count: 3 },
];
const dailyData = Array.from({ length: 35 }, (_, i) => ({ date: date(Date.now() - (34 - i) * DAY), postCount: [1, 0, 2, 1, 0, 1, 1][i % 7] }));

const fake = fakeZernio(seed);
const fakeBase = await fake.listen();

const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const front = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://demo');
  const p = url.pathname.replace(/^\/api\/v1/, '');
  const profileId = url.searchParams.get('profileId');
  const body = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });

  if (req.method === 'GET' && p === '/posts') {
    const fromD = url.searchParams.get('dateFrom');
    const toD = url.searchParams.get('dateTo');
    const list = queue.filter((x) => x.profileId === profileId).filter((x) => {
      const when = (x.publishedAt || x.scheduledFor || '').slice(0, 10);
      return !fromD || (when && when >= fromD && when <= toD);
    });
    return send(res, 200, { posts: list, pagination: { total: list.length } });
  }
  if (req.method === 'GET' && p === '/analytics/best-time') return send(res, 200, { slots: profileId === H ? bestTimeSlots : [] });
  if (req.method === 'GET' && p === '/analytics/daily-metrics') {
    const bd = seed.report[profileId]?.breakdown ?? [];
    return send(res, 200, { dailyData: bd.length ? dailyData : [], platformBreakdown: bd });
  }
  if (req.method === 'POST' && p === '/tools/validate/post') return send(res, 200, { valid: true, errors: [], warnings: [] });
  if (req.method === 'POST' && p === '/posts') {
    const b = JSON.parse(body || '{}');
    const post = { _id: `q_new${queue.length}`, profileId: b.profileId ?? profileId, status: b.scheduledFor ? 'scheduled' : 'published', content: b.content, scheduledFor: b.scheduledFor, publishedAt: b.scheduledFor ? undefined : iso(Date.now()), platforms: (b.platforms ?? []).map((t) => ({ platform: t.platform, status: b.scheduledFor ? 'scheduled' : 'published' })) };
    queue.unshift(post);
    return send(res, 201, { post });
  }
  if (req.method === 'POST' && p === '/profiles') return send(res, 400, { error: 'Demo mode: add real clients with your own Zernio key (see README).' });
  if (p.startsWith('/connect')) return send(res, 400, { error: 'Demo mode: connecting accounts needs your own Zernio key (see README).' });

  // Everything else goes to the test fixture API.
  const r = await fetch(fakeBase + p + url.search, { method: req.method, headers: { authorization: req.headers.authorization || '', 'content-type': 'application/json', ...(req.headers['idempotency-key'] ? { 'idempotency-key': req.headers['idempotency-key'] } : {}) }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  res.writeHead(r.status, { 'content-type': 'application/json' });
  res.end(await r.text());
});
await new Promise((r) => front.listen(0, '127.0.0.1', r));

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';
const dir = mkdtempSync(join(tmpdir(), 'white-label-demo-'));
writeFileSync(join(dir, 'clients.json'), JSON.stringify(CLIENTS, null, 2));
Object.assign(process.env, {
  ZERNIO_API_BASE: `http://127.0.0.1:${front.address().port}/api/v1`,
  ZERNIO_API_KEY: 'test-key',
  CLIENTS_FILE: join(dir, 'clients.json'),
  INBOX_DB: ':memory:',
  BASE_URL: `http://${HOST}:${PORT}`,
  WEBHOOK_SECRET: 'demo-secret-demo-secret-demo-secret',
  DEMO_MODE: '1',
});
const { default: app } = await import('../server.js');
app.listen(PORT, HOST, () => console.log(`Demo (made-up data, no Zernio calls) → http://${HOST}:${PORT}`));
