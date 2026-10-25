// The Automations tab's recipes: the ManyChat patterns, each as a short form, turned into exactly what
// Zernio's API takes. One place for this so the tab, the JSON API and the AI agent build the same thing.
//
//   recipe          what it is                                   Zernio object
//   comment_dm      comment a keyword → DM (+ button, reply)     comment automation, trigger comment
//   followers_only  same, but only followers get it (one tap)    comment automation + audience + followGate
//   story_mention   mentioned in a story → DM                    comment automation, trigger story_mention
//   ref_link        a link or QR code starts a flow, tags them   workflow, trigger referral
//   ask_first       comment → plain message first, then button   workflow, trigger comment
//
// Docs: https://docs.zernio.com/guides/manychat-patterns.mdx (read October 24, 2026).

export const RECIPES = {
  comment_dm: {
    kind: 'comment',
    title: 'Comment → DM',
    pitch: 'Someone comments a keyword, they get a DM with your link. Plus a public reply.',
    icon: 'comment',
  },
  followers_only: {
    kind: 'comment',
    title: 'Followers only',
    pitch: 'Only followers get the reward. Everyone else gets a one-tap “I’m following” check first.',
    icon: 'heart',
  },
  story_mention: {
    kind: 'comment',
    title: 'Story mention → DM',
    pitch: 'Someone mentions you in their story, they get a thank-you DM.',
    icon: 'story',
  },
  ref_link: {
    kind: 'flow',
    title: 'Link or QR → flow',
    pitch: 'A link or QR code opens your DMs and starts a flow. Everyone who comes in gets a tag.',
    icon: 'qr',
  },
  ask_first: {
    kind: 'flow',
    title: 'Comment → ask first',
    pitch: 'For people who don’t follow you yet: a plain DM first, the link after they reply.',
    icon: 'reply',
  },
};

export const DEFAULTS = {
  comment_dm: {
    name: 'Guide giveaway', keywords: 'GUIDE', matchMode: 'word', typoTolerance: true,
    dmMessage: 'Hey {{first_name}}! Here’s the guide you asked for 👇',
    buttons: [{ title: 'Get the guide', url: 'https://example.com/guide' }],
    commentReply: 'Sent it to your DMs, {{first_name}} 📩', likeComment: false,
    repeat: 'once', cooldownHours: '', alsoMatchInDms: true,
  },
  followers_only: {
    name: 'Followers-only discount', keywords: 'VIP', matchMode: 'word', typoTolerance: true,
    dmMessage: 'You’re in, {{first_name}}! Here’s 20% off for followers 🎉',
    buttons: [{ title: 'Claim 20% off', url: 'https://example.com/vip' }],
    commentReply: 'Check your DMs, {{first_name}} 👀', likeComment: false,
    gateMessage: 'Follow us, then tap below to unlock your discount 👇',
    gateButton: 'I’m following ✅',
    gateNotFollowing: 'Looks like you’re not following yet. Follow and tap again 🙌',
    repeat: 'once', cooldownHours: '', alsoMatchInDms: false,
  },
  story_mention: {
    name: 'Story mention thank-you',
    dmMessage: 'Thank you for the shout-out, {{first_name}}! 💛 Here’s a little something for you.',
    buttons: [{ title: 'Your gift', url: 'https://example.com/thanks' }],
    repeat: 'every', cooldownHours: '24',
  },
  ref_link: {
    name: 'QR at the counter', ref: 'counter',
    dmMessage: 'Hi {{contact.name}}! Thanks for scanning 🙌 Here’s today’s menu.',
    buttons: [{ title: 'See the menu', url: 'https://example.com/menu' }],
    tag: 'came-from-qr', cooldownHours: '24',
  },
  ask_first: {
    name: 'Guide, ask first', keywords: 'GUIDE', matchMode: 'contains',
    opener: 'Hey! Reply YES and I’ll send you the guide 🙌',
    dmMessage: 'Here it is! 👇',
    buttons: [{ title: 'Get the guide', url: 'https://example.com/guide' }],
    tag: 'guide-lead',
  },
};

/* ------------------------------------------------------------------ helpers */
const LIMIT_TEXT = 1000;
const LIMIT_WITH_BUTTONS = 640;

