import express from 'express';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openStore } from './inbox/store.js';
import { workspaceAccounts, accountIdOf, assertAccount, AccessDenied } from './inbox/tenancy.js';
import { webhookHandler, drainEvents } from './inbox/webhooks.js';
import inboxRoutes from './inbox/routes.js';
import reportRoutes from './report/routes.js';
import automationRoutes from './automations/routes.js';
import { accountHealth } from './inbox/adapter.js';
import { bindWorkspace, platformsOf } from './workspace.js';
import {
  listAccounts, connectUrl, completeOAuth, pendingData, selectLinkedInOrg,
  createProfile, createScopedKey, deleteKey, createPost, validatePost,
  listPosts, listPostsRange, deletePost, retryPost, analytics, dailyMetrics, bestTime,
} from './zernio.js';
import {
  app as shell, clientPage, section, accounts, esc, note, empty, chip, icon,
  copyField, num, ago, plural, idx, platformName, asyncAccounts, BRAND,
  platformCell, barChart, chartBlock, kpi, metricSlot, ALL_PLATFORMS, plogo, clock,
  calendar, monthLabel, postDate, metricTable, platformCellName, ranked, zcard, engagementRate,
} from './views.js';

const app = express();
app.use(express.urlencoded({ extended: false }));
// Long cache is safe only because the stylesheet link carries ?v=<mtime>,
// so an edit busts it instead of leaving people on last hour's design.
app.use(express.static('public', { maxAge: '1y', immutable: true }));

