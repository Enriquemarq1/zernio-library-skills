// FIXTURE Zernio API for local tests. Nothing here is live evidence.
// Response shapes follow a live read-only probe of 2026-09-25 (scripts/zernio-readonly-probe.mjs) and the
// official reference pages recorded in docs/zernio-inbox/CAPABILITIES.md. Scenario switches let tests
// provoke pagination, partial account failure, late history import, idempotency replays, ambiguous 5xx
// and delivery ordering without touching a real account.
import { createServer } from 'node:http';

export function fakeZernio(seed) {
  const state = {
    accounts: seed.accounts,             // [{ _id, platform, username, profileId }]
    conversations: seed.conversations,   // [{ id, accountId, platform, participantName, lastMessage, updatedTime, unreadCount }]
    messages: seed.messages ?? {},        // `${accountId}:${conversationId}` -> [{ id, message, direction, createdAt }]
    failedAccounts: new Set(),           // account ids that fail during list (partial failure)
    skippedAccounts: new Set(),          // account ids reported in meta.accountsSkipped (live: the SMS/phone account)
    idem: new Map(),                     // Idempotency-Key -> { hash, response, inFlight }
    sendMode: 'ok',                      // ok | timeout | 5xx-accepted | 5xx-rejected | 400
    sends: [],                           // every send the fake actually "delivered"
    reads: [],                           // mark-read calls (must stay empty unless explicitly requested)
    requests: [],
    pageSize: seed.pageSize ?? 2,
  };
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake');
    const body = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
    state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body });
    // Keys: 'test-key' (the portal's) plus any seed.keys; seed.profileKeys pins a profile to ONE key, so a
    // workspace with its own key file is refused (403) when called with any other key.
    const keys = new Set(['test-key', ...(seed.keys ?? [])]);
    const presented = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (!keys.has(presented)) return json(res, 401, { error: 'Unauthorized' });
    const asked = url.searchParams.get('profileId');
    if (asked && seed.profileKeys?.[asked] && seed.profileKeys[asked] !== presented) return json(res, 403, { error: 'Profile not accessible with this key' });
    const p = url.pathname.replace(/^\/api\/v1/, '');
    const rep = seed.report ?? {};
    const forProfile = (id) => rep[id] ?? {};

    let mm;
    /* ---- client report fixtures (GET only) ---- */
    if (req.method === 'GET' && p === '/analytics/dashboard') {
      if (!url.searchParams.get('fromDate') || !url.searchParams.get('toDate')) return json(res, 400, { error: 'fromDate and toDate are required' });
      const d = forProfile(asked).dashboard;
      return d ? json(res, 200, d) : json(res, 200, { totals: {}, previousTotals: {}, followers: { current: 0, gained: 0, byAccount: [] }, daily: [], topPosts: [] });
    }
    // Posts with their numbers, and the per-platform breakdown. Both IGNORE the platform filter on purpose,
    // so the tests prove the portal applies a workspace's platform list itself.
    if (req.method === 'GET' && p === '/analytics') {
      const list = forProfile(asked).posts;
      if (!list) return json(res, 404, { error: 'fake: no posts fixture' });
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const page = Number(url.searchParams.get('page') ?? 1);
      return json(res, 200, {
        overview: { totalPosts: list.length }, posts: list.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: list.length, pages: Math.max(1, Math.ceil(list.length / limit)) }, accounts: [], hasAnalyticsAccess: true,
      });
    }
    if (req.method === 'GET' && p === '/analytics/daily-metrics') {
      const b = forProfile(asked).breakdown;
      return b ? json(res, 200, { dailyData: [], platformBreakdown: b }) : json(res, 404, { error: 'fake: no breakdown fixture' });
    }
    if (req.method === 'GET' && p === '/ads') {
      const adAccountId = url.searchParams.get('adAccountId');
      const owner = adAccountId ? Object.keys(rep).find((k) => rep[k].adAccountId === adAccountId) : asked;
      const r = forProfile(owner);
      const prev = url.searchParams.get('fromDate') < (r.windowStart ?? '0000');
      const all = (r.ads ?? []).map((a) => (prev ? { ...a, metrics: Object.fromEntries(Object.entries(a.metrics).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v / 2) : v])) } : a));
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const page = Number(url.searchParams.get('page') ?? 1);
      const body = { ads: all.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: all.length, pages: Math.ceil(all.length / limit) } };
      if (r.adsMode === 'backfill') return json(res, 202, { ...body, backfillPending: true });
      return json(res, 200, body);
    }
    if (req.method === 'GET' && p === '/analytics/inbox/response-time') return json(res, 200, { success: true, ...(forProfile(asked).responseTime ?? { summary: { sampleSize: 0 }, histogram: [] }) });
    if (req.method === 'GET' && p === '/analytics/inbox/volume') return json(res, 200, { success: true, ...(forProfile(asked).volume ?? { summary: {}, byPlatform: [] }) });
    if (req.method === 'GET' && p === '/inbox/comments') {
      const list = forProfile(asked).commentPosts ?? [];
      const start = Number(url.searchParams.get('cursor') ?? 0);
      const page = list.slice(start, start + 2); // tiny pages so the opaque cursor is followed
      return json(res, 200, { data: page, pagination: { hasMore: start + 2 < list.length, nextCursor: start + 2 < list.length ? String(start + 2) : null }, meta: {} });
    }
    if (req.method === 'GET' && (mm = p.match(/^\/inbox\/comments\/([^/]+)$/))) {
      const all = Object.values(rep).reduce((o, r) => ({ ...o, ...(r.comments ?? {}) }), {});
      const list = all[decodeURIComponent(mm[1])];
      return list ? json(res, 200, { status: 'success', comments: list, pagination: { hasMore: false } }) : json(res, 400, { error: 'Platform does not support comments' });
    }
    if (req.method === 'GET' && (mm = p.match(/^\/ads\/([^/]+)\/comments$/))) {
      const all = Object.values(rep).reduce((o, r) => ({ ...o, ...(r.adComments ?? {}) }), {});
      const list = all[decodeURIComponent(mm[1])];
      return list ? json(res, 200, { status: 'success', comments: list, pagination: { hasMore: false } }) : json(res, 400, { error: 'Invalid ad ID format' });
    }

    if (req.method === 'GET' && p === '/accounts') {
      const profileId = url.searchParams.get('profileId');
      return json(res, 200, { accounts: state.accounts.filter((a) => !profileId || a.profileId === profileId) });
    }
    let m;
    if (req.method === 'GET' && (m = p.match(/^\/accounts\/([^/]+)\/health$/))) {
      const a = state.accounts.find((x) => x._id === m[1]);
      if (!a) return json(res, 404, { error: 'Account not found' });
      return json(res, 200, { accountId: a._id, platform: a.platform, status: a.health ?? 'healthy', issues: a.issues ?? [], tokenStatus: { valid: a.health !== 'error' },
        ...(a.platform === 'whatsapp' ? { platformConnection: { status: 'connected', inboundWebhookSubscribed: a.inbound !== false } } : {}) });
    }
    if (req.method === 'GET' && p === '/inbox/conversations') {
      const profileId = url.searchParams.get('profileId');
      const accountId = url.searchParams.get('accountId');
      const scoped = state.conversations.filter((c) => {
        const acct = state.accounts.find((a) => a._id === c.accountId);
        return (!profileId || acct?.profileId === profileId) && (!accountId || c.accountId === accountId) && !state.failedAccounts.has(c.accountId) && !state.skippedAccounts.has(c.accountId);
      }).sort((a, b) => b.updatedTime.localeCompare(a.updatedTime));
      const start = Number(url.searchParams.get('cursor') ?? 0);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), state.pageSize); // small pages so cursors are exercised
      const page = scoped.slice(start, start + limit);
      const failed = [...state.failedAccounts].filter((id) => !profileId || state.accounts.find((a) => a._id === id)?.profileId === profileId);
      return json(res, 200, {
        data: page,
        pagination: { hasMore: start + limit < scoped.length, nextCursor: start + limit < scoped.length ? String(start + limit) : null },
        meta: { accountsQueried: 2, accountsFailed: failed.length, failedAccounts: failed.map((id) => ({ accountId: id, error: 'Token expired' })), accountsSkipped: [...state.skippedAccounts].map((id) => ({ accountId: id, platform: state.accounts.find((a) => a._id === id)?.platform })) },
      });
    }
    if ((m = p.match(/^\/inbox\/conversations\/([^/]+)\/messages$/))) {
      const conversationId = decodeURIComponent(m[1]);
      const payload = body ? JSON.parse(body) : {};
      const accountId = req.method === 'GET' ? url.searchParams.get('accountId') : payload.accountId;
      const convo = state.conversations.find((c) => c.id === conversationId && c.accountId === accountId);
      if (!accountId) return json(res, 400, { error: 'accountId is required' });
      if (!convo) return json(res, 404, { error: 'Conversation not found' });
      const k = `${accountId}:${conversationId}`;
      if (req.method === 'GET') {
        // Documented default sortOrder=asc (oldest first); desc returns the newest page first.
        const order = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
        const all = [...(state.messages[k] ?? [])].sort((a, b) => (order === 'desc' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
        const start = Number(url.searchParams.get('cursor') ?? 0);
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 3); // tiny pages so paging is exercised
        const page = all.slice(start, start + limit);
        return json(res, 200, { status: 'success', messages: page, sortOrderApplied: order,
          pagination: { hasMore: start + limit < all.length, nextCursor: start + limit < all.length ? String(start + limit) : null } });
      }
      // POST reply
      const key = req.headers['idempotency-key'];
      const hash = JSON.stringify(payload);
      if (key && state.idem.has(key)) {
        const prev = state.idem.get(key);
        if (prev.inFlight) return json(res, 409, { error: 'A request with this Idempotency-Key is already in progress' });
        if (prev.hash !== hash) return json(res, 422, { error: 'Idempotency-Key reused with a different request body' });
        res.setHeader('Idempotent-Replayed', 'true');
        return json(res, 200, prev.response);
      }
      const deliver = () => {
        const msg = { id: `m_out_${state.sends.length + 1}`, message: payload.message, direction: 'outgoing', createdAt: new Date().toISOString() };
        (state.messages[k] ??= []).push(msg);
        state.sends.push({ key, conversationId, accountId, text: payload.message });
        return msg;
      };
      if (state.sendMode === 'in-flight') { state.idem.set(key, { hash, inFlight: true }); return json(res, 409, { error: 'in progress' }); }
      if (state.sendMode === '400') return json(res, 400, { error: 'Outside the messaging window' });
      if (state.sendMode === '5xx-rejected') return json(res, 502, { error: 'Bad gateway' });
      if (state.sendMode === '5xx-accepted') { deliver(); return json(res, 502, { error: 'Bad gateway' }); } // platform accepted, response lost; key released
      if (state.sendMode === 'timeout') { deliver(); return; } // never answers
      const msg = deliver();
      const response = { success: true, data: { messageId: msg.id, conversationId, sentAt: msg.createdAt } };
      if (key) state.idem.set(key, { hash, response });
      return json(res, 200, response);
    }
    if (req.method === 'POST' && (m = p.match(/^\/inbox\/conversations\/([^/]+)\/read$/))) {
      const { accountId } = body ? JSON.parse(body) : {};
      if (!accountId) return json(res, 400, { error: 'accountId is required' });
      state.reads.push({ conversationId: decodeURIComponent(m[1]), accountId });
      return json(res, 200, { success: true, markedCount: 1 });
    }
    if (req.method === 'POST' && p === '/inbox/conversations') {
      const b = JSON.parse(body || '{}');
      const acct = state.accounts.find((a) => a._id === b.accountId);
      if (!acct) return json(res, 404, { error: 'Account not found' });
      if (['instagram', 'facebook'].includes(acct.platform)) return json(res, 400, { error: 'PLATFORM_NOT_SUPPORTED' });
      if (acct.platform === 'whatsapp' && !b.templateName) return json(res, 400, { error: 'TEMPLATE_REQUIRED' });
      const id = `new_${state.conversations.length + 1}`;
      state.conversations.push({ id, accountId: acct._id, platform: acct.platform === 'phone' ? 'sms' : acct.platform, participantName: b.participantId, lastMessage: b.message ?? b.templateName, updatedTime: new Date().toISOString(), unreadCount: 0 });
      state.created = (state.created ?? []).concat([{ ...b }]);
      return json(res, 201, { success: true, data: { messageId: `m_${id}`, conversationId: id, participantId: b.participantId } });
    }
    return json(res, 404, { error: `fake: no route ${req.method} ${p}` });
  });
  return {
    state,
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}/api/v1`))),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
