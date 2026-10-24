// Client report rendering. Server-rendered HTML fragments, inline SVG, the portal's design tokens.
// Nothing here names the data vendor: the report carries the agency's brand only.
import {
  esc, num, plogo, platformName, chip, icon, BRAND, empty, note,
  metricTable, platformCellName, ranked, vsAvg, zcard, metricIcon, engagementRate, fmtER,
} from '../views.js';
import { logo, brandColor } from '../logos.js';

/* ----------------------------------------------------------------- format */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (iso, year = true) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${year ? `, ${y}` : ''}`;
};
export const rangeLabel = (from, to) =>
  from.slice(0, 4) === to.slice(0, 4) ? `${dayLabel(from, false)} – ${dayLabel(to)}` : `${dayLabel(from)} – ${dayLabel(to)}`;

const int = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pct = (n, digits = 1) => (n == null ? '—' : `${Number(n).toFixed(digits).replace(/\.0+$/, '')}%`);
const money = (n, currency) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'USD', maximumFractionDigits: n < 1000 ? 2 : 0, minimumFractionDigits: n < 1000 ? 2 : 0,
    }).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${currency || ''}`.trim();
  }
};
const plural = (n, one, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;

// "3 minutes", "1 hour 30 minutes", "2 days 4 hours".
export function humanDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (s < 60) return pl(s, 'second');
  const mins = Math.round(s / 60);
  if (mins < 60) return pl(mins, 'minute');
  if (s < 86400) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${pl(h, 'hour')} ${pl(m, 'minute')}` : pl(h, 'hour');
  }
  const hours = Math.round(s / 3600);
  const d = Math.floor(hours / 24), h = hours % 24;
  return h ? `${pl(d, 'day')} ${pl(h, 'hour')}` : pl(d, 'day');
}

// Change against the previous period. `better: 'down'` for numbers where lower is good (reply time).
const delta = (cur, prev, { days, better = 'up', points = false } = {}) => {
  if (prev == null || cur == null) return null;
  const vs = `vs previous ${days} days`;
  // dir is the colour (up = good, down = bad, flat = neither); arrow is the actual direction.
  const tone = (rise) => (better === 'none' ? 'flat' : rise === (better === 'up') ? 'up' : 'down');
  if (points) {
    const d = cur - prev;
    if (Math.abs(d) < 0.005) return { dir: 'flat', arrow: '•', text: `No change ${vs}` };
    return { dir: tone(d > 0), arrow: d > 0 ? '▲' : '▼', text: `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} pts ${vs}` };
  }
  if (!prev) return cur ? { dir: 'flat', arrow: '▲', text: `Up from 0 ${vs}` } : { dir: 'flat', arrow: '•', text: `No change ${vs}` };
  const r = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(r) < 0.5) return { dir: 'flat', arrow: '•', text: `No change ${vs}` };
  return { dir: tone(r > 0), arrow: r > 0 ? '▲' : '▼', text: `${r > 0 ? '+' : '−'}${Math.abs(r) >= 10 ? Math.round(Math.abs(r)) : Math.abs(r).toFixed(1)}% ${vs}` };
};

/* ------------------------------------------------------------- components */
const tile = (label, value, d, hint = '') => `<div class="metric rmetric">
  <span class="label">${esc(label)}</span>
  <div class="value num">${esc(value)}</div>
  ${d ? `<div class="kpi-delta ${d.dir}"><span aria-hidden="true">${d.arrow}</span> ${esc(d.text)}</div>` : ''}
  ${hint ? `<div class="rhint">${esc(hint)}</div>` : ''}
