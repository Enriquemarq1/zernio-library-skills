// Thin server-side wrapper around the Zernio API. The API key never leaves this file.
// The key is the per-call override, else the workspace's own key (workspace.js), else ZERNIO_API_KEY.
import { currentKey, current, allows, platformParam } from './workspace.js';

const base = () => process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1';

// Same as zernio() but also returns the HTTP status (202 means "accepted, still syncing").
export async function request(path, { key, ...options } = {}) {
  const res = await fetch(base() + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${key || currentKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error || body.message || res.statusText), {
      status: res.status,
      body,
    });
  }
  return { status: res.status, body };
}

export default async function zernio(path, options) {
  return (await request(path, options)).body;
}

export const listProfiles = () =>
  zernio('/profiles').then((r) => r.profiles ?? r.data ?? []);

// Accounts are scoped to one client's workspace by profileId, and to the workspace's platforms when it
// names them: an account on any other platform is not part of that workspace anywhere in the portal.
export const listAccounts = (profileId, key) =>
  zernio(`/accounts?profileId=${encodeURIComponent(profileId)}`, { key }).then((r) =>
    (r.accounts ?? r.data ?? []).filter((a) => allows(current().platforms, a.platform))
  );

export const createProfile = (name, color) =>
  zernio('/profiles', { method: 'POST', body: JSON.stringify({ name, color }) }).then(
    (r) => r.profile ?? r
  );

// A key that can see ONE profile and nothing else — the isolation boundary itself.
export const createScopedKey = (name, profileIds) =>
  zernio('/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, scope: 'profiles', profileIds, permission: 'read' }),
  }).then((r) => r.apiKey);

export const deleteKey = (keyId) => zernio(`/api-keys/${keyId}`, { method: 'DELETE' });

// --- Connect flow -----------------------------------------------------------
// headless=true keeps the client on our pages: Zernio never renders its own UI.
export const connectUrl = (platform, profileId, redirectUrl) =>
  zernio(
    `/connect/${platform}?profileId=${encodeURIComponent(profileId)}` +
      `&headless=true&redirect_url=${encodeURIComponent(redirectUrl)}`
  );

// Simple platforms (instagram, tiktok): exchange the raw code+state for an account.
export const completeOAuth = (platform, body) =>
  zernio(`/connect/${platform}`, { method: 'POST', body: JSON.stringify(body) });

// Selection platforms (linkedin): one unauthenticated call returns the whole picker.
export const pendingData = (token) =>
  zernio(`/connect/pending-data?token=${encodeURIComponent(token)}`);

export const selectLinkedInOrg = (body) =>
  zernio('/connect/linkedin/select-organization', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// --- Posting ----------------------------------------------------------------
export const createPost = (body) =>
  zernio('/posts', { method: 'POST', body: JSON.stringify(body) });

// Dry-run the same body: catches missing media, character limits, bad formats.
export const validatePost = (body) =>
  zernio('/tools/validate/post', { method: 'POST', body: JSON.stringify(body) });

// --- Content queue -----------------------------------------------------------
// A post can target several platforms; in a workspace limited to some, keep only those targets.
export const scopePosts = (posts) => {
  const p = current().platforms;
  if (!p) return posts;
  return posts
    .map((x) => (Array.isArray(x.platforms) ? { ...x, platforms: x.platforms.filter((t) => p.includes(t.platform)) } : x))
    .filter((x) => (Array.isArray(x.platforms) ? x.platforms.length > 0 : p.includes(x.platform)));
};

// Returns the page AND the real total, so callers can't mistake one for the other.
export const listPosts = (profileId, q = '') =>
  zernio(`/posts?profileId=${encodeURIComponent(profileId)}&limit=50${platformParam()}${q}`).then((r) => {
    const posts = scopePosts(r.posts ?? []);
    const dropped = (r.posts ?? []).length - posts.length;
    return { posts, total: Math.max(posts.length, (r.pagination?.total ?? (r.posts ?? []).length) - dropped) };
  });
export const deletePost = (id) => zernio(`/posts/${id}`, { method: 'DELETE' });
export const retryPost = (id) => zernio(`/posts/${id}/retry`, { method: 'POST' });

// --- Analytics ---------------------------------------------------------------
export const analytics = (profileId) =>
  zernio(`/analytics?profileId=${encodeURIComponent(profileId)}&limit=8${platformParam()}`).then((r) => ({
    ...r,
    posts: scopePosts(r.posts ?? []),
  }));
// A dated window (fromDate/toDate) when given, else the last `days` days. The Analytics tab and the
// report's Platform breakdown both read platformBreakdown from here.
export const dailyMetrics = (profileId, days = 30, { fromDate, toDate } = {}) =>
  zernio(`/analytics/daily-metrics?profileId=${encodeURIComponent(profileId)}${
    fromDate && toDate ? `&fromDate=${fromDate}&toDate=${toDate}` : `&days=${days}`
  }${platformParam()}`).then((r) => ({
    ...r,
    platformBreakdown: (r.platformBreakdown ?? []).filter((b) => allows(current().platforms, b.platform)),
  }));
// Every post published in a window with its numbers, all pages up to maxPages (GET only). Posts carry
// mediaType (text | image | video | carousel), which the report's Content format breakdown groups by.
export async function analyticsPosts({ profileId, fromDate, toDate, maxPages = 5 }) {
  const posts = [];
  let total = 0;
  let truncated = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const r = await zernio(`/analytics?${new URLSearchParams({ profileId, fromDate, toDate, limit: '100', page: String(page) })}${platformParam()}`);
    posts.push(...scopePosts(r.posts ?? []));
    total = r.pagination?.total ?? posts.length;
    if (page >= (r.pagination?.pages ?? 1)) break;
    if (page === maxPages) truncated = true;
  }
  return { posts, total, truncated };
}
export const bestTime = (profileId) =>
  zernio(`/analytics/best-time?profileId=${encodeURIComponent(profileId)}${platformParam()}`).then(
    (r) => r.slots ?? []
  );

