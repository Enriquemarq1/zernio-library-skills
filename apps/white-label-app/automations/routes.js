// The Automations tab (/w/:profileId/automations) and its JSON API (/api/...), which the MCP server and any
// AI agent use. Both go through service.js, so the agent can do exactly what the tab does, no more.
import QRCode from 'qrcode';
import * as svc from './service.js';
import { RECIPES, DEFAULTS, settingsFrom, RecipeError } from './recipes.js';
import { viewKit, defaultsFor, stripForAgent } from './views.js';

const KINDS = new Set(['comment', 'flow']);

// The form posts parallel btnTitle/btnUrl fields; turn them into the recipe's buttons list.
const fromForm = (b) => {
  const titles = [].concat(b.btnTitle ?? []);
  const urls = [].concat(b.btnUrl ?? []);
  const out = { ...b, buttons: titles.map((title, i) => ({ title, url: urls[i] ?? '' })) };
  for (const k of ['typoTolerance', 'alsoMatchInDms', 'likeComment']) out[k] = b[k] === '1';
  delete out.btnTitle;
  delete out.btnUrl;
  return out;
};

const upstream = (e) => {
  const d = e.body?.details;
  return `${e.message}${e.body?.param ? ` (field: ${e.body.param})` : ''}${d && typeof d === 'object' && !Array.isArray(d) && d.message ? ` ${d.message}` : ''}`;
};

