import { statSync } from 'node:fs';
import { logo, brandColor } from './logos.js';

export const BRAND = {
  name: 'Futuro Social',
  short: 'Futuro',
  tagline: 'Social media from the future',
  face: '/agency-face.jpg',
  accent: '#EB3514',
  favicon: '/agency-face.jpg',
};

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/* ---------------------------------------------------------------- formatting */
export const num = (n) => {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
};

export const ago = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 604800) return `${Math.round(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const clock = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '';

export const plural = (n, one, many = one + 's') => `${num(n)} ${n === 1 ? one : many}`;
export const idx = (i) => String(i + 1).padStart(2, '0');

const PLATFORM_NAMES = {
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', facebook: 'Facebook',
  youtube: 'YouTube', twitter: 'X', threads: 'Threads', bluesky: 'Bluesky',
  pinterest: 'Pinterest', reddit: 'Reddit', metaads: 'Meta Ads', googleads: 'Google Ads',
  whatsapp: 'WhatsApp', telegram: 'Telegram', snapchat: 'Snapchat', discord: 'Discord',
  slack: 'Slack', googlebusiness: 'Google Business', phone: 'Phone',
};
export const platformName = (p) =>
  PLATFORM_NAMES[p] || (p ? p[0].toUpperCase() + p.slice(1) : 'Unknown');

// The real brand mark on its own tinted tile; 'plogo-bare' is the 16px mark alone (tables).
export const plogo = (platform, size = 'plogo') =>
  size === 'plogo-bare'
    ? `<span class="plogo-bare" style="color:${brandColor(platform)}">${logo(platform, 16)}</span>`
    : `<span class="${size}" style="color:${brandColor(platform)};
    background:color-mix(in srgb, ${brandColor(platform)} 9%, #fff)">${logo(
    platform,
    size === 'plogo-sm' ? 15 : size === 'plogo-lg' ? 24 : 20
  )}</span>`;

/* -------------------------------------------------------------------- icons */
const I = {
  plug: '<path d="M7 3v5M13 3v5"/><path d="M4.5 8h11v3a5.5 5.5 0 0 1-11 0Z"/><path d="M10 16.5V19"/>',
  edit: '<path d="M4 15.5V18h2.5L15 9.5 12.5 7Z"/><path d="M13.7 5.8 15 4.5a1.4 1.4 0 0 1 2 2l-1.3 1.3Z"/>',
  chart: '<path d="M4 17V9M9.3 17V4M14.7 17v-6M20 17H2"/>',
  inbox: '<path d="M3 11h4l1.2 2.6h5.6L15 11h4"/><path d="M4.5 4.5h13L20 11v7.5H2V11Z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 18a6 6 0 0 1 12 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/>',
  bolt: '<path d="M12 2 4 12.5h6L9.5 20 18 9.5h-6Z"/>',
  shield: '<path d="M11 2 4 5v6c0 4 3 7 7 8 4-1 7-4 7-8V5Z"/>',
  plus: '<path d="M11 5v12M5 11h12"/>',
  arrow: '<path d="M4 11h13M12 6l5 5-5 5"/>',
  check: '<path d="M4 11l5 5 9-10"/>',
  alert: '<circle cx="11" cy="11" r="8"/><path d="M11 6.5v5.5M11 15.4h.01"/>',
  caret: '<path d="M6 8.5 11 13l5-4.5"/>',
  cal: '<rect x="3" y="5" width="16" height="14" rx="2"/><path d="M3 9.5h16M7.5 3v4M14.5 3v4"/>',
  left: '<path d="M13 5l-5 6 5 6"/>',
  right: '<path d="M9 5l5 6-5 6"/>',
  send: '<path d="M19 3 9.5 12.5"/><path d="M19 3l-6.2 16-3.3-6.5L3 9.2Z"/>',
  link: '<path d="M9 12a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"/><path d="M13 10a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1"/>',
  report: '<path d="M6 2.5h7l4 4V19a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 19Z"/><path d="M13 2.5v4h4"/><path d="M9 15.5v-3M11.5 15.5v-5M14 15.5v-2"/>',
  download: '<path d="M11 3v11M6.5 9.5 11 14l4.5-4.5"/><path d="M4 18h14"/>',
  updown: '<path d="M7.5 8.5 11 5l3.5 3.5M7.5 13.5 11 17l3.5-3.5"/>',
  ext: '<path d="M8 14 15 7M9 7h6v6"/>',
  grid: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="12.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="12.5" width="6" height="6" rx="1"/><rect x="12.5" y="12.5" width="6" height="6" rx="1"/>',
  trophy: '<path d="M7 3.5h8v4a4 4 0 0 1-8 0Z"/><path d="M7 5H4v1.5A3 3 0 0 0 7 9.5M15 5h3v1.5a3 3 0 0 1-3 3"/><path d="M11 11.5V15M7.5 18.5h7M9 15h4v3.5H9Z"/>',
  doc: '<path d="M6 2.5h7l4 4V19a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 19Z"/><path d="M13 2.5v4h4M9 11h5M9 14h5M9 8h2"/>',
  layers: '<path d="m11 3 8 4.5-8 4.5-8-4.5Z"/><path d="m3 11 8 4.5 8-4.5"/><path d="m3 14.5 8 4.5 8-4.5"/>',
  image: '<rect x="3" y="4" width="16" height="14" rx="1.5"/><circle cx="8" cy="9" r="1.6"/><path d="m3.5 16 4.5-4.5 3.5 3.5 2.5-2.5 5 4.5"/>',
  video: '<rect x="2.5" y="5.5" width="12" height="11" rx="1.5"/><path d="m14.5 9.5 5-3v9l-5-3Z"/>',
  ads: '<path d="M3.5 9v4h3l6 4V5l-6 4Z"/><path d="M16 8.5a3.5 3.5 0 0 1 0 5M18.5 6a7 7 0 0 1 0 10"/>',
  clock: '<circle cx="11" cy="11" r="8"/><path d="M11 6.5V11l3 2"/>',
};
export const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 22 22" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;

/* ------------------------------------------------------------------- layout */
const CSS_V = (() => {
  try { return statSync(new URL('./public/app.css', import.meta.url)).mtimeMs.toString(36); }
  catch { return '1'; }
})();

const head = (title) => `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(BRAND.name)}</title>
<link rel="icon" href="${BRAND.favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Geist:wght@400;450;500;600;700&display=swap">
<link rel="stylesheet" href="/app.css?v=${CSS_V}">`;

export const WORKSPACE_TABS = [
  ['connections', 'Connections', 'plug'],
  ['content', 'Content', 'edit'],
  ['calendar', 'Calendar', 'cal'],
  ['analytics', 'Analytics', 'chart'],
  ['inbox', 'Inbox', 'inbox'],
  ['report', 'Report', 'report'],
];

const AGENCY_NAV = [
  ['/', 'All clients', 'users'],
  ['/events', 'Activity', 'bolt'],
  ['/prove-isolation', 'Isolation', 'shield'],
];

/* The persistent left rail: workspace switcher (badge, name, label, chevrons), sections, and a dark
   pill at the foot. The switcher is the real <select>, laid transparently over the styled button, so it
   stays keyboard- and screen-reader-native and keeps working with the existing change handler. */
const rail = ({ active, client, clientList = [], counts = {} }) => {
  const tab = WORKSPACE_TABS.some(([s]) => s === active) ? active : 'connections';
  const name = client ? client.name : BRAND.short;
  return `<aside class="rail">
  <div class="switcher">
    <div class="switcher-btn" aria-hidden="true">
      ${client ? `<span class="badge-tile">${esc((name[0] || 'F').toUpperCase())}</span>` : `<img class="badge-tile rmark-face" src="${BRAND.face}" alt="">`}
      <span class="who">
        <span class="n"><b>${esc(name)}</b><small>${client ? 'Client' : 'Agency'}</small></span>
        <span class="m">${client ? esc(BRAND.name) : `${esc(BRAND.tagline)} · ${clientList.length}`}</span>
      </span>
      <span class="caret">${icon('updown', 16)}</span>
    </div>
    <select class="js-switch" id="ws" aria-label="Switch workspace">
      <option value="/"${!client ? ' selected' : ''}>All clients · ${esc(BRAND.name)}</option>
      ${clientList
        .map(
          // `active` is a tab slug inside a workspace but a path ("/") on agency
          // pages — using it raw produced /w/<id>// and a hard 404.
          (c) => `<option value="/w/${esc(c.profileId)}/${esc(tab)}"${
            client && c.profileId === client.profileId ? ' selected' : ''
          }>${esc(c.name)}</option>`
        )
        .join('')}
    </select>
  </div>

  ${
    client
      ? `<div class="rail-group">
          <span class="label">Workspace</span>
          <nav aria-label="Workspace">
            ${WORKSPACE_TABS.map(
              ([slug, label, ic]) =>
                `<a href="/w/${esc(client.profileId)}/${slug}"${
                  slug === active ? ' aria-current="page"' : ''
                }><span class="ico">${icon(ic, 17)}</span>${label}${
                  counts[slug] != null ? `<span class="count num">${num(counts[slug])}</span>` : ''
                }</a>`
            ).join('')}
          </nav>
        </div>`
      : ''
  }

  <div class="rail-group">
    <span class="label">Agency</span>
    <nav aria-label="Agency">
      ${AGENCY_NAV.map(
        ([href, label, ic]) =>
          `<a href="${href}"${!client && href === active ? ' aria-current="page"' : ''}>
            <span class="ico">${icon(ic, 17)}</span>${label}${
            counts[href] != null ? `<span class="count num">${num(counts[href])}</span>` : ''
          }</a>`
      ).join('')}
    </nav>
  </div>

  <div class="rail-foot">
    ${
      client
        ? `<a class="pill-dark" href="/c/${esc(client.profileId)}/report" target="_blank" rel="noopener">
            ${icon('report', 16)} Client report <span class="ext">${icon('ext', 13)}</span></a>
          <a class="icon-btn" href="/" aria-label="All clients" title="All clients">${icon('grid', 17)}</a>`
        : `<a class="pill-dark" href="/events">${icon('bolt', 16)} Activity log</a>`
    }
  </div>
  <div class="rail-status">${process.env.DEMO_MODE ? 'Demo data · not connected' : 'Connected to live API'}</div>