// CLIENTS_FILE lets tests run against two throwaway tenants without touching the real list.
const FILE = process.env.CLIENTS_FILE ? pathToFileURL(process.env.CLIENTS_FILE) : new URL('./clients.json', import.meta.url);
// No clients.json yet = no workspaces: the dashboard shows its empty state and points at clients.example.json.
// Adding a client from the dashboard creates the file.
const clients = () => {
  let raw;
  try {
    raw = readFileSync(FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('clients.json is not valid JSON. Compare it with clients.example.json.');
  }
};
const save = (list) => writeFileSync(FILE, JSON.stringify(list, null, 2) + '\n');
// Every workspace route runs with that workspace's own key and platform list (workspace.js).
app.use(['/w/:profileId', '/c/:profileId', '/connect/:profileId', '/api/w/:profileId'], bindWorkspace(clients));
const PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn']];
const lastPost = new Map();
const events = [];
const needsReconnect = new Set();
// Durable inbox state (sends, webhook events, message cache, connect intents). INBOX_DB=:memory: in tests.
const store = openStore();
let draining = null;
const kickWorker = () => {
  draining ??= drainEvents({ store, clients }).catch((e) => console.error('inbox worker:', e.message)).finally(() => (draining = null));
  return draining;
};
// Boot-time resume + a slow sweep: anything persisted but unprocessed (crash, restart) gets processed.
export function startInboxWorker() {
  kickWorker();
  setInterval(kickWorker, 15000).unref();
}
export const _inbox = { store, kickWorker };

const safeAccounts = (profileId) =>
  listAccounts(profileId).then(
    (list) => ({ list }),
    (err) => ({ list: [], error: `${err.status || ''} ${err.message}`.trim() })
  );

const connectLink = (profileId) =>
  `${process.env.BASE_URL}/c/${encodeURIComponent(profileId)}/connect`;

/* ============================================================ client workspace */
// One shell for all four tabs. Each tab owns its own data fetch.
const workspaceShell = ({ client, tab, subtitle, actions = '', body, counts = {} }) =>
  shell({
    title: client.name,
    subtitle,
    active: tab,
    client,
    clientList: clients(),
    counts,
    tabsFor: client.profileId,
    actions,
    body,
  });

const findClient = (req, res) => {
  const c = clients().find((x) => x.profileId === req.params.profileId);
  if (!c) res.status(404).send(shell({ title: 'Not found', body: section('Error',
    empty('No such workspace', 'That client is not in this portal.',
      '<a class="btn btn-primary btn-sm" href="/">Back to workspaces</a>')) }));
  return c;
};

app.get('/w/:profileId', (req, res) => res.redirect(`/w/${req.params.profileId}/connections`));

/* --- Connections ---------------------------------------------------------- */
app.get('/w/:profileId/connections', async (req, res) => {
  const client = findClient(req, res);
  if (!client) return;
  const { list, error } = await safeAccounts(client.profileId);
  const byPlatform = new Map(list.map((a) => [a.platform, a]));
  const extras = list.map((a) => a.platform).filter((p) => !ALL_PLATFORMS.includes(p));
  // A workspace limited to some platforms shows only those, connected or not.
  const only = platformsOf(client);
  const grid = only || [...ALL_PLATFORMS, ...new Set(extras)];
  const live = list.length;
  const dead = list.filter((a) => needsReconnect.has(a._id)).length;
  // Messaging readiness is checked, not assumed: token validity alone does not mean inbound works.
  const MSG = new Set(['instagram', 'facebook', 'whatsapp', 'phone', 'sms', 'telegram']);
  const health = await Promise.all(list.filter((a) => MSG.has(a.platform)).map((a) =>
    accountHealth(a._id).then((h) => ({ a, h }), (e) => ({ a, h: { status: 'unknown', issues: [`${e.status || ''} ${e.message}`.trim()] } }))));
  const healthRow = ({ a, h }) => {
    const wa = h.whatsappConnection;
    const ready = h.status === 'healthy' && (!wa || (wa.status === 'connected' && wa.inboundSubscribed !== false));
    const detail = [
      ...h.issues,
      h.messagingRestriction ? `Messaging restriction: ${typeof h.messagingRestriction === 'string' ? h.messagingRestriction : JSON.stringify(h.messagingRestriction)}` : '',
      wa ? `Meta connection ${wa.status}${wa.phoneStatus ? ` (${wa.phoneStatus})` : ''}; inbound ${wa.inboundSubscribed ? 'subscribed' : 'NOT subscribed'}` : '',
    ].filter(Boolean).join(' · ');
    return `<div class="titem"><span class="idx">${plogo(a.platform, 'plogo-sm')}</span>
      <div style="min-width:0"><div class="title">${esc(platformName(a.platform))} · ${esc(a.username || a.displayName || a._id)}</div>
        <div class="meta sub">${esc(detail || 'No issues reported')}</div></div>
      ${chip(ready ? 'ok' : h.status === 'unknown' ? 'neutral' : 'danger', ready ? 'Ready' : h.status === 'unknown' ? 'Unknown' : 'Action required')}</div>`;
  };

  res.send(
    workspaceShell({
      client,
      tab: 'connections',
      subtitle: `${plural(live, 'account')} connected across ${plural(grid.length, 'platform')}.`,
      actions: `<a class="btn btn-primary" href="/c/${esc(client.profileId)}/connect">
          Open client page ${icon('arrow', 16)}</a>
        <a class="link-underline" href="/">All workspaces</a>`,
      body: `
        ${section(
          'Overview',
          `<div class="metrics">
            ${kpi(0, 'Connected', num(live))}
            ${kpi(1, 'Available', num(grid.length))}
            ${kpi(2, 'Need attention', num(dead), dead ? { dir: 'down', text: 'Action required' } : null)}
          </div>
          <div style="margin-top:var(--s6)">
            <div class="field">
              <label for="wlink">Client connect link</label>
              ${copyField('wlink', connectLink(client.profileId), `connect link for ${client.name}`)}
            </div>
          </div>`,
          true
        )}
        ${section(
          'Platforms',
          error
            ? note('danger', "Couldn't load connections", error)
            : `<div class="pgrid">${grid
                .map((p) =>
                  platformCell(p, byPlatform.get(p), client.profileId,
                    byPlatform.get(p) && needsReconnect.has(byPlatform.get(p)._id))
                )
                .join('')}</div>`
        )}
        ${health.length ? section('Messaging health',
          `<div class="tlist">${health.map(healthRow).join('')}</div>
           <p class="idx" style="margin-top:var(--s3)">Checked live from Zernio on each visit. Reconnect from the client connect link; nothing here disconnects or replaces an account.</p>`) : ''}`,
    })
  );
});

/* --- Content queue -------------------------------------------------------- */
app.get('/w/:profileId/content', async (req, res) => {
  const client = findClient(req, res);
  if (!client) return;
  const [{ list: accts }, page] = await Promise.all([
    safeAccounts(client.profileId),
    listPosts(client.profileId).catch(() => ({ posts: [], total: 0 })),
  ]);
  const { posts, total } = page;
  const group = (s) => posts.filter((p) => p.status === s);
  const scheduled = group('scheduled');
  const published = group('published');
  const failed = group('failed');
  const drafts = group('draft');

  const row = (p) => {
    const st = p.status || 'draft';
    const kind = st === 'published' ? 'ok' : st === 'failed' ? 'danger'
      : st === 'scheduled' ? 'info' : 'neutral';
    const when = p.publishedAt || p.scheduledFor;
    return `<div class="qrow">
      <span class="idx">${esc((p._id || '').slice(-4))}</span>
      <div style="min-width:0">
        <div class="head">${esc((p.title || p.content || 'Untitled').slice(0, 72))}</div>
        <div class="txt">${esc((p.content || '').slice(0, 150))}</div>
        <div class="rail-chips">
          ${chip(kind, st)}
          ${(p.platforms || [])
            // The live URL and the real per-platform status both live here,
            // not on the post — a post can be published on 3 of 4 targets.
            .map((x) =>
              chip(
                x.status === 'failed' ? 'danger' : x.status === 'published' ? 'neutral' : 'warn',
                platformName(x.platform),
                x.platformPostUrl
              )
            )
            .join('')}
          ${when ? `<span class="idx">${esc(ago(when))}</span>` : ''}
        </div>
      </div>
      <div class="row" style="gap:var(--s2)">
        ${st === 'failed'
          ? `<form method="post" action="/w/${esc(client.profileId)}/posts/${esc(p._id)}/retry">
              <button class="btn btn-primary btn-sm" type="submit">Retry</button></form>`
          : ''}
        ${
          // The API refuses to delete published posts, so only offer it where
          // it works. Unpublishing a live post is deliberately not wired here.
          st === 'draft' || st === 'scheduled' || st === 'failed'
            ? `<form method="post" action="/w/${esc(client.profileId)}/posts/${esc(p._id)}/delete"
                onsubmit="return confirm('Delete this ${esc(st)} post? This cannot be undone.')">
                <button class="btn btn-ghost btn-sm" type="submit">Delete</button></form>`
            : `<span class="idx">Live</span>`
        }
      </div>
    </div>`;
  };

  const bucket = (title, rows, hint) =>
    `<div class="card" style="margin-top:var(--s6)">
      <div class="card-head">
        <div><span class="label">${esc(hint)}</span>
          <h2 class="h2" style="margin-top:var(--s3)">${esc(title)}</h2></div>
        <span class="h2 num">${num(rows.length)}</span>
      </div>
      ${rows.length
        ? rows.map(row).join('')
        : `<div class="card-section" style="padding-block:var(--s5)">
            <p class="sub">Nothing here yet.</p></div>`}
    </div>`;

  res.send(
    workspaceShell({
      client,
      tab: 'content',
      subtitle: `${plural(total, 'post')} in this workspace${
        total > posts.length ? ` — showing the ${num(posts.length)} most recent` : ''
      }.`,
      actions: `<button class="btn btn-primary" data-dialog="compose">
          ${icon('plus', 16)} Create post</button>
        <a class="link-underline" href="/w/${esc(client.profileId)}/analytics">See performance</a>`,
      body: `
        ${req.query.posted ? section('Status', note('ok', 'Post sent', req.query.posted)) : ''}
        ${req.query.err ? section('Status', note('danger', 'Post not sent', req.query.err)) : ''}
        ${section(
          'Queue',
          `<div class="metrics">
            ${kpi(0, 'Scheduled', num(scheduled.length))}
            ${kpi(1, 'Published', num(published.length))}
            ${kpi(2, 'Failed', num(failed.length),
              failed.length ? { dir: 'down', text: 'Needs a retry' } : null)}
          </div>
          ${failed.length ? bucket('Failed', failed, 'Needs a retry') : ''}
          ${bucket('Scheduled', scheduled, 'Waiting to go out')}
          ${drafts.length ? bucket('Drafts', drafts, 'Not queued yet') : ''}
          ${bucket('Published', published.slice(0, 10), 'Ten most recent')}`,
          true
        )}
        ${composer(client, accts)}`,
    })
  );
});

// The compose modal: content, media, targets, and when to publish.
const composer = (client, accts) => `<dialog id="compose" aria-labelledby="compose-title">
  <form method="post" action="/w/${esc(client.profileId)}/posts">
    <div class="card-head">
      <div><span class="label">${esc(client.name)}</span>
        <h2 class="h2" id="compose-title" style="margin-top:var(--s3)">Create post</h2></div>
    </div>
    <div class="card-body stack">
      <div class="field">
        <label for="c-content">Content</label>
        <textarea class="input" id="c-content" name="content"
          placeholder="What's on your mind…" required></textarea>
      </div>
      <div class="field">
        <label for="c-image">Media URL <span class="hint">Required by Instagram and TikTok</span></label>
        <input class="input" id="c-image" name="image" type="url" placeholder="https://">
      </div>
      <fieldset class="field">
        <legend>Publish to</legend>
        ${accts.length
          ? `<div class="targets">${accts
              .map(
                (a) => `<label class="check">
                  <input type="checkbox" name="target" value="${esc(a.platform)}:${esc(a._id)}">
                  ${plogo(a.platform, 'plogo-sm')}
                  <span class="name">${esc(a.username || platformName(a.platform))}</span></label>`
              )
              .join('')}</div>`
          : `<p class="sub">No accounts connected yet.</p>`}
      </fieldset>
      <div class="field">
        <label for="c-when">Publishing</label>
        <div class="row row-wrap" style="gap:var(--s4)">
          <label class="check"><input type="radio" name="mode" value="now" checked>
            <span class="name">Now</span></label>
          <label class="check"><input type="radio" name="mode" value="schedule">
            <span class="name">Schedule</span></label>
          <label class="check"><input type="radio" name="mode" value="draft">
            <span class="name">Draft</span></label>
        </div>
      </div>
      <div class="field">
        <label for="c-when">Date &amp; time <span class="hint">Used when scheduling</span></label>
        <input class="input" id="c-when" name="scheduledFor" type="datetime-local">
      </div>
    </div>
    <div class="card-foot row" style="justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button>
      <button class="btn btn-primary btn-sm" type="submit">Publish</button>
    </div>
  </form>
</dialog>`;

app.post('/w/:profileId/posts', async (req, res) => {
  const { profileId } = req.params;
  const back = `/w/${profileId}/content`;
  const targets = [].concat(req.body.target || []);
  if (!targets.length) return res.redirect(`${back}?err=${encodeURIComponent('Pick at least one account.')}`);

  const body = {
    content: req.body.content,
    platforms: targets.map((t) => {
      const [platform, accountId] = t.split(':');
      return { platform, accountId };
    }),
  };
  if (req.body.image) body.mediaItems = [{ type: 'image', url: req.body.image }];
  if (req.body.mode === 'now') body.publishNow = true;
  else if (req.body.mode === 'draft') body.isDraft = true;
  else if (req.body.scheduledFor) body.scheduledFor = new Date(req.body.scheduledFor).toISOString();
  else body.isDraft = true; // scheduling with no date would silently vanish

  try {
    const check = await validatePost(body);
    if (check.valid === false)
      return res.redirect(
        `${back}?err=${encodeURIComponent(check.errors.map((e) => `${e.platform}: ${e.error}`).join(' · '))}`
      );
    const r = await createPost(body);
    res.redirect(`${back}?posted=${encodeURIComponent(r.post?._id || 'queued')}`);
  } catch (e) {
    res.redirect(`${back}?err=${encodeURIComponent(`${e.status || ''} ${e.message}`.trim())}`);
  }
});

// Both report failure rather than silently doing nothing.
const act = (fn, okMsg) => async (req, res) => {
  const back = `/w/${req.params.profileId}/content`;
  try {
    await fn(req.params.id);
    res.redirect(`${back}?posted=${encodeURIComponent(okMsg)}`);
  } catch (e) {
    res.redirect(`${back}?err=${encodeURIComponent(`${e.status || ''} ${e.message}`.trim())}`);
  }
};
app.post('/w/:profileId/posts/:id/retry', act(retryPost, 'Retry queued'));
app.post('/w/:profileId/posts/:id/delete', act(deletePost, 'Post deleted'));

/* --- Calendar ------------------------------------------------------------- */
app.get('/w/:profileId/calendar', async (req, res) => {
  const client = findClient(req, res);
  if (!client) return;

  // ?m=YYYY-MM drives the view; default to the current month.
  const now = new Date();
  // Two digits is not enough: "2026-13" rolled into Jan 2027 and printed
  // "undefined 2026" from MONTHS[12].
  const raw = String(req.query.m || '');
  const ok = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw);
  const year = ok ? +raw.slice(0, 4) : now.getFullYear();
  const month = ok ? +raw.slice(5, 7) - 1 : now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month + 1)}-01`;
  const last = `${year}-${pad(month + 1)}-${new Date(year, month + 1, 0).getDate()}`;

  const step = (delta) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  };
  const url = (mm, dd) =>
    `/w/${encodeURIComponent(client.profileId)}/calendar?m=${mm}${dd ? `&d=${dd}` : ''}`;

  let posts = [];
  let error = null;
  try {
    posts = await listPostsRange(client.profileId, first, last);
  } catch (e) {
    error = `${e.status || ''} ${e.message}`.trim();
  }

  // Bucket by local calendar day.
  const byDay = new Map();
  for (const p of posts) {
    const raw = postDate(p);
    if (!raw) continue;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(p);
  }
  for (const arr of byDay.values())
    arr.sort((a, b) => new Date(postDate(a)) - new Date(postDate(b)));

  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const openDay = /^\d{4}-\d{2}-\d{2}$/.test(req.query.d || '') ? req.query.d : null;
  const count = (s) => posts.filter((p) => p.status === s).length;
  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  const dayPanel = () => {
    const list = byDay.get(openDay) || [];
    const label = new Date(openDay + 'T12:00:00').toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return `<div class="card">
      <div class="card-head">
        <div><h2 class="h2">${esc(label)}</h2>
          <p class="sub" style="font-size:var(--t-sm)">${esc(plural(list.length, 'post'))}</p></div>
        <a class="btn btn-ghost btn-sm" href="${esc(url(`${year}-${pad(month + 1)}`))}">Close</a>
      </div>
      ${list.length
        ? `<div class="list">${list
            .map((p) => {
              const live = p.platforms?.find((x) => x.platformPostUrl)?.platformPostUrl;
              return `<div class="list-row">
                ${plogo(p.platforms?.[0]?.platform || 'default', 'plogo-sm')}
                <div class="who" style="flex:1;min-width:0">
                  <div class="name truncate">${esc((p.title || p.content || 'Untitled').slice(0, 80))}</div>
                  <div class="meta">${esc(clock(postDate(p)))}</div>
                </div>
                ${chip(p.status === 'published' ? 'ok' : p.status === 'failed' ? 'danger'
                  : p.status === 'scheduled' ? 'info' : 'neutral', p.status || 'draft')}
                ${live ? `<a class="btn btn-ghost btn-sm" href="${esc(live)}"
                  target="_blank" rel="noopener">View</a>` : ''}
              </div>`;
            })
            .join('')}</div>`
        : `<div class="card-body"><p class="sub">Nothing on this day.</p></div>`}
    </div>`;
  };

  res.send(
    workspaceShell({
      client,
      tab: 'calendar',
      counts: { calendar: posts.length },
      subtitle: `${plural(posts.length, 'post')} in ${monthLabel(year, month)}`,
      actions: `<button class="btn btn-primary" data-dialog="compose">
          ${icon('plus', 16)} Create post</button>`,
      body: `
        ${error ? note('danger', "Couldn't load this month", error) : ''}
        <div class="row row-wrap">
          <div class="cal-nav">
            <a class="btn btn-secondary btn-sm" href="${esc(url(step(-1)))}"
              aria-label="Previous month">${icon('left', 16)}</a>
            <span class="month">${esc(monthLabel(year, month))}</span>
            <a class="btn btn-secondary btn-sm" href="${esc(url(step(1)))}"
              aria-label="Next month">${icon('right', 16)}</a>
            <a class="btn btn-ghost btn-sm" href="${esc(
              url(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`)
            )}">Today</a>
          </div>
          <div class="spacer"></div>
          <div class="legend">
            <span><i style="background:var(--ok)"></i>Published ${num(count('published'))}</span>
            <span><i style="background:var(--accent)"></i>Scheduled ${num(count('scheduled'))}</span>
            <span><i style="background:var(--danger)"></i>Failed ${num(count('failed'))}</span>
            <span><i style="background:var(--n-400)"></i>Draft ${num(count('draft'))}</span>
          </div>
        </div>

        ${calendar({ year, month, byDay, todayKey, profileId: client.profileId, openDay })}

        ${openDay ? dayPanel() : ''}

        <div class="metrics">
          ${metricSlot(0, 'Posts this month', num(posts.length))}
          ${metricSlot(1, 'Active days', num(byDay.size))}
          ${metricSlot(2, 'Busiest day',
            busiest ? `${new Date(busiest[0] + 'T12:00:00').getDate()} · ${busiest[1].length}` : '—')}
        </div>

        ${composer(client, (await safeAccounts(client.profileId)).list)}`,
    })
  );
});