export class RecipeError extends Error {
  constructor(errors) {
    super(errors.join(' '));
    this.status = 400;
    this.errors = errors;
  }
}

const str = (v) => (v == null ? '' : String(v)).trim();
const bool = (v) => v === true || v === 'true' || v === 'on' || v === '1' || v === 1;
const intOrNull = (v) => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
};
// "GUIDE, link  , pdf" → ['GUIDE', 'link', 'pdf']
export const keywordList = (v) =>
  (Array.isArray(v) ? v : str(v).split(/[,\n]/)).map((k) => str(k)).filter(Boolean).slice(0, 20);

// Buttons arrive as [{title,url}] (JSON) or as parallel form fields btnTitle[] / btnUrl[].
export function buttonList(input) {
  let list = input.buttons;
  if (!Array.isArray(list)) {
    const titles = [].concat(input.btnTitle ?? []);
    const urls = [].concat(input.btnUrl ?? []);
    list = titles.map((title, i) => ({ title, url: urls[i] }));
  }
  return list.map((b) => ({ title: str(b?.title), url: str(b?.url) })).filter((b) => b.title || b.url).slice(0, 3);
}

const checkButtons = (buttons, errors) => {
  for (const b of buttons) {
    if (!b.title) errors.push('Every button needs a label.');
    else if (b.title.length > 20) errors.push(`Button label “${b.title}” is over 20 characters.`);
    if (!/^https:\/\/\S+$/i.test(b.url)) errors.push(`Button “${b.title || 'untitled'}” needs a link starting with https://.`);
  }
};
const checkText = (label, text, buttons, errors, required = true) => {
  if (!text) { if (required) errors.push(`${label} is empty.`); return; }
  const max = buttons.length ? LIMIT_WITH_BUTTONS : LIMIT_TEXT;
  if (text.length > max) errors.push(`${label} is ${text.length} characters; the limit is ${max}${buttons.length ? ' with buttons' : ''}.`);
};
const toZernioButtons = (buttons) => buttons.map((b) => ({ type: 'url', title: b.title, url: b.url }));

// One normalised settings object per recipe: what the form shows, what the agent sends, what we store nowhere
// (Zernio is the system of record; settings are read back from the automation itself, see fromComment / fromFlow).
export function settingsFrom(recipe, input = {}) {
  if (!RECIPES[recipe]) throw new RecipeError([`Unknown recipe “${recipe}”. Use one of: ${Object.keys(RECIPES).join(', ')}.`]);
  const s = {
    recipe,
    name: str(input.name),
    accountId: str(input.accountId),
    isActive: input.isActive === undefined ? true : bool(input.isActive),
    dmMessage: str(input.dmMessage),
    buttons: buttonList(input),
  };
  if (recipe === 'comment_dm' || recipe === 'followers_only' || recipe === 'ask_first') {
    s.keywords = keywordList(input.keywords);
    s.matchMode = ['word', 'contains', 'exact'].includes(input.matchMode) ? input.matchMode : recipe === 'ask_first' ? 'contains' : 'word';
    const post = str(input.platformPostId ?? input.post);
    s.platformPostId = post && post !== 'any' ? post : null;
    s.postTitle = s.platformPostId ? str(input.postTitle).slice(0, 120) : null;
  }
  if (recipe === 'comment_dm' || recipe === 'followers_only') {
    s.typoTolerance = s.matchMode === 'word' && bool(input.typoTolerance);
    s.commentReply = str(input.commentReply);
    s.likeComment = bool(input.likeComment);
    s.alsoMatchInDms = bool(input.alsoMatchInDms);
  }
  if (recipe === 'comment_dm' || recipe === 'followers_only' || recipe === 'story_mention') {
    s.repeat = input.repeat === 'every' ? 'every' : 'once';
    s.cooldownHours = s.repeat === 'every' ? intOrNull(input.cooldownHours) : null;
  }
  if (recipe === 'followers_only') {
    s.gateMessage = str(input.gateMessage);
    s.gateButton = str(input.gateButton);
    s.gateNotFollowing = str(input.gateNotFollowing);
  }
  if (recipe === 'ref_link') {
    s.ref = str(input.ref);
    s.tag = str(input.tag);
    s.cooldownHours = intOrNull(input.cooldownHours);
  }
  if (recipe === 'ask_first') {
    s.opener = str(input.opener);
    s.tag = str(input.tag);
  }
  return s;
}

