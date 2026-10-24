// Client report tests — FIXTURES ONLY (tests/fake-zernio.mjs). Never the real API.
//   npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeZernio } from './fake-zernio.mjs';
import { period } from '../report/data.js';
import { humanDuration } from '../report/views.js';

const P1 = 'p1_harbour';   // portal key, no limits, ads by profile
const P2 = 'p2_keyed';     // own key file, facebook only, pinned ad account
const P3 = 'p3_syncing';   // 202 backfill with some ads
const P4 = 'p4_noads';     // no ads at all
const P5 = 'p5_syncnone';  // 202 backfill, nothing synced yet
const P6 = 'p6_badkey';    // key file that does not exist: must fail closed
const P7 = 'p7_nolist';    // dashboard only: the post list and breakdown can't be read (fallback top posts)
const WS_KEY = 'ws-key-fixture-123';

const dir = mkdtempSync(join(tmpdir(), 'report-test-'));
const KEY_FILE = join(dir, 'workspace-key.env');
const MISSING_KEY_FILE = join(dir, 'nope', 'missing.env');
writeFileSync(KEY_FILE, `ZERNIO_API_KEY=${WS_KEY}\n`);

const p30 = period(30);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().replace('Z', '+0000').replace(/\.\d{3}/, '');
const dash = (over = {}) => ({
  dateRange: { fromDate: p30.from, toDate: p30.to },
  totals: { impressions: 2000, reach: 1200, likes: 40, comments: 6, shares: 2, saves: 1, clicks: 25, views: 800, engagementRate: 1.85 },
  previousTotals: { impressions: 1000, reach: 700, likes: 20, comments: 3, shares: 1, saves: 0, clicks: 10, views: 400, engagementRate: 1.5 },
  followers: { current: 1289, gained: 207, byAccount: [{ accountId: 'fb1', platform: 'facebook', current: 1289, gained: 207 }] },
  previousFollowers: { current: 1081, gained: 126 },
  daily: Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.parse(p30.from) + i * 864e5).toISOString().slice(0, 10), impressions: 60 + i, reach: 40, engagement: i % 5, views: 20, followersGained: 1 })),
  topPosts: [
    { postId: 'tp1', platform: 'facebook', publishedAt: daysAgo(5), metrics: { impressions: 223, reach: 84, views: 0, likes: 3, engagementRate: 0.45 } },
    { postId: 'tp2', platform: 'facebook', publishedAt: daysAgo(9), metrics: { impressions: 180, views: 90, likes: 2, engagementRate: 0.3 } },
  ],
  dataAsOf: new Date().toISOString(),
  ...over,
});
const ad = (id, account, metrics, over = {}) => ({
  _id: id, platformAdId: `9${id}`, platform: 'facebook', platformAdAccountId: account, name: `Fixture ad ${id}`, status: 'active', currency: 'EUR',
  metrics: { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, purchaseValue: 0, ...metrics }, ...over,
});
const histogram = [
  { bucket: '0-1m', lowerSeconds: 0, upperSeconds: 60, count: 2 },
  { bucket: '1-5m', lowerSeconds: 60, upperSeconds: 300, count: 1 },
  { bucket: '5-15m', lowerSeconds: 300, upperSeconds: 900, count: 1 },
  { bucket: '15-60m', lowerSeconds: 900, upperSeconds: 3600, count: 0 },
  { bucket: '1-4h', lowerSeconds: 3600, upperSeconds: 14400, count: 1 },
  { bucket: '4-24h', lowerSeconds: 14400, upperSeconds: 86400, count: 0 },
  { bucket: '1d+', lowerSeconds: 86400, upperSeconds: null, count: 0 },
];
const post = (id, platform, mediaType, analytics, content, over = {}) => ({
  _id: id, platform, mediaType, content, publishedAt: daysAgo(3), status: 'published', isAd: false,
  platforms: [{ platform, status: 'published' }],
  analytics: { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, follows: null, engagementRate: 0, ...analytics },
  ...over,
});
const cmt = (id, message, when, name, owner = false) => ({ id, message, createdTime: when, from: { id: `u_${id}`, name, isOwner: owner }, replies: [] });