</div>`;

const card = (title, sub, body, meta = '') => zcard(title, body, { sub, meta });
const foot = (text) => `<p class="rfoot">${esc(text)}</p>`;
const brandMark = (platform, size = 18) => `<span style="color:${brandColor(platform)}">${logo(platform, size)}</span>`;

// A daily line, flat SVG. Scales to its own maximum; first/middle/last dates under it.
const line = (points, { label, color = 'var(--accent)' }) => {
  const W = 600, H = 120;
  const vals = points.map((p) => Number(p.value) || 0);
  const max = Math.max(1, ...vals);
  const n = Math.max(1, points.length - 1);
  const xy = vals.map((v, i) => [(i / n) * W, H - 6 - (v / max) * (H - 16)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${d} L${W} ${H} L0 ${H} Z`;
  const ticks = points.length ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [];
  return `<figure class="rline">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
      ${[0.5, 1].map((t) => `<line x1="0" x2="${W}" y1="${H - 6 - t * (H - 16)}" y2="${H - 6 - t * (H - 16)}" stroke="var(--line)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`).join('')}
      <line x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}" stroke="var(--line)" vector-effect="non-scaling-stroke"/>
      <path d="${area}" fill="${color}" opacity=".07"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="1.75" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    </svg>
    <div class="rline-y"><span>${esc(num(max))}</span><span>0</span></div>
    <div class="rline-x">${ticks.map((i) => `<span>${esc(dayLabel(points[i].date, false))}</span>`).join('')}</div>
  </figure>`;
};

/* ------------------------------------------------------------- the frame */
// The header both doors share: agency logo + name, the client, the period.
export const reportHeader = ({ client, p }) => `<div class="rhead">
  <div class="rhead-brand">
    <img class="rmark rmark-face" src="${BRAND.face}" alt="" aria-hidden="true">
    <div><div class="rhead-agency">${esc(BRAND.name)}</div><div class="rhead-kind">Social media report</div></div>
  </div>
  <div class="rhead-meta">
    <div class="rhead-client">${esc(client.name)}</div>
    <div class="rhead-period num">${esc(rangeLabel(p.from, p.to))}</div>
    <div class="rhead-cmp">Compared with ${esc(rangeLabel(p.prevFrom, p.prevTo))}</div>
  </div>
</div>`;

const SECTIONS = [
  ['organic', 'Organic', 'What the posts did'],
  ['paid', 'Paid', 'What the ads did, next to the posts'],
  ['community', 'Community', 'How fast the brand answers'],
  ['sentiment', 'Sentiment', 'How people feel in the comments'],
];

const skeleton = `<div class="rskel" aria-hidden="true">
  <div class="rskel-row">${'<div class="skeleton rskel-tile"></div>'.repeat(4)}</div>
  <div class="skeleton rskel-block"></div>
</div>`;

// The four sections, each filled by its own fragment so the page paints at once.
export const reportSections = (partUrl) => SECTIONS.map(([id, label, title], i) => `<section class="rsec" id="${id}" aria-labelledby="h-${id}">
  <div class="rsec-head">
    <span class="rsec-num num">${String(i + 1).padStart(2, '0')}</span>
    <div><span class="label">${esc(label)}</span><h2 class="h2" id="h-${id}">${esc(title)}</h2></div>
  </div>
  <div class="rsec-body" data-part="${esc(partUrl(id))}" role="status" aria-busy="true" aria-label="Loading ${esc(label.toLowerCase())}">${skeleton}</div>
</section>`).join('');

// Print-only frame: the header repeats on every A4 page, the footer sits at the bottom of each.
export const printFrame = ({ client, p, inner }) => `<div class="pf">
  <div class="pf-head"><div class="pf-head-in">
    <img class="rmark rmark-sm rmark-face" src="${BRAND.face}" alt="" aria-hidden="true">
    <span class="pf-agency">${esc(BRAND.name)}</span>
    <span class="pf-client">${esc(client.name)} · ${esc(rangeLabel(p.from, p.to))}</span>
  </div></div>
  <div class="pf-body">${inner}</div>
  <div class="pf-foot"><div class="pf-foot-space"></div></div>