// --- Inbox -------------------------------------------------------------------
export const listConversations = (limit = 40) =>
  zernio(`/inbox/conversations?limit=${limit}`).then((r) => r.data ?? []);
// accountId is required — the same conversation id can exist on several accounts.
export const conversationMessages = (id, accountId) =>
  zernio(
    `/inbox/conversations/${encodeURIComponent(id)}/messages` +
      `?accountId=${encodeURIComponent(accountId)}&limit=50`
  ).then((r) => r.messages ?? r.data ?? []);
export const listComments = (limit = 30) =>
  zernio(`/inbox/comments?limit=${limit}`).then((r) => r.data ?? []);

export const sendMessage = (conversationId, accountId, message) =>
  zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ accountId, message }),
  });

export const markRead = (conversationId) =>
  zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST' });

// Posts inside a date window — what the calendar paints a month from.
export const listPostsRange = (profileId, from, to) =>
  zernio(
    `/posts?profileId=${encodeURIComponent(profileId)}` +
      `&dateFrom=${from}&dateTo=${to}&limit=500&sortBy=scheduled-asc${platformParam()}`
  ).then((r) => scopePosts(r.posts ?? []));

// --- Client report (GET only) -------------------------------------------------
const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

// One call: totals, previous period, followers, the daily series and top posts.
export const analyticsDashboard = ({ profileId, fromDate, toDate, platform }) =>
  zernio(`/analytics/dashboard?${qs({ profileId, fromDate, toDate, compare: 'previous_period', topPosts: 5, platform })}`);

// Every ad for the window, all pages. A 202 with backfillPending still carries the ads synced so far.
export async function listAds({ profileId, adAccountId, fromDate, toDate, maxPages = 10 }) {
  const ads = [];
  let backfillPending = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const { status, body } = await request(`/ads?${qs({
      profileId: adAccountId ? undefined : profileId, adAccountId, source: 'all', fromDate, toDate, limit: 100, page,
    })}`);
    if (status === 202 || body.backfillPending) backfillPending = true;
    ads.push(...(body.ads ?? body.data ?? []));
    if (page >= (body.pagination?.pages ?? 1)) break;
  }
  return { ads, backfillPending };
}

export const inboxResponseTime = ({ profileId, fromDate, toDate, platform }) =>
  zernio(`/analytics/inbox/response-time?${qs({ profileId, fromDate, toDate, platform })}`);
export const inboxVolume = ({ profileId, fromDate, toDate, platform }) =>
  zernio(`/analytics/inbox/volume?${qs({ profileId, fromDate, toDate, platform })}`);

// Posts (and ads) that have comments. The cursor is opaque: pass it back verbatim; dedupe by id.
export async function listCommentPosts({ profileId, maxPages = 8 }) {
  const byId = new Map();
  let cursor;
  let truncated = false;
  for (let i = 0; i < maxPages; i += 1) {
    const r = await zernio(`/inbox/comments?${qs({ profileId, minComments: 1, limit: 50, cursor })}`);
    for (const p of r.data ?? []) byId.set(`${p.id}:${p.placement || ''}`, p);
    cursor = r.pagination?.hasMore ? r.pagination.nextCursor : null;
    if (!cursor) break;
    if (i === maxPages - 1) truncated = true;
  }
  return { posts: [...byId.values()], truncated };
}

// One organic post's comments, or one ad's (Meta placement: facebook | instagram).
export const postComments = (postId, accountId) =>
  zernio(`/inbox/comments/${encodeURIComponent(postId)}?${qs({ accountId, limit: 100 })}`).then((r) => r.comments ?? r.data ?? []);
export const adComments = (adId, placement) =>
  zernio(`/ads/${encodeURIComponent(adId)}/comments?${qs({ placement, limit: 100 })}`).then((r) => r.comments ?? r.data ?? []);