</aside>`;
};

export const app = ({
  title, subtitle, actions = '', body, active = '/', client = null,
  clientList = [], counts = {}, tabsFor = null,
}) => `<!doctype html><html lang="en"><head>${head(title)}</head><body>
<div class="app">
  ${rail({ active, client, clientList, counts })}
  <main class="main">
    <header class="topbar">
      <div class="titles">
        <h1 class="h1">${esc(title)}</h1>
        ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </header>
    ${
      tabsFor
        ? `<nav class="tabs" aria-label="Workspace sections">
            ${WORKSPACE_TABS.map(
              ([slug, label]) =>
                `<a class="tab" href="/w/${esc(tabsFor)}/${slug}"${
                  slug === active ? ' aria-current="page"' : ''
                }>${label}</a>`
            ).join('')}
          </nav>`
        : ''
    }
    <div class="content stack">${body}</div>
  </main>
</div>
${SCRIPT}</body></html>`;

// The client-facing shell: our brand, none of our navigation.
export const clientPage = ({ title, lede = '', body, wide = false, actions = '', foot = '' }) =>
  wide
    ? `<!doctype html><html lang="en"><head>${head(title)}</head><body class="client-wide">
<div class="cshell">
  <header class="cbar">
    <div class="cbar-brand">
      <img class="rmark rmark-face" src="${BRAND.face}" alt="" aria-hidden="true">
      <span class="cbar-name">${esc(BRAND.name)}</span>
    </div>
    ${actions ? `<div class="cbar-actions">${actions}</div>` : ''}
  </header>
  <main class="cmain">${body}</main>
  <footer class="cfoot">${foot || `Prepared by ${esc(BRAND.name)}`}</footer>