</div>
<div class="print-foot">${esc(rangeLabel(p.from, p.to))} · Prepared by ${esc(BRAND.name)}</div>`;

// Fetches each section, then lets "Download PDF" print only once everything is in.
export const REPORT_SCRIPT = `<script>
(() => {
  const load = (el) => {
    el.setAttribute('aria-busy', 'true');
    return fetch(el.dataset.part, { headers: { accept: 'text/html' } })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((html) => { el.innerHTML = html; })
      .catch(() => {
        el.innerHTML = '<div class="card"><div class="card-body"><div class="note note-danger" role="alert"><div>' +
          '<span class="title">This section didn\\u2019t load.</span> <span class="detail">Check the connection and try again.</span>' +
          '</div></div><div style="margin-top:12px"><button type="button" class="btn btn-secondary btn-sm js-retry">Try again</button></div></div></div>';
      })
      .finally(() => el.removeAttribute('aria-busy'));
  };
  const parts = [...document.querySelectorAll('[data-part]')];
  window.reportReady = Promise.all(parts.map(load));
  document.addEventListener('click', (e) => {
    const retry = e.target.closest('.js-retry');
    if (retry) load(retry.closest('[data-part]'));
    const pr = e.target.closest('.js-print');
    if (pr) {
      pr.disabled = true;
      const was = pr.innerHTML;
      pr.textContent = 'Preparing…';
      window.reportReady.then(() => { pr.disabled = false; pr.innerHTML = was; window.print(); });
    }
  });
})();
</script>`;

/* --------------------------------------------------------------- organic */
const PLATFORM_COLS = ['posts', 'likes', 'comments', 'shares', 'saves', 'clicks', 'views', 'impressions', 'reach', 'er'];
const POST_COLS = ['likes', 'comments', 'shares', 'saves', 'clicks', 'views', 'follows', 'impressions', 'reach', 'er'];
const FORMAT = {
  text: ['Text', 'doc'], carousel: ['Carousel', 'layers'], image: ['Image', 'image'], video: ['Video', 'video'],
};

const platformBreakdown = (rows) => rows.length
  ? metricTable({
      first: 'Platform',
      label: 'Platform breakdown',
      cols: PLATFORM_COLS,
      rows: rows.map((r) => ({ first: platformCellName(r.platform), sortKey: platformName(r.platform), platform: r.platform, values: r, er: engagementRate(r) })),
      note: '– means the platform does not report that number. ER: likes, comments, shares and saves over impressions (views where a platform has no impressions).',
    })
  : `<p class="rsub">No platform reported posts or numbers in these dates.</p>`;

const topPostsTable = (top) => top.length
  ? metricTable({
      first: 'Post',
      label: 'Top performing posts',
      cols: POST_COLS,
      rows: top.map((x) => ({
        first: `<span class="zpost">${plogo(x.platform, 'plogo-bare')}<span style="min-width:0"><span class="zpost-t" title="${esc(x.title)}">${esc(x.title || `${platformName(x.platform)} ${x.mediaType ? `${x.mediaType} ` : ''}post`)}</span><span class="zpost-d">${esc(x.publishedAt ? dayLabel(x.publishedAt) : '')}</span></span></span>`,
        sortKey: x.publishedAt || '',
        platform: x.platform,
        values: x.metrics,
        er: x.engagementRate,
      })),
      note: 'Lifetime numbers for each post published in this period, so they won’t add up to the totals above. Ranked by views and impressions.',
    })
  : `<p class="rsub">No posts were published in this period.</p>`;

const formatBreakdown = (f) => {
  if (!f.rows.length) return '';
  const best = f.rows.length > 1 && f.rows[0].er > 0;
  return ranked(f.rows.map((r, i) => {
    const [label, ic] = FORMAT[r.type] || [r.type[0].toUpperCase() + r.type.slice(1), 'doc'];
    const rel = f.rows.length > 1 ? vsAvg(r.er, f.avg) : '';
    return {
      icon: icon(ic, 18), label, value: r.er, display: fmtER(r.er), best: best && i === 0,
      sub: `${esc(plural(r.posts, 'post'))}${rel ? ` · ${rel}` : ''}`,
    };
  }), { label: 'Content format breakdown' });
};

// Lifetime numbers from the dashboard's top posts: the fallback when the post list could not be read.
const legacyTop = (o) => {
  const main = (m) => (m.views ? ['views', m.views] : m.impressions ? ['impressions', m.impressions] : m.reach ? ['reached', m.reach] : ['likes', m.likes || 0]);
  if (!o.topPosts.length) return `<p class="rsub">No posts were published in this period.</p>`;
  return ranked(o.topPosts.map((x, i) => {
    const m = x.metrics || x.analytics || {};
    const [unit, v] = main(m);
    const measured = ['views', 'impressions', 'reach', 'likes', 'comments', 'shares', 'clicks'].some((k) => Number(m[k]) > 0);
    return {
      icon: brandMark(x.platform), label: `${platformName(x.platform)} post`, value: measured ? v : 0,
      display: measured ? `${num(v)} ${unit}` : 'No numbers yet', best: false, hl: i === 0 && measured,
      sub: `Published ${esc(dayLabel(x.publishedAt || ''))}${measured && m.engagementRate != null ? ` · ${esc(pct(m.engagementRate, 2))} engagement` : ''}`,
    };
  }), { label: 'Top posts' });
};

export function organicPart(o, p) {
  const t = o.totals, pv = o.prev || {};
  const seen = (x) => (Number(x.views) || 0) + (Number(x.impressions) || 0);
  const anything = seen(t) || t.reach || t.likes || t.comments || o.followers.current || o.daily.some((d) => d.views || d.impressions);
  if (!anything)
    return `<div class="card">${empty('No organic activity in this period', 'Nothing was published or measured on the connected accounts in these dates.')}</div>`;

  const parts = [t.impressions ? `${int(t.impressions)} impressions` : '', t.views ? `${int(t.views)} views` : ''].filter(Boolean).join(' · ');
  const tiles = `<div class="rmetrics">
    ${tile('Views + impressions', num(seen(t)), delta(seen(t), o.prev ? seen(pv) : null, p), parts)}
    ${tile('Engagement rate', pct(t.engagementRate, 2), delta(t.engagementRate, pv.engagementRate, { ...p, points: true }), `${int((t.likes || 0) + (t.comments || 0) + (t.shares || 0) + (t.saves || 0))} likes, comments, shares and saves`)}
    ${tile('Followers gained', `${o.followers.gained > 0 ? '+' : ''}${int(o.followers.gained)}`, delta(o.followers.gained, o.prevFollowers?.gained, p))}
    ${tile('Current followers', num(o.followers.current), delta(o.followers.current, o.prevFollowers?.current, p), 'Across every connected account')}
  </div>`;

  const followers = o.byAccount.length
    ? ranked(o.byAccount.map((a, i) => ({
        icon: brandMark(a.platform), label: platformName(a.platform), value: a.current, display: int(a.current),
        hl: i === 0 && o.byAccount.length > 1,
        sub: `${a.handle ? `@${esc(a.handle)} · ` : ''}<span class="${a.gained > 0 ? 'up' : a.gained < 0 ? 'down' : ''}">${a.gained > 0 ? '+' : ''}${esc(int(a.gained))} gained</span>`,
      })), { label: 'Followers by account' })
    : `<p class="rsub">No follower counts reported for these accounts.</p>`;

  const daily = o.daily.length
    ? `<div class="rlines">
        <div><div class="rline-title"><span class="dot" style="background:var(--accent)"></span>Views + impressions per day</div>
          ${line(o.daily.map((d) => ({ date: d.date, value: (d.views || 0) + (d.impressions || 0) })), { label: 'Views and impressions per day' })}</div>
        <div><div class="rline-title"><span class="dot" style="background:var(--ok)"></span>Engagements per day</div>
          ${line(o.daily.map((d) => ({ date: d.date, value: d.engagement || 0 })), { label: 'Engagements per day', color: 'var(--ok)' })}</div>
      </div>`
    : `<p class="rsub">No daily figures for this period.</p>`;

  const f = o.formats;
  const formats = f && f.rows.length
    ? card('Content format breakdown', '', formatBreakdown(f), f.rows.length > 1 ? `avg ${esc(fmtER(f.avg))}` : `${esc(plural(f.posts, 'post'))}`)
    : '';

  // Two columns that stay level: a long follower list gets the right column to itself.
  const fCard = card('Followers by account', 'Current followers and the change in this period', followers);
  const dCard = card('Day by day', `${rangeLabel(p.from, p.to)}`, daily);
  const long = o.byAccount.length > 2;
  return `${tiles}
    <div class="rgrid2">
      <div class="stack" style="gap:var(--s4)">${formats}${long ? dCard : fCard}</div>
      <div class="stack" style="gap:var(--s4)">${long ? fCard : dCard}</div>
    </div>
    ${o.platforms ? card('Platform breakdown', '', platformBreakdown(o.platforms), `${esc(rangeLabel(p.from, p.to))}`) : ''}
    ${o.top
      ? card('Top performing posts', '', topPostsTable(o.top), o.top.length ? `top ${o.top.length}` : '')
      : card('Top posts published in this period', 'Lifetime numbers for each post, so they won’t add up to the totals above', legacyTop(o))}
    ${o.dataAsOf ? foot(`Data as of ${new Date(o.dataAsOf).toUTCString().replace(/:\d\d GMT$/, ' UTC')}. Follower counts refresh daily; post numbers can trail by a day.${o.postsTruncated ? ' Only the most recent 500 posts were read for the tables.' : ''}`) : ''}`;
}

/* ------------------------------------------------------------------ paid */
export function paidPart(paid, organic, p, { spend }) {
  const s = paid.sum, ps = paid.prevSum;
  const syncing = paid.backfillPending;
  if (!paid.count && syncing)
    return `<div class="card"><div class="card-body">${note('info', 'Syncing your ad history', 'The ad account is still being read. The numbers will appear here on their own; nothing is shown as zero meanwhile.')}</div></div>`;
  if (!paid.delivered)
    return `<div class="card">${empty('No ads running in this period', paid.count ? 'The ad account has ads, but none of them were shown in these dates.' : 'There are no ads on this account for these dates.')}</div>`;

  const cur = paid.currency;
  const syncNote = syncing ? `<div class="rsync">${chip('info', 'Still syncing')} <span>Older ads are still being read; these totals may grow.</span></div>` : '';
  const ot = organic?.totals || null;
  const oCtr = ot && ot.impressions ? (ot.clicks / ot.impressions) * 100 : null;
  const dash = '<span class="muted">–</span>';
  const row = (label, o, pd, hint = '', mk = '') => `<tr><th scope="row"><span class="zth">${mk ? metricIcon(mk) : ''}${esc(label)}</span>${hint ? `<span class="rhint-inline">${esc(hint)}</span>` : ''}</th><td class="r num">${o}</td><td class="r num">${pd}</td></tr>`;
  const compare = `<div class="rtable rcompare"><table>
      <thead><tr><th>Metric</th><th class="r">Organic</th><th class="r">Paid</th></tr></thead>
      <tbody>
        ${row('Impressions', ot ? esc(int(ot.impressions)) : dash, esc(int(s.impressions)), '', 'impressions')}
        ${row('Reach', ot ? esc(int(ot.reach)) : dash, esc(int(s.reach)), 'Paid reach is summed across ads', 'reach')}
        ${row('Clicks', ot ? esc(int(ot.clicks)) : dash, esc(int(s.clicks)), '', 'clicks')}
        ${row('Click-through rate', oCtr == null ? dash : esc(pct(oCtr, 2)), esc(pct(s.ctr, 2)))}
        ${row('Views', ot && ot.views ? esc(int(ot.views)) : dash, dash, '', 'views')}
        ${row('Engagement rate', ot ? esc(pct(ot.engagementRate, 2)) : dash, dash)}
        ${spend ? `${row('Spend', dash, esc(cur ? money(s.spend, cur) : 'Mixed currencies'))}
        ${row('Cost per click', dash, esc(cur ? money(s.cpc, cur) : '—'))}
        ${row('Cost per result', dash, esc(cur && s.costPerResult != null ? money(s.costPerResult, cur) : '—'), `${int(s.conversions)} result${s.conversions === 1 ? "" : "s"}`)}
        ${row('Cost per 1,000 impressions', dash, esc(cur ? money(s.cpm, cur) : '—'))}
        ${s.roas != null ? row('Return on ad spend', dash, esc(`${s.roas.toFixed(2)}×`)) : ''}` : ''}
      </tbody></table></div>`;

  const tiles = `<div class="rmetrics">
    ${tile('Ad impressions', num(s.impressions), delta(s.impressions, ps?.impressions, p))}
    ${tile('Ad clicks', num(s.clicks), delta(s.clicks, ps?.clicks, p))}
    ${tile('Click-through rate', pct(s.ctr, 2), delta(s.ctr, ps?.ctr, { ...p, points: true }))}
    ${tile('Active ads', int(paid.active), null, `${int(paid.delivered)} ads shown in this period`)}
  </div>
  ${spend && cur ? `<div class="rmetrics rmetrics-spend">
    ${tile('Spend', money(s.spend, cur), delta(s.spend, ps?.spend, { ...p, better: 'none' }))}
    ${tile('Cost per click', money(s.cpc, cur), delta(s.cpc, ps?.cpc, { ...p, better: 'down' }))}
    ${tile('Cost per result', s.costPerResult != null ? money(s.costPerResult, cur) : '—', null, `${int(s.conversions)} result${s.conversions === 1 ? "" : "s"} tracked`)}
    ${tile('Cost per 1,000 impressions', money(s.cpm, cur), delta(s.cpm, ps?.cpm, { ...p, better: 'down' }))}
  </div>` : ''}`;

  const STATUS = { active: 'up', rejected: 'down' };
  const top = paid.top.length
    ? ranked(paid.top.map((a, i) => ({
        icon: icon('ads', 18), label: a.name, value: a.clicks, display: int(a.clicks), best: paid.top.length > 1 && i === 0,
        sub: `<span class="${STATUS[a.status] || ''}">${esc(a.status[0].toUpperCase() + a.status.slice(1))}</span> · ${esc(pct(a.ctr, 2))} CTR${spend ? ` · ${esc(money(a.spend, a.currency || cur))}` : ''}`,
      })), { label: 'Top 3 ads by clicks' })
    : `<p class="rsub">No ad got a click in this period.</p>`;

  return `${syncNote}${tiles}
    <div class="rgrid2">
      ${card('Organic and paid, side by side', `Same dates, same accounts${ot ? '' : ' · organic numbers unavailable'}`, compare)}
      ${card('Top 3 ads by clicks', '', top, 'clicks')}
    </div>`;
}

/* ------------------------------------------------------------- community */
export function communityPart(c, p) {
  const s = c.summary, v = c.volume;
  if (!s.sampleSize && !v.received && !v.sent)
    return `<div class="card">${empty('No messages in this period', 'Nobody wrote to the connected accounts in these dates, so there is no reply time to measure.')}</div>`;

  const within = c.histogram.filter((b) => b.upperSeconds != null && b.upperSeconds <= 3600).reduce((n, b) => n + (b.count || 0), 0);
  const answered = c.histogram.reduce((n, b) => n + (b.count || 0), 0) || s.sampleSize || 0;
  const share = answered ? (within / answered) * 100 : null;
  const LABELS = { '0-1m': 'Under 1 min', '1-5m': '1 to 5 min', '5-15m': '5 to 15 min', '15-60m': '15 to 60 min', '1-4h': '1 to 4 h', '4-24h': '4 to 24 h', '1d+': 'Over a day' };
  const md = s.sampleSize ? delta(s.medianSeconds, c.prev?.sampleSize ? c.prev.medianSeconds : null, { ...p, better: 'down' }) : null;
  // Faster is better: say "faster/slower" instead of a bare percentage.
  const mdText = md && md.dir !== 'flat' ? { ...md, text: md.text.replace(/^[+−]/, '').replace(/% vs/, `% ${md.dir === 'up' ? 'faster' : 'slower'} vs`) } : md;

  const tiles = `<div class="rmetrics">
    ${tile('Median first reply', s.sampleSize ? humanDuration(s.medianSeconds) : '—', mdText, s.sampleSize ? `Based on ${int(s.sampleSize)} answered conversation${s.sampleSize === 1 ? '' : 's'}` : 'No answered conversations')}
    ${tile('Answered within 1 hour', share == null ? '—' : pct(share, 0), null, answered ? `${int(within)} of ${int(answered)} answered conversations` : '')}
    ${tile('Messages received', int(v.received), null, `${int(v.sent)} sent`)}
    ${tile('Conversations', int(v.uniqueConversations), null, 'With at least one message in this period')}
  </div>`;

  const most = Math.max(0, ...c.histogram.map((b) => b.count || 0));
  // One clear winner gets the badge; a tie colours the tied bars and names none of them.
  const unique = c.histogram.filter((b) => (b.count || 0) === most).length === 1;
  const hist = card('Time to first reply', 'Answered conversations, by how long the first reply took',
    ranked(c.histogram.map((b) => ({
      label: LABELS[b.bucket] || b.bucket, value: b.count || 0, display: int(b.count || 0),
      best: unique && most > 0 && (b.count || 0) === most, badge: unique && most > 0 && (b.count || 0) === most ? 'Most common' : '',
      hl: !unique && most > 0 && (b.count || 0) === most,
      sub: answered ? esc(pct(((b.count || 0) / answered) * 100, 0)) : '',
    })), { compact: true, label: 'Time to first reply' }));
  const plat = c.byPlatform.length
    ? `<div class="rtable"><table>
        <thead><tr><th>Channel</th><th class="r">Received</th><th class="r">Sent</th></tr></thead>
        <tbody>${c.byPlatform.map((x) => `<tr>
          <td><div class="racct">${plogo(x.platform, 'plogo-bare')}<span class="racct-name">${esc(platformName(x.platform))}</span></div></td>
          <td class="r num">${esc(int(x.received))}</td><td class="r num">${esc(int(x.sent))}</td></tr>`).join('')}
          <tr class="rtotal"><td>All channels · ${esc(int(v.uniqueConversations))} conversation${v.uniqueConversations === 1 ? '' : 's'}</td><td class="r num">${esc(int(v.received))}</td><td class="r num">${esc(int(v.sent))}</td></tr>
        </tbody></table></div>`
    : `<p class="rsub">No messages by channel.</p>`;

  return `${tiles}
    <div class="rgrid2">${hist}${card('Messages by channel', 'Received and sent in this period', plat)}</div>
    ${foot('Response time counts conversations that got an answer. Numbers only: no message text, no names.')}`;
}

/* ------------------------------------------------------------- sentiment */
export function sentimentPart(r) {
  if (!r.total)
    return `<div class="card">${empty('No comments in this period', r.threads ? 'Posts and ads have comments, but none were written in these dates.' : 'Nobody commented on the posts or ads in these dates.')}</div>`;
  const share = (n) => (n / r.total) * 100;
  const segs = [['positive', 'Positive', 'var(--ok)'], ['neutral', 'Neutral', 'var(--cream-muted)'], ['negative', 'Negative', 'var(--danger)']];
  const bar = `<div class="rstack" role="img" aria-label="${segs.map(([k, l]) => `${l} ${Math.round(share(r.counts[k]))}%`).join(', ')}">
      ${segs.filter(([k]) => r.counts[k]).map(([k, , c]) => `<span style="width:${share(r.counts[k]).toFixed(2)}%;background:${c}"></span>`).join('')}
    </div>
    <div class="rstack-legend">${segs.map(([k, l, c]) => `<div class="rleg">
        <span class="dot" style="background:${c}"></span>
        <span class="rleg-label">${l}</span>
        <span class="rleg-val num">${esc(pct(share(r.counts[k]), 0))}</span>
        <span class="rleg-n num">${esc(int(r.counts[k]))} comment${r.counts[k] === 1 ? '' : 's'}</span>
      </div>`).join('')}</div>`;

  const from = [r.source.posts ? `${int(r.source.posts)} on posts` : '', r.source.ads ? `${int(r.source.ads)} on ads` : ''].filter(Boolean).join(', ');
  const tiles = `<div class="rmetrics rmetrics-3">
    ${tile('Comments read', int(r.total), null, from)}
    ${tile('Positive', pct(share(r.counts.positive), 0), null, `${int(r.counts.positive)} comment${r.counts.positive === 1 ? "" : "s"}`)}
    ${tile('Negative', pct(share(r.counts.negative), 0), null, `${int(r.counts.negative)} comment${r.counts.negative === 1 ? "" : "s"}`)}
  </div>`;
  const words = r.words.length
    ? `<div class="rwords">${r.words.map((w) => `<span class="rword"><span class="rword-w">${esc(w.word)}</span><span class="rword-n num">${esc(int(w.count))}×</span></span>`).join('')}</div>
       <p class="rsub" style="margin-top:var(--s3)">The most frequent words in negative comments. Worth reading those threads before the next post.</p>`
    : `<p class="rsub">${r.counts.negative ? 'The negative comments share no common words.' : 'No negative comments in this period.'}</p>`;

  return `${tiles}
    <div class="rgrid2 rgrid2-wide">
      ${card('The mix', `${int(r.total)} comments from other people, the brand’s own replies left out`, bar, `${esc(int(r.total))} read`)}
      ${card('Worth a look', 'Common words in negative comments', words)}
    </div>
    ${foot(`Comments read ${r.readAt ? new Date(r.readAt).toUTCString().replace(/:\d\d GMT$/, ' UTC') : 'just now'}. Scored automatically from the words people used, so read it as a trend, not a verdict. Names and comment text are never shown.${r.partial ? ' The most recent threads were read; older ones were left out.' : ''}${r.failed ? ` ${int(r.failed)} thread${r.failed === 1 ? '' : 's'} could not be read.` : ''}`)}`;
}

export const partError = (detail) =>
  `<div class="card"><div class="card-body">${note('danger', 'This section isn’t available right now', detail)}
    <div style="margin-top:var(--s4)"><button type="button" class="btn btn-secondary btn-sm js-retry">Try again</button></div></div></div>`;