const seed = {
  keys: [WS_KEY],
  profileKeys: { [P2]: WS_KEY },
  accounts: [
    { _id: 'fb1', platform: 'facebook', username: 'harbour_fb', profileId: P1 },
    { _id: 'fb2', platform: 'facebook', username: 'keyed_fb', profileId: P2 },
    { _id: 'tw2', platform: 'twitter', username: 'keyed_test_twitter', profileId: P2 },
    { _id: 'ph2', platform: 'phone', username: '+1 555 0199', profileId: P2 },
    { _id: 'ma2', platform: 'metaads', username: 'keyed_ads', profileId: P2 },
  ],
  conversations: [
    { id: 'k1', accountId: 'fb2', platform: 'facebook', participantName: 'FB fixture person', lastMessage: 'hello', updatedTime: daysAgo(1), unreadCount: 0 },
    { id: 'k2', accountId: 'ph2', platform: 'sms', participantName: 'SMS fixture person', lastMessage: 'sms text', updatedTime: daysAgo(1), unreadCount: 1 },
  ],
  report: {
    [P1]: {
      windowStart: p30.from,
      dashboard: dash(),
      // Formats: image 5.0, text 3.0, video (1.2 + 0.8) / 2 = 1.0; average of the four posts 2.5. The ad is left out.
      posts: [
        post('pA', 'facebook', 'image', { impressions: 500, reach: 300, likes: 20, comments: 3, shares: 2, clicks: 4, engagementRate: 5 }, 'Spring cleaning special\nsecond line of the post'),
        post('pB', 'facebook', 'video', { impressions: 900, reach: 500, views: 400, likes: 10, comments: 1, engagementRate: 1.2 }, 'Behind the chair: a full clean'),
        post('pC', 'facebook', 'text', { impressions: 100, likes: 3, engagementRate: 3 }, 'Open on Saturday'),
        post('pE', 'youtube', 'video', { views: 236, likes: 7, comments: 5, engagementRate: 0.8 }, 'Clinic tour'),
        post('pAd', 'facebook', 'image', { impressions: 50, likes: 25, engagementRate: 50 }, 'Boosted fixture ad copy', { isAd: true }),
      ],
      breakdown: [
        { platform: 'facebook', postCount: 3, impressions: 1500, reach: 800, likes: 35, comments: 4, shares: 2, saves: 0, clicks: 4, views: 700 },
        { platform: 'youtube', postCount: 1, impressions: 0, reach: 0, likes: 7, comments: 5, shares: 0, saves: 0, clicks: 0, views: 236 },
      ],
      ads: [
        ad('a1', 'act_h', { impressions: 10000, reach: 6000, clicks: 300, spend: 123.45, conversions: 5 }),
        ad('a2', 'act_h', { impressions: 5000, reach: 3000, clicks: 100, spend: 50, conversions: 0 }, { status: 'paused' }),
        ad('a3', 'act_h', { impressions: 0, clicks: 0 }, { status: 'cancelled' }),
      ],
      responseTime: { summary: { sampleSize: 5, medianSeconds: 180, p90Seconds: 4000 }, histogram },
      volume: { summary: { received: 12, sent: 7, read: 4, uniqueConversations: 5 }, byPlatform: [{ platform: 'facebook', received: 12, sent: 7 }] },
      commentPosts: [
        { id: 'post1', platform: 'facebook', accountId: 'fb1', createdTime: daysAgo(3), commentCount: 5 },
        { id: 'post2', platform: 'facebook', accountId: 'fb1', createdTime: daysAgo(20), commentCount: 2 },
        { id: 'adrow1', platform: 'facebook', placement: 'facebook', isAd: true, adId: 'a1', accountId: 'ma1', createdTime: daysAgo(2), commentCount: 1 },
      ],
      comments: {
        post1: [
          cmt('c1', 'Love this, great work', daysAgo(2), 'Ada Fixture'),
          cmt('c2', 'This is terrible and slow, really disappointed', daysAgo(2), 'Ben Fixture'),
          cmt('c3', 'Thanks so much, glad you love it', daysAgo(1), 'Harbour Dental', true),
          cmt('c4', 'awful awful awful', daysAgo(200), 'Old Fixture'),
          cmt('c5', 'quentin here, awful slow service. Ask the Paris office', daysAgo(4), 'Quentin Fixture'),
        ],
        post2: [
          cmt('c6', 'What time does the store open?', daysAgo(6), 'Cy Fixture'),
          cmt('c7', 'Shipping was slow and the app is broken', daysAgo(7), 'Dee Fixture'),
        ],
      },
      adComments: { a1: [cmt('c8', 'Bad price, slow delivery', daysAgo(1), 'Eve Fixture')] },
    },
    [P2]: {
      windowStart: p30.from,
      adAccountId: 'act_2',
      dashboard: dash({ followers: { current: 50, gained: 5, byAccount: [{ accountId: 'fb2', platform: 'facebook', current: 50, gained: 5 }] } }),
      posts: [
        post('kA', 'facebook', 'image', { impressions: 300, likes: 1, engagementRate: 0.33 }, 'Keyed facebook post'),
        post('kT', 'twitter', 'text', { impressions: 170, clicks: 9, engagementRate: 2 }, 'keyed tweet text'),
      ],
      breakdown: [
        { platform: 'facebook', postCount: 3, impressions: 307, reach: 120, likes: 1, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0 },
        { platform: 'twitter', postCount: 8, impressions: 174, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 9, views: 38 },
      ],
      ads: [ad('b1', 'act_2', { impressions: 4000, reach: 2000, clicks: 80, spend: 20 })],
      responseTime: { summary: { sampleSize: 4, medianSeconds: 5400 }, histogram },
      volume: { summary: { received: 7, sent: 4, uniqueConversations: 4 }, byPlatform: [{ platform: 'facebook', received: 7, sent: 4 }] },
      commentPosts: [
        { id: 'k_post', platform: 'facebook', accountId: 'fb2', createdTime: daysAgo(3), commentCount: 1 },
        { id: 'k_ig', platform: 'instagram', accountId: 'ig2', createdTime: daysAgo(3), commentCount: 1 },
        { id: 'k_adrow_other', platform: 'facebook', placement: 'facebook', isAd: true, adId: 'zz_other_account', createdTime: daysAgo(2), commentCount: 1 },
      ],
      comments: {
        k_post: [cmt('k1', 'Love it', daysAgo(1), 'Fixture One')],
        k_ig: [cmt('k2', 'great great great', daysAgo(1), 'Fixture Two')],
      },
      adComments: { zz_other_account: [cmt('k3', 'great product', daysAgo(1), 'Fixture Three')] },
    },
    [P3]: { windowStart: p30.from, adsMode: 'backfill', ads: [ad('s1', 'act_s', { impressions: 900, clicks: 9 })] },
    [P4]: { windowStart: p30.from, ads: [] },
    [P5]: { windowStart: p30.from, adsMode: 'backfill', ads: [] },
    [P7]: { windowStart: p30.from, dashboard: dash(), ads: [] },
  },
};