</div>
${SCRIPT}</body></html>`
    : `<!doctype html><html lang="en"><head>${head(title)}</head><body>
<div class="auth">
  <div class="auth-head">
    <img class="rmark rmark-face" src="${BRAND.face}" alt="" aria-hidden="true" style="width:44px;height:44px">
    <h1 class="h1">${esc(title)}</h1>
    ${lede ? `<p class="sub" style="max-width:52ch">${lede}</p>` : ''}
  </div>
  <div class="auth-shell">${body}</div>
  <p class="auth-foot">Secured by ${esc(BRAND.name)}</p>
</div>
${SCRIPT}</body></html>`;

/* --------------------------------------------------------------- components */
export const empty = (title, text, cta = '') =>
  `<div class="empty">
    <div class="icon">${icon('link', 18)}</div>
    <div class="title">${esc(title)}</div>
    <p class="text">${esc(text)}</p>
    ${cta}
  </div>`;

export const note = (kind, title, detail = '') =>
  `<div class="note note-${kind}" role="${kind === 'danger' ? 'alert' : 'status'}">
    ${icon(kind === 'ok' ? 'check' : 'alert', 18)}
    <div><span class="title">${esc(title)}</span>
    ${detail ? ` <span class="detail">${esc(detail)}</span>` : ''}</div>
  </div>`;

export const chip = (kind, label, href) =>
  href
    ? `<a class="chip chip-${kind}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`
    : `<span class="chip chip-${kind}">${esc(label)}</span>`;

