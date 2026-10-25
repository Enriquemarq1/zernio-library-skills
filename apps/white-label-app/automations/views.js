// The Automations tab's screens (redesign, October 24, 2026, second pass).
//   list      one stats strip, automation cards that read as a flow (trigger → actions), a template gallery
//   builder   a vertical flow of steps, one open at a time, each closed step a one-line summary; a live
//             Instagram preview beside it (the DM thread, and the post's comments for the public reply)
//   detail    the same flow and preview read-only, the link and QR, live activity as a feed
// Every form field keeps the name the server reads (routes.js fromForm), so behaviour is unchanged.
import { RECIPES, DEFAULTS, describe } from './recipes.js';

/* ----------------------------------------------------------------- icons */
const P = {
  comment: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h11A1.5 1.5 0 0 1 18 5.5v8a1.5 1.5 0 0 1-1.5 1.5H9.5L5.5 18v-3H5.5A1.5 1.5 0 0 1 4 13.5Z"/>',
  heart: '<path d="M11 18s-7-4.2-7-9.2A3.8 3.8 0 0 1 11 6.4a3.8 3.8 0 0 1 7 2.4C18 13.8 11 18 11 18Z"/>',
  story: '<circle cx="11" cy="11" r="7.5" stroke-dasharray="3 2.2"/><circle cx="11" cy="11" r="3.4"/>',
  qr: '<rect x="3.5" y="3.5" width="5.5" height="5.5" rx=".8"/><rect x="13" y="3.5" width="5.5" height="5.5" rx=".8"/><rect x="3.5" y="13" width="5.5" height="5.5" rx=".8"/><path d="M13 13h2.5v2.5H13ZM16 16h2.5v2.5H16ZM13 18.5h2M18.5 13v1.5"/>',
  reply: '<path d="M9 6 4 10.5 9 15"/><path d="M4.5 10.5H13a5 5 0 0 1 5 5V17"/>',
  send: '<path d="M19 3 9.5 12.5"/><path d="M19 3l-6.2 16-3.3-6.5L3 9.2Z"/>',
  bot: '<rect x="4" y="7" width="14" height="10" rx="2.5"/><path d="M11 3.5V7M8 11.5h.01M14 11.5h.01M8.5 14.5h5"/>',
  trash: '<path d="M4 6h14M9 6V4h4v2M6 6l1 12h8l1-12"/>',
  pencil: '<path d="M4 15.5V18h2.5L15 9.5 12.5 7Z"/><path d="M13.7 5.8 15 4.5a1.4 1.4 0 0 1 2 2l-1.3 1.3Z"/>',
  tag: '<path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7l7.3 7.3-7.7 7.7Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  repeat: '<path d="M4 9a5 5 0 0 1 5-5h7l-2-2M18 13a5 5 0 0 1-5 5H6l2 2"/>',
  once: '<circle cx="11" cy="8" r="3.2"/><path d="M5 18a6 6 0 0 1 9-5.2"/><path d="m14.5 16 1.8 1.8 3.2-3.6"/>',
  shield: '<path d="M11 2.5 4.5 5v5.5c0 3.8 2.8 6.6 6.5 7.6 3.7-1 6.5-3.8 6.5-7.6V5Z"/><path d="m8 10.8 2.2 2.2 4-4.3"/>',
  link: '<path d="M9 12a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"/><path d="M13 10a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1"/>',
  chev: '<path d="m6 8.5 5 5 5-5"/>',
  check: '<path d="m5 11.5 4 4 8-9"/>',
  x: '<path d="M6 6l10 10M16 6 6 16"/>',
  plus: '<path d="M11 5v12M5 11h12"/>',
  arrow: '<path d="M4 11h13M12 6l5 5-5 5"/>',
  back: '<path d="M18 11H5M10 6l-5 5 5 5"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="12" y="4" width="6" height="6" rx="1"/><rect x="4" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/>',
  hourglass: '<path d="M6 3.5h10M6 18.5h10M7 3.5c0 4 8 4.5 8 7.5s-8 3.5-8 7.5M15 3.5c0 4-8 4.5-8 7.5s8 3.5 8 7.5"/>',
  info: '<circle cx="11" cy="11" r="8"/><path d="M11 10v5M11 7.2h.01"/>',
  copy: '<rect x="7" y="7" width="11" height="11" rx="2"/><path d="M15 7V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H7"/>',
  download: '<path d="M11 3v11M6.5 9.5 11 14l4.5-4.5"/><path d="M4 18h14"/>',
  bolt: '<path d="M12 2 4 12.5h6L9.5 20 18 9.5h-6Z"/>',
};
export const aicon = (name, size = 18, sw = 1.7) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="${sw}"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

const TONE = { comment_dm: 'blue', followers_only: 'pink', story_mention: 'violet', ref_link: 'green', ask_first: 'amber' };
// What each template looks like as a tiny flow, for the gallery and the list.
const FLOWCHIPS = {
  comment_dm: [['comment', 'Comment'], ['send', 'DM'], ['reply', 'Reply']],
  followers_only: [['comment', 'Comment'], ['shield', 'Follow check'], ['send', 'DM']],
  story_mention: [['story', 'Mention'], ['send', 'DM']],
  ref_link: [['qr', 'Link / QR'], ['send', 'DM'], ['tag', 'Tag']],
  ask_first: [['comment', 'Comment'], ['send', 'Ask'], ['reply', 'Reply'], ['send', 'DM']],
};