const fake = fakeZernio(seed);
let base, server;
const CLIENTS = [
  { name: 'Harbour Dental', profileId: P1 },
  { name: 'Keyed Fixture Co', profileId: P2, keyFile: KEY_FILE, platforms: ['facebook'], adAccountId: 'act_2' },
  { name: 'Syncing Fixture Co', profileId: P3 },
  { name: 'No Ads Fixture Co', profileId: P4 },
  { name: 'Sync None Fixture Co', profileId: P5 },
  { name: 'Bad Key Fixture Co', profileId: P6, keyFile: MISSING_KEY_FILE },
  { name: 'No List Fixture Co', profileId: P7 },
];

before(async () => {
  const api = await fake.listen();
  writeFileSync(join(dir, 'clients.json'), JSON.stringify(CLIENTS));
  Object.assign(process.env, {
    ZERNIO_API_BASE: api, ZERNIO_API_KEY: 'test-key', CLIENTS_FILE: join(dir, 'clients.json'), INBOX_DB: ':memory:',
    WEBHOOK_SECRET: 'test-secret', BASE_URL: 'http://127.0.0.1:1',
  });
  const mod = await import('../server.js');
  await new Promise((r) => { server = mod.default.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.closeAllConnections?.(); await new Promise((r) => server.close(r)); await fake.close(); });

const page = async (path) => { const r = await fetch(base + path); return { status: r.status, html: await r.text() }; };
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');

/* ------------------------------------------------------------------ stage 0: the tab */
test('report tab: agency brand, client, period, four sections in order, spend off by default', async () => {
  const { status, html } = await page(`/w/${P1}/report`);
  assert.equal(status, 200);
  assert.match(html, /Futuro Social/);
  assert.match(html, /Harbour Dental/);
  assert.match(html, /aria-current="page"[^>]*>Report|>Report</);
  const order = ['id="organic"', 'id="paid"', 'id="community"', 'id="sentiment"'].map((s) => html.indexOf(s));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), 'sections in order Organic, Paid, Community, Sentiment');
  assert.match(html, /Last 30 days/);
  assert.match(html, /Last 90 days/);
  assert.match(html, /\/report\/part\/paid\?days=30"/, 'spend not requested by default');
  assert.doesNotMatch(html, /name="spend" value="1" checked/);
  assert.match(html, /Compared with/);
});

test('report period: 30 and 90 days, each against the period just before it', () => {
  const p = period(90, Date.UTC(2026, 9, 19, 12));
  assert.deepEqual(p, { days: 90, from: '2026-07-22', to: '2026-10-19', prevFrom: '2026-04-23', prevTo: '2026-07-21' });
  assert.equal(period('nonsense').days, 30);
});

/* ------------------------------------------------------------------ stage 1: organic */
test('organic: headline numbers with change, followers by account, daily lines, top posts labelled lifetime', async () => {
  const { status, html } = await page(`/w/${P1}/report/part/organic?days=30`);
  assert.equal(status, 200);
  const t = text(html);
  assert.match(t, /Views \+ impressions 2\.8k/);
  assert.match(t, /\+100% vs previous 30 days/);
  assert.match(t, /Engagement rate 1\.85%/);
  assert.match(t, /\+0\.35 pts/);
  assert.match(t, /Followers gained \+207/);
  assert.match(t, /Current followers 1\.3k/);
  assert.match(t, /@harbour_fb/);
  assert.match(html, /<svg viewBox="0 0 600 120"/);
  assert.match(t, /Top performing posts/);
  assert.match(t, /Lifetime numbers/);
  assert.match(t, /Data as of/);
  const req = fake.state.requests.find((r) => r.path.endsWith('/analytics/dashboard') && r.query.profileId === P1);
  assert.equal(req.query.compare, 'previous_period');
  assert.equal(req.query.fromDate, p30.from);
  assert.equal(req.query.toDate, p30.to);
});

test('organic fallback: when the post list cannot be read, the dashboard top posts show, labelled lifetime', async () => {
  const t = text((await page(`/w/${P7}/report/part/organic?days=30`)).html);
  assert.match(t, /Top posts published in this period/);
  assert.match(t, /Lifetime numbers/);
  assert.match(t, /223 impressions/);
  assert.match(t, /90 views/, 'a post that reports views shows views');
  assert.doesNotMatch(t, /Platform breakdown|Content format breakdown/, 'no empty tables when their read failed');
});

test('organic tables: platform breakdown, top performing posts and content formats, read for the same window', async () => {
  const { html } = await page(`/w/${P1}/report/part/organic?days=30`);
  const t = text(html);
  // Platform breakdown: one row per platform, ER pill, "–" where a platform reports nothing.
  assert.match(t, /Platform breakdown/);
  const table = html.match(/<table aria-label="Platform breakdown">[\s\S]*?<\/table>/)[0];
  assert.equal((table.match(/<tr>/g) || []).length, 3, 'header + Facebook + YouTube');
  assert.match(text(table), /Facebook 3 35 4 2 – 4 700 1\.5k 800 2\.7%/);
  assert.match(table, /er-pill">5\.1%/, 'YouTube: 12 engagements over 236 views');
  assert.match(table, /title="Not reported by YouTube">–/);
  assert.match(table, /<button type="button" class="zsort">/, 'sortable headers');
  // Top performing posts: the brand's own title (first line), date, ranked by views + impressions; no ads.
  assert.match(t, /Top performing posts/);
  assert.ok(html.indexOf('Behind the chair') < html.indexOf('Spring cleaning special'), 'most seen first');
  assert.ok(!html.includes('second line of the post'), 'one line only');
  assert.ok(!html.includes('Boosted fixture ad copy'), 'ads are not organic posts');
  // Content format breakdown: average ER per media type, the best row marked, deltas against the average.
  assert.match(t, /Content format breakdown avg 2\.5%/);
  assert.match(t, /Image Best 1 post · \+100% vs avg/);
  assert.match(t, /Text 1 post · \+20% vs avg/);
  assert.match(t, /Video 2 posts · −60% vs avg/);
  assert.equal((html.match(/class="rk is-best"/g) || []).length, 1);
  for (const path of ['/analytics', '/analytics/daily-metrics']) {
    const r = fake.state.requests.filter((x) => x.path.endsWith(path) && x.query.profileId === P1).at(-1);
    assert.ok(r, `${path} was read`);
    assert.equal(r.query.fromDate, p30.from, path);
    assert.equal(r.query.toDate, p30.to, path);
  }
});

test('organic tables: a facebook-only workspace shows Facebook rows and posts only, filter sent upstream', async () => {
  const { html } = await page(`/w/${P2}/report/part/organic?days=30`);
  const table = html.match(/<table aria-label="Platform breakdown">[\s\S]*?<\/table>/)[0];
  assert.equal((table.match(/<tr>/g) || []).length, 2, 'header + Facebook');
  assert.ok(!html.includes('keyed tweet text'), 'no post from another platform');
  assert.doesNotMatch(text(html), /\bX\b|Twitter/);
  for (const path of ['/analytics', '/analytics/daily-metrics']) {
    const r = fake.state.requests.filter((x) => x.path.endsWith(path) && x.query.profileId === P2).at(-1);
    assert.equal(r.query.platform, 'facebook', path);
  }
});

/* ------------------------------------------------------------------ stage 2: paid */
test('paid: summed metrics beside organic; spend hidden by default and shown when switched on', async () => {
  const off = text((await page(`/w/${P1}/report/part/paid?days=30`)).html);
  assert.match(off, /Ad impressions 15k/);
  assert.match(off, /Ad clicks 400/);
  assert.match(off, /Click-through rate 2\.67%/);
  assert.match(off, /Active ads 1 /);
  assert.match(off, /Organic and paid, side by side/);
  assert.match(off, /Impressions 2,000 15,000/);
  assert.match(off, /Top 3 ads by clicks/);
  assert.match(off, /Fixture ad a1 Best Active · 3% CTR 300/, 'top ads as ranked rows, the winner marked best');
  for (const hidden of [/Spend/, /Cost per click/, /Cost per result/, /Cost per 1,000/, /€/, /123/, /Return on ad spend/])
    assert.doesNotMatch(off, hidden, `spend hidden: ${hidden}`);

  const on = text((await page(`/w/${P1}/report/part/paid?days=30&spend=1`)).html);
  assert.match(on, /Spend €173\.45/);
  assert.match(on, /Cost per click €0\.43/);
  assert.match(on, /Cost per result €34\.69/);
});

test('paid: 202 backfill keeps the ads it returned and says it is still syncing; nothing synced = syncing, never zeros', async () => {
  const partial = text((await page(`/w/${P3}/report/part/paid?days=30`)).html);
  assert.match(partial, /Still syncing/);
  assert.match(partial, /Ad impressions 900/);
  const none = text((await page(`/w/${P5}/report/part/paid?days=30`)).html);
  assert.match(none, /Syncing your ad history/);
  assert.doesNotMatch(none, /Ad impressions/);
  const noAds = text((await page(`/w/${P4}/report/part/paid?days=30`)).html);
  assert.match(noAds, /No ads running in this period/);
});

/* ------------------------------------------------------------------ stage 3: community */
test('community: median in plain words, share within an hour, histogram, by channel, numbers only', async () => {
  const t = text((await page(`/w/${P1}/report/part/community?days=30`)).html);
  assert.match(t, /Median first reply 3 minutes/);
  assert.match(t, /Based on 5 answered conversations/);
  assert.match(t, /Answered within 1 hour 80%/);
  assert.match(t, /4 of 5 answered conversations/);
  for (const label of ['Under 1 min', '1 to 5 min', '5 to 15 min', '15 to 60 min', '1 to 4 h', '4 to 24 h', 'Over a day']) assert.ok(t.includes(label), label);
  assert.match(t, /Messages received 12/);
  assert.match(t, /Response time counts conversations that got an answer/);
  assert.equal(humanDuration(5400), '1 hour 30 minutes');
  assert.equal(humanDuration(44), '44 seconds');
});

/* ------------------------------------------------------------------ stage 4: sentiment */
test('sentiment: counts posts and ads, skips the brand and old comments, shows no names or text', async () => {
  const { html } = await page(`/w/${P1}/report/part/sentiment?days=30`);
  const t = text(html);
  // In window, not the brand: c1 positive; c2, c5, c7, c8 negative; c6 neutral. c3 is the brand; c4 is too old.
  assert.match(t, /Comments read 6/);
  assert.match(t, /5 on posts, 1 on ads/);
  assert.match(t, /Positive 17%/);
  assert.match(t, /Negative 67%/);
  assert.match(t, /Worth a look/);
  assert.match(t, /slow 4×/);
  for (const leak of ['Fixture', 'Ada', 'Quentin', 'quentin', 'Paris', 'Love this', 'terrible and slow', 'glad you love', 'store open'])
    assert.ok(!html.includes(leak), `no names or comment text: ${leak}`);
});

/* ------------------------------------------------------------------ stage 5: client link */
test('client link: agency brand only, no agency navigation, no vendor name in the page or any section', async () => {
  const { status, html } = await page(`/c/${P1}/report`);
  assert.equal(status, 200);
  assert.match(html, /Futuro Social/);
  assert.match(html, /Harbour Dental/);
  assert.match(html, /Prepared by Futuro Social/);
  assert.match(html, /Download PDF/);
  assert.doesNotMatch(html, /class="rail"|All clients|Isolation|Copy client link|Show spend/);
  const pages = [html];
  for (const part of ['organic', 'paid', 'community', 'sentiment']) pages.push((await page(`/c/${P1}/report/part/${part}?days=30`)).html);
  pages.push(readFileSync(new URL('../public/app.css', import.meta.url), 'utf8'));
  for (const h of pages) {
    assert.doesNotMatch(h, /zernio/i);
    assert.doesNotMatch(h, /powered by/i);
  }
});

test('client link: spend only with the agency-signed link; editing the URL cannot reveal it', async () => {
  const agency = (await page(`/w/${P1}/report?days=30&spend=1`)).html;
  const link = agency.match(/data-url="([^"]+\/c\/[^"]+)"/)[1].replace(/&amp;/g, '&');
  assert.match(link, /spend=1&s=/);
  const signed = new URL(link).search;
  assert.match(text((await page(`/c/${P1}/report/part/paid${signed}`)).html), /Spend €173\.45/);
  assert.doesNotMatch(text((await page(`/c/${P1}/report/part/paid?days=30&spend=1`)).html), /Spend|€/);
  assert.doesNotMatch(text((await page(`/c/${P1}/report/part/paid?days=30&spend=1&s=forged`)).html), /Spend|€/);
  const off = (await page(`/w/${P1}/report?days=30`)).html.match(/data-url="([^"]+\/c\/[^"]+)"/)[1];
  assert.doesNotMatch(off, /spend/);
});

test('client link: an unknown report id is a plain branded 404', async () => {
  const { status, html } = await page('/c/not-a-client/report');
  assert.equal(status, 404);
  assert.match(html, /Link not valid/);
  assert.doesNotMatch(html, /zernio/i);
});

/* ------------------------------------------------------------------ workspace key file + platforms */
test('key file: the workspace uses its own key; the key and the file path never reach a page', async () => {
  const before = fake.state.requests.length;
  const pages = [];
  for (const path of [`/w/${P2}/report`, `/w/${P2}/connections`, `/w/${P2}/inbox`, `/c/${P2}/report`, `/c/${P2}/connect`, `/w/${P2}/accounts`])
    pages.push((await page(path)).html);
  for (const part of ['organic', 'paid', 'community', 'sentiment']) {
    const r = await page(`/w/${P2}/report/part/${part}?days=30`);
    assert.equal(r.status, 200, part);
    pages.push(r.html);
  }
  const mine = fake.state.requests.slice(before).filter((r) => r.query.profileId === P2 || r.query.adAccountId === 'act_2');
  assert.ok(mine.length > 5);
  assert.ok(mine.every((r) => r.headers.authorization === `Bearer ${WS_KEY}`), 'every call for the keyed workspace used its own key');
  for (const h of pages) {
    assert.ok(!h.includes(WS_KEY), 'key never rendered');
    assert.ok(!h.includes('workspace-key.env') && !h.includes(dir.replace(/\\/g, '/')) && !h.includes(dir), 'path never rendered');
  }
});

test('platforms: a facebook-only workspace shows no other account, conversation or comment anywhere', async () => {
  for (const path of [`/w/${P2}/connections`, `/w/${P2}/inbox`, `/w/${P2}/accounts`, `/c/${P2}/connect`, `/w/${P2}/content`]) {
    const { html } = await page(path);
    for (const leak of ['keyed_test_twitter', '555 0199', 'SMS fixture person', 'sms text', 'keyed_ads'])
      assert.ok(!html.includes(leak), `${path} leaks ${leak}`);
  }
  const conn = text((await page(`/w/${P2}/connections`)).html);
  assert.match(conn, /keyed_fb/);
  assert.doesNotMatch(conn, /Instagram|TikTok|LinkedIn|Pinterest/, 'platform grid limited to the workspace platforms');
  const dashReq = fake.state.requests.filter((r) => r.path.endsWith('/analytics/dashboard') && r.query.profileId === P2).at(-1);
  assert.equal(dashReq.query.platform, 'facebook');
  const rt = fake.state.requests.filter((r) => r.path.endsWith('/inbox/response-time') && r.query.profileId === P2).at(-1);
  assert.equal(rt.query.platform, 'facebook');
  const ads = fake.state.requests.filter((r) => r.path.endsWith('/ads') && r.query.adAccountId === 'act_2');
  assert.ok(ads.length, 'paid column pinned to the ad account');
  // Instagram comments and comments on another ad account's ads are not this workspace's.
  assert.match(text((await page(`/w/${P2}/report/part/sentiment?days=30`)).html), /Comments read 1 /);
  assert.ok(!fake.state.requests.some((r) => r.path.includes('/ads/zz_other_account/comments')));
});

test('key file: an unreadable key file fails closed, without the path and without falling back to the portal key', async () => {
  const before = fake.state.requests.length;
  const r = await page(`/w/${P6}/report/part/organic?days=30`);
  assert.equal(r.status, 502);
  assert.ok(!r.html.includes('missing.env') && !r.html.includes('nope'));
  assert.equal(fake.state.requests.slice(before).filter((x) => x.query.profileId === P6).length, 0, 'no call made with another key');
  const c = await page(`/c/${P6}/report/part/organic?days=30`);
  assert.match(text(c.html), /Please try again in a minute/);
});

test('read-only: building every report made GET requests only', () => {
  const writes = fake.state.requests.filter((r) => r.method !== 'GET');
  assert.deepEqual(writes, []);
});