export const copyField = (id, url, label) =>
  `<div class="copy">
    <input class="url" id="${esc(id)}" value="${esc(url)}" readonly
      aria-label="${esc(label)}" onfocus="this.select()">
    <button type="button" class="btn btn-secondary js-copy" data-url="${esc(url)}"
      aria-label="Copy ${esc(label)}">Copy</button>
  </div>`;

export const metric = (label, value, delta) => `<div class="metric">
  <span class="label">${esc(label)}</span>
  <div class="value num">${value}</div>
  ${delta ? `<div class="kpi-delta ${delta.dir}">${esc(delta.text)}</div>` : ''}
</div>`;
export const kpi = (_i, label, value, delta) => metric(label, esc(value), delta);

export const skeletonRows = (n = 3) =>
  `<div class="list">${Array.from({ length: n })
    .map(
      (_, i) => `<div class="list-row" aria-hidden="true">
      <div class="skeleton sk-circle"></div>
      <div class="who" style="flex:1">
        <div class="skeleton sk-line" style="width:${170 - i * 30}px"></div>
        <div class="skeleton sk-line" style="width:80px;margin-top:7px;height:9px"></div>
      </div>
      <div class="skeleton sk-line" style="width:76px;height:20px"></div>
    </div>`
    )
    .join('')}</div>`;

export const asyncAccounts = (profileId, rows = 3) =>
  `<div class="js-load" data-src="/w/${esc(profileId)}/accounts"
     role="status" aria-busy="true" aria-label="Loading connected accounts">
    ${skeletonRows(rows)}
  </div>`;

export const accounts = (list, flagged = new Set(), profileId = '') =>
  list.length
    ? `<div class="list">${list
        .map((a) => {
          const dead = flagged.has(a._id);
          return `<div class="list-row" data-account${dead ? ' data-dead' : ''}>
            ${plogo(a.platform, 'plogo-sm')}
            <div class="who">
              <div class="name">${esc(a.username || a.displayName || a.name || 'Untitled')}</div>
              <div class="meta">${esc(platformName(a.platform))}</div>
            </div>
            <div class="spacer"></div>
            ${dead
              ? chip('danger', 'Reconnect needed', `/c/${profileId}/connect`)
              : chip('quiet', 'Connected')}
          </div>`;
        })
        .join('')}</div>`
    : '';

/* Every platform we offer, in grid order. */
export const ALL_PLATFORMS = [
  'instagram', 'tiktok', 'linkedin', 'facebook', 'youtube', 'twitter',
  'threads', 'bluesky', 'pinterest', 'reddit',
];
export const CONNECTABLE = new Set(['instagram', 'tiktok', 'linkedin']);

export const platformCell = (platform, account, profileId, dead) => {
  const on = !!account;
  return `<div class="pcell${dead ? ' is-dead' : ''}">
    <div class="pcell-top">
      ${plogo(platform)}
      <div style="min-width:0">
        <div class="pcell-name">${esc(platformName(platform))}</div>
        <div class="pcell-state">${dead ? 'Needs reconnection' : on ? 'Connected' : 'Not connected'}</div>
      </div>
      <div class="spacer"></div>
      ${dead ? chip('warn', 'Action') : on ? chip('ok', 'Live') : ''}
    </div>
    <div class="pcell-id">
      ${on
        ? `<div class="pcell-handle truncate">@${esc(account.username || account.displayName || '—')}</div>
           ${account.createdAt
             ? `<div class="pcell-meta">Since ${esc(
                 new Date(account.createdAt).toLocaleDateString(undefined, {
                   month: 'short', year: 'numeric' })
               )}</div>`
             : ''}`
        : `<div class="pcell-meta">No account authorised on this platform.</div>`}
    </div>
    <div class="pcell-act">
      ${dead
        ? `<a class="btn btn-primary btn-sm btn-block"
            href="/connect/${esc(profileId)}/${platform}">Reconnect</a>`
        : on
          ? `<span class="btn btn-secondary btn-sm btn-block" aria-disabled="true">Connected</span>`
          : CONNECTABLE.has(platform)
            ? `<a class="btn btn-secondary btn-sm btn-block"
                href="/connect/${esc(profileId)}/${platform}">${icon('plus', 15)} Connect</a>`
            : `<a class="btn btn-ghost btn-sm btn-block"
                href="/c/${esc(profileId)}/connect">Via client page</a>`}
    </div>
  </div>`;
};