export function validate(s) {
  const errors = [];
  if (!s.name) errors.push('Give the automation a name.');
  if (s.name.length > 100) errors.push('The name is over 100 characters.');
  if (!s.accountId) errors.push('Pick the account it runs on.');
  checkButtons(s.buttons, errors);
  checkText('The DM', s.dmMessage, s.buttons, errors);
  if ('keywords' in s && s.recipe !== 'ask_first' && s.alsoMatchInDms && !s.keywords.length)
    errors.push('“Also when they DM the keyword” needs at least one keyword.');
  if (s.recipe === 'ask_first' && !s.keywords.length) errors.push('Add at least one keyword.');
  if (s.commentReply && s.commentReply.length > 1000) errors.push('The public reply is over 1,000 characters.');
  if (s.cooldownHours !== undefined && s.cooldownHours !== null) {
    const max = s.recipe === 'ref_link' ? 720 : 8760;
    if (!Number.isInteger(s.cooldownHours) || s.cooldownHours < 1 || s.cooldownHours > max)
      errors.push(`The wait between repeats must be a whole number of hours from 1 to ${max}.`);
  }
  if (s.recipe === 'followers_only') {
    if (s.gateMessage.length > 640) errors.push('The follow check message is over 640 characters.');
    if (s.gateButton.length > 20) errors.push('The follow check button is over 20 characters.');
  }
  if (s.recipe === 'ref_link') {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(s.ref)) errors.push('The link name can use letters, numbers, - and _ (up to 40).');
  }
  if (s.tag && !/^[\w -]{1,40}$/u.test(s.tag)) errors.push('The tag can use letters, numbers, spaces, - and _ (up to 40).');
  if (s.recipe === 'ask_first') checkText('The first message', s.opener, [], errors);
  if (errors.length) throw new RecipeError(errors);
  return s;
}

/* ------------------------------------------------------- settings → Zernio */
// The body of POST /v1/comment-automations (create) or PATCH (update: the same fields, so a cleared field clears).
export function commentBody(s, { profileId, forUpdate = false } = {}) {
  const b = {
    name: s.name,
    dmMessage: s.dmMessage,
    buttons: toZernioButtons(s.buttons),
    isActive: s.isActive,
  };
  if (!forUpdate) Object.assign(b, { profileId, accountId: s.accountId });
  if (s.recipe === 'story_mention') {
    b.trigger = 'story_mention';
    b.keywords = [];
  } else {
    b.trigger = 'comment';
    b.keywords = s.keywords;
    b.matchMode = s.matchMode;
    b.typoTolerance = s.typoTolerance;
    b.commentReply = s.commentReply;
    b.publicReplyPolicy = s.recipe === 'followers_only' ? 'always' : 'after_dm';
    b.actions = { likeComment: s.likeComment, hideComment: false };
    b.alsoMatchInDms = s.alsoMatchInDms;
    // The binding moves as a unit (platformPostId + postTitle + postId); all null means "any post".
    if (s.platformPostId) Object.assign(b, { platformPostId: s.platformPostId, postTitle: s.postTitle || undefined });
    else if (forUpdate) Object.assign(b, { platformPostId: null, postTitle: null, postId: null });
  }
  b.repeatPolicy = s.repeat === 'every'
    ? { mode: 'every_comment', ...(s.cooldownHours ? { cooldownHours: s.cooldownHours } : {}) }
    : { mode: 'once' };
  if (s.recipe === 'followers_only') {
    b.audience = { followerStatus: 'follower', whenUnknown: 'verify' };
    b.followGate = {
      ...(s.gateMessage ? { message: s.gateMessage } : {}),
      ...(s.gateButton ? { buttonLabel: s.gateButton } : {}),
      ...(s.gateNotFollowing ? { notFollowingMessage: s.gateNotFollowing } : {}),
    };
  } else if (forUpdate && s.recipe !== 'story_mention') {
    b.audience = { followerStatus: 'any', whenUnknown: 'send' };
  }
  return b;
}

const edge = (id, source, target, sourceHandle) => ({ id, source, target, ...(sourceHandle ? { sourceHandle } : {}) });

