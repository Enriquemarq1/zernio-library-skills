// Client report data: four live reads scoped to one workspace and one window. No database.
// Every loader runs inside the workspace context (workspace.js), so the workspace's own key and
// platform list apply. Results are cached in memory for 10 minutes, the same as the API's own cache.
import { analyticsDashboard, dailyMetrics, analyticsPosts, listAccounts, listAds, inboxResponseTime, inboxVolume, listCommentPosts, postComments, adComments } from '../zernio.js';
import { current, allows } from '../workspace.js';
import { scoreComment, worthALook, nameTokensOf } from './sentiment.js';

const DAY = 864e5;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

// Last 30 or 90 UTC days including today, and the same number of days just before it.
export function period(days, now = Date.now()) {
  const d = Number(days) === 90 ? 90 : 30;
  const n = new Date(now);
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const from = today - (d - 1) * DAY;
  const prevTo = from - DAY;
  return { days: d, from: isoDay(from), to: isoDay(today), prevFrom: isoDay(prevTo - (d - 1) * DAY), prevTo: isoDay(prevTo) };
}

const TTL = 10 * 60 * 1000;
const cache = new Map();
function cached(key, fn, { staleMs = 0 } = {}) {
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < TTL) return hit.p;
  // Past 10 minutes, a loader with staleMs serves its last result at once and reads a fresh one in the
  // background (comments: the upstream listing can take a minute when its own cache is cold).
  if (hit && hit.done && age < staleMs) {
    if (!hit.refreshing) {
      hit.refreshing = true;
      const p = fn();
      p.then((value) => cache.set(key, { at: Date.now(), p, done: true }), () => { hit.refreshing = false; });
    }
    return hit.p;
  }
  const entry = { at: Date.now(), p: fn(), done: false };
  cache.set(key, entry);
  entry.p.then(() => { entry.done = true; }, () => { if (cache.get(key) === entry) cache.delete(key); });
  return entry.p;
}
export const _clearReportCache = () => cache.clear();

const scopeKey = (client, p, part) =>
  [part, client.profileId, (current().platforms || []).join(','), client.adAccountId || '', p.from, p.to].join('|');
// The API's platform filter takes one platform.
const onePlatform = () => (current().platforms?.length === 1 ? current().platforms[0] : undefined);

/* ------------------------------------------------------------------ organic */
const METRIC_KEYS = ['likes', 'comments', 'shares', 'saves', 'clicks', 'views', 'impressions', 'reach'];
const FORMAT_ORDER = ['text', 'carousel', 'image', 'video'];

// One post's title for the table: the brand's own words, first line only. Mentions and links stay as written.
const titleOf = (x) => String(x.title || x.content || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean)?.slice(0, 140) || '';

// Per platform, from the daily-metrics breakdown for the same window (the Analytics tab reads the same call).
function platformRows(daily, platforms) {
  if (!daily) return null;
  return (daily.platformBreakdown || [])
    .filter((b) => allows(platforms, b.platform))
    .filter((b) => b.postCount || METRIC_KEYS.some((k) => Number(b[k]) > 0))
    .map((b) => ({ platform: b.platform, posts: Number(b.postCount) || 0, ...Object.fromEntries(METRIC_KEYS.map((k) => [k, Number(b[k]) || 0])) }))
    .sort((a, b) => b.posts - a.posts || (b.views + b.impressions) - (a.views + a.impressions));
}

// The window's organic posts ranked by how much they were seen (views + impressions), then by engagements.
function topRows(list) {
  const seen = (m) => (Number(m.views) || 0) + (Number(m.impressions) || 0);
  const eng = (m) => (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.shares) || 0) + (Number(m.saves) || 0);
  return list
    .map((x) => ({ x, m: x.analytics || {} }))
    .sort((a, b) => seen(b.m) - seen(a.m) || eng(b.m) - eng(a.m))
    .slice(0, 5)
    .map(({ x, m }) => ({
      platform: x.platform || x.platforms?.[0]?.platform,
      title: titleOf(x),
      publishedAt: x.publishedAt || x.scheduledFor || null,
      mediaType: x.mediaType || null,
      metrics: { ...Object.fromEntries([...METRIC_KEYS, 'follows'].map((k) => [k, m[k] ?? null])) },
      engagementRate: m.engagementRate ?? null,
    }));
}