/* Charts — flat SVG, no library. */
export const barChart = (series, { height = 190, label = '' } = {}) => {
  const max = Math.max(1, ...series.map((s) => s.value));
  const n = series.length || 1;
  const bw = 100 / n;
  const w = Math.min(bw * 0.52, 9);
  return `<div class="chart">
    <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" class="chart-svg"
      role="img" aria-label="${esc(label)}">
      ${[0, .5, 1].map((t) => `<line x1="0" y1="${height - t * height}" x2="100"
        y2="${height - t * height}" stroke="var(--line)" stroke-width="1"
        vector-effect="non-scaling-stroke"/>`).join('')}
      ${series.map((s, i) => {
        const h = (s.value / max) * (height - 10);
        return `<rect x="${i * bw + (bw - w) / 2}" y="${height - h}" width="${w}" height="${h}"
          fill="${s.accent ? 'var(--accent)' : 'var(--bar)'}" rx="1"/>`;
      }).join('')}
    </svg>
    <div class="chart-x">${series.map((s) => `<span>${esc(s.label)}</span>`).join('')}</div>
  </div>`;
};

export const chartBlock = (title, sub, total, body) => `<div class="card">
  <div class="card-head">
    <div><h2 class="h3">${esc(title)}</h2><p class="rsub">${esc(sub)}</p></div>
    <div class="h2 num">${esc(total)}</div>
  </div>
  <div class="card-body">${body}</div>
</div>`;

/* ============================================================================
   Data patterns: metric tables and ranked rows (the report, the Analytics tab)
   ========================================================================= */
// Small filled marks for the metric headers, each in its own colour (see --m-* tokens).
const MI = {
  likes: '<path d="M8 14s-5.6-3.3-5.6-7.3A3 3 0 0 1 8 4.8a3 3 0 0 1 5.6 1.9C13.6 10.7 8 14 8 14Z"/>',
  comments: '<path d="M8 2.5c3.6 0 6 2.2 6 5s-2.4 5-6 5c-.7 0-1.4-.1-2-.3l-3.2 1.3.9-2.6C2.6 10 2 8.8 2 7.5c0-2.8 2.4-5 6-5Z"/>',
  shares: '<path d="M9.5 3 14.5 7.4l-5 4.4V9.3C6 9.2 3.7 10.4 1.8 13c.5-4 2.9-6.6 7.7-7.2Z"/>',
  saves: '<path d="M4 1.8h8v12.4l-4-3-4 3Z"/>',
  clicks: '<path d="M3.6 1.8 12.8 8.5l-4.1.8 2.2 4.3-1.7.8-2.2-4.2-3.4 2.9Z"/>',
  views: '<path d="M8 3.5C4.4 3.5 1.8 6.4 1 8c.8 1.6 3.4 4.5 7 4.5s6.2-2.9 7-4.5c-.8-1.6-3.4-4.5-7-4.5Zm0 7.2a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"/>',
  impressions: '<path d="M2 13.5h12M3 10.8l3.4-4 2.6 2.6 4.5-5.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  reach: '<circle cx="5.4" cy="5.4" r="2.3"/><circle cx="11.2" cy="5.8" r="2"/><path d="M1.2 13.2c.3-2.7 2-4.2 4.2-4.2s3.9 1.5 4.2 4.2ZM9.9 9.3c.4-.2.9-.3 1.4-.3 1.9 0 3.3 1.3 3.5 3.7h-4"/>',
  follows: '<circle cx="6" cy="5" r="2.5"/><path d="M1.5 13.5c.3-2.8 2.1-4.3 4.5-4.3s4.2 1.5 4.5 4.3Z"/><path d="M12.6 4.4v4.2M10.5 6.5h4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
};
const COLOR = { likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves', clicks: 'clicks', views: 'views', impressions: 'impr', reach: 'reach', follows: 'follows' };
export const metricIcon = (k) =>
  MI[k] ? `<svg viewBox="0 0 16 16" fill="currentColor" style="color:var(--m-${COLOR[k]})" aria-hidden="true">${MI[k]}</svg>` : '';

export const METRIC_LABELS = {
  posts: 'Posts', likes: 'Likes', comments: 'Comments', shares: 'Shares', saves: 'Saves', clicks: 'Clicks',
  views: 'Views', follows: 'Follows', impressions: 'Impr.', reach: 'Reach', er: 'ER',
};

// A metric a platform does not report shows "–", never a zero that reads like a result. A non-zero value
// always wins over this list: the data is the authority.
const UNREPORTED = {
  youtube: ['impressions', 'reach', 'saves', 'clicks', 'follows'],
  tiktok: ['impressions', 'reach', 'saves', 'clicks', 'follows'],
  facebook: ['saves', 'follows'],
  instagram: ['clicks'],
  twitter: ['reach', 'follows'],
  threads: ['impressions', 'reach', 'saves', 'clicks', 'follows'],
  linkedin: ['saves', 'follows'],
  bluesky: ['impressions', 'reach', 'saves', 'clicks', 'views', 'follows'],
  pinterest: ['shares', 'follows'],
};
export const isReported = (platform, key, value) =>
  value != null && (Number(value) > 0 || !(UNREPORTED[platform] || []).includes(key));

// Engagement rate the way the table reads it: likes + comments + shares + saves over impressions
// (views where a platform has no impressions). Null when there is nothing to divide by.
export const engagementRate = (m = {}) => {
  const seen = Number(m.impressions) || Number(m.views) || 0;
  const eng = (Number(m.likes) || 0) + (Number(m.comments) || 0) + (Number(m.shares) || 0) + (Number(m.saves) || 0);
  return seen ? (eng / seen) * 100 : null;
};
export const fmtER = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '–';
  const n = Number(v);
  if (!n) return '0%';
  return `${n >= 2 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2).replace(/0$/, '').replace(/\.0?$/, '')}%`;
};
export const erPill = (v) =>
  v == null ? '<span class="muted">–</span>' : `<span class="er-pill${Number(v) ? '' : ' is-zero'}">${esc(fmtER(v))}</span>`;

