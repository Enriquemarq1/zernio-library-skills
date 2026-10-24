// Read-only probe of the client-report endpoints. GET requests only; prints response SHAPES and numbers,
// never message text, commenter names or the key.
//   node scripts/report-probe.mjs <profileId> [--key-file <path>] [--platform facebook] [--ad-account act_…] [--days 30]
// Without --key-file it uses ZERNIO_API_KEY from the environment (node --env-file=.env …).
import { readKeyFile } from '../keyfile.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const profileId = args[0];
const KEY = opt('--key-file') ? readKeyFile(opt('--key-file')) : process.env.ZERNIO_API_KEY;
const platform = opt('--platform');
const adAccountId = opt('--ad-account');
const days = Number(opt('--days') || 30);
const BASE = process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1';
const day = (d) => d.toISOString().slice(0, 10);
const to = day(new Date(Date.now() - 864e5));
const from = day(new Date(Date.now() - days * 864e5));

const get = async (path) => {
  const t = Date.now();
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
  return { status: res.status, ms: Date.now() - t, body: await res.json().catch(() => ({})) };
};
const keys = (o) => (o && typeof o === 'object' ? Object.keys(o) : o);
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();

console.log('window', from, '→', to, 'platform', platform || 'all');

const dash = await get(`/analytics/dashboard?${qs({ profileId, fromDate: from, toDate: to, compare: 'previous_period', topPosts: 5, platform })}`);
const d = dash.body;
console.log('\nDASHBOARD', dash.status, dash.ms + 'ms', 'keys', keys(d));
console.log(' totals', JSON.stringify(d.totals));
console.log(' previousTotals', JSON.stringify(d.previousTotals));
console.log(' followers keys', keys(d.followers), 'current', d.followers?.current, 'gained', d.followers?.gained);
console.log(' followers.byAccount[0] keys', keys(d.followers?.byAccount?.[0]), 'n', d.followers?.byAccount?.length,
  JSON.stringify((d.followers?.byAccount || []).map((a) => ({ platform: a.platform, current: a.current ?? a.followers, gained: a.gained }))));
console.log(' previousFollowers', JSON.stringify(d.previousFollowers && { ...d.previousFollowers, byAccount: undefined }));
console.log(' daily n', d.daily?.length, 'item keys', keys(d.daily?.[0]), JSON.stringify(d.daily?.[0]));
console.log(' topPosts n', d.topPosts?.length, 'item keys', keys(d.topPosts?.[0]));
console.log(' topPosts[0] metrics', JSON.stringify(d.topPosts?.[0] && { platform: d.topPosts[0].platform, publishedAt: d.topPosts[0].publishedAt, analytics: d.topPosts[0].analytics ?? d.topPosts[0].metrics }));
for (const k of Object.keys(d)) if (!['totals', 'previousTotals', 'followers', 'previousFollowers', 'daily', 'topPosts'].includes(k)) console.log(' ', k, JSON.stringify(d[k])?.slice(0, 300));

const ads = await get(`/ads?${qs({ profileId: adAccountId ? undefined : profileId, adAccountId, source: 'all', fromDate: from, toDate: to })}`);
const list = ads.body.ads ?? ads.body.data ?? [];
console.log('\nADS', ads.status, ads.ms + 'ms', 'keys', keys(ads.body), 'n', list.length);
for (const k of Object.keys(ads.body)) if (!['ads', 'data'].includes(k)) console.log(' ', k, JSON.stringify(ads.body[k])?.slice(0, 300));
if (list[0]) {
  console.log(' ad keys', keys(list[0]));
  console.log(' ad[0] status/currency/platform', list[0].status, list[0].currency, list[0].platform, 'metrics', JSON.stringify(list[0].metrics));
  const statuses = list.reduce((m, a) => ((m[a.status] = (m[a.status] || 0) + 1), m), {});
  console.log(' statuses', JSON.stringify(statuses));
  const sum = (k) => list.reduce((n, a) => n + (Number(a.metrics?.[k]) || 0), 0);
  console.log(' sums impressions', sum('impressions'), 'reach', sum('reach'), 'clicks', sum('clicks'), 'spend present', sum('spend') > 0, 'conversions', sum('conversions'));
  console.log(' adAccountIds', JSON.stringify([...new Set(list.map((a) => a.adAccountId ?? a.platformAdAccountId))]));
}

const rt = await get(`/analytics/inbox/response-time?${qs({ profileId, fromDate: from, toDate: to, platform })}`);
console.log('\nRESPONSE TIME', rt.status, rt.ms + 'ms', 'keys', keys(rt.body));
console.log(' summary', JSON.stringify(rt.body.summary), '\n histogram', JSON.stringify(rt.body.histogram));
for (const k of Object.keys(rt.body)) if (!['summary', 'histogram'].includes(k)) console.log(' ', k, JSON.stringify(rt.body[k])?.slice(0, 300));

const vol = await get(`/analytics/inbox/volume?${qs({ profileId, fromDate: from, toDate: to, platform })}`);
console.log('\nVOLUME', vol.status, vol.ms + 'ms', 'keys', keys(vol.body));
console.log(' summary', JSON.stringify(vol.body.summary), '\n byPlatform', JSON.stringify(vol.body.byPlatform));
for (const k of Object.keys(vol.body)) if (!['summary', 'byPlatform'].includes(k)) console.log(' ', k, JSON.stringify(vol.body[k])?.slice(0, 200));

const cm = await get(`/inbox/comments?${qs({ profileId, minComments: 1, limit: 100 })}`);
const posts = cm.body.data ?? cm.body.posts ?? [];
console.log('\nCOMMENT POSTS', cm.status, cm.ms + 'ms', 'keys', keys(cm.body), 'n', posts.length, 'pagination', JSON.stringify(cm.body.pagination), 'meta', JSON.stringify(cm.body.meta)?.slice(0, 300));
if (posts[0]) console.log(' post keys', keys(posts[0]));
console.log(' platforms', JSON.stringify(posts.reduce((m, p) => ((m[p.platform] = (m[p.platform] || 0) + 1), m), {})));
console.log(' dates', JSON.stringify(posts.slice(0, 12).map((p) => [p.platform, p.createdTime ?? p.publishedAt ?? p.createdAt, p.commentCount])));
const first = posts.find((p) => !platform || p.platform === platform);
if (first) {
  const one = await get(`/inbox/comments/${encodeURIComponent(first.id ?? first._id ?? first.postId)}?${qs({ accountId: first.accountId })}`);
  const cs = one.body.comments ?? one.body.data ?? [];
  console.log('\nCOMMENTS of one post', one.status, one.ms + 'ms', 'keys', keys(one.body), 'n', cs.length, 'pagination', JSON.stringify(one.body.pagination));
  if (cs[0]) console.log(' comment keys', keys(cs[0]), 'from keys', keys(cs[0].from), 'isOwner values', JSON.stringify(cs.map((c) => c.from?.isOwner)), 'replies keys', keys(cs[0].replies?.[0] ?? cs[0].replies));
}