/* --- Analytics ------------------------------------------------------------ */
app.get('/w/:profileId/analytics', async (req, res) => {
  const client = findClient(req, res);
  if (!client) return;
  const [a, daily, slots] = await Promise.all([
    analytics(client.profileId).catch((e) => ({ error: e.message })),
    dailyMetrics(client.profileId, 30).catch(() => ({ dailyData: [] })),
    bestTime(client.profileId).catch(() => []),
  ]);

  if (a.error)
    return res.send(
      workspaceShell({ client, tab: 'analytics', subtitle: 'Performance across every connected account.',
        body: section('Error', note('danger', "Couldn't load analytics", a.error)) })
    );

  const posts = a.posts || [];
  // platformBreakdown covers the WHOLE window. Deriving totals from the posts
  // page would measure the page size, not the account — 8 of 161 here.
  const bd = daily.platformBreakdown || [];
  const sum = (k) => bd.reduce((n, p) => n + (p[k] || 0), 0);
  const likes = sum('likes'), comments = sum('comments'), shares = sum('shares');
  const views = sum('views'), impressions = sum('impressions');
  // YouTube/TikTok report views, Instagram reports impressions — count both.
  const seen = views + impressions;
  const eng = seen ? ((likes + comments + shares) / seen) * 100 : 0;

  const perPlatform = bd
    .filter((p) => p.postCount)
    .sort((x, y) => y.postCount - x.postCount)
    .slice(0, 6);

  // Real 28 days, by date — dailyData spans months, so slicing entries lies.
  const cutoff = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10);
  const days = (daily.dailyData || []).filter((d) => d.date >= cutoff);
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      label: chunk[0]?.date?.slice(5) || '',
      value: chunk.reduce((n, d) => n + (d.postCount || 0), 0),
    });
  }
  const windowLabel = daily.dailyData?.length
    ? `${daily.dailyData[0].date} → ${daily.dailyData.at(-1).date}`
    : 'no data';

  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const top = slots.slice(0, 5);

  const platformRows = bd
    .filter((p) => p.postCount || p.views || p.impressions || p.likes)
    .sort((x, y) => (y.postCount || 0) - (x.postCount || 0));
  const bestSlot = Math.max(0, ...top.map((s) => s.avg_engagement || 0));

  res.send(
    workspaceShell({
      client,
      tab: 'analytics',
      subtitle: 'Performance across every connected account, read live.',
      actions: `<a class="btn btn-secondary" href="/w/${esc(client.profileId)}/content">Content queue</a>
        <a class="btn btn-primary" href="/w/${esc(client.profileId)}/report">${icon('report', 16)} Client report</a>`,
      body: `
        ${section(
          'Headline',
          `<div class="metrics">
            ${kpi(0, 'Posts', num(a.overview?.totalPosts || 0))}
            ${kpi(1, 'Views + impressions', num(seen))}
            ${kpi(2, 'Engagement', `${eng.toFixed(2)}%`)}
          </div>
          <div class="metrics" style="margin-top:var(--s4)">
            ${kpi(3, 'Likes', num(likes))}
            ${kpi(4, 'Comments', num(comments))}
            ${kpi(5, 'Last sync', a.overview?.lastSync ? ago(a.overview.lastSync) : '—')}
          </div>
          <p class="rsub" style="margin-top:var(--s3)">
            Window ${esc(windowLabel)}. Totals come from the platform breakdown,
            not the visible page.</p>`,
          true
        )}
        ${section(
          'Platforms',
          zcard('Platform Breakdown', platformRows.length
            ? metricTable({
                first: 'Platform',
                label: 'Platform breakdown',
                cols: ['posts', 'likes', 'comments', 'shares', 'saves', 'clicks', 'views', 'impressions', 'reach', 'er'],
                rows: platformRows.map((p) => ({
                  first: platformCellName(p.platform), sortKey: platformName(p.platform), platform: p.platform,
                  values: { ...p, posts: p.postCount || 0 }, er: engagementRate(p),
                })),
                note: '– means the platform does not report that number. Click a column to sort.',
              })
            : empty('No posts in range', 'Publish something and it will show up here.'),
          { meta: esc(windowLabel) })
        )}
        ${section(
          'Trend',
          `<div class="rgrid2">
          ${chartBlock(
            'Deliveries per platform',
            'One post to four platforms counts four times',
            num(bd.reduce((n, p) => n + (p.postCount || 0), 0)),
            perPlatform.length
              ? barChart(
                  perPlatform.map((p, i) => ({
                    label: platformName(p.platform), value: p.postCount, accent: i === 0,
                  })),
                  { label: 'Posts per platform' }
                )
              : empty('No posts in range', 'Publish something and it will show up here.')
          )}
          ${chartBlock(
            'Engagement per platform',
            'Likes plus comments, full window',
            num(likes + comments),
            perPlatform.length
              ? barChart(
                  perPlatform.map((p, i) => ({
                    label: platformName(p.platform),
                    value: (p.likes || 0) + (p.comments || 0), accent: i === 0,
                  })),
                  { label: 'Engagement per platform' }
                )
              : ''
          )}</div>
          <div style="margin-top:var(--s4)">
          ${chartBlock(
            'Posts over time',
            'Per week, last 28 days',
            num(weeks.reduce((n, w) => n + w.value, 0)),
            weeks.length
              ? barChart(weeks.map((w, i) => ({ ...w, accent: i === weeks.length - 1 })),
                  { label: 'Posts per week' })
              : empty('Nothing in the last 28 days',
                  'The account has older history, but no posts inside this window.')
          )}</div>`
        )}
        ${section(
          'Recent',
          zcard('Latest posts', posts.length
            ? metricTable({
                first: 'Post',
                label: 'Latest posts',
                cols: ['likes', 'comments', 'shares', 'views', 'impressions', 'reach', 'er'],
                rows: posts.map((p) => ({
                  first: `<span class="zpost">${plogo(p.platform, 'plogo-bare')}<span style="min-width:0"><span class="zpost-t">${esc(
                    (p.content || p.title || 'Untitled').split(/\r?\n/)[0].slice(0, 120))}</span><span class="zpost-d">${esc(
                    p.publishedAt || p.scheduledFor ? clock(p.publishedAt || p.scheduledFor) : '')}</span></span></span>`,
                  sortKey: p.publishedAt || p.scheduledFor || '',
                  platform: p.platform,
                  values: p.analytics || {},
                  er: p.analytics?.engagementRate ?? null,
                })),
              })
            : empty('No posts yet', 'Published posts and their metrics appear here.'),
          { meta: `${esc(plural(a.pagination?.total || posts.length, 'post'))} total`, sub: 'Most recent, newest first' })
        )}
        ${section(
          'Timing',
          zcard('Best time to post', top.length
            ? ranked(top.map((s, i) => ({
                icon: icon('clock', 18),
                label: `${DAY[s.day_of_week] || '—'} · ${String(s.hour).padStart(2, '0')}:00`,
                sub: esc(plural(s.post_count, 'post')),
                value: s.avg_engagement || 0,
                display: `${num(Math.round(s.avg_engagement || 0))} avg`,
                best: i === 0 && bestSlot > 0 && top.length > 1,
              })), { label: 'Best time to post' })
            : empty('Not enough data yet',
                'Best-time needs a few weeks of posting history before it can rank slots.'),
          { meta: 'highest average engagement' })
        )}`,
    })
  );
});