const caret2 = '<svg class="caret2" viewBox="0 0 7 10" aria-hidden="true"><path d="M3.5 0 7 4H0ZM3.5 10 0 6h7Z" fill="currentColor"/></svg>';
const th = (label, { icon: ic = '', right = false } = {}) =>
  `<th scope="col"${right ? ' class="r"' : ''}><button type="button" class="zsort"><span class="zth">${ic}${esc(label)}</span>${caret2}</button></th>`;

/* A sortable metric table.
   first: { label } for the name column; cols: metric keys (see METRIC_LABELS);
   rows: [{ first: html, sortKey: text, platform, values: { likes: n, … }, er: n|null }] */
export const metricTable = ({ first = 'Platform', cols, rows, label, note: foot = '' }) => `<div class="ztable">
  <table aria-label="${esc(label || first)}">
    <thead><tr>${th(first)}${cols.map((k) => th(METRIC_LABELS[k], { icon: metricIcon(k), right: true })).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td data-v="${esc(r.sortKey || '')}">${r.first}</td>
      ${cols.map((k) => {
        if (k === 'er') return `<td class="r" data-v="${r.er == null ? -1 : Number(r.er).toFixed(4)}">${erPill(r.er)}</td>`;
        const v = r.values[k];
        return k !== 'posts' && !isReported(r.platform, k, v)
          ? `<td class="r dash" data-v="-1" title="Not reported by ${esc(platformName(r.platform))}">–</td>`
          : `<td class="r num" data-v="${Number(v) || 0}">${esc(num(v))}</td>`;
      }).join('')}
    </tr>`).join('')}</tbody>
  </table>