// Average engagement rate per media type, against the average of every post in the window.
function formatRows(list) {
  const typed = list.filter((x) => x.mediaType);
  if (!typed.length) return { rows: [], avg: null, posts: 0 };
  const er = (x) => Number(x.analytics?.engagementRate) || 0;
  const avg = typed.reduce((n, x) => n + er(x), 0) / typed.length;
  const groups = new Map();
  for (const x of typed) {
    const k = String(x.mediaType).toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const rows = [...groups.entries()]
    .map(([type, xs]) => ({ type, posts: xs.length, er: xs.reduce((n, x) => n + er(x), 0) / xs.length }))
    .sort((a, b) => b.er - a.er || b.posts - a.posts || FORMAT_ORDER.indexOf(a.type) - FORMAT_ORDER.indexOf(b.type));
  return { rows, avg, posts: typed.length };
}

export const loadOrganic = (client, p) =>
  cached(scopeKey(client, p, 'organic'), async () => {
    const platforms = current().platforms;
    const [d, accts, daily, list] = await Promise.all([
      analyticsDashboard({ profileId: client.profileId, fromDate: p.from, toDate: p.to, platform: onePlatform() }),
      listAccounts(client.profileId).catch(() => []),
      // Both tables are additions: if either read fails, the section still renders without it.
      dailyMetrics(client.profileId, p.days, { fromDate: p.from, toDate: p.to }).catch(() => null),
      analyticsPosts({ profileId: client.profileId, fromDate: p.from, toDate: p.to }).catch(() => null),
    ]);
    const organicPosts = list ? list.posts.filter((x) => !x.isAd && allows(platforms, x.platform)) : null;
    const handle = (id) => {
      const a = accts.find((x) => x._id === id);
      return a ? a.username || a.displayName || null : null;
    };
    return {
      totals: d.totals || {},
      prev: d.previousTotals || null,
      followers: d.followers || {},
      prevFollowers: d.previousFollowers || null,
      byAccount: (d.followers?.byAccount || [])
        .filter((a) => allows(platforms, a.platform))
        .map((a) => ({ platform: a.platform, current: a.current, gained: a.gained, handle: handle(a.accountId) }))
        .sort((a, b) => (b.current || 0) - (a.current || 0)),
      daily: d.daily || [],
      topPosts: (d.topPosts || []).filter((x) => allows(platforms, x.platform)).slice(0, 3),
      platforms: platformRows(daily, platforms),
      top: organicPosts ? topRows(organicPosts) : null,
      formats: organicPosts ? formatRows(organicPosts) : null,
      postsTruncated: !!list?.truncated,
      dataAsOf: d.dataAsOf || null,
    };
  });

/* --------------------------------------------------------------------- paid */
const sumAds = (ads) => {
  const s = { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, purchaseValue: 0 };
  for (const a of ads) for (const k of Object.keys(s)) s[k] += Number(a.metrics?.[k]) || 0;
  s.ctr = s.impressions ? (s.clicks / s.impressions) * 100 : null;
  s.cpc = s.clicks ? s.spend / s.clicks : null;
  s.cpm = s.impressions ? (s.spend / s.impressions) * 1000 : null;
  s.costPerResult = s.conversions ? s.spend / s.conversions : null;
  s.roas = s.spend && s.purchaseValue ? s.purchaseValue / s.spend : null;
  return s;
};

export const loadPaid = (client, p) =>
  cached(scopeKey(client, p, 'paid'), async () => {
    const platforms = current().platforms;
    const pin = client.adAccountId || undefined;
    // Without a pinned ad account, keep the workspace's platforms only (Meta ads report as "facebook").
    const keep = (ads) => (pin ? ads : ads.filter((a) => allows(platforms, a.platform)));
    const [cur, prev] = await Promise.all([
      listAds({ profileId: client.profileId, adAccountId: pin, fromDate: p.from, toDate: p.to }),
      listAds({ profileId: client.profileId, adAccountId: pin, fromDate: p.prevFrom, toDate: p.prevTo }).catch(() => null),
    ]);
    const ads = keep(cur.ads);
    const delivered = ads.filter((a) => (Number(a.metrics?.impressions) || 0) > 0);
    const currencies = [...new Set(ads.map((a) => a.currency).filter(Boolean))];
    const ids = new Set();
    for (const a of ads) {
      for (const v of [a._id, a.platformAdId, a.creative?.effectiveObjectStoryId, a.creative?.effectiveInstagramMediaId]) if (v) ids.add(String(v));
    }
    return {
      backfillPending: cur.backfillPending,
      count: ads.length,
      delivered: delivered.length,
      active: ads.filter((a) => a.status === 'active').length,
      sum: sumAds(ads),
      prevSum: prev ? sumAds(keep(prev.ads)) : null,
      currency: currencies.length === 1 ? currencies[0] : null,
      currencies,
      top: delivered
        .filter((a) => (Number(a.metrics?.clicks) || 0) > 0)
        .sort((a, b) => b.metrics.clicks - a.metrics.clicks)
        .slice(0, 3)
        .map((a) => ({
          name: a.name || a.campaignName || 'Untitled ad',
          status: a.status || 'unknown',
          clicks: Number(a.metrics.clicks) || 0,
          impressions: Number(a.metrics.impressions) || 0,
          ctr: a.metrics.impressions ? (a.metrics.clicks / a.metrics.impressions) * 100 : null,
          spend: Number(a.metrics.spend) || 0,
          currency: a.currency || null,
        })),
      adIds: [...ids],
    };
  });

/* ---------------------------------------------------------------- community */
export const loadCommunity = (client, p) =>
  cached(scopeKey(client, p, 'community'), async () => {
    const platforms = current().platforms;
    const base = { profileId: client.profileId, platform: onePlatform() };
    const [rt, vol, rtPrev] = await Promise.all([
      inboxResponseTime({ ...base, fromDate: p.from, toDate: p.to }),
      inboxVolume({ ...base, fromDate: p.from, toDate: p.to }),
      inboxResponseTime({ ...base, fromDate: p.prevFrom, toDate: p.prevTo }).catch(() => null),
    ]);
    return {
      summary: rt.summary || {},
      histogram: rt.histogram || [],
      prev: rtPrev?.summary || null,
      volume: vol.summary || {},
      byPlatform: (vol.byPlatform || []).filter((x) => allows(platforms, x.platform)),
    };
  });

/* ---------------------------------------------------------------- sentiment */
const MAX_THREADS = 80;
const POOL = 6;

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

// Reads comments on the client's posts AND ads (an ad is the client's post too), keeps the ones written
// inside the window by someone other than the brand, and keeps ONLY counts and three words. Comment text
// and names are used in memory to score, then dropped: nothing about who said what is returned or cached.
export const loadSentiment = (client, p) =>
  cached(scopeKey(client, p, 'sentiment'), async () => {
    const platforms = current().platforms;
    const { posts, truncated } = await listCommentPosts({ profileId: client.profileId });
    let rows = posts.filter((r) => allows(platforms, r.isAd ? r.placement || r.platform : r.platform));
    if (client.adAccountId) {
      // Pinned ad account: only comments on that account's ads.
      const paid = await loadPaid(client, p).catch(() => null);
      const ids = new Set(paid?.adIds || []);
      rows = rows.filter((r) => !r.isAd || ids.has(String(r.adId)) || ids.has(String(r.id)));
    }
    rows.sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
    const capped = rows.length > MAX_THREADS;
    rows = rows.slice(0, MAX_THREADS);

    const fromT = Date.parse(`${p.from}T00:00:00Z`);
    const toT = Date.parse(`${p.to}T00:00:00Z`) + DAY;
    const counts = { positive: 0, neutral: 0, negative: 0 };
    const source = { posts: 0, ads: 0 };
    const negative = [];
    const names = [];
    let failed = 0;

    const threads = await pool(rows, POOL, (r) =>
      (r.isAd ? adComments(r.adId || r.id, r.placement || undefined) : postComments(r.id, r.accountId))
        .then((list) => ({ r, list }), () => { failed += 1; return { r, list: [] }; }));

    for (const { r, list } of threads) {
      const all = list.flatMap((c) => [c, ...(Array.isArray(c.replies) ? c.replies : [])]);
      for (const c of all) {
        if (c.from?.isOwner) continue; // the brand's own replies
        const t = Date.parse(c.createdTime || '');
        if (!(t >= fromT && t < toT)) continue;
        const text = String(c.message || '').trim();
        if (!text) continue;
        const label = scoreComment(text);
        counts[label] += 1;
        source[r.isAd ? 'ads' : 'posts'] += 1;
        if (c.from?.name) names.push(c.from.name);
        if (label === 'negative') negative.push(text);
      }
    }
    const total = counts.positive + counts.neutral + counts.negative;
    return {
      readAt: new Date().toISOString(),
      counts,
      total,
      source,
      threads: rows.length,
      failed,
      partial: truncated || capped,
      words: worthALook(negative, nameTokensOf(names)),
    };
  }, { staleMs: 2 * 60 * 60 * 1000 });