/* --- Inbox ---------------------------------------------------------------- */
// Lives in inbox/routes.js: server-side workspace scoping, paginated list/history, explicit read receipts,
// idempotent replies with honest pending/accepted/failed/unknown states, and new-thread rules per channel.
inboxRoutes(app, {
  store,
  findClient,
  workspaceShell,
  v: { esc, note, empty, icon, plogo, platformName, ago, clock, num, plural, chip },
});

/* --- Report ----------------------------------------------------------------- */
// Organic, paid, response time and sentiment for one client and one window; the agency tab here, the
// client's branded link at /c/:profileId/report. Lives in report/.
reportRoutes(app, {
  clients,
  findClient,
  workspaceShell,
  clientPage,
  v: { esc, icon, empty, BRAND },
});

/* --- Automations ------------------------------------------------------------ */
// Comment-to-DM, followers only, story mentions, ref links: the ManyChat patterns on Zernio, plus the JSON
// API the AI agent uses (/api). Lives in automations/.
automationRoutes(app, {
  clients,
  findClient,
  workspaceShell,
  express,
  v: { esc, note, empty, icon, plogo, platformName, ago, clock, num, plural, chip, copyField },
});

/* ============================================================ agency dashboard */
app.get('/', (req, res) => {
  const list = clients();

  const workspace = (c, i) => `<div class="card">
      <div class="card-head">
        <div style="min-width:0">
          <span class="idx">${esc(idx(i))}</span>
          <h2 class="h1" style="margin-top:var(--s2)">
            <a href="/w/${esc(c.profileId)}/connections">${esc(c.name)}</a></h2>
        </div>
        <div class="row" style="gap:var(--s2)">
          <a class="btn btn-primary btn-sm" href="/w/${esc(c.profileId)}/connections">
            Open workspace ${icon('arrow', 14)}</a>
          <a class="btn btn-ghost btn-sm" href="/c/${esc(c.profileId)}/connect">Client page</a>
        </div>
      </div>

      <div class="card-section">
        <div class="field">
          <label for="link-${esc(c.profileId)}">Client connect link</label>
          ${copyField(`link-${c.profileId}`, connectLink(c.profileId), `connect link for ${c.name}`)}
        </div>
      </div>

      ${asyncAccounts(c.profileId, 3)}
    </div>`;

  res.send(
    shell({
      title: 'Client workspaces',
      active: '/',
      clientList: list,
      counts: { '/': list.length, '/events': events.length },
      subtitle:
        'Every client gets an isolated workspace and a connect page carrying only your brand. ' +
        'Accounts and posting run through one key that never leaves this server.',
      active: '/',
      actions: `<button class="btn btn-primary" data-dialog="add-client">
          ${icon('plus', 16)} Add client</button>
        <a class="link-underline" href="/prove-isolation">See the boundary</a>`,
      body: `
        ${
          req.query.error || req.query.created
            ? section(
                'Status',
                req.query.error
                  ? note('danger', 'Workspace not created', req.query.error)
                  : note('ok', 'Workspace created', req.query.created)
              )
            : ''
        }

        ${section(
          'Overview',
          `<div class="metrics">
            ${metricSlot(0, 'Clients', num(list.length))}
            ${metricSlot(1, 'Connected accounts', '', 'accounts')}
            ${metricSlot(2, 'Need attention', '', 'attention')}
          </div>`,
          true
        )}

        ${section(
          'Workspaces',
          list.length
            ? list.map(workspace).join('')
            : `<div class="card">${empty(
                'No workspaces yet',
                'Create the first one and you’ll get a branded connect link to send straight to the client. ' +
                  'Already have Zernio profiles? Copy clients.example.json to clients.json and put their profile ids in it.',
                `<button class="btn btn-primary" data-dialog="add-client">Create a workspace</button>`
              )}</div>`
        )}

        <dialog id="add-client" aria-labelledby="add-client-title">
          <form method="post" action="/clients">
            <div class="card-head">
              <div>
                <span class="label">New workspace</span>
                <h2 class="h2" id="add-client-title" style="margin-top:var(--s3)">Add client</h2>
              </div>
            </div>
            <div class="card-body">
              <div class="field">
                <label for="new-client">Client name</label>
                <input class="input" id="new-client" name="name" required autofocus
                  placeholder="Harbour Dental" autocomplete="off">
                <span class="hint">Creates a real workspace and its branded connect link.</span>
              </div>
            </div>
            <div class="card-foot row" style="justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button>
              <button class="btn btn-primary btn-sm" type="submit">Create workspace</button>
            </div>
          </form>
        </dialog>`,
    })
  );
});

