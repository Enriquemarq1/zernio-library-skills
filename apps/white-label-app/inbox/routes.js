// Inbox routes for a client workspace. Server-rendered like the rest of the portal.
// Every route: workspace from the URL -> account ownership checked against Zernio (tenancy.js) -> action.
import {
  listConversations, messagesPage, mergeMessages, markConversationRead, createConversation,
  newThreadRule, ZernioError,
} from './adapter.js';
import { reply, reconcile, newAttemptKey } from './service.js';
import { workspaceAccounts, assertAccount, accountIdOf, AccessDenied } from './tenancy.js';

const MESSAGING = new Set(['instagram', 'facebook', 'whatsapp', 'phone', 'sms', 'telegram', 'twitter', 'bluesky', 'reddit', 'imessage']);
const MAX_TEXT = 1000;

export default function inboxRoutes(app, { store, findClient, workspaceShell, v }) {
  const { esc, note, empty, icon, plogo, platformName, ago, clock, num, plural } = v;
  const base = (client) => `/w/${esc(client.profileId)}/inbox`;
  const denied = (res, client, err) =>
    res.status(err instanceof AccessDenied ? 403 : 502).send(workspaceShell({
      client, tab: 'inbox', subtitle: 'Not available',
      body: `<div class="card"><div class="card-body">${note('danger', err instanceof AccessDenied ? 'Not part of this workspace' : 'Zernio could not be reached', err.message)}
        <div style="margin-top:var(--s4)"><a class="btn btn-ghost btn-sm" href="${base(client)}">Back to inbox</a></div></div></div>`,
    }));

  const stateChip = (s) => ({
    pending: ['neutral', 'Sending…'],
    accepted: ['ok', 'Accepted by Zernio'],
    failed: ['danger', 'Not sent'],
    unknown: ['warn', 'Outcome unknown'],
    sent: ['ok', 'Sent'], delivered: ['ok', 'Delivered'], read: ['ok', 'Read'],
  })[s] ?? null;

  /* ------------------------------------------------------------------ list + thread */
  app.get('/w/:profileId/inbox', async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    const channel = String(req.query.ch || '');
    let accts, listErr = null, list = { items: [], failedAccounts: [], skippedAccounts: [], truncated: false };
    try {
      accts = (await workspaceAccounts(client.profileId)).filter((a) => MESSAGING.has(a.platform));
    } catch (e) {
      accts = [];
      listErr = `Couldn't load this workspace's accounts (${e.status || ''} ${e.message})`.trim();
    }
    const ids = new Set(accts.filter((a) => !channel || a.platform === channel).map(accountIdOf));
    if (!listErr && ids.size) {
      try {
        list = await listConversations({ profileId: client.profileId, accountIds: ids });
      } catch (e) {
        listErr = `Couldn't load conversations (${e.status || ''} ${e.message})`.trim();
      }
    }
    const convos = list.items;
    const byId = new Map(accts.map((a) => [accountIdOf(a), a]));

    // Open thread: ?c=<conversationId>&a=<accountId>. Ownership is enforced before any read.
    const openId = req.query.c ? String(req.query.c) : null;
    const openAcct = req.query.a ? String(req.query.a) : convos.find((c) => c.id === openId)?.accountId;
    let open = null, messages = [], older = null, threadErr = null;
    if (openId) {
      try {
        await assertAccount(client.profileId, openAcct);
      } catch (e) {
        return denied(res, client, e);
      }
      open = convos.find((c) => c.id === openId && c.accountId === openAcct) ?? { id: openId, accountId: openAcct, platform: byId.get(openAcct)?.platform, participantName: null };
      try {
        const page = await messagesPage({ conversationId: openId, accountId: openAcct, cursor: req.query.before || undefined });
        older = page.nextCursor;
        const cached = store.messagesForThread(client.profileId, openAcct, openId).map((r) => ({
          platformMessageId: r.platform_message_id, direction: r.direction, text: r.text, createdAt: r.created_at, status: r.status,
        }));
        messages = mergeMessages(cached, page.items);
      } catch (e) {
        threadErr = e instanceof ZernioError && e.status === 404 ? 'That conversation is not on this account.' : `${e.status || ''} ${e.message}`.trim();
      }
    }
    const attempts = open ? store.sendsForThread(client.profileId, open.id).filter((s) => s.account_id === open.accountId && s.state !== 'accepted') : [];
    const shown = req.query.k ? store.getSend(String(req.query.k)) : null;
    const shownAttempt = shown && shown.profile_id === client.profileId ? shown : null;
    const unread = convos.filter((c) => c.unreadCount > 0).length;
    const channels = [...new Set(accts.map((a) => a.platform))];

    const threadHref = (c) => `${base(client)}?c=${encodeURIComponent(c.id)}&a=${encodeURIComponent(c.accountId)}${channel ? `&ch=${encodeURIComponent(channel)}` : ''}`;
    const threadRow = (c) => `<a class="thread${c.unreadCount ? ' unread' : ''}" href="${esc(threadHref(c))}"
        ${open && c.id === open.id && c.accountId === open.accountId ? 'aria-current="true"' : ''}>
        <span class="av">
          ${c.participantPicture ? `<img src="${esc(c.participantPicture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
          <span class="badge">${plogo(c.platform, 'plogo-sm')}</span>
        </span>
        <span style="min-width:0">
          <span class="top">
            <span class="who truncate">${esc(c.participantName || 'Unknown')}</span>
            <span class="when">${esc(ago(c.updatedTime))}</span>
          </span>
          <span class="snippet">${esc(c.lastMessage || 'No messages yet')}</span>
          <span class="via">${esc(platformName(c.platform))} · ${esc(c.accountUsername ? '@' + c.accountUsername : byId.get(c.accountId)?.username || '')}</span>
        </span>
      </a>`;

    const bubble = (m) => {
      const chip = m.direction === 'outgoing' && m.status ? stateChip(m.status) : null;
      return `<div class="msg msg-${m.direction === 'outgoing' ? 'out' : 'in'}">
        ${esc(m.isDeleted ? '[Deleted message]' : m.text || (m.attachments ? '[Attachment]' : m.noRenderableContent ? '[Unsupported content]' : ''))}
        <span class="stamp">${esc(m.senderName || '')}${m.senderName ? ' · ' : ''}${esc(clock(m.createdAt))}${chip ? ` · ${esc(chip[1])}` : ''}</span>
      </div>`;
    };
    const attemptBubble = (s) => {
      const [kind, label] = stateChip(s.state);
      return `<div class="msg msg-out" data-attempt="${esc(s.state)}">${esc(s.text)}
        <span class="stamp">${v.chip(kind, label)}${s.error ? ` ${esc(s.error)}` : ''}</span>
        ${s.state === 'unknown' ? `<form method="post" action="${base(client)}/reconcile" style="margin-top:var(--s2)">
            <input type="hidden" name="key" value="${esc(s.key)}">
            <button class="btn btn-ghost btn-sm" type="submit">Check again</button>
            <span class="idx">Zernio did not answer clearly. This checks the thread; it never resends on its own.</span></form>` : ''}
      </div>`;
    };

    const channelChips = channels.length > 1 ? `<div class="row row-wrap" style="gap:var(--s2);margin-bottom:var(--s3)">
        <a class="btn btn-${channel ? 'ghost' : 'secondary'} btn-sm" href="${base(client)}">All</a>
        ${channels.map((p) => `<a class="btn btn-${channel === p ? 'secondary' : 'ghost'} btn-sm" href="${base(client)}?ch=${encodeURIComponent(p)}">${plogo(p, 'plogo-sm')} ${esc(platformName(p))}</a>`).join('')}
      </div>` : '';

    const notes = [
      listErr ? note('danger', 'Inbox not loaded', listErr) : '',
      list.failedAccounts.length ? note('warn', `${plural(list.failedAccounts.length, 'account')} could not be read`,
        list.failedAccounts.map((f) => `${byId.get(f.accountId)?.username || f.accountId}: ${f.error}`).join(' · ') + ' — conversations from these accounts are missing, not empty.') : '',
      list.skippedAccounts?.length ? note('warn', `${plural(list.skippedAccounts.length, 'account')} not included by Zernio`,
        list.skippedAccounts.map((k) => `${byId.get(k.accountId)?.username || k.accountId} (${platformName(k.platform || byId.get(k.accountId)?.platform || '')})`).join(' · ') +
        ' — Zernio skipped these in the conversation list (channel not supported there, or the account is not enabled for the inbox). Their threads are not shown here.') : '',
      list.truncated ? note('info', 'Showing the most recent pages', 'Older conversations exist beyond what this page loaded.') : '',
      shownAttempt?.state === 'accepted' ? note('ok', 'Reply accepted', 'Zernio accepted it. Delivery is confirmed separately where the platform reports it.') : '',
      shownAttempt?.state === 'failed' ? note('danger', 'Reply not sent', shownAttempt.error || '') : '',
      shownAttempt?.state === 'unknown' ? note('warn', 'Outcome unknown', 'Zernio did not confirm or reject this reply. Use “Check again” — do not resend until it is settled.') : '',
      req.query.marked ? note('ok', 'Marked as read') : '',
      req.query.err ? note('danger', 'Action failed', String(req.query.err).slice(0, 200)) : '',
    ].join('');

    const pane = open
      ? `<div class="convo">
          <div class="convo-head">
            ${plogo(open.platform, 'plogo-sm')}
            <div style="min-width:0">
              <div class="h3 truncate">${esc(open.participantName || 'Conversation')}</div>
              <div class="idx">${esc(platformName(open.platform))} · via ${esc(byId.get(open.accountId)?.username ? '@' + byId.get(open.accountId).username : open.accountId)}</div>
            </div>
            <div class="spacer"></div>
            <form method="post" action="${base(client)}/read">
              <input type="hidden" name="conversationId" value="${esc(open.id)}">
              <input type="hidden" name="accountId" value="${esc(open.accountId)}">
              <button class="btn btn-ghost btn-sm" type="submit" title="Sends a read receipt where the platform supports it">Mark read</button>
            </form>
            ${open.url ? `<a class="btn btn-ghost btn-sm" href="${esc(open.url)}" target="_blank" rel="noopener noreferrer">Open on ${esc(platformName(open.platform))}</a>` : ''}
          </div>
          <div class="convo-body">
            ${threadErr ? note('danger', "Couldn't load messages", threadErr) : ''}
            ${older ? `<p style="text-align:center"><a class="btn btn-ghost btn-sm" href="${esc(threadHref(open))}&before=${encodeURIComponent(older)}">Load older messages</a></p>` : ''}
            ${messages.length ? messages.map(bubble).join('') : threadErr ? '' : `<p class="sub" style="text-align:center;margin:auto">No messages in this thread yet.</p>`}
            ${attempts.map(attemptBubble).join('')}
          </div>
          <div class="convo-foot">
            <form class="row" style="gap:var(--s2)" method="post" action="${base(client)}/reply" data-once>
              <input type="hidden" name="conversationId" value="${esc(open.id)}">
              <input type="hidden" name="accountId" value="${esc(open.accountId)}">
              <input type="hidden" name="key" value="${esc(newAttemptKey())}">
              <label class="sr-only" for="reply-box" style="position:absolute;left:-9999px">Reply message</label>
              <input class="input" id="reply-box" name="message" required maxlength="${MAX_TEXT}" autocomplete="off" placeholder="Reply…">
              <button class="btn btn-primary" type="submit">${icon('send', 16)} Send</button>
            </form>
            <p class="idx" style="margin-top:var(--s2)">Replies go out on ${esc(platformName(open.platform))} from this thread's account. Platform messaging windows still apply.</p>
          </div>
        </div>`
      : `<div class="convo"><div class="convo-empty">${empty('Select a conversation',
          convos.length ? 'Pick a thread to read it and reply. Opening a thread does not send a read receipt.' : 'Nothing has come in for this client yet.')}</div></div>`;

    const newThread = accts.length ? `<details class="card" style="margin-top:var(--s6)"><summary class="card-body" style="cursor:pointer">Start a new conversation</summary>
        <form class="card-body" method="post" action="${base(client)}/new" data-once>
          <input type="hidden" name="key" value="${esc(newAttemptKey())}">
          <div class="field"><label for="nt-acct">From</label>
            <select class="input" id="nt-acct" name="accountId">${accts.map((a) => {
              const rule = newThreadRule(a.platform);
              return `<option value="${esc(accountIdOf(a))}" ${rule.allowed ? '' : 'disabled'}>${esc(platformName(a.platform))} · ${esc(a.username || accountIdOf(a))}${rule.allowed ? '' : ` — ${esc(rule.reason)}`}</option>`;
            }).join('')}</select></div>
          <div class="field"><label for="nt-to">To</label><input class="input" id="nt-to" name="to" required autocomplete="off" placeholder="Phone number in international format, or platform user id"></div>
          <div class="field"><label for="nt-msg">Message</label><input class="input" id="nt-msg" name="message" maxlength="${MAX_TEXT}" autocomplete="off"></div>
          <div class="field"><label for="nt-tpl">WhatsApp template (required to start a WhatsApp thread)</label>
            <input class="input" id="nt-tpl" name="templateName" autocomplete="off" placeholder="approved template name"> <input class="input" name="templateLanguage" autocomplete="off" placeholder="language code, e.g. en_US"></div>
          <button class="btn btn-primary btn-sm" type="submit">Send first message</button>
          <p class="idx">Instagram and Messenger threads start when the customer writes first; they are not offered here.</p>
        </form></details>` : '';

    res.send(workspaceShell({
      client,
      tab: 'inbox',
      counts: { inbox: unread || convos.length },
      subtitle: `${plural(convos.length, 'conversation')}${unread ? ` · ${num(unread)} unread` : ''} · refreshes when you reload`,
      body: `${notes}${channelChips}
        ${convos.length || open
          ? `<div class="inbox">
              <div class="inbox-list">
                <div class="inbox-list-head row"><span class="label">Conversations</span><div class="spacer"></div>
                  <a class="idx" href="${esc(req.originalUrl)}">Refresh</a></div>
                ${convos.map(threadRow).join('')}
              </div>
              ${pane}
            </div>`
          : `<div class="card"><div class="card-body">${empty(listErr ? 'Conversations unavailable' : 'No conversations',
              listErr ? 'The inbox could not be loaded — see the note above.' : accts.length
                ? 'Messages arrive here once someone contacts one of this client’s messaging accounts.'
                : 'Connect a messaging account first — Instagram, Facebook, WhatsApp or an SMS number.',
              accts.length ? '' : `<a class="btn btn-primary btn-sm" href="/w/${esc(client.profileId)}/connections">Connect an account</a>`)}</div></div>`}
        ${newThread}
        <script>document.querySelectorAll('form[data-once]').forEach(f=>f.addEventListener('submit',()=>{const b=f.querySelector('button[type=submit]');if(b){b.disabled=true;b.textContent='Sending…';}}));</script>`,
    }));
  });

  /* ------------------------------------------------------------------ actions */
  const guarded = (handler) => async (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    try {
      await handler(client, req, res);
    } catch (e) {
      if (e instanceof AccessDenied) return denied(res, client, e);
      res.redirect(`${base(client)}?err=${encodeURIComponent(`${e.status || ''} ${e.message}`.trim())}`);
    }
  };

  const doReply = async (client, req, res, conversationId) => {
    const accountId = String(req.body.accountId || '');
    await assertAccount(client.profileId, accountId); // throws 403 for another workspace's account
    const text = String(req.body.message || '').trim();
    const back = `${base(client)}?c=${encodeURIComponent(conversationId)}&a=${encodeURIComponent(accountId)}`;
    if (!text) return res.redirect(back);
    if (text.length > MAX_TEXT) return res.redirect(`${back}&err=${encodeURIComponent(`Message is longer than ${MAX_TEXT} characters`)}`);
    const key = /^rep_[0-9a-f-]{36}$/.test(req.body.key || '') ? req.body.key : newAttemptKey();
    const r = await reply({ store, profileId: client.profileId, conversationId, accountId, text, key });
    res.redirect(`${back}&k=${encodeURIComponent(key)}${r.state === 'conflict' ? `&err=${encodeURIComponent(r.note)}` : ''}`);
  };
  app.post('/w/:profileId/inbox/reply', guarded((client, req, res) => doReply(client, req, res, String(req.body.conversationId || ''))));
  // Old form path kept working (existing links/bookmarks), same guarded logic.
  app.post('/w/:profileId/inbox/:id/reply', guarded((client, req, res) => doReply(client, req, res, req.params.id)));

  app.post('/w/:profileId/inbox/reconcile', guarded(async (client, req, res) => {
    const row = store.getSend(String(req.body.key || ''));
    if (!row || row.profile_id !== client.profileId) throw new AccessDenied('That send is not part of this workspace.');
    await assertAccount(client.profileId, row.account_id);
    await reconcile({ store, key: row.key });
    res.redirect(`${base(client)}?c=${encodeURIComponent(row.conversation_id)}&a=${encodeURIComponent(row.account_id)}&k=${encodeURIComponent(row.key)}`);
  }));

  app.post('/w/:profileId/inbox/read', guarded(async (client, req, res) => {
    const accountId = String(req.body.accountId || '');
    const conversationId = String(req.body.conversationId || '');
    await assertAccount(client.profileId, accountId);
    await markConversationRead({ conversationId, accountId });
    res.redirect(`${base(client)}?c=${encodeURIComponent(conversationId)}&a=${encodeURIComponent(accountId)}&marked=1`);
  }));

  app.post('/w/:profileId/inbox/new', guarded(async (client, req, res) => {
    const accountId = String(req.body.accountId || '');
    const account = await assertAccount(client.profileId, accountId);
    const rule = newThreadRule(account.platform);
    if (!rule.allowed) throw Object.assign(new Error(`Can't start a ${account.platform} conversation: ${rule.reason}`), { status: 400 });
    const to = String(req.body.to || '').trim();
    const text = String(req.body.message || '').trim();
    // No Idempotency-Key exists for this operation: guard double submits locally with the form's attempt key.
    const key = String(req.body.key || '');
    if (!/^rep_[0-9a-f-]{36}$/.test(key)) throw Object.assign(new Error('This form expired. Reload the page and try again.'), { status: 400 });
    const claim = store.claimSend({ key, profileId: client.profileId, accountId, conversationId: `new:${to.replace(/[^0-9]/g, '')}`, text: text || `[template ${req.body.templateName || ''}]` });
    if (!claim.created) return res.redirect(`${base(client)}?err=${encodeURIComponent('That first message was already submitted — check the inbox before sending again.')}`);
    try {
      const r = await createConversation({
        accountId, platform: account.platform, to, text: text || undefined,
        templateName: String(req.body.templateName || '').trim() || undefined,
        templateLanguage: String(req.body.templateLanguage || '').trim() || undefined,
      });
      store.settleSend(key, 'accepted', { messageId: r.messageId });
      res.redirect(r.conversationId
        ? `${base(client)}?c=${encodeURIComponent(r.conversationId)}&a=${encodeURIComponent(accountId)}&k=${encodeURIComponent(key)}`
        : `${base(client)}?err=${encodeURIComponent('Accepted, but Zernio returned no conversation id yet — refresh shortly.')}`);
    } catch (e) {
      if (e instanceof ZernioError && e.kind === 'ambiguous') {
        store.settleSend(key, 'unknown', { error: e.message });
        return res.redirect(`${base(client)}?err=${encodeURIComponent('Outcome unknown — Zernio did not confirm. Check the inbox for the new thread before trying again (this operation cannot be safely retried).')}`);
      }
      store.settleSend(key, 'failed', { error: e.message });
      throw e;
    }
  }));
}