</div>${foot ? `<p class="znote">${foot}</p>` : ''}`;

// The platform name cell: real logo at 16px beside the name.
export const platformCellName = (p) => `<span class="zname">${plogo(p, 'plogo-bare')}${esc(platformName(p))}</span>`;

/* Ranked rows: each row its own bordered box. rows: [{ icon, label, sub (html), value (number for the bar),
   display (text at the right), best (coral row + BEST badge), hl (coral bar only), badge }] */
export const ranked = (rows, { compact = false, label = '' } = {}) => {
  const max = Math.max(0, ...rows.map((r) => Number(r.value) || 0));
  return `<div class="ranked${compact ? ' ranked-compact' : ''}${rows.length === 1 ? ' ranked-one' : ''}" role="list"${label ? ` aria-label="${esc(label)}"` : ''}>${rows
    .map((r) => {
      const w = max ? ((Number(r.value) || 0) / max) * 100 : 0;
      return `<div class="rk${r.best ? ' is-best' : ''}${r.hl ? ' is-hl' : ''}" role="listitem">
      ${compact ? '' : `<span class="rk-ico" aria-hidden="true">${r.icon || ''}</span>`}
      <div class="rk-main">
        <div class="rk-label"><span>${esc(r.label)}</span>${r.best || r.badge ? `<span class="best">${icon('trophy', 11)}${esc(r.badge || 'Best')}</span>` : ''}</div>
        ${r.sub ? `<div class="rk-sub">${r.sub}</div>` : ''}
      </div>
      <div class="rk-bar" aria-hidden="true"><div class="rk-track"><span class="rk-fill" style="width:${w.toFixed(1)}%"></span></div></div>
      <div class="rk-val num">${esc(r.display ?? num(r.value))}</div>
    </div>`;
    })
    .join('')}</div>`;
};

// "+423% vs avg" in success, "−13% vs avg" in danger.
export const vsAvg = (v, avg) => {
  if (v == null || !avg) return '';
  const r = ((v - avg) / avg) * 100;
  if (Math.abs(r) < 0.5) return '<span>on the average</span>';
  return `<span class="${r > 0 ? 'up' : 'down'}">${r > 0 ? '+' : '−'}${Math.abs(r) >= 10 ? Math.round(Math.abs(r)) : Math.abs(r).toFixed(1)}% vs avg</span>`;
};

// A card with a title on the left and a small grey meta on the right.
export const zcard = (title, body, { meta = '', sub = '' } = {}) => `<div class="card">
  <div class="card-head"><div><h3 class="h3">${esc(title)}</h3>${sub ? `<p class="rsub">${esc(sub)}</p>` : ''}</div>${meta ? `<span class="meta-r">${meta}</span>` : ''}</div>
  <div class="card-body">${body}</div>
</div>`;

export const SCRIPT = `<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.js-copy');
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.url); } catch { return; }
  const was = b.textContent;
  b.textContent = 'Copied';
  b.classList.add('btn-primary'); b.classList.remove('btn-secondary');
  setTimeout(() => { b.textContent = was;
    b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); }, 1400);
});

// Workspace switcher navigates on change.
for (const s of document.querySelectorAll('.js-switch'))
  s.addEventListener('change', () => { location.href = s.value; });

// Async panels: shell paints first, lists fill in.
const q = new URLSearchParams(location.search);
const pass = ['delay', 'fail'].filter((k) => q.has(k)).map((k) => k + '=' + q.get(k)).join('&');
for (const el of document.querySelectorAll('.js-load')) {
  fetch(el.dataset.src + (pass ? '?' + pass : ''))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((html) => { el.innerHTML = html; el.removeAttribute('aria-busy'); })
    .catch((err) => {
      el.removeAttribute('aria-busy');
      el.innerHTML = '<div class="card-body"><div class="note note-danger" role="alert">' +
        '<div><span class="title">Couldn\\u2019t load accounts.</span> ' +
        '<span class="detail">' + err.message + '</span></div></div>' +
        '<div style="margin-top:12px"><button class="btn btn-secondary btn-sm" ' +
        'onclick="location.reload()">Retry</button></div></div>';
    })
    .finally(() => document.dispatchEvent(new Event('frag')));
}
document.addEventListener('frag', () => {
  if (document.querySelectorAll('.js-load[aria-busy]').length) return;
  const rows = document.querySelectorAll('.list-row[data-account]');
  const bad = document.querySelectorAll('.list-row[data-account][data-dead]').length;
  const set = (k, v) => { const el = document.querySelector('[data-metric=' + k + ']');
    if (el) { el.textContent = v; el.classList.remove('skeleton'); el.style.width = 'auto'; } };
  set('accounts', rows.length); set('attention', bad);
});

for (const b of document.querySelectorAll('[data-dialog]'))
  b.addEventListener('click', () => document.getElementById(b.dataset.dialog)?.showModal());
for (const b of document.querySelectorAll('[data-close]'))
  b.addEventListener('click', () => b.closest('dialog')?.close());