/* Dev-only: hold or break a panel so loading and error states stay inspectable. */
const devTrip = async (q) => {
  if (process.env.NODE_ENV === 'production') return null;
  if (q.delay) await new Promise((r) => setTimeout(r, Math.min(+q.delay || 0, 8000)));
  return q.fail ? 'Upstream API unreachable (dev simulation)' : null;
};

/* One workspace panel: status, accounts, composer. Loaded after first paint. */
app.get('/w/:profileId/accounts', async (req, res) => {
  const { profileId } = req.params;
  const client = clients().find((c) => c.profileId === profileId);
  const simulated = await devTrip(req.query);
  const { list, error = simulated } = simulated ? { list: [] } : await safeAccounts(profileId);
  res.type('html');

  if (error)
    return res.send(`<div class="card-body">
      ${note('danger', "Couldn't load this workspace", error)}
      <div style="margin-top:var(--s4)">
        <button class="btn btn-ghost btn-sm" onclick="location.reload()">Retry</button>
      </div></div>`);

  if (!list.length)
    return res.send(`<div class="card-section">${empty(
      'No accounts connected',
      'Send this client their connect link — accounts they authorise appear here automatically.',
      `<a class="btn btn-primary btn-sm" href="/c/${esc(profileId)}/connect">Open connect page</a>`
    )}</div>`);

  const dead = list.filter((a) => needsReconnect.has(a._id)).length;
  res.send(`
    <div class="card-section row row-wrap">
      ${dead ? chip('danger', `${dead} need${dead === 1 ? 's' : ''} reconnecting`) : chip('ok', 'All healthy')}
      <span class="label">${plural(list.length, 'account')}</span>
    </div>
    ${accounts(list, needsReconnect, profileId)}
    <div class="card-section">
      <form class="stack" method="post" action="/clients/${esc(profileId)}/post">
        <div class="field">
          <label for="content-${esc(profileId)}">New post</label>
          <textarea class="input" id="content-${esc(profileId)}" name="content"
            placeholder="Write something for ${esc(client?.name || 'this client')}…" required></textarea>
        </div>
        <div class="field">
          <label for="image-${esc(profileId)}">Image URL
            <span class="hint">Required by Instagram and TikTok</span></label>
          <input class="input" id="image-${esc(profileId)}" name="image" type="url" placeholder="https://">
        </div>
        <fieldset class="field">
          <legend>Publish to</legend>
          <div class="targets">
            ${list
              .map(
                (a) => `<label class="check">
                  <input type="checkbox" name="target" value="${esc(a.platform)}:${esc(a._id)}">
                  ${plogo(a.platform, 'plogo-sm')}
                  <span class="name">${esc(a.username || platformName(a.platform))}</span></label>`
              )
              .join('')}
          </div>
        </fieldset>
        <div class="row"><button class="btn btn-primary btn-sm" type="submit">Publish now</button></div>
      </form>
      ${postResult(lastPost.get(profileId))}
    </div>`);
});