// The graph for a flow recipe. Node ids are fixed, so fromFlow can read the settings back.
export function flowGraph(s) {
  const send = (id, text, buttons) => ({
    id, type: 'send_message', label: id === 'n_open' ? 'First message' : 'The DM',
    config: { messageType: 'text', text, ...(buttons.length ? { buttons: toZernioButtons(buttons) } : {}) },
  });
  const tag = s.tag ? [{ id: 'n_tag', type: 'add_tag', label: 'Tag the contact', config: { tag: s.tag } }] : [];
  const end = { id: 'n_end', type: 'end' };
  if (s.recipe === 'ref_link') {
    const nodes = [
      { id: 'n_trigger', type: 'trigger', label: 'Link opened', config: {
        triggerType: 'referral', referral: { ref: s.ref, matchType: 'exact' },
        ...(s.cooldownHours ? { cooldownHours: s.cooldownHours } : {}) } },
      send('n_dm', s.dmMessage, s.buttons), ...tag, end,
    ];
    const edges = [edge('e1', 'n_trigger', 'n_dm'), ...(tag.length ? [edge('e2', 'n_dm', 'n_tag'), edge('e3', 'n_tag', 'n_end')] : [edge('e2', 'n_dm', 'n_end')])];
    return { nodes, edges, entryNodeId: 'n_trigger' };
  }
  // ask_first: Instagram can refuse buttons in a private reply to someone who doesn't follow the account, so the
  // private reply is plain text; the button goes out once they answer and the conversation is open.
  const nodes = [
    { id: 'n_trigger', type: 'trigger', label: 'Keyword comment', config: {
      triggerType: 'comment', comment: { keywords: s.keywords, matchType: s.matchMode === 'exact' ? 'exact' : 'contains',
        ...(s.platformPostId ? { platformPostId: s.platformPostId } : {}) } } },
    send('n_open', s.opener, []),
    { id: 'n_wait', type: 'wait_for_reply', label: 'Wait for their reply', config: { timeoutMinutes: 1440, saveAs: 'answer' } },
    send('n_dm', s.dmMessage, s.buttons), ...tag, end,
  ];
  const edges = [
    edge('e1', 'n_trigger', 'n_open'), edge('e2', 'n_open', 'n_wait'),
    edge('e3', 'n_wait', 'n_dm', 'reply'), edge('e4', 'n_wait', 'n_end', 'timeout'),
    ...(tag.length ? [edge('e5', 'n_dm', 'n_tag'), edge('e6', 'n_tag', 'n_end')] : [edge('e5', 'n_dm', 'n_end')]),
  ];
  return { nodes, edges, entryNodeId: 'n_trigger' };
}

export const flowBody = (s, { profileId, platform, forUpdate = false } = {}) => ({
  ...(forUpdate ? {} : { profileId, accountId: s.accountId, platform }),
  name: s.name,
  description: `${RECIPES[s.recipe].title} · made in the Automations tab`,
  ...flowGraph(s),
});

/* ------------------------------------------------------- Zernio → settings */
const fromButtons = (list = []) => list.filter((b) => b.type === 'url').map((b) => ({ title: b.title, url: b.url }));

export function fromComment(a) {
  const gated = a.audience?.followerStatus === 'follower' || a.audience?.whenUnknown === 'verify' || a.audience?.tapToUnlock;
  const recipe = a.trigger === 'story_mention' ? 'story_mention' : gated ? 'followers_only' : 'comment_dm';
  return {
    recipe,
    name: a.name ?? '',
    accountId: a.accountId ?? '',
    isActive: a.isActive !== false,
    keywords: a.keywords ?? [],
    matchMode: a.matchMode ?? 'contains',
    typoTolerance: Boolean(a.typoTolerance),
    platformPostId: a.platformPostId || null,
    postTitle: a.postTitle || null,
    dmMessage: a.dmMessage ?? '',
    buttons: fromButtons(a.buttons),
    commentReply: a.commentReply ?? '',
    likeComment: Boolean(a.actions?.likeComment),
    alsoMatchInDms: Boolean(a.alsoMatchInDms),
    repeat: a.repeatPolicy?.mode === 'every_comment' ? 'every' : 'once',
    cooldownHours: a.repeatPolicy?.cooldownHours ?? null,
    gateMessage: a.followGate?.message ?? '',
    gateButton: a.followGate?.buttonLabel ?? '',
    gateNotFollowing: a.followGate?.notFollowingMessage ?? '',
    unsupported: [a.template && 'a product card', a.quickReplies?.length && 'quick replies', a.dmMedia && 'an attachment',
      (a.buttons ?? []).some((b) => b.type !== 'url') && 'a postback or phone button', a.trigger === 'live_comment' && 'the live trigger',
      a.trigger === 'story_reply' && 'the story-reply trigger', a.audience?.tapToUnlock && 'tap-to-unlock',
      a.audience?.minFollowerCount != null && 'a minimum follower count'].filter(Boolean),
  };
}

