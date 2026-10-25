// FIXTURE Zernio API for the Automations tab. Nothing here is live evidence. It answers the endpoints the tab
// calls with the shapes in Zernio's reference (comment-automations/*, workflows/*, read October 24, 2026) and
// applies the rules the tab relies on, so the tests prove we send what Zernio accepts:
//   dmMessage required on Instagram/Facebook · ≤640 with buttons · story_mention takes no keywords and no post
//   audience is Instagram only · cooldownHours only with every_comment · one active automation per post (409)
//   a new workflow is a draft; only activate makes it active · alsoMatchInDms needs a keyword
import { createServer } from 'node:http';

export function fakeAutomations(seed) {
  const state = {
    accounts: seed.accounts,
    posts: seed.posts ?? [],
    comment: new Map(), // id -> automation
    flows: new Map(),   // id -> workflow
    logs: new Map(),    // automation id -> [log]
    runs: new Map(),    // workflow id -> [execution]
    requests: [],
    next: 1,
  };
  const id = () => (state.next++).toString(16).padStart(24, 'a');
  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const bad = (res, error, param) => json(res, 400, { error, type: 'invalid_request_error', code: 'invalid_field_value', ...(param ? { param } : {}) });
  const acct = (aid) => state.accounts.find((a) => a._id === aid);

  function checkComment(b, existing) {
    const a = acct(b.accountId ?? existing?.accountId);
    if (!a) return ['Account not found', 'accountId'];
    const trigger = b.trigger ?? existing?.trigger ?? 'comment';
    const dm = b.dmMessage ?? existing?.dmMessage;
    const buttons = b.buttons ?? existing?.buttons ?? [];
    if (['instagram', 'facebook'].includes(a.platform) && !dm) return ['dmMessage is required', 'dmMessage'];
    if (buttons.length > 3) return ['At most 3 buttons', 'buttons'];
    if (buttons.length && dm.length > 640) return ['Text must be 640 characters or less when buttons are attached', 'dmMessage'];
    for (const btn of buttons) if (!btn.title || btn.title.length > 20) return ['Button title is 1-20 characters', 'buttons'];
    if (trigger === 'story_mention') {
      if ((b.keywords ?? existing?.keywords ?? []).length) return ['story_mention takes no keywords', 'keywords'];
      if (b.platformPostId) return ['story_mention takes no post', 'platformPostId'];
      if (a.platform !== 'instagram') return ['story_mention is Instagram only', 'trigger'];
    }
    if (b.audience && a.platform !== 'instagram') return ['audience is Instagram only', 'audience'];
    if (b.repeatPolicy?.mode === 'once' && b.repeatPolicy.cooldownHours) return ['cooldownHours needs every_comment', 'repeatPolicy'];
    if (b.alsoMatchInDms && !(b.keywords ?? existing?.keywords ?? []).length) return ['alsoMatchInDms requires at least one keyword', 'alsoMatchInDms'];
    return null;
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake');
    const raw = await new Promise((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });
    const body = raw ? JSON.parse(raw) : {};
    state.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
    if (req.headers.authorization !== 'Bearer test-key') return json(res, 401, { error: 'Unauthorized' });
    const p = url.pathname.replace(/^\/api\/v1/, '');
    const profileId = url.searchParams.get('profileId');
    let m;

    if (req.method === 'GET' && p === '/accounts')
      return json(res, 200, { accounts: state.accounts.filter((a) => !profileId || a.profileId === profileId) });
    if (req.method === 'GET' && p === '/inbox/comments')
      return json(res, 200, { data: state.posts.filter((x) => { const a = acct(x.accountId); return !profileId || a?.profileId === profileId; }), pagination: { hasMore: false } });

    /* comment automations */
    if (req.method === 'GET' && p === '/comment-automations')
      return json(res, 200, { success: true, automations: [...state.comment.values()].filter((a) => !profileId || a.profileId === profileId) });
    if (req.method === 'POST' && p === '/comment-automations') {
      const err = checkComment(body);
      if (err) return bad(res, ...err);
      if (body.platformPostId && body.isActive !== false && [...state.comment.values()].some((x) => x.isActive && x.platformPostId === body.platformPostId))
        return json(res, 409, { error: 'Active per-post automation already exists for this platformPostId' });
      const a = { id: id(), platform: acct(body.accountId).platform, trigger: 'comment', keywords: [], matchMode: 'contains', isActive: true,
        repeatPolicy: { mode: 'once' }, stats: { triggered: 0, dmsSent: 0, dmsFailed: 0, uniqueContacts: 0, linkClicks: 0 }, createdAt: new Date(Date.now() + state.next).toISOString(), ...body };
      state.comment.set(a.id, a);
      return json(res, 200, { success: true, automation: a });
    }
    if ((m = p.match(/^\/comment-automations\/([^/]+)$/))) {
      const a = state.comment.get(m[1]);
      if (!a) return json(res, 404, { error: 'Automation not found' });
      if (req.method === 'GET') return json(res, 200, { success: true, automation: a });
      if (req.method === 'DELETE') { state.comment.delete(a.id); return json(res, 200, { success: true }); }
      if (req.method === 'PATCH') {
        if ('profileId' in body || 'accountId' in body) return bad(res, 'profileId and accountId cannot be changed', 'accountId');
        const err = checkComment(body, a);
        if (err) return bad(res, ...err);
        const next = { ...a, ...body };
        for (const k of ['platformPostId', 'postTitle', 'postId']) if (body[k] === null) delete next[k];
        state.comment.set(a.id, next);
        return json(res, 200, { success: true, automation: next });
      }
    }
    if (req.method === 'GET' && (m = p.match(/^\/comment-automations\/([^/]+)\/logs$/))) {
      if (!state.comment.has(m[1])) return json(res, 404, { error: 'Automation not found' });
      const logs = state.logs.get(m[1]) ?? [];
      return json(res, 200, { success: true, logs, pagination: { total: logs.length, limit: 50, skip: 0, hasMore: false }, misses: seed.misses ?? { total: 0, retentionDays: 7, samples: [] } });
    }

    /* workflows */
    if (req.method === 'GET' && p === '/workflows')
      return json(res, 200, { success: true, workflows: [...state.flows.values()].filter((w) => !profileId || w.profileId === profileId).map(({ nodes, edges, ...w }) => ({ ...w, nodeCount: nodes.length })) });
    if (req.method === 'POST' && p === '/workflows') {
      if (!acct(body.accountId)) return bad(res, 'Account not found', 'accountId');
      const ids = new Set((body.nodes ?? []).map((n) => n.id));
      if (ids.size !== (body.nodes ?? []).length) return bad(res, 'Node ids must be unique', 'nodes');
      if ((body.edges ?? []).some((e) => !ids.has(e.source) || !ids.has(e.target))) return bad(res, 'Edge references a missing node', 'edges');
      const w = { id: id(), status: 'draft', totalStarted: 0, totalCompleted: 0, totalExited: 0, createdAt: new Date(Date.now() + state.next).toISOString(), ...body };
      state.flows.set(w.id, w);
      return json(res, 200, { success: true, workflow: w });
    }
    if ((m = p.match(/^\/workflows\/([^/]+)$/))) {
      const w = state.flows.get(m[1]);
      if (!w) return json(res, 404, { error: 'Workflow not found' });
      if (req.method === 'GET') return json(res, 200, { success: true, workflow: w });
      if (req.method === 'DELETE') { state.flows.delete(w.id); return json(res, 200, { success: true }); }
      if (req.method === 'PATCH') {
        if ('status' in body) return bad(res, 'status is not a field of this request', 'status');
        state.flows.set(w.id, { ...w, ...body });
        return json(res, 200, { success: true, workflow: state.flows.get(w.id) });
      }
    }
    if (req.method === 'POST' && (m = p.match(/^\/workflows\/([^/]+)\/(activate|pause)$/))) {
      const w = state.flows.get(m[1]);
      if (!w) return json(res, 404, { error: 'Workflow not found' });
      if (m[2] === 'activate' && !(w.nodes ?? []).some((n) => n.type === 'trigger')) return bad(res, 'no trigger node', 'nodes');
      w.status = m[2] === 'activate' ? 'active' : 'paused';
      return json(res, 200, { success: true, workflow: w });
    }
    if (req.method === 'GET' && (m = p.match(/^\/workflows\/([^/]+)\/executions$/)))
      return json(res, 200, { success: true, executions: state.runs.get(m[1]) ?? [], pagination: { total: (state.runs.get(m[1]) ?? []).length } });

    return json(res, 404, { error: `fake: no route ${req.method} ${p}` });
  });
  return {
    state,
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}/api/v1`))),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