// Sortable data tables: click a header to sort by its column; again to flip. Cells carry data-v.
// Delegated, so tables that arrive later as report fragments sort too.
document.addEventListener('click', (e) => {
  const b = e.target.closest('button.zsort');
  if (!b) return;
  const th = b.closest('th');
  const table = th.closest('table');
  const col = [...th.parentNode.children].indexOf(th);
  const dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
  for (const h of th.parentNode.children) h.removeAttribute('aria-sort');
  th.setAttribute('aria-sort', dir);
  const body = table.tBodies[0];
  const val = (tr) => {
    const c = tr.children[col];
    const v = c ? c.dataset.v : '';
    const n = Number(v);
    return v !== '' && v != null && !Number.isNaN(n) ? n : String(v || c?.textContent || '').toLowerCase();
  };
  const rows = [...body.rows];
  rows.sort((x, y) => {
    const a = val(x), z = val(y);
    const r = typeof a === 'number' && typeof z === 'number' ? a - z : String(a).localeCompare(String(z));
    return dir === 'ascending' ? r : -r;
  });
  for (const r of rows) body.appendChild(r);
});

// Keep the open conversation pinned to its newest message.
const cb = document.querySelector('.convo-body');
if (cb) cb.scrollTop = cb.scrollHeight;
</script>`;

/* A titled group. Kept from the previous layout so every route keeps working —
   in the rail layout it renders as a labelled block rather than a grid column. */
export const section = (label, content, _mark = false) => `<section class="stack">
  <span class="label">${esc(label)}</span>
  <div>${content}</div>
</section>`;

// Legacy 4-arg form: metric(index, label, value, dataMetricKey).
export const metricSlot = (_i, label, value, dataMetric) => `<div class="metric">
  <span class="label">${esc(label)}</span>
  <div class="value num">${
    dataMetric
      ? `<span data-metric="${esc(dataMetric)}" class="skeleton"
          style="display:inline-block;width:56px;height:32px">&nbsp;</span>`
      : esc(value)
  }</div>
</div>`;

/* ============================================================================
   Calendar — a month of post activity
   ========================================================================= */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// A post's calendar date: when it goes out, or when it went out.
export const postDate = (p) =>
  p.scheduledFor || p.publishedAt || p.platforms?.[0]?.publishedAt || p.createdAt;

export const monthLabel = (y, m) => `${MONTHS[m]} ${y}`;

// Month grid starting Monday, with leading/trailing days from adjacent months.
export const calendar = ({ year, month, byDay, todayKey, profileId, openDay }) => {
  const first = new Date(Date.UTC(year, month, 1));
  // 0=Sun in JS; shift so Monday is column 0.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];

  const prevDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let i = lead - 1; i >= 0; i--)
    cells.push({ day: prevDays - i, out: true, key: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, out: false, key });
  }
  // Trailing filler belongs to the NEXT month, so it counts from 1.
  let tail = 1;
  while (cells.length % 7) cells.push({ day: tail++, out: true, key: null });

  const pill = (p) => {
    const st = p.status || 'draft';
    const url = p.platforms?.find((x) => x.platformPostUrl)?.platformPostUrl;
    const time = new Date(postDate(p)).toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit',
    });
    const inner = `<span class="cal-time num">${esc(time)}</span>
      ${plogo(p.platforms?.[0]?.platform || 'default', 'plogo-xs')}
      <span class="cal-txt truncate">${esc((p.title || p.content || 'Untitled').slice(0, 40))}</span>`;
    return url
      ? `<a class="cal-pill is-${esc(st)}" href="${esc(url)}" target="_blank"
          rel="noopener" title="${esc((p.content || '').slice(0, 140))}">${inner}</a>`
      : `<span class="cal-pill is-${esc(st)}" title="${esc((p.content || '').slice(0, 140))}">${inner}</span>`;
  };

  return `<div class="cal">
    <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">
      ${cells
        .map((c) => {
          const posts = c.key ? byDay.get(c.key) || [] : [];
          const shown = posts.slice(0, 3);
          const rest = posts.length - shown.length;
          return `<div class="cal-day${c.out ? ' is-out' : ''}${
            c.key === todayKey ? ' is-today' : ''
          }${c.key && c.key === openDay ? ' is-open' : ''}">
            <div class="cal-num num">${c.day}</div>
            ${shown.map(pill).join('')}
            ${rest > 0
              ? `<a class="cal-more" href="/w/${esc(profileId)}/calendar?m=${year}-${String(
                  month + 1
                ).padStart(2, '0')}&d=${esc(c.key)}">+${rest} more</a>`
              : ''}
          </div>`;
        })
        .join('')}
    </div>
  </div>`;
};