export default function automationRoutes(app, { findClient, workspaceShell, clients, express, v }) {
  const k = viewKit(v);
  const { esc, note, icon } = v;

  const shell = (client, { subtitle, actions = '', body }) => workspaceShell({ client, tab: 'automations', subtitle, actions, body });
  const fail = (res, client, e) => {
    const status = e.status === 403 || e.status === 404 ? 404 : e instanceof RecipeError ? 400 : 502;
    res.status(status).send(shell(client, {
      subtitle: 'Automations',
      body: note('danger', status === 404 ? 'Not in this workspace' : 'Zernio answered with an error', status === 404 ? e.message : upstream(e)),
    }));
  };
  const flashFrom = (q) => (q.ok ? note('ok', q.ok) : q.err ? note('danger', 'That didn’t work', q.err) : '');

  /* ---------------------------------------------------------------- list */
  app.get('/w/:profileId/automations', async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    try {
      const data = await svc.listAutomations(client.profileId);
      res.send(shell(client, k.listPage({ client, ...data, flash: flashFrom(req.query) })));
    } catch (e) {
      fail(res, client, e);
    }
  });

  /* ------------------------------------------------------------- new */
  app.get('/w/:profileId/automations/new', (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    res.send(shell(client, k.newPage({ client })));
  });

  const builder = async (req, res, client, { recipe, s, errors = [], editing = null, status = 200 }) => {
    const accounts = await svc.automationAccounts(client.profileId);
    const acct = accounts.find((a) => a.id === s.accountId) || accounts.find((a) => a.platform === 'instagram') || accounts[0];
    const posts = acct && ['comment_dm', 'followers_only', 'ask_first'].includes(recipe)
      ? await svc.postsFor(client.profileId, acct.id).catch(() => []) : [];
    res.status(status).send(shell(client, accounts.length
      ? k.builderPage({ client, recipe, s: { ...s, accountId: s.accountId || acct?.id }, accounts, posts, errors, editing })
      : { subtitle: 'New automation', body: note('warn', 'No Instagram or Facebook account in this workspace', 'Connect one in the Connections tab first.') }));
  };

  app.get('/w/:profileId/automations/new/:recipe', async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    const { recipe } = req.params;
    if (!RECIPES[recipe]) return res.redirect(`${k.base(client.profileId)}/new`);
    try {
      await builder(req, res, client, { recipe, s: defaultsFor(recipe, await svc.automationAccounts(client.profileId)) });
    } catch (e) {
      fail(res, client, e);
    }
  });

  app.post('/w/:profileId/automations/new/:recipe', async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    const { recipe } = req.params;
    const input = { ...fromForm(req.body), recipe };
    try {
      const it = await svc.createAutomation(client.profileId, input);
      res.redirect(`${k.itemHref(client.profileId, it)}?ok=${encodeURIComponent(it.live ? `“${it.name}” is live.` : `“${it.name}” is saved and paused.`)}`);
    } catch (e) {
      const errors = e instanceof RecipeError ? e.errors : [upstream(e)];
      if (e.status === 403) errors.splice(0, errors.length, 'That account is not part of this workspace.');
      let s;
      try { s = settingsFrom(recipe, input); } catch { s = defaultsFor(recipe, []); }
      await builder(req, res, client, { recipe, s, errors, status: 400 }).catch((x) => fail(res, client, x));
    }
  });

  /* ------------------------------------------------------------ detail */
  const withItem = (handler) => async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    const { kind, id } = req.params;
    if (!KINDS.has(kind)) return fail(res, client, new svc.NotFound());
    try {
      const { item, accounts } = await svc.getAutomation(client.profileId, kind, id);
      await handler(req, res, client, item, accounts);
    } catch (e) {
      fail(res, client, e);
    }
  };

  app.get('/w/:profileId/automations/:kind/:id', withItem(async (req, res, client, it) => {
    const qrSvg = it.link ? await QRCode.toString(it.link, { type: 'svg', margin: 1, width: 168, color: { dark: '#2D2D2D', light: '#FFFFFF' } }) : '';
    const post = it.settings.platformPostId
      ? (await svc.postsFor(client.profileId, it.account.id).catch(() => [])).find((p) => p.id === it.settings.platformPostId)
        ?? { title: it.settings.postTitle || 'One post', picture: null, permalink: null }
      : null;
    const page = k.detailPage({ client, it, qrSvg, post });
    res.send(shell(client, { ...page, body: `${flashFrom(req.query)}${page.body}` }));
  }));

  app.get('/w/:profileId/automations/:kind/:id/activity', async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    res.type('html').set('Cache-Control', 'no-store');
    try {
      res.send(k.activityPart(await svc.activity(client.profileId, req.params.kind, req.params.id)));
    } catch (e) {
      res.status(e.status === 404 ? 404 : 502).send(`<div class="card-body">${note('danger', 'Couldn’t read the activity', e.status === 404 ? e.message : upstream(e))}</div>`);
    }
  });

  app.get('/w/:profileId/automations/:kind/:id/qr.png', withItem(async (req, res, client, it) => {
    if (!it.link) return res.status(404).end();
    res.type('png').send(await QRCode.toBuffer(it.link, { type: 'png', margin: 2, width: 1024, color: { dark: '#2D2D2D', light: '#FFFFFF' } }));
  }));

  /* -------------------------------------------------------------- edit */
  app.get('/w/:profileId/automations/:kind/:id/edit', withItem(async (req, res, client, it) => {
    if (it.kind === 'flow' && !it.ours) return res.redirect(k.itemHref(client.profileId, it));
    await builder(req, res, client, { recipe: it.recipe, s: it.settings, editing: it });
  }));

  app.post('/w/:profileId/automations/:kind/:id/edit', withItem(async (req, res, client, it) => {
    const input = fromForm(req.body);
    delete input.isActive; // editing never flips live/paused; the switch does
    try {
      const saved = await svc.updateAutomation(client.profileId, it.kind, it.id, input);
      res.redirect(`${k.itemHref(client.profileId, saved)}?ok=${encodeURIComponent('Saved.')}`);
    } catch (e) {
      const errors = e instanceof RecipeError ? e.errors : [upstream(e)];
      let s;
      try { s = settingsFrom(it.recipe, { ...it.settings, ...input }); } catch { s = it.settings; }
      await builder(req, res, client, { recipe: it.recipe, s, errors, editing: it, status: 400 });
    }
  }));

  /* --------------------------------------------------- switch, delete */
  const safeBack = (client, back) => (typeof back === 'string' && back.startsWith(`/w/${client.profileId}/automations`) ? back : k.base(client.profileId));
  app.post('/w/:profileId/automations/:kind/:id/live', withItem(async (req, res, client, it) => {
    const on = req.body.on === '1';
    const back = safeBack(client, req.body.back);
    const sep = back.includes('?') ? '&' : '?';
    try {
      await svc.setLive(client.profileId, it.kind, it.id, on);
      res.redirect(`${back}${sep}ok=${encodeURIComponent(on ? `“${it.name}” is live.` : `“${it.name}” is paused.`)}`);
    } catch (e) {
      res.redirect(`${back}${sep}err=${encodeURIComponent(upstream(e))}`);
    }
  }));

  app.post('/w/:profileId/automations/:kind/:id/delete', withItem(async (req, res, client, it) => {
    try {
      await svc.deleteAutomation(client.profileId, it.kind, it.id);
      res.redirect(`${k.base(client.profileId)}?ok=${encodeURIComponent(`“${it.name}” is deleted.`)}`);
    } catch (e) {
      res.redirect(`${k.itemHref(client.profileId, it)}?err=${encodeURIComponent(upstream(e))}`);
    }
  }));

  /* ============================================================ JSON API */
  // Local only, like the whole portal (it binds 127.0.0.1). With PORTAL_AGENT_TOKEN set, every call needs
  // `Authorization: Bearer <token>`. A browser on another site cannot use it: cross-site requests are refused.
  const guard = (req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      const host = req.get('host');
      if (!host || new URL(origin).host !== host) return res.status(403).json({ error: 'Cross-site requests are refused.' });
    }
    const token = process.env.PORTAL_AGENT_TOKEN;
    if (token && req.get('authorization') !== `Bearer ${token}`) return res.status(401).json({ error: 'Missing or wrong agent token.' });
    next();
  };
  const api = express.Router();
  api.use(guard, express.json({ limit: '100kb' }));

  const send = (res, fn) => fn().then((body) => res.json(body), (e) => {
    const status = e instanceof RecipeError ? 400 : e.status === 403 || e.status === 404 ? 404 : e.status >= 400 && e.status < 500 ? e.status : 502;
    res.status(status).json({ error: e instanceof RecipeError ? e.message : status === 404 ? e.message : upstream(e), ...(e.errors ? { errors: e.errors } : {}) });
  });
  const ws = (req, res) => {
    const c = clients().find((x) => x.profileId === req.params.profileId);
    if (!c) res.status(404).json({ error: 'No such workspace in this portal.' });
    return c;
  };
  const kindOk = (req, res) => {
    if (KINDS.has(req.params.kind)) return true;
    res.status(404).json({ error: 'kind must be "comment" or "flow".' });
    return false;
  };
  const agentItem = (it) => ({
    kind: it.kind, id: it.id, recipe: it.recipe, name: it.name, status: it.status, live: it.live,
    account: it.account, link: it.link ?? undefined, when: it.read.when, then: it.read.then, repeat: it.read.repeat,
    stats: it.stats, settings: stripForAgent(it.settings), createdAt: it.createdAt,
  });

  api.get('/recipes', (req, res) => res.json({
    recipes: Object.fromEntries(Object.entries(RECIPES).map(([id, r]) => [id, { kind: r.kind, title: r.title, what: r.pitch, example: { recipe: id, ...DEFAULTS[id] } }])),
    fields: {
      name: 'string, required', accountId: 'an Instagram or Facebook account id from list_automations.accounts, required',
      isActive: 'boolean, default true (false saves it paused)', dmMessage: 'the DM text; {{first_name}}, {{name}}, {{username}} in comment recipes, {{contact.name}} in flows',
      buttons: '[{ title (≤20 chars), url (https) }], up to 3', keywords: 'array or comma-separated string (comment recipes)',
      matchMode: 'word | contains | exact', typoTolerance: 'boolean, matchMode word only', platformPostId: '"any" or a post id from list_posts',
      commentReply: 'public reply under the comment (comment_dm, followers_only)', likeComment: 'boolean', alsoMatchInDms: 'boolean, needs a keyword',
      repeat: 'once | every', cooldownHours: 'number; with repeat every, or the ref_link window (1–720)',
      gateMessage: 'followers_only: the one-tap check DM', gateButton: 'followers_only: its button label (≤20)', gateNotFollowing: 'followers_only: sent when they still don’t follow',
      ref: 'ref_link: the link name, letters, numbers, - and _', tag: 'ref_link, ask_first: tag added to the contact', opener: 'ask_first: the plain first message',
    },
    notes: [
      'Instagram can refuse buttons in the first DM to someone who does not follow the account; ask_first opens with plain text for them.',
      'followers_only and story_mention are Instagram only.',
      'Every DM counts as a Zernio outbound message: the first 10,000 a month are free, then $1 per 10,000.',
    ],
  }));
  api.get('/workspaces', (req, res) => res.json({ workspaces: clients().map((c) => ({ profileId: c.profileId, name: c.name })) }));
  api.get('/w/:profileId/automations', (req, res) => {
    if (!ws(req, res)) return;
    send(res, async () => {
      const { accounts, items, totals } = await svc.listAutomations(req.params.profileId);
      return { accounts, totals, automations: items.map(agentItem) };
    });
  });
  api.get('/w/:profileId/posts', (req, res) => {
    if (!ws(req, res)) return;
    send(res, async () => {
      const accounts = await svc.automationAccounts(req.params.profileId);
      const accountId = req.query.accountId || accounts.find((a) => a.platform === 'instagram')?.id || accounts[0]?.id;
      if (!accountId) return { posts: [] };
      return { accountId, posts: await svc.postsFor(req.params.profileId, String(accountId)) };
    });
  });
  api.post('/w/:profileId/automations', (req, res) => {
    if (!ws(req, res)) return;
    send(res, async () => agentItem(await svc.createAutomation(req.params.profileId, req.body || {})));
  });
  api.get('/w/:profileId/automations/:kind/:id', (req, res) => {
    if (!ws(req, res) || !kindOk(req, res)) return;
    send(res, async () => agentItem((await svc.getAutomation(req.params.profileId, req.params.kind, req.params.id)).item));
  });
  api.patch('/w/:profileId/automations/:kind/:id', (req, res) => {
    if (!ws(req, res) || !kindOk(req, res)) return;
    send(res, async () => agentItem(await svc.updateAutomation(req.params.profileId, req.params.kind, req.params.id, req.body || {})));
  });
  for (const action of ['activate', 'pause'])
    api.post(`/w/:profileId/automations/:kind/:id/${action}`, (req, res) => {
      if (!ws(req, res) || !kindOk(req, res)) return;
      send(res, async () => agentItem(await svc.setLive(req.params.profileId, req.params.kind, req.params.id, action === 'activate')));
    });
  api.delete('/w/:profileId/automations/:kind/:id', (req, res) => {
    if (!ws(req, res) || !kindOk(req, res)) return;
    send(res, () => svc.deleteAutomation(req.params.profileId, req.params.kind, req.params.id));
  });
  api.get('/w/:profileId/automations/:kind/:id/activity', (req, res) => {
    if (!ws(req, res) || !kindOk(req, res)) return;
    send(res, async () => {
      const a = await svc.activity(req.params.profileId, req.params.kind, req.params.id, { limit: Math.min(Number(req.query.limit) || 50, 100) });
      // Counts and outcomes; the agent gets handles and outcomes, never what people wrote.
      return { kind: a.kind, total: a.total, rows: a.rows.map(({ text, ...r }) => r), missesTotal: a.misses?.total ?? 0 };
    });
  });
  api.use((req, res) => res.status(404).json({ error: 'No such endpoint.' }));
  app.use('/api', api);
}