export function fromFlow(w) {
  const node = (id) => (w.nodes ?? []).find((n) => n.id === id);
  const trig = (w.nodes ?? []).find((n) => n.type === 'trigger')?.config ?? {};
  const dm = node('n_dm')?.config ?? (w.nodes ?? []).find((n) => n.type === 'send_message')?.config ?? {};
  const recipe = trig.triggerType === 'referral' ? 'ref_link' : trig.triggerType === 'comment' ? 'ask_first' : null;
  const ours = Boolean(node('n_trigger') && node('n_dm') && recipe);
  return {
    recipe,
    ours,
    name: w.name ?? '',
    accountId: w.accountId ?? '',
    isActive: w.status === 'active',
    status: w.status ?? 'draft',
    ref: trig.referral?.ref ?? '',
    keywords: trig.comment?.keywords ?? [],
    matchMode: trig.comment?.matchType === 'exact' ? 'exact' : 'contains',
    platformPostId: trig.comment?.platformPostId ?? null,
    cooldownHours: trig.cooldownHours ?? null,
    opener: node('n_open')?.config?.text ?? '',
    dmMessage: dm.text ?? '',
    buttons: fromButtons(dm.buttons),
    tag: node('n_tag')?.config?.tag ?? (w.nodes ?? []).find((n) => n.type === 'add_tag')?.config?.tag ?? '',
  };
}

/* ------------------------------------------------------- plain-English read */
const quoteList = (ks) => ks.map((k) => `“${k}”`).join(', ');
export function describe(s, { username } = {}) {
  const who = username ? `@${username}` : 'your account';
  const where = s.platformPostId ? `on ${s.postTitle ? `the post “${s.postTitle.split('\n')[0].slice(0, 40)}”` : 'one post'}` : 'on any post';
  const kw = s.keywords?.length ? quoteList(s.keywords) : 'anything';
  let when;
  const then = [];
  if (s.recipe === 'story_mention') when = `Someone mentions ${who} in their story`;
  else if (s.recipe === 'ref_link') when = `Someone opens the “${s.ref}” link or scans its QR code`;
  else when = `Someone comments ${kw} ${where}${s.alsoMatchInDms ? ', or DMs it' : ''}`;
  if (s.recipe === 'followers_only') then.push('Followers only: anyone not known to follow you gets a one-tap “I’m following” check first');
  if (s.recipe === 'ask_first') then.push('Send a plain first message and wait for their reply');
  then.push(`Send the DM${s.buttons?.length ? ` with ${s.buttons.length === 1 ? 'a button' : `${s.buttons.length} buttons`}` : ''}`);
  if (s.commentReply) then.push('Reply under the comment');
  if (s.likeComment) then.push('Like the comment');
  if (s.tag) then.push(`Tag them “${s.tag}”`);
  const repeat = s.recipe === 'ref_link'
    ? s.cooldownHours ? `Once per person every ${s.cooldownHours} h` : 'Once per person every 24 h'
    : s.recipe === 'ask_first' ? 'Each matching comment'
      : s.repeat === 'every' ? `Every time${s.cooldownHours ? `, at most once per ${s.cooldownHours} h per person` : ''}` : 'Once per person, ever';
  return { when, then, repeat };
}

// The ig.me / m.me link a ref-link flow listens for.
export const refLinkUrl = ({ platform, username, platformUserId }, ref) =>
  platform === 'facebook'
    ? `https://m.me/${encodeURIComponent(platformUserId || username)}?ref=${encodeURIComponent(ref)}`
    : `https://ig.me/m/${encodeURIComponent(username)}?ref=${encodeURIComponent(ref)}`;