const handle = (a) => (a.platform === 'instagram' ? `@${String(a.username).replace(/[&<>"']/g, '')}` : String(a.username).replace(/[&<>"']/g, ''));

export function viewKit(v) {
  const { esc, num, ago, note, empty, plogo, copyField } = v;
  const base = (pid) => `/w/${encodeURIComponent(pid)}/automations`;
  const itemHref = (pid, it) => `${base(pid)}/${it.kind}/${encodeURIComponent(it.id)}`;
  const tile = (recipe, size = 18, cls = '') => `<span class="ax-tile tone-${TONE[recipe] || 'blue'}${cls ? ` ${cls}` : ''}">${aicon(RECIPES[recipe]?.icon || 'bolt', size)}</span>`;
  const statusPill = (it) => it.status === 'live'
    ? `<span class="ax-status is-live"><i></i>Live</span>`
    : `<span class="ax-status"><i></i>${it.status === 'draft' ? 'Draft' : 'Paused'}</span>`;
  const liveSwitch = (pid, it, back, { label = false } = {}) => `<form method="post" action="${esc(itemHref(pid, it))}/live" class="ax-switch-form">
      <input type="hidden" name="on" value="${it.live ? '0' : '1'}"><input type="hidden" name="back" value="${esc(back)}">
      <button type="submit" class="ax-switch${it.live ? ' is-on' : ''}${label ? ' has-label' : ''}" role="switch" aria-checked="${it.live}"
        aria-label="${it.live ? 'Pause' : 'Turn on'} ${esc(it.name)}"><span class="ax-knob"></span>${label ? `<b>${it.live ? 'Live' : it.status === 'draft' ? 'Draft' : 'Paused'}</b>` : ''}</button>
    </form>`;
  const flowChips = (recipe, labels) => `<span class="ax-chips">${(labels || FLOWCHIPS[recipe] || []).map(([ic, l], i) =>
    i ? `<span class="ax-chip-unit"><span class="ax-chip-arrow" aria-hidden="true"></span><span class="ax-chip">${aicon(ic, 13)}${esc(l)}</span></span>` : `<span class="ax-chip">${aicon(ic, 13)}${esc(l)}</span>`).join('')}</span>`;

  // The flow of one automation as chips, from its settings (the list and the detail header).
  const itemChips = (it) => {
    const s = it.settings;
    const kw = (s.keywords || [])[0];
    const chips = [];
    if (it.recipe === 'story_mention') chips.push(['story', 'Story mention']);
    else if (it.recipe === 'ref_link') chips.push(['qr', `ref=${s.ref || '…'}`]);
    else chips.push(['comment', kw ? `“${kw}”${s.keywords.length > 1 ? ` +${s.keywords.length - 1}` : ''}` : 'Any comment']);
    if (it.recipe === 'followers_only') chips.push(['shield', 'Followers only']);
    if (it.recipe === 'ask_first') chips.push(['send', 'Ask first']);
    chips.push(['send', `DM${s.buttons?.length ? ` · ${s.buttons.length} button${s.buttons.length > 1 ? 's' : ''}` : ''}`]);
    if (s.commentReply) chips.push(['reply', 'Reply']);
    if (s.tag) chips.push(['tag', s.tag]);
    return flowChips(null, chips);
  };

  const statsStrip = (cells, foot = '') => `<div class="ax-strip">${cells.map(([label, value, sub]) =>
    `<div class="ax-strip-cell"><span class="ax-strip-label">${esc(label)}</span><span class="ax-strip-value num">${value}</span>${sub ? `<span class="ax-strip-sub">${sub}</span>` : ''}</div>`).join('')}</div>${foot}`;

  /* =============================================================== list */
  const card = (pid, it, back) => {
    const s = it.stats;
    const nums = it.kind === 'comment'
      ? [['Triggered', s.triggered], ['DMs', s.sent], ['Clicks', s.clicks]]
      : [['Started', s.runs], ['Finished', s.completed]];
    return `<article class="ax-card${it.live ? ' is-live' : ''}">
      <a class="ax-card-link" href="${esc(itemHref(pid, it))}" aria-label="Open ${esc(it.name)}"></a>
      ${tile(it.recipe, 20)}
      <div class="ax-card-main">
        <div class="ax-card-title"><b>${esc(it.name)}</b>${statusPill(it)}</div>
        <div class="ax-card-flow">${itemChips(it)}</div>
        <div class="ax-card-meta">${it.account?.username ? `<span class="ax-acct-mini">${plogo(it.platform, 'plogo-xs')}@${esc(it.account.username)}</span>` : ''}<span>${esc(it.read.repeat)}</span></div>
      </div>
      <div class="ax-card-nums">${nums.map(([l, n]) => `<div><b class="num">${esc(num(n))}</b><small>${esc(l)}</small></div>`).join('')}</div>
      <div class="ax-card-end">${liveSwitch(pid, it, back)}</div>
    </article>`;
  };

  const gallery = (pid, { big = false } = {}) => `<div class="ax-gallery${big ? ' is-big' : ''}">
    ${Object.entries(RECIPES).map(([id, r]) => `<a class="ax-tpl tone-${TONE[id]}" href="${esc(base(pid))}/new/${id}">
        <span class="ax-tpl-top">${tile(id, 20)}<span class="ax-tpl-go">${aicon('arrow', 16)}</span></span>
        <span class="ax-tpl-title">${esc(r.title)}</span>
        <span class="ax-tpl-pitch">${esc(r.pitch)}</span>
        ${flowChips(id)}
      </a>`).join('')}
  </div>`;

  const agentCard = (pid) => `<details class="ax-agent">
      <summary><span class="ax-tile tone-dark">${aicon('bot', 18)}</span>
        <span class="ax-agent-text"><b>Run this tab from your AI agent</b><small>Every action here is also a tool: list, create, edit, pause, delete, read the activity.</small></span>
        <span class="ax-agent-cta">Set up ${aicon('chev', 16)}</span></summary>
      <div class="ax-agent-body">
        <p>Claude Code opened in this app's folder already has the tools (<code>.mcp.json</code>). Anywhere else, add:</p>
<pre class="ax-code">{
  "mcpServers": {
    "futuro-automations": {
      "command": "node",
      "args": ["mcp/automations-mcp.mjs"],
      "env": { "PORTAL_URL": "http://127.0.0.1:3000" }
    }
  }
}</pre>
        <p>Then just ask: <em>“For this client, anyone who comments PRICE on any post gets the price list in their DMs. Followers only.”</em></p>
        <p class="ax-muted">JSON API: <code>GET /api/w/${esc(pid)}/automations</code> · <code>POST /api/w/${esc(pid)}/automations</code> · recipes at <a href="/api/recipes">/api/recipes</a></p>
      </div>
    </details>`;

  const listPage = ({ client, accounts, items, totals, flash }) => {
    const pid = client.profileId;
    const back = base(pid);
    const body = `${flash || ''}
      ${!accounts.length ? note('warn', 'No Instagram or Facebook account in this workspace', 'Automations answer comments and DMs, so connect an Instagram or Facebook account first (Connections tab).') : ''}
      ${items.length ? `
        ${statsStrip([
          ['Live', `${esc(num(totals.live))}<small> / ${esc(num(totals.count))}</small>`],
          ['DMs sent', esc(num(totals.sent))],
          ['Link clicks', esc(num(totals.clicks))],
          ['Flows started', esc(num(totals.runs))],
        ])}
        <section class="ax-section">
          <div class="ax-section-head"><h2>Automations</h2><span class="ax-muted">${esc(num(items.length))} on ${accounts.map(handle).join(', ') || 'this workspace'}</span></div>
          <div class="ax-cards">${items.map((it) => card(pid, it, back)).join('')}</div>
        </section>
        <section class="ax-section">
          <div class="ax-section-head"><h2>Start another</h2></div>
          ${gallery(pid)}
        </section>`
      : `<section class="ax-hero">
          <span class="ax-hero-eyebrow">${aicon('bolt', 14)} Automations</span>
          <h2>Your own ManyChat, for ${esc(client.name)}</h2>
          <p>Comments, story mentions and links that turn into DMs, on ${accounts.map(handle).join(', ') || 'this workspace'}. Pick one to start; every word can change before it goes live.</p>
        </section>
        ${gallery(pid, { big: true })}`}
      <p class="ax-fineprint">${aicon('info', 14)} Every DM an automation sends counts as an outbound message on Zernio: the first 10,000 a month are free, then $1 per 10,000.</p>
      ${agentCard(pid)}`;
    return {
      subtitle: 'Comment-to-DM, story mentions, ref links and follower-only rewards, on Zernio.',
      actions: items.length ? `<a class="btn btn-primary" href="${esc(base(pid))}/new">${aicon('plus', 16, 2)} New automation</a>` : '',
      body: `<div class="ax">${body}</div>`,
    };
  };

  const newPage = ({ client }) => ({
    subtitle: 'New automation',
    actions: `<a class="btn btn-ghost" href="${esc(base(client.profileId))}">Cancel</a>`,
    body: `<div class="ax"><section class="ax-hero is-compact"><h2>What should happen?</h2><p>Pick a starting point. You can change every word before it goes live.</p></section>${gallery(client.profileId, { big: true })}<div class="ax-agent-hint"><span class="ax-tile tone-dark">${aicon('bot', 18)}</span><span>Or just tell your AI agent: <em>“Anyone who comments PRICE on any post gets the price list in their DMs.”</em> It builds the same thing (setup on the Automations page).</span></div></div>`,
  });

  /* ============================================================ builder */
  const toggle = (name, on, title, sub = '', attrs = '') => `<label class="ax-toggle"><input type="checkbox" ${name ? `name="${name}" value="1"` : ''}${on ? ' checked' : ''} ${attrs}>
      <span class="ax-toggle-ui" aria-hidden="true"></span><span class="ax-toggle-text"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
  const pills = (name, value, opts) => `<div class="ax-pills" role="radiogroup">${opts.map(([v, l]) =>
    `<label><input type="radio" name="${name}" value="${v}"${String(value) === v ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  const label = (text, hint = '') => `<div class="ax-label"><span>${text}</span>${hint ? `<small>${hint}</small>` : ''}</div>`;
  const composer = ({ name, value, max, rows = 3, vars = [], placeholder = '', id, hiddenName }) => `<div class="ax-composer">
      <textarea class="ax-textarea" ${name ? `name="${name}"` : ''} id="${id}" rows="${rows}" maxlength="${max}" placeholder="${esc(placeholder)}" data-count="${max}">${esc(value ?? '')}</textarea>
      ${hiddenName ? `<input type="hidden" name="${hiddenName}" value="${esc(value ?? '')}" data-mirror="${id}">` : ''}
      <div class="ax-composer-bar">${vars.map(([token, l]) => `<button type="button" class="ax-var" data-insert="${id}" data-token="${token}">${aicon('plus', 12, 2)}${esc(l)}</button>`).join('')}
        <span class="ax-count" data-count-for="${id}"></span></div>
    </div>`;
  const buttonRow = (b) => `<div class="ax-btn-row">
      <input class="ax-input" name="btnTitle" maxlength="20" placeholder="Button text" value="${esc(b.title)}" aria-label="Button text">
      <span class="ax-url">${aicon('link', 14)}<input class="ax-input" name="btnUrl" type="url" placeholder="https://your-link.com" value="${esc(b.url)}" aria-label="Button link"></span>
      <button type="button" class="ax-icon-btn ax-del-btn" aria-label="Remove button">${aicon('x', 15)}</button>
    </div>`;
  const buttonsEditor = (buttons) => `<div class="ax-btns">${buttons.map(buttonRow).join('')}</div>
      <button type="button" class="ax-add-btn">${aicon('plus', 14, 2)} Add a button <small></small></button>
      <template id="ax-btn-tpl">${buttonRow({ title: '', url: '' })}</template>`;

  const postTiles = (s, posts) => {
    const tiles = [
      `<label class="ax-post is-any" title="Any post or reel"><input type="radio" name="platformPostId" value="any" data-title=""${!s.platformPostId ? ' checked' : ''}>
        <span class="ax-post-img">${aicon('grid', 22)}</span><span class="ax-post-cap">Any post or reel</span>${aicon('check', 12, 2.6)}</label>`,
      ...posts.map((p) => `<label class="ax-post" title="${esc(p.title)}"><input type="radio" name="platformPostId" value="${esc(p.id)}" data-title="${esc(p.title)}" data-pic="${esc(p.picture || '')}"${s.platformPostId === p.id ? ' checked' : ''}>
        <span class="ax-post-img">${p.picture ? `<img src="${esc(p.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<em>${esc(p.title.slice(0, 2))}</em></span>
        <span class="ax-post-cap">${esc(p.createdAt ? new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : p.title)}</span>${aicon('check', 12, 2.6)}<span class="sr-only">${esc(p.title)}</span></label>`),
    ];
    if (s.platformPostId && !posts.some((p) => p.id === s.platformPostId))
      tiles.push(`<label class="ax-post" title="${esc(s.postTitle || 'The bound post')}"><input type="radio" name="platformPostId" value="${esc(s.platformPostId)}" data-title="${esc(s.postTitle || '')}" checked>
        <span class="ax-post-img"><em>${esc((s.postTitle || 'P').slice(0, 2))}</em></span><span class="ax-post-cap">${esc(s.postTitle || 'The bound post')}</span>${aicon('check', 12, 2.6)}</label>`);
    return `<div class="ax-posts" role="radiogroup" aria-label="Which post">${tiles.join('')}</div>
      <input type="hidden" name="postTitle" value="${esc(s.postTitle || '')}">`;
  };

  const node = ({ key, tone, icon: ic, eyebrow, title, body, next, open }) => `<section class="ax-node tone-${tone}${open ? ' is-open' : ''}" data-node="${key}">
      <button type="button" class="ax-node-head" aria-expanded="${open ? 'true' : 'false'}">
        <span class="ax-tile">${aicon(ic, 18)}</span>
        <span class="ax-node-text"><small>${esc(eyebrow)}</small><b>${esc(title)}</b><span class="ax-node-sum" data-sum="${key}"></span></span>
        <span class="ax-node-chev">${aicon('chev', 18)}</span>
      </button>
      <div class="ax-node-body">${body}
        <div class="ax-node-foot"><button type="button" class="ax-next">${next ? `Next: ${esc(next)} ${aicon('arrow', 14, 2)}` : `Done ${aicon('check', 14, 2.2)}`}</button></div>
      </div>
    </section>`;

  const builderPage = ({ client, recipe, s, accounts, posts, errors = [], editing = null }) => {
    const pid = client.profileId;
    const r = RECIPES[recipe];
    const igOnly = ['followers_only', 'story_mention'].includes(recipe);
    const usable = accounts.filter((a) => !igOnly || a.platform === 'instagram');
    const acct = usable.find((a) => a.id === s.accountId) || usable[0];
    const acctOptions = usable.map((a) => `<option value="${esc(a.id)}" data-username="${esc(a.username)}" data-platform="${esc(a.platform)}" data-uid="${esc(a.platformUserId || '')}" data-followers="${a.followers ?? ''}" data-pic="${esc(a.picture || '')}"${a.id === acct?.id ? ' selected' : ''}>@${esc(a.username)} · ${a.platform === 'instagram' ? 'Instagram' : 'Facebook'}</option>`).join('');
    const isComment = ['comment_dm', 'followers_only', 'ask_first'].includes(recipe);
    const nameVars = [['{{first_name}}', 'First name'], ['{{username}}', 'Username']];
    const nodes = [];

    // WHEN
    nodes.push({ key: 'when', tone: TONE[recipe], icon: RECIPES[recipe].icon, eyebrow: 'When',
      title: recipe === 'story_mention' ? 'Someone mentions you in their story' : recipe === 'ref_link' ? 'Someone opens your link or QR code' : 'Someone comments a keyword',
      body: isComment ? `
        ${label('Keywords', 'press Enter after each one')}
        <div class="ax-chipfield" data-chips="keywords"><input class="ax-chipfield-input" placeholder="Type a keyword…" aria-label="Add a keyword" autocomplete="off"></div>
        <input type="hidden" name="keywords" value="${esc((s.keywords || []).join(', '))}">
        ${pills('matchMode', s.matchMode, recipe === 'ask_first'
          ? [['contains', 'Anywhere in the comment'], ['exact', 'The whole comment']]
          : [['word', 'As a word'], ['contains', 'Anywhere'], ['exact', 'Whole comment']])}
        ${label('On which post')}
        ${postTiles(s, posts)}
        ${recipe !== 'ask_first' ? `<div class="ax-toggles">
          ${toggle('typoTolerance', s.typoTolerance, 'Catch small typos', '“guied” still counts as “guide”')}
          ${toggle('alsoMatchInDms', s.alsoMatchInDms, 'Also when they DM it', 'One automation for comments and DMs')}</div>` : ''}`
        : recipe === 'story_mention' ? `<div class="ax-explain">${aicon('story', 18)}<p>Every mention of <b class="js-uname">@${esc(acct?.username || 'you')}</b> in someone's story counts. A mention carries no words, so there are no keywords. Instagram only.</p></div>`
          : `${label('Link name', 'letters, numbers, - and _')}
        <div class="ax-affix"><span class="ax-affix-pre js-refpre">${acct?.platform === 'facebook' ? 'm.me/…?ref=' : `ig.me/m/${esc(acct?.username || '')}?ref=`}</span>
          <input class="ax-input" name="ref" value="${esc(s.ref)}" required pattern="[A-Za-z0-9_\\-]{1,40}" autocomplete="off" aria-label="Link name"></div>
        <p class="ax-hint">${aicon('qr', 14)} The QR code for this link is on the automation's page after you save, ready to print.</p>`,
    });
    if (recipe === 'followers_only') nodes.push({ key: 'gate', tone: 'pink', icon: 'shield', eyebrow: 'Check', title: 'Only followers get it',
      body: `<div class="ax-explain">${aicon('info', 18)}<p>Instagram only tells you who follows you after they've messaged you. So anyone it doesn't know yet gets a one-tap check first. The tap counts as a message, Zernio checks the follow, and the reward goes out on its own.</p></div>
        ${label('The check message')}
        ${composer({ name: 'gateMessage', value: s.gateMessage, max: 640, rows: 2, id: 'ax-gate' })}
        ${label('Its button')}
        <input class="ax-input ax-input-btn" name="gateButton" value="${esc(s.gateButton)}" maxlength="20" aria-label="Check button">
        ${label('If they don’t follow yet', 'sent with the button again')}
        ${composer({ name: 'gateNotFollowing', value: s.gateNotFollowing, max: 1000, rows: 2, id: 'ax-notyet' })}` });
    if (recipe === 'ask_first') nodes.push({ key: 'ask', tone: 'amber', icon: 'send', eyebrow: 'First', title: 'Send a plain message, wait for a reply',
      body: `<div class="ax-explain">${aicon('info', 18)}<p>Instagram can refuse buttons in the first DM to someone who doesn't follow you. A plain message always arrives; once they reply, the button goes too.</p></div>
        ${composer({ name: 'opener', value: s.opener, max: 1000, rows: 2, id: 'ax-opener' })}` });
    // THEN
    nodes.push({ key: 'dm', tone: 'violet', icon: 'send', eyebrow: 'Then', title: recipe === 'ask_first' ? 'When they reply, send the DM' : 'Send a DM',
      body: `${composer({ name: 'dmMessage', value: s.dmMessage, max: 1000, id: 'ax-dm', vars: recipe === 'ref_link' ? [['{{contact.name}}', 'Name']] : recipe === 'ask_first' ? [] : nameVars, placeholder: 'Write the DM…' })}
        ${label('Buttons', 'up to 3, each opens a link')}
        ${buttonsEditor(s.buttons || [])}
        ${['comment_dm', 'followers_only'].includes(recipe) ? `<div class="ax-sep"></div>
          ${toggle('', Boolean(s.commentReply), 'Reply publicly under the comment', 'So everyone sees it worked', 'data-reveal="ax-reply-wrap" id="ax-reply-on"')}
          <div id="ax-reply-wrap" class="ax-reveal">${composer({ value: s.commentReply, max: 1000, rows: 2, id: 'ax-reply', vars: nameVars, hiddenName: 'commentReply' })}</div>
          ${toggle('likeComment', s.likeComment, 'Like their comment', 'Instagram allows it only for accounts connected with Facebook Login')}` : ''}` });
    if (['ref_link', 'ask_first'].includes(recipe)) nodes.push({ key: 'tag', tone: 'green', icon: 'tag', eyebrow: 'And', title: 'Tag the contact',
      body: `<div class="ax-affix"><span class="ax-affix-pre">#</span><input class="ax-input" name="tag" value="${esc(s.tag)}" maxlength="40" placeholder="came-from-qr" aria-label="Tag"></div>
        <p class="ax-hint">Optional. Use it later for broadcasts and sequences.</p>` });
    if (recipe !== 'ask_first') nodes.push({ key: 'often', tone: 'slate', icon: 'repeat', eyebrow: 'How often', title: recipe === 'ref_link' ? 'Same person again' : 'Repeat rule',
      body: recipe === 'ref_link'
        ? `<div class="ax-inline">Start it again for the same person after <input class="ax-input ax-num" name="cooldownHours" type="number" min="1" max="720" value="${esc(s.cooldownHours ?? 24)}"> hours</div>`
        : `<div class="ax-choices" role="radiogroup">
            <label class="ax-choice"><input type="radio" name="repeat" value="once"${s.repeat !== 'every' ? ' checked' : ''}>${aicon('once', 20)}<b>Once per person</b><small>They get it the first time. After that it's skipped, and the log says why.</small></label>
            <label class="ax-choice"><input type="radio" name="repeat" value="every"${s.repeat === 'every' ? ' checked' : ''}>${aicon('repeat', 20)}<b>Every time</b><small>Each new ${recipe === 'story_mention' ? 'mention' : 'comment'} gets it, with an optional pause.</small></label>
          </div>
          <div class="ax-inline ax-cooldown">Leave at least <input class="ax-input ax-num" name="cooldownHours" type="number" min="1" max="8760" value="${esc(s.cooldownHours ?? '')}" placeholder="0"> hours between two DMs to the same person</div>` });

    const openAll = errors.length > 0;
    const flow = nodes.map((n, i) => node({ ...n, open: openAll || i === 0, next: nodes[i + 1]?.title })).join('<div class="ax-wire" aria-hidden="true"></div>');
    const action = editing ? `${base(pid)}/${editing.kind}/${encodeURIComponent(editing.id)}/edit` : `${base(pid)}/new/${recipe}`;
    const cancel = editing ? `${base(pid)}/${editing.kind}/${encodeURIComponent(editing.id)}` : `${base(pid)}/new`;

    const body = `<form method="post" action="${esc(action)}" class="ax ax-builder" id="au-form" data-recipe="${recipe}" novalidate>
      ${errors.length ? `<div class="ax-errors" role="alert">${aicon('info', 18)}<div><b>Fix ${errors.length === 1 ? 'this' : 'these'} and save again</b><ul class="au-errors">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div></div>` : ''}
      <div class="ax-builder-grid">
        <div class="ax-flow">
          <div class="ax-titlebar">
            ${tile(recipe, 22, 'is-lg')}
            <div class="ax-titlebar-main">
              <input class="ax-name" name="name" value="${esc(s.name)}" required maxlength="100" aria-label="Automation name" placeholder="Name this automation">
              <div class="ax-titlebar-meta"><span class="ax-kind">${esc(r.title)}</span>
                <label class="ax-acct">${acct ? plogo(acct.platform, 'plogo-xs') : ''}
                  <select name="accountId" ${editing ? 'disabled' : 'required'} aria-label="Account">${acctOptions}</select>${editing ? '' : aicon('chev', 14)}</label>
                ${editing ? `<input type="hidden" name="accountId" value="${esc(s.accountId)}">` : ''}</div>
            </div>
          </div>
          <div class="ax-nodes">${flow}
            <div class="ax-wire" aria-hidden="true"></div>
            <div class="ax-end">${aicon('check', 14, 2.4)} ${editing ? 'Save your changes up top' : 'Ready. Go live up top, or save it as a draft'}</div>
          </div>
        </div>
        <aside class="ax-stage-col">${stage(recipe)}</aside>
      </div>
    </form>${PREVIEW_JS}${BUILDER_JS}`;

    const actions = editing
      ? `<a class="btn btn-ghost" href="${esc(cancel)}">Cancel</a>
         <button class="btn btn-primary" type="submit" form="au-form">${aicon('check', 15, 2.2)} Save changes</button>`
      : `<a class="btn btn-ghost" href="${esc(cancel)}">Cancel</a>
         <button class="btn btn-secondary" type="submit" form="au-form" name="isActive" value="0">Save as draft</button>
         <button class="btn btn-primary ax-golive" type="submit" form="au-form" name="isActive" value="1"><i></i>Go live</button>`;
    return { subtitle: editing ? `Editing · ${esc(r.title)}` : `New automation · ${esc(r.title)}`, actions, body };
  };

  // The preview: an iPhone 17 Pro running Instagram, seen from Sam's side (the person who commented).
  // DM: the thread the automation opens. Comment: the post with Instagram's comments sheet and the public reply.
  const SB = `<span class="ax-sb-icons" aria-hidden="true"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg><svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8 .6 10.4 10.4 0 0 0 .6 3.6l1.2 1.2A8.7 8.7 0 0 1 8 2.3Zm0 3.4c1.5 0 2.8.6 3.8 1.5L13 6a7 7 0 0 0-5-2 7 7 0 0 0-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5Zm0 3.4c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.7c.4-.4.9-.6 1.5-.6Z"/></svg><span class="ax-batt"><i></i></span></span>`;
  const IC = {
    phone: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M16.6 14.6 14.5 16a12.3 12.3 0 0 1-6.5-6.5L9.4 7.4 8 3.5H4.6A1.6 1.6 0 0 0 3 5.2 16 16 0 0 0 18.8 21a1.6 1.6 0 0 0 1.7-1.6V16Z"/></svg>',
    video: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.5" y="6" width="13.5" height="12" rx="3"/><path d="m16 10.6 5.5-3.3v9.4L16 13.4Z"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="12.8" r="3.2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    img: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m3.5 17 5-5 4 4 2.5-2.5 5.5 5"/></svg>',
    sticker: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9h9Z"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.5 3.2c0 6-8.5 11-8.5 11Z"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20.7 16.4A9 9 0 1 0 17 20l4 1Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21.5 3 9.6 13.2M21.5 3l-7.3 18-4.6-7.8L2.5 9Z"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M19 21 12 15.4 5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1Z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  const stage = (recipe, state = null) => {
    const hasComment = ['comment_dm', 'followers_only', 'ask_first'].includes(recipe);
    return `<div class="ax-stage"${state ? ` data-state="${esc(JSON.stringify(state))}"` : ''} data-recipe="${recipe}">
      ${hasComment
        ? `<div class="ax-seg" role="tablist" aria-label="Preview"><button type="button" role="tab" data-view="dm" aria-selected="true">DM</button><button type="button" role="tab" data-view="post" aria-selected="false">Comment</button></div>`
        : '<div class="ax-seg is-label"><span>What they see</span></div>'}
      <div class="ax-iphone" aria-label="Preview on Instagram">
        <span class="ax-hw is-action"></span><span class="ax-hw is-volup"></span><span class="ax-hw is-voldn"></span><span class="ax-hw is-power"></span><span class="ax-hw is-camctl"></span>
        <div class="ax-screen">
          <div class="ax-statusbar"><b>9:41</b><span class="ax-island"></span>${SB}</div>
          <div class="ax-view is-dm" data-view-pane="dm">
            <div class="ax-ig-head">
              <span class="ax-ig-back">${IC.back}</span>
              <span class="ax-av is-head js-av">K<i></i></span>
              <span class="ax-ig-who"><b><span class="js-uname-plain">account</span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg></b><small>Active now</small></span>
              <span class="ax-ig-acts">${IC.phone}${IC.video}</span>
            </div>
            <div class="ax-chat js-chat"></div>
            <div class="ax-ig-compose"><span class="ax-cam">${IC.cam}</span><span class="ax-ig-ph">Message...</span><span class="ax-ig-tools">${IC.mic}${IC.img}${IC.sticker}</span></div>
          </div>
          ${hasComment ? `<div class="ax-view is-post" data-view-pane="post" hidden>
            <div class="ax-post-head"><span class="ax-av is-ring js-av">K</span><b class="js-uname-plain">account</b><span class="ax-post-dots">${IC.dots}</span></div>
            <div class="ax-igpost-img js-posthero"></div>
            <div class="ax-post-acts">${IC.heart}${IC.bubble}${IC.share}<span class="ax-post-save">${IC.save}</span></div>
            <div class="ax-sheet">
              <span class="ax-sheet-grab"></span>
              <div class="ax-sheet-title">Comments</div>
              <div class="ax-comments js-comments"></div>
              <div class="ax-sheet-emoji"><span>❤️</span><span>🙌</span><span>🔥</span><span>👏</span><span>😢</span><span>😍</span><span>😮</span><span>😂</span></div>
              <div class="ax-sheet-add"><span class="ax-av is-sm is-sam">S</span><span>Add a comment for <b class="js-uname-plain">account</b>...</span></div>
            </div>
          </div>` : ''}
          <span class="ax-home"></span>
        </div>
      </div>
      <p class="ax-stage-note">Live preview · as Sam sees it on Instagram</p>
    </div>`;
  };

  /* ============================================================ detail */
  const howItWorks = (it) => {
    const steps = [['When', it.read.when, RECIPES[it.recipe]?.icon || 'bolt', TONE[it.recipe] || 'blue'],
      ...it.read.then.map((t) => [/one-tap|Followers only/.test(t) ? 'Check' : /^Tag/.test(t) ? 'And' : /^Reply|^Like/.test(t) ? 'And' : 'Then', t,
        /one-tap|Followers only/.test(t) ? 'shield' : /^Tag/.test(t) ? 'tag' : /^Reply/.test(t) ? 'reply' : /^Like/.test(t) ? 'heart' : 'send',
        /one-tap|Followers only/.test(t) ? 'pink' : /^Tag/.test(t) ? 'green' : /^Reply|^Like/.test(t) ? 'slate' : 'violet']),
      ...(it.read.repeat ? [['How often', it.read.repeat, 'repeat', 'slate']] : [])];
    return `<div class="ax-readflow">${steps.map(([k, t, ic, tone], i) => `${i ? '<div class="ax-wire is-short" aria-hidden="true"></div>' : ''}<div class="ax-readnode tone-${tone}"><span class="ax-tile">${aicon(ic, 16)}</span><span><small>${esc(k)}</small><b>${esc(t)}</b></span></div>`).join('')}</div>`;
  };

  const metricsFor = (it) => {
    const s = it.stats;
    if (it.kind === 'flow') return statsStrip([['Started', esc(num(s.runs))], ['Finished', esc(num(s.completed))], ['Ended early', esc(num(s.exited || 0))]]);
    const ctr = s.trackedSends ? `${((s.uniqueClicks / s.trackedSends) * 100).toFixed(0)}% clicked` : '';
    return statsStrip([
      ['Triggered', esc(num(s.triggered))],
      ['DMs sent', esc(num(s.sent)), s.failed ? `${esc(num(s.failed))} failed` : ''],
      ['Link clicks', esc(num(s.clicks)), esc(ctr)],
      it.recipe === 'followers_only' ? ['Unlocked by followers', esc(num(s.gatePassed)), `${esc(num(s.gated))} checks sent`] : ['Skipped', esc(num(s.skipped))],
    ]);
  };

  const previewState = (it, post) => ({
    username: it.account?.username || '', platform: it.platform, followers: it.account?.followers ?? '', avatar: it.account?.picture || '', dm: it.settings.dmMessage, buttons: (it.settings.buttons || []).map((b) => b.title),
    reply: it.settings.commentReply || '', gateMessage: it.settings.gateMessage || '', gateButton: it.settings.gateButton || '',
    opener: it.settings.opener || '', keyword: (it.settings.keywords || [])[0] || '', ref: it.settings.ref || '', tag: it.settings.tag || '',
    postPic: post?.picture || '', postTitle: post?.title || it.settings.postTitle || '', anyPost: !it.settings.platformPostId,
  });

  const detailPage = ({ client, it, qrSvg, post }) => {
    const pid = client.profileId;
    const self = itemHref(pid, it);
    const canEdit = it.kind === 'comment' || it.ours;
    const linkCard = it.link ? `<div class="ax-panel ax-qr-panel"><div class="ax-qr">${qrSvg || ''}</div>
        <div class="ax-qr-main"><span class="ax-eyebrow">${aicon('qr', 14)} Your link and QR code</span>
          <p>Put the link in a bio, an ad or a story, or print the code. Opening it starts this flow.</p>
          ${copyField('reflink', it.link, 'ref link')}
          <a class="btn btn-secondary btn-sm" href="${esc(self)}/qr.png" download="qr-${esc(it.settings.ref)}.png">${aicon('download', 14)} Download QR (PNG)</a></div></div>` : '';
    const unsupported = it.settings.unsupported?.length
      ? note('warn', 'Made outside this tab', `It also uses ${it.settings.unsupported.join(', ')}. Editing it here would remove ${it.settings.unsupported.length === 1 ? 'that' : 'those'}.`) : '';
    const body = `<div class="ax">${unsupported}
      <section class="ax-hero is-item">
        ${tile(it.recipe, 22, 'is-lg')}
        <div class="ax-hero-main"><h2>${esc(it.name)}</h2>
          <div class="ax-hero-meta">${statusPill(it)}<span class="ax-kind">${esc(it.title)}</span>${it.account?.username ? `<span class="ax-acct-mini">${plogo(it.platform, 'plogo-xs')}@${esc(it.account.username)}</span>` : ''}</div></div>
      </section>
      <div class="ax-detail-grid">
        <div class="ax-detail-main">
          ${metricsFor(it)}
          <div class="ax-panel"><div class="ax-panel-head"><h3>How it works</h3>${canEdit ? `<a class="ax-link" href="${esc(self)}/edit">${aicon('pencil', 14)} Edit</a>` : ''}</div>${howItWorks(it)}</div>
          ${linkCard}
          ${post ? `<div class="ax-panel ax-postcard">${post.picture ? `<img src="${esc(post.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<div><span class="ax-eyebrow">On this post</span><b>${esc(post.title)}</b>
            ${post.permalink ? `<a class="ax-link" href="${esc(post.permalink)}" target="_blank" rel="noopener">Open on Instagram ↗</a>` : ''}</div></div>` : ''}
          <div class="ax-panel ax-activity">
            <div class="ax-panel-head"><div><h3>Live activity</h3><p class="ax-muted">${it.kind === 'comment' ? (it.recipe === 'story_mention' ? 'Mention the account in a story from another account and watch it land here.' : 'Comment from another account and watch it land here.') : it.recipe === 'ref_link' ? 'Open the link from another account and watch it land here.' : 'Comment from another account and watch it land here.'}</p></div>
              <span class="ax-live"><i></i>Live</span></div>
            <div class="js-activity" data-src="${esc(self)}/activity" aria-live="polite"><div class="ax-feed-empty">Loading…</div></div>
          </div>
        </div>
        <aside class="ax-stage-col">${stage(it.recipe, previewState(it, post))}</aside>
      </div>
      <details class="ax-agent"><summary><span class="ax-tile tone-dark">${aicon('bot', 18)}</span>
        <span class="ax-agent-text"><b>The same automation, for your agent</b><small>Tool <code>get_automation</code> · kind <code>${esc(it.kind)}</code> · id <code>${esc(it.id)}</code></small></span>
        <span class="ax-agent-cta">Show ${aicon('chev', 16)}</span></summary>
        <div class="ax-agent-body"><pre class="ax-code">${esc(JSON.stringify({ kind: it.kind, id: it.id, recipe: it.recipe, settings: stripForAgent(it.settings) }, null, 2))}</pre></div></details>
    </div>${PREVIEW_JS}${ACTIVITY_JS}`;
    const actions = `<a class="btn btn-ghost" href="${esc(base(pid))}">${aicon('back', 15, 2)} All</a>
        ${canEdit ? `<a class="btn btn-secondary" href="${esc(self)}/edit">${aicon('pencil', 15)} Edit</a>` : ''}
        ${liveSwitch(pid, it, self, { label: true })}
        <form method="post" action="${esc(self)}/delete" class="ax-switch-form" onsubmit="return confirm('Delete “${esc(it.name).replace(/'/g, '')}”? It stops for good; its log stays in Zernio.')">
          <button class="btn btn-ghost ax-danger" type="submit" aria-label="Delete">${aicon('trash', 16)}</button></form>`;
    return { subtitle: `${esc(it.title)} · ${it.status === 'live' ? 'Live' : it.status === 'draft' ? 'Draft' : 'Paused'}`, actions, body };
  };

  /* ----------------------------------------------------------- activity */
  const doorLabel = { comment: 'Comment', dm: 'DM', story_mention: 'Story mention', story_reply: 'Story reply', live_comment: 'Live', link: 'Link' };
  const tone = (st) => (st === 'sent' || st === 'completed' ? 'ok' : st === 'failed' ? 'bad' : st === 'gated' || st === 'waiting' || st === 'pending' || st === 'running' ? 'wait' : 'idle');
  const activityPart = ({ kind, rows, total, misses }) => {
    if (!rows.length)
      return `<div class="ax-feed-empty">${empty(kind === 'comment' ? 'Nothing yet' : 'No runs yet',
        kind === 'comment' ? 'When someone comments the keyword (or mentions you), it lands here within seconds, with what the automation did.' : 'When someone opens the link, the run lands here with where it is.')}</div>${missesBox(misses)}`;
    const items = rows.map((r) => {
      const who = String(r.who || 'someone');
      const extra = kind === 'comment' ? [
        r.text ? `<span class="ax-feed-said">“${esc(r.text.slice(0, 60))}”</span>` : '',
        r.follower === true ? '<span class="ax-tagline is-ok">Follows you</span>' : r.follower === false ? '<span class="ax-tagline">Doesn’t follow</span>' : '',
        r.reply === 'sent' ? '<span class="ax-tagline">Public reply posted</span>' : r.reply === 'failed' ? `<span class="ax-tagline is-bad">Reply failed${r.replyError ? `: ${esc(r.replyError)}` : ''}</span>` : '',
        r.clicks ? `<span class="ax-tagline is-ok">${esc(num(r.clicks))} click${r.clicks > 1 ? 's' : ''}</span>` : '',
        r.gate === 'rejected' ? '<span class="ax-tagline is-bad">Instagram refused the check button</span>' : '',
        r.likeSkipped ? `<span class="ax-tagline">Like skipped: ${esc(r.likeSkipped)}</span>` : '',
      ].join('') : `<span class="ax-tagline">${esc(num(r.steps))} steps</span>`;
      return `<li class="ax-feed-row">
        <span class="ax-feed-av">${esc(who.replace(/^@/, '')[0]?.toUpperCase() || '?')}</span>
        <div class="ax-feed-main">
          <div class="ax-feed-line"><b>${kind === 'comment' ? '@' : ''}${esc(who)}</b><span class="ax-door">${esc(doorLabel[r.door] || r.door)}</span><span class="ax-badge is-${tone(r.status)}">${esc(r.outcome)}</span></div>
          <div class="ax-feed-extra">${extra}</div>
        </div>
        <time class="ax-feed-time">${esc(ago(r.at))}</time>
      </li>`;
    }).join('');
    return `<ul class="ax-feed">${items}</ul>
      ${total > rows.length ? `<p class="ax-muted ax-feed-more">Showing the newest ${esc(num(rows.length))} of ${esc(num(total))}.</p>` : ''}${missesBox(misses)}`;
  };
  const missesBox = (m) => m?.total ? `<div class="ax-misses"><b>Matched no keyword</b>
      <span>${esc(num(m.total))} comment${m.total === 1 ? '' : 's'} in the last ${esc(m.retentionDays ?? '')} days reached this automation without a keyword in them.</span>
      ${(m.samples || []).slice(0, 3).map((x) => `<span class="ax-muted">“${esc(String(x.commentText || '').slice(0, 60))}”${x.excludedBy ? ` · blocked by “${esc(x.excludedBy)}”` : ''} · ${esc(ago(x.at))}</span>`).join('')}</div>` : '';

  return { base, itemHref, listPage, newPage, builderPage, detailPage, activityPart, aicon, statusPill, liveSwitch, templateCards: gallery };
}

// What an agent needs to edit it; nothing about the commenters.
export const stripForAgent = (s) => Object.fromEntries(Object.entries(s).filter(([k, v]) => v !== null && v !== '' && k !== 'unsupported' && k !== 'ours'));

export const defaultsFor = (recipe, accounts) => ({
  recipe, accountId: (accounts.find((a) => a.platform === 'instagram') || accounts[0])?.id || '',
  keywords: [], buttons: [], ...structuredClone(DEFAULTS[recipe] || {}),
  ...(DEFAULTS[recipe]?.keywords ? { keywords: DEFAULTS[recipe].keywords.split(',').map((k) => k.trim()) } : {}),
});

export { describe };

/* ================================================================ scripts */
// The Instagram preview renderer, shared by the builder (state from the form) and the detail page (data-state).
const PREVIEW_JS = `<script>
window.axPreview = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fill = (t) => esc(t)
    .replace(/\\{\\{\\s*(first_name|contact\\.name)\\s*\\}\\}/g, 'Sam')
    .replace(/\\{\\{\\s*name\\s*\\}\\}/g, 'Sam Rivera')
    .replace(/\\{\\{\\s*username\\s*\\}\\}/g, 'sam.rivera')
    .replace(/\\n/g, '<br>');
  const ini = (u) => esc((u || 'k').replace(/^@/, '')[0].toUpperCase());
  let AV = '';
  const avs = (cls, u) => '<span class="ax-av ' + cls + '"' + (AV ? ' style="background-image:url(&quot;' + esc(AV) + '&quot;)"' : '') + '>' + (AV ? '' : ini(u)) + '</span>';
  // Each item: { who: 'them' | 'me' | 'sys' | 'ctx' | 'story', html }
  function thread(items, u) {
    let h = '';
    items.forEach((it, i) => {
      const next = items[i + 1];
      if (it.who === 'sys') { h += '<div class="ax-sys">' + it.html + '</div>'; return; }
      if (it.who === 'ctx') { h += it.html; return; }
      const lastOfRun = !next || next.who !== it.who;
      if (it.who === 'them') {
        h += '<div class="ax-row is-them' + (lastOfRun ? ' is-last' : '') + '">' + (lastOfRun ? avs('is-xs', u) : '<span class="ax-av is-xs is-gap"></span>') + it.html + '</div>';
      } else {
        h += '<div class="ax-row is-me' + (lastOfRun ? ' is-last' : '') + '">' + it.html + '</div>';
      }
    });
    return h;
  }
  const text = (t) => '<div class="ax-b is-in"><p>' + (fill(t) || '<i class="ax-ph">Write the DM…</i>') + '</p></div>';
  const card = (t, btns) => btns && btns.length
    ? '<div class="ax-b is-card"><p>' + (fill(t) || '<i class="ax-ph">Write the DM…</i>') + '</p>' + btns.map((b) => '<span class="ax-b-btn">' + esc(b) + '</span>').join('') + '</div>'
    : text(t);
  const mine = (t) => '<div class="ax-b is-out"><p>' + esc(t) + '</p></div>';
  function render(stage, s) {
    const recipe = stage.dataset.recipe;
    const u = s.username || 'account';
    AV = s.avatar || '';
    stage.querySelectorAll('.js-uname-plain').forEach((e) => (e.textContent = u));
    stage.querySelectorAll('.js-av').forEach((e) => { const dot = e.querySelector('i'); e.textContent = AV ? '' : ini(u); e.style.backgroundImage = AV ? 'url("' + AV + '")' : ''; e.classList.toggle('has-pic', !!AV); if (dot) e.appendChild(dot); });
    const fol = Number(s.followers);
    const items = [{ who: 'ctx', html: '<div class="ax-profile">' + avs('is-xl', u) + '<b>' + esc(u) + '</b><small>' + esc(u) + ' · Instagram</small>' + (Number.isFinite(fol) && s.followers !== '' && s.followers != null ? '<small>' + fol.toLocaleString() + (fol === 1 ? ' follower' : ' followers') + '</small>' : '') + '<span class="ax-profile-btn">View profile</span></div>' }, { who: 'sys', html: 'Today 9:41 AM' }];
    if (recipe === 'story_mention') {
      items.push({ who: 'ctx', html: '<div class="ax-story"><small>You mentioned ' + esc(u) + ' in your story</small><span class="ax-story-card"><span>@' + esc(u) + '</span></span></div>' });
    } else if (recipe === 'ref_link') {
      items.push({ who: 'sys', html: 'You opened a link · <b>ref=' + esc(s.ref || 'link') + '</b>' });
    } else {
      items.push({ who: 'ctx', html: '<div class="ax-quote"><small>' + esc(u) + ' replied to your comment</small><span class="ax-quote-box">' + (s.postPic ? '<span class="ax-quote-thumb" style="background-image:url(&quot;' + esc(s.postPic) + '&quot;)"></span>' : '') + esc(s.keyword || 'GUIDE') + '</span></div>' });
    }
    if (recipe === 'followers_only') {
      items.push({ who: 'them', html: card(s.gateMessage || 'Follow the account, then tap below to unlock it 👇', [s.gateButton || 'I\\u2019m following']) });
      items.push({ who: 'me', html: mine(s.gateButton || 'I\\u2019m following') });
      items.push({ who: 'sys', html: '<span class="ax-ok">✓</span> Follow confirmed' });
    }
    if (recipe === 'ask_first') { items.push({ who: 'them', html: text(s.opener) }); items.push({ who: 'me', html: mine('YES 🙌') }); }
    items.push({ who: 'them', html: card(s.dm, s.buttons || []) });
    if (s.tag && (recipe === 'ref_link' || recipe === 'ask_first')) items.push({ who: 'sys', html: 'Tagged <b>#' + esc(s.tag) + '</b>' });
    const chat = stage.querySelector('.js-chat');
    const sig = items.map((i) => i.who).join();
    if (chat.dataset.sig !== sig) { chat.classList.remove('is-anim'); void chat.offsetWidth; chat.classList.add('is-anim'); chat.dataset.sig = sig; }
    chat.innerHTML = thread(items, u);
    chat.scrollTop = chat.scrollHeight;
    const comments = stage.querySelector('.js-comments');
    if (comments) {
      const hero = stage.querySelector('.js-posthero');
      hero.style.backgroundImage = s.postPic ? 'url("' + s.postPic + '")' : '';
      hero.classList.toggle('is-empty', !s.postPic);
      hero.innerHTML = s.postPic ? '' : '<span>' + esc(s.anyPost ? 'Any of your posts' : (s.postTitle || 'Your post')) + '</span>';
      let c = '<div class="ax-cmt"><span class="ax-av is-sm is-sam">S</span><div><p><b>sam.rivera</b><time>1m</time></p><p>' + esc(s.keyword || 'GUIDE') + ' 🙌</p><small>Reply</small></div><span class="ax-cmt-heart">♡</span></div>';
      if (s.reply) c += '<div class="ax-cmt is-reply">' + avs('is-xs', u) + '<div><p><b>' + esc(u) + '</b><time>Just now</time></p><p>' + fill(s.reply) + '</p><small>Reply</small></div><span class="ax-cmt-heart">♡</span></div>';
      else c += '<div class="ax-cmt-none">No public reply. Sam only gets the DM.</div>';
      comments.innerHTML = c;
    }
  }
  function show(stage, view) {
    stage.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    stage.querySelectorAll('[data-view-pane]').forEach((p) => (p.hidden = p.dataset.viewPane !== view));
  }
  // Keep the real iPhone proportions and scale the whole device to the window (zoom keeps text crisp).
  const fit = () => document.querySelectorAll('.ax-iphone').forEach((p) => {
    const top = Math.max(88, (p.closest('.ax-stage')?.getBoundingClientRect().top ?? 88) + window.scrollY);
    const room = window.innerHeight - Math.min(top, 240) - 130;
    p.style.zoom = String(Math.max(0.68, Math.min(1, room / 689)));
  });
  fit();
  window.addEventListener('resize', fit);
  for (const st of document.querySelectorAll('.ax-stage')) {
    st.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(st, b.dataset.view)));
    if (st.dataset.state) render(st, JSON.parse(st.dataset.state));
  }
  return { render, show };
})();
</script>`;

const BUILDER_JS = `<script>
(() => {
  const f = document.getElementById('au-form');
  if (!f) return;
  const recipe = f.dataset.recipe;
  const stage = f.querySelector('.ax-stage');
  const el = (n) => f.elements[n];
  const val = (n) => { const e = el(n); if (!e) return ''; if (e instanceof RadioNodeList) return e.value; return e.type === 'checkbox' ? e.checked : e.value; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* keywords as chips */
  const chipField = f.querySelector('[data-chips]');
  const kwHidden = el('keywords');
  const keywords = () => (kwHidden?.value || '').split(',').map((k) => k.trim()).filter(Boolean);
  function drawChips() {
    if (!chipField) return;
    chipField.querySelectorAll('.ax-kw').forEach((c) => c.remove());
    const input = chipField.querySelector('input');
    for (const k of keywords()) {
      const c = document.createElement('span');
      c.className = 'ax-kw';
      c.innerHTML = esc(k) + '<button type="button" aria-label="Remove ' + esc(k) + '">×</button>';
      c.querySelector('button').onclick = () => { kwHidden.value = keywords().filter((x) => x !== k).join(', '); drawChips(); update(); };
      chipField.insertBefore(c, input);
    }
    input.placeholder = keywords().length ? 'Add another…' : 'Type a keyword…';
  }
  function addKeyword(text) {
    const parts = text.split(',').map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    const now = keywords();
    for (const p of parts) if (!now.some((k) => k.toLowerCase() === p.toLowerCase())) now.push(p);
    kwHidden.value = now.slice(0, 20).join(', ');
    drawChips(); update();
  }
  if (chipField) {
    const input = chipField.querySelector('input');
    chipField.addEventListener('click', () => input.focus());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(input.value); input.value = ''; }
      else if (e.key === 'Backspace' && !input.value && keywords().length) { kwHidden.value = keywords().slice(0, -1).join(', '); drawChips(); update(); }
    });
    input.addEventListener('blur', () => { if (input.value.trim()) { addKeyword(input.value); input.value = ''; } });
    drawChips();
  }

  /* reveal + mirror (public reply only goes out when its toggle is on) */
  const replyOn = document.getElementById('ax-reply-on');
  function syncReveal() {
    f.querySelectorAll('[data-reveal]').forEach((t) => { const w = document.getElementById(t.dataset.reveal); if (w) w.hidden = !t.checked; });
    f.querySelectorAll('[data-mirror]').forEach((h) => { const src = document.getElementById(h.dataset.mirror); h.value = replyOn && !replyOn.checked ? '' : src.value; });
  }

  /* counters, button limits, link checks */
  function counters() {
    const hasButtons = [...f.querySelectorAll('.ax-btn-row')].some((r) => r.querySelector('[name=btnTitle]').value.trim());
    f.querySelectorAll('[data-count-for]').forEach((c) => {
      const ta = document.getElementById(c.dataset.countFor);
      const max = ta.id === 'ax-dm' && hasButtons ? 640 : Number(ta.dataset.count);
      c.textContent = ta.value.length + ' / ' + max;
      c.classList.toggle('is-over', ta.value.length > max);
    });
    const rows = f.querySelectorAll('.ax-btn-row');
    const add = f.querySelector('.ax-add-btn');
    if (add) { add.hidden = rows.length >= 3; add.querySelector('small').textContent = rows.length ? (3 - rows.length) + ' left' : ''; }
    rows.forEach((r) => {
      const t = r.querySelector('[name=btnTitle]'), u = r.querySelector('[name=btnUrl]');
      u.closest('.ax-url').classList.toggle('is-bad', !!u.value && !/^https:\\/\\/\\S+$/i.test(u.value));
      t.classList.toggle('is-bad', t.value.length > 20);
    });
    const cd = f.querySelector('.ax-cooldown'); if (cd) cd.hidden = val('repeat') !== 'every';
  }

  /* summaries on each step */
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  function summaries() {
    const set = (k, t) => { const e = f.querySelector('[data-sum="' + k + '"]'); if (e) e.textContent = t; };
    const post = f.querySelector('input[name=platformPostId]:checked');
    const kws = keywords();
    if (recipe === 'ref_link') set('when', 'ref=' + (val('ref') || '…'));
    else if (recipe !== 'story_mention') set('when', (kws.length ? kws.map((k) => '“' + k + '”').join(', ') : 'Any comment') + ' · ' + (post && post.value !== 'any' ? 'one post' : 'any post') + (val('alsoMatchInDms') ? ' · and DMs' : ''));
    else set('when', 'Every story mention');
    set('gate', 'One tap to confirm, then the reward');
    set('ask', trunc(val('opener') || '', 48));
    const btns = [...f.querySelectorAll('.ax-btn-row [name=btnTitle]')].filter((i) => i.value.trim()).length;
    set('dm', trunc(val('dmMessage') || 'Empty', 44) + (btns ? ' · ' + btns + ' button' + (btns > 1 ? 's' : '') : '') + (replyOn?.checked ? ' · public reply' : ''));
    set('tag', val('tag') ? '#' + val('tag') : 'No tag');
    if (recipe === 'ref_link') set('often', 'After ' + (val('cooldownHours') || 24) + ' h');
    else set('often', val('repeat') === 'every' ? 'Every time' + (val('cooldownHours') ? ' · ' + val('cooldownHours') + ' h apart' : '') : 'Once per person');
  }

  /* the preview */
  function preview() {
    const a = f.querySelector('select[name=accountId]')?.selectedOptions[0]?.dataset || {};
    const post = f.querySelector('input[name=platformPostId]:checked');
    f.elements.postTitle && (f.elements.postTitle.value = post?.dataset.title || '');
    const pre = f.querySelector('.js-refpre'); if (pre) pre.textContent = a.platform === 'facebook' ? 'm.me/' + (a.uid || a.username) + '?ref=' : 'ig.me/m/' + (a.username || '') + '?ref=';
    f.querySelectorAll('.js-uname').forEach((e) => (e.textContent = '@' + (a.username || 'you')));
    window.axPreview.render(stage, {
      username: a.username, platform: a.platform, followers: a.followers, avatar: a.pic, dm: val('dmMessage'),
      buttons: [...f.querySelectorAll('.ax-btn-row [name=btnTitle]')].map((i) => i.value.trim()).filter(Boolean),
      reply: replyOn ? (replyOn.checked ? (document.getElementById('ax-reply')?.value || '') : '') : '',
      gateMessage: val('gateMessage'), gateButton: val('gateButton'), opener: val('opener'),
      keyword: keywords()[0] || '', ref: val('ref'), tag: val('tag'),
      postPic: post?.dataset.pic || f.querySelector('input[name=platformPostId][data-pic]:not([data-pic=""])')?.dataset.pic || '', postTitle: post?.dataset.title || '', anyPost: !post || post.value === 'any',
    });
  }
  const grow = () => f.querySelectorAll('.ax-textarea').forEach((t) => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 64) + 'px'; });
  function update() { syncReveal(); counters(); summaries(); preview(); grow(); }

  /* steps: one open at a time, Next moves on */
  const nodes = [...f.querySelectorAll('.ax-node')];
  function open(n) { nodes.forEach((x) => { const on = x === n && !x.classList.contains('is-open-keep'); x.classList.toggle('is-open', x === n); x.querySelector('.ax-node-head').setAttribute('aria-expanded', String(x === n)); }); }
  nodes.forEach((n, i) => {
    n.querySelector('.ax-node-head').addEventListener('click', () => (n.classList.contains('is-open') ? (n.classList.remove('is-open'), n.querySelector('.ax-node-head').setAttribute('aria-expanded', 'false')) : open(n)));
    n.querySelector('.ax-next').addEventListener('click', () => { if (nodes[i + 1]) { open(nodes[i + 1]); nodes[i + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } else { n.classList.remove('is-open'); } });
  });

  /* the preview follows what you edit */
  f.addEventListener('focusin', (e) => {
    if (!stage.querySelector('[data-view=post]')) return;
    window.axPreview.show(stage, e.target.closest('#ax-reply-wrap') || e.target.id === 'ax-reply-on' || e.target.name === 'platformPostId' ? 'post' : 'dm');
  });

  f.addEventListener('input', update);
  f.addEventListener('change', update);
  f.addEventListener('click', (e) => {
    const add = e.target.closest('.ax-add-btn');
    if (add) { const t = document.getElementById('ax-btn-tpl'); f.querySelector('.ax-btns').append(t.content.cloneNode(true)); f.querySelector('.ax-btn-row:last-child input').focus(); update(); }
    const del = e.target.closest('.ax-del-btn');
    if (del) { del.closest('.ax-btn-row').remove(); update(); }
    const ins = e.target.closest('.ax-var');
    if (ins) { const ta = document.getElementById(ins.dataset.insert); const p = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, p) + ins.dataset.token + ta.value.slice(ta.selectionEnd ?? p); ta.focus(); ta.selectionStart = ta.selectionEnd = p + ins.dataset.token.length; update(); }
  });
  f.addEventListener('submit', () => { const i = chipField?.querySelector('input'); if (i && i.value.trim()) { addKeyword(i.value); i.value = ''; } syncReveal(); });
  update();
})();
</script>`;

const ACTIVITY_JS = `<script>
(() => {
  const el = document.querySelector('.js-activity');
  if (!el) return;
  let last = '';
  const tick = () => fetch(el.dataset.src, { cache: 'no-store' })
    .then((r) => r.text().then((t) => (r.ok ? t : Promise.reject(t))))
    .then((html) => { if (html !== last) { el.innerHTML = html; last = html; } })
    .catch((t) => { if (!last) el.innerHTML = typeof t === 'string' && t.startsWith('<') ? t : '<div class="ax-feed-empty">Couldn’t read the activity. Retrying…</div>'; })
    .finally(() => setTimeout(tick, document.hidden ? 15000 : 4000));
  tick();
})();
</script>`;