const postResult = (r) => {
  if (!r) return '';
  if (r.error)
    return `<div style="margin-top:var(--s5)">${note('danger', 'Post not sent', r.error)}</div>`;
  const rows = r.post?.platforms || [];
  return `<div class="stack" style="margin-top:var(--s5)">
    ${note('ok', 'Post sent', `Reference ${r.post?._id || ''}`)}
    <div class="row row-wrap" style="gap:var(--s2)">
      ${rows
        .map((p) => {
          const st = p.status || 'pending';
          const kind = st === 'published' ? 'ok' : st === 'failed' ? 'danger'
            : st === 'scheduled' ? 'info' : 'warn';
          return chip(kind, `${p.platform} · ${st}`);
        })
        .join('')}
    </div></div>`;
};

app.post('/clients', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/');
  try {
    const profile = await createProfile(name, BRAND.accent);
    save([...clients(), { name, profileId: profile._id }]);
    res.redirect(`/?created=${encodeURIComponent(name)}`);
  } catch (err) {
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

/* ================================================================== publishing */
app.post('/clients/:profileId/post', async (req, res) => {
  const { profileId } = req.params;
  const targets = [].concat(req.body.target || []);
  const body = {
    content: req.body.content,
    platforms: targets.map((t) => {
      const [platform, accountId] = t.split(':');
      return { platform, accountId };
    }),
    publishNow: true,
  };
  if (req.body.image) body.mediaItems = [{ type: 'image', url: req.body.image }];

  if (!body.platforms.length) {
    lastPost.set(profileId, { error: 'Pick at least one account to publish to.' });
    return res.redirect('/');
  }
  try {
    // Dry-run first so platform rules surface as readable text, not a failed post.
    const check = await validatePost(body);
    if (check.valid === false)
      lastPost.set(profileId, {
        error: check.errors.map((e) => `${e.platform}: ${e.error}`).join(' · '),
      });
    else lastPost.set(profileId, await createPost(body));
  } catch (e) {
    lastPost.set(profileId, { error: `${e.status || ''} ${e.message}`.trim() });
  }
  res.redirect('/');
});

/* ============================================================ activity / events */
app.get('/events', (req, res) => {
  const list = clients();
  res.send(
    shell({
      title: 'Platform activity',
      subtitle: 'Signed webhook deliveries, newest first. Nothing is stored between restarts.',
      active: '/events',
      clientList: list,
      counts: { '/': list.length, '/events': events.length },
      body: section(
        'Events',
        events.length
          ? `<div class="tlist">${events
              .map((e, i) => {
                const who = list.find((c) => c.profileId === e.profileId);
                const kind = e.event.includes('disconnected') || e.event.includes('failed')
                  ? 'danger' : e.event.includes('connected') ? 'ok' : 'neutral';
                return `<div class="titem">
                  <span class="idx">${esc(idx(i))}</span>
                  <div style="min-width:0">
                    <div class="title">${esc(who?.name || 'Unknown workspace')}</div>
                    <div class="meta row row-wrap">
                      ${chip(kind, e.event)}
                      ${e.detail ? `<span class="sub">${esc(e.detail)}</span>` : ''}
                    </div>
                  </div>
                  <time class="idx" datetime="${esc(e.at || '')}">${esc(ago(e.at))}</time>
                </div>`;
              })
              .join('')}</div>`
          : empty(
              'No events yet',
              'Account and post events land here as soon as a public webhook URL is registered.',
              `<a class="btn btn-ghost btn-sm" href="/">Back to workspaces</a>`
            ),
        true
      ) + inboxEventsSection(list),
    })
  );
});

// Inbox webhook deliveries from the durable store: ids and processing state only, never message text.
function inboxEventsSection(list) {
  const rows = store.recentEvents(30);
  return section(
    'Inbox events',
    rows.length
      ? `<div class="tlist">${rows
          .map((e, i) => {
            const who = list.find((c) => c.profileId === e.profile_id);
            const kind = e.error ? 'danger' : e.state === 'done' ? 'ok' : 'neutral';
            return `<div class="titem">
              <span class="idx">${esc(idx(i))}</span>
              <div style="min-width:0">
                <div class="title">${esc(who?.name || (e.state === 'ignored' ? 'Not a workspace here' : 'Unrouted'))}</div>
                <div class="meta row row-wrap">
                  ${chip(kind, `${e.event} · ${e.state}`)}
                  ${e.error ? `<span class="sub">${esc(e.error)}</span>` : ''}
                </div>
              </div>
              <time class="idx" datetime="${esc(e.received_at || '')}">${esc(ago(e.received_at))}</time>
            </div>`;
          })
          .join('')}</div>`
      : empty('No inbox events yet', 'Message events land here once the portal webhook subscription exists (setup-webhook.js). Pending rows are retried every 15 s and at start-up.'),
    true
  );
}

/* =============================================================== isolation proof */
app.get('/prove-isolation', async (req, res) => {
  const list = clients();
  const [a, b] = list;
  const frame = (body) =>
    shell({
      title: 'Workspace isolation',
      subtitle: 'One client’s key, asked for two clients’ data. The platform answers, not this app.',
      active: '/prove-isolation',
      clientList: list,
      body,
    });

  if (!b)
    return res.send(
      frame(
        section(
          'Proof',
          `<div class="card">${empty(
            'Two workspaces needed',
            'The probe asks one client’s scoped key for another client’s accounts, so it needs at least two.',
            `<a class="btn btn-primary btn-sm" href="/">Add a client</a>`
          )}</div>`
        )
      )
    );

  let key;
  try {
    key = await createScopedKey(`isolation-probe-${Date.now()}`, [a.profileId]);
    const own = await listAccounts(a.profileId, key.key).then(
      (r) => ({ status: 200, body: { accounts: r.length } }),
      (e) => ({ status: e.status, body: e.body })
    );
    const other = await listAccounts(b.profileId, key.key).then(
      (r) => ({ status: 200, body: r }),
      (e) => ({ status: e.status, body: e.body })
    );
    const panel = (i, title, sub, r, ok) => `<div class="card">
      <div class="card-head">
        <div>
          <span class="idx">${esc(idx(i))}</span>
          <h2 class="h2" style="margin-top:var(--s2)">${esc(title)}</h2>
          <p class="sub" style="margin-top:var(--s2)">${esc(sub)}</p>
        </div>
        ${chip(ok ? 'ok' : 'danger', `HTTP ${r.status}`)}
      </div>
      <div class="card-body"><pre class="raw">${esc(JSON.stringify(r.body, null, 2))}</pre></div>
    </div>`;

    res.send(
      frame(
        section(
          'Proof',
          `${note('info', `Read-only key scoped to ${a.name}`, 'Minted for this request, deleted immediately after.')}
          <div style="margin-top:var(--s8)">
            ${panel(0, `Its own workspace — ${a.name}`, 'Allowed. The key owns this profile.', own, own.status === 200)}
            ${panel(1, `Another workspace — ${b.name}`, 'Refused upstream, not by this app.', other, other.status === 200)}
          </div>`,
          true
        )
      )
    );
  } catch (err) {
    res.send(
      frame(
        section(
          'Proof',
          `<div class="card"><div class="card-body">
            ${note('danger', 'The probe could not run', err.message)}
            <div style="margin-top:var(--s4)">
              <a class="btn btn-ghost btn-sm" href="/prove-isolation">Try again</a></div>
          </div></div>`
        )
      )
    );
  } finally {
    if (key?.id) await deleteKey(key.id).catch(() => {});
  }
});

/* ========================================================= client-facing connect */
app.get('/c/:profileId/connect', async (req, res) => {
  const { profileId } = req.params;
  const client = clients().find((c) => c.profileId === profileId);
  const { list, error } = await safeAccounts(profileId);
  const q = req.query;

  // An unknown profile means a dead or mistyped link. Offering Connect buttons
  // here sends the client into an OAuth flow that cannot succeed.
  if (!client && error)
    return res.status(404).send(
      clientPage({
        title: 'Link not valid',
        lede: 'This connect link does not point at an active workspace.',
        body: `<div class="card"><div class="card-body">${empty(
          'We can’t open this page',
          'The link may have expired or been typed incorrectly. Ask whoever sent it for a fresh one.'
        )}</div></div>`,
      })
    );

  res.send(
    clientPage({
      title: 'Connect your accounts',
      lede: `Authorise ${BRAND.name} to publish on your behalf. ` +
            `Each platform asks for permission on its own sign-in page. You can revoke access at any time.`,
      body: `
        ${
          q.connected || q.error
            ? section(
                'Status',
                q.connected
                  ? note('ok', `${q.connected} connected`, q.username ? `@${q.username}` : '')
                  : note('danger', 'We couldn’t finish connecting', q.error)
              )
            : ''
        }

        ${PLATFORMS.some(([id]) => !platformsOf(client) || platformsOf(client).includes(id)) ? section(
          'Add',
          `<div class="connect-list">
            ${PLATFORMS.filter(([id]) => !platformsOf(client) || platformsOf(client).includes(id)).map(
              ([id, label], i) => `<a class="connect-item" href="/connect/${esc(profileId)}/${id}">
                <span class="idx">${esc(idx(i))}</span>
                ${plogo(id, 'plogo-lg')}
                <span class="title">${label}</span>
                <span class="go">${icon('arrow', 22)}</span>
              </a>`
            ).join('')}
          </div>
          <!-- Plain links: the critical path works with or without JavaScript. -->`,
          true
        ) : ''}

        ${section(
          'Connected',
          `<div class="card">
            <div class="card-head">
              <div>
                <span class="label">${client ? esc(client.name) : 'Your workspace'}</span>
                <h2 class="h2" style="margin-top:var(--s3)">Connected accounts</h2>
              </div>
              ${list.length ? chip('ok', plural(list.length, 'account')) : ''}
            </div>
            ${
              error
                ? `<div class="card-body">${note('danger', 'We couldn’t load your accounts', error)}
                   <div style="margin-top:var(--s4)"><a class="btn btn-ghost btn-sm"
                     href="/c/${esc(profileId)}/connect">Try again</a></div></div>`
                : list.length
                  ? accounts(list, needsReconnect, profileId)
                  : `<div class="card-section">${empty(
                      'Nothing connected yet',
                      'Choose a platform above and you’ll be taken to its own secure sign-in.'
                    )}</div>`
            }
          </div>`
        )}`,
    })
  );
});

/* ===================================================================== webhooks */
// Signature on the raw body, durable record before the 200, dedupe by event id, async worker.
// Account/post events keep feeding the existing activity log exactly as before.
app.post('/webhooks/zernio', express.raw({ type: '*/*', limit: '1mb' }), webhookHandler({
  store,
  kick: kickWorker,
  onLegacy: (p) => {
    if (p.event === 'account.disconnected') needsReconnect.add(p.account?.accountId);
    if (p.event === 'account.connected') needsReconnect.delete(p.account?.accountId);
    events.unshift({
      event: p.event,
      profileId: p.account?.profileId || p.post?.profileId,
      detail: p.account?.username || p.post?.content?.slice(0, 48) || '',
      at: p.timestamp,
    });
    events.length = Math.min(events.length, 12);
  },
}));

/* ================================================================= connect flow */
const connectPage = (profileId, q = '') => `/c/${encodeURIComponent(profileId)}/connect${q}`;
const fail = (res, profileId, err) =>
  res.redirect(connectPage(profileId, `?error=${encodeURIComponent(err.message || err)}`));

// A connection starts here. The workspace is bound SERVER-SIDE to a single-use, expiring intent tied to
// this browser (cookie); the callback carries only the opaque nonce. A profileId typed into the callback
// URL is ignored, so a tampered or replayed callback cannot attach an account to another workspace.
const browserId = (req, res) => {
  const found = /(?:^|;\s*)zc_b=([A-Za-z0-9_-]{16,})/.exec(req.headers.cookie || '');
  if (found) return found[1];
  const id = randomBytes(18).toString('base64url');
  res.append('Set-Cookie', `zc_b=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  return id;
};
const browserHash = (id) => createHmac('sha256', process.env.WEBHOOK_SECRET || 'local-intent-salt').update(id).digest('hex');
const pendingSelections = new Map(); // tempToken -> { profileId, expires } (LinkedIn picker)

app.get('/connect/:profileId/:platform', async (req, res) => {
  const { profileId, platform } = req.params;
  if (!clients().some((c) => c.profileId === profileId)) return fail(res, profileId, 'unknown workspace');
  const nonce = randomBytes(18).toString('base64url');
  store.createIntent({ nonce, profileId, platform, browserHash: browserHash(browserId(req, res)) });
  const back = `${process.env.BASE_URL}/callback/${encodeURIComponent(platform)}?i=${nonce}`;
  try {
    const { authUrl } = await connectUrl(platform, profileId, back);
    res.redirect(authUrl);
  } catch (err) {
    fail(res, profileId, err);
  }
});

// Re-read the workspace's accounts before announcing success: a redirect is not proof of a connection.
const confirmConnected = async (res, profileId, platform, accountId, username) => {
  const list = await workspaceAccounts(profileId, { fresh: true }).catch(() => []);
  const hit = list.find((a) => (accountId ? accountIdOf(a) === accountId : a.platform === platform));
  if (!hit) return fail(res, profileId, `${platform} did not appear in this workspace after authorisation — check it in the Zernio dashboard`);
  res.redirect(connectPage(profileId, `?connected=${encodeURIComponent(platform)}&username=${encodeURIComponent(hit.username || username || '')}`));
};

app.get('/callback/:platform', async (req, res) => {
  const { platform } = req.params;
  const { i, code, state, pendingDataToken, connected, username, error } = req.query;
  const intent = store.consumeIntent({ nonce: String(i || ''), platform, browserHash: browserHash(browserId(req, res)) });
  // Scrub callback tokens from the visible URL/history: every exit below is a redirect or a fresh page.
  if (!intent.ok)
    return res.status(400).send(clientPage({ title: 'Connection not accepted', lede: 'This sign-in could not be matched to a workspace.',
      body: `<div class="card"><div class="card-body">${note('danger', 'Start again from your connect link', intent.reason)}</div></div>` }));
  const profileId = intent.profileId;
  if (error) return fail(res, profileId, error);

  if (connected || req.query.accountId) return confirmConnected(res, profileId, platform, req.query.accountId, username);

  try {
    // Selection platform (linkedin): render OUR picker, never the vendor's.
    if (pendingDataToken) {
      const d = await pendingData(pendingDataToken);
      pendingSelections.set(d.tempToken, { profileId, expires: Date.now() + 15 * 60 * 1000 });
      const hidden = `<input type="hidden" name="tempToken" value="${esc(d.tempToken)}">
        <input type="hidden" name="userProfile" value="${esc(JSON.stringify(d.userProfile))}">`;
      const rows = [
        {
          name: d.userProfile?.displayName || 'My personal profile',
          meta: 'Personal profile',
          value: { accountType: 'personal' },
        },
        ...(d.organizations || []).map((o) => ({
          name: o.name,
          meta: o.vanityName ? `Company page — ${o.vanityName}` : 'Company page',
          value: {
            accountType: 'organization',
            selectedOrganization: { id: o.id, urn: o.urn, name: o.name },
          },
        })),
      ];
      return res.send(
        clientPage({
          title: 'Choose an account',
          lede: `Pick the profile or page ${BRAND.name} should publish to.`,
          body: section(
            'Select',
            `<div class="tlist">${rows
              .map(
                (r, i) => `<form class="titem" method="post" action="/select/${esc(platform)}">
                  ${hidden}
                  <input type="hidden" name="choice" value="${esc(JSON.stringify(r.value))}">
                  <span class="idx">${esc(idx(i))}</span>
                  <div style="min-width:0">
                    <div class="title">${esc(r.name)}</div>
                    <div class="meta label">${esc(r.meta)}</div>
                  </div>
                  <button class="btn btn-primary btn-sm" type="submit">Connect</button>
                </form>`
              )
              .join('')}</div>`,
            true
          ),
        })
      );
    }

    if (code && state) {
      const r = await completeOAuth(platform, { code, state, profileId });
      return confirmConnected(res, profileId, platform, r.account?._id || r.account?.accountId, r.account?.username);
    }
    fail(res, profileId, 'the platform returned no authorisation data');
  } catch (err) {
    fail(res, profileId, err);
  }
});

app.post('/select/:platform', async (req, res) => {
  const { tempToken, userProfile, choice } = req.body;
  // The workspace comes from the server-side record made at callback time, never from the form.
  const sel = pendingSelections.get(tempToken);
  pendingSelections.delete(tempToken);
  if (!sel || sel.expires < Date.now())
    return res.status(400).send(clientPage({ title: 'Selection expired', lede: 'Start the connection again from your connect link.', body: '' }));
  const { profileId } = sel;
  try {
    const r = await selectLinkedInOrg({
      profileId,
      tempToken,
      userProfile: JSON.parse(userProfile),
      ...JSON.parse(choice),
    });
    return confirmConnected(res, profileId, req.params.platform, r.account?._id || r.account?.accountId, r.account?.username);
  } catch (err) {
    fail(res, profileId, err);
  }
});

/* ============================================================ errors ========= */
// Anything unrouted. Without this Express answers a bare "Cannot GET /path",
// which is exactly the unstyled error the standard forbids.
app.use((req, res) => {
  res.status(404).send(
    shell({
      title: 'Page not found',
      subtitle: 'That address does not match anything in this portal.',
      clientList: clients(),
      body: `<div class="card"><div class="card-body">${empty(
        '404 — nothing here',
        `Nothing is served at ${req.path}. It may have been a stale link, or a workspace that was removed.`,
        `<a class="btn btn-primary btn-sm" href="/">Back to all clients</a>`
      )}</div></div>`,
    })
  );
});

// Anything thrown. Four arguments is what marks this as an error handler.
app.use((err, req, res, _next) => {
  console.error('unhandled:', err);
  res.status(500).send(
    shell({
      title: 'Something went wrong',
      subtitle: 'The portal hit an error it could not recover from.',
      clientList: (() => { try { return clients(); } catch { return []; } })(),
      body: `<div class="card"><div class="card-body">
        ${note('danger', 'Unexpected error', err.message || 'Unknown error')}
        <div style="margin-top:var(--s4)" class="row">
          <a class="btn btn-primary btn-sm" href="/">Back to all clients</a>
          <button class="btn btn-secondary btn-sm" onclick="history.back()">Go back</button>
        </div>
      </div></div>`,
    })
  );
});

export default app;

// Listen only when run directly (tests import the app and bind an ephemeral port).
// Local-only by default: this portal has no user login, so it must not face a network
// until authentication + tenant authorization exist (see README.md, "Honest limits").
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  startInboxWorker();
  app.listen(PORT, HOST, () => console.log(`${BRAND.name} → http://${HOST}:${PORT}`));
}
