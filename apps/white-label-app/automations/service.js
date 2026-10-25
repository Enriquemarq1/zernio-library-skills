// Automations for one workspace: the one layer the tab, the JSON API and the AI agent all go through.
// Workspace rule (same as the inbox): an automation belongs to this workspace only when Zernio's own account
// list for the workspace's profile contains its account. An id typed into a URL or sent by an agent proves nothing.
import { workspaceAccounts, accountIdOf, assertAccount, AccessDenied } from '../inbox/tenancy.js';
import * as api from './zernio-api.js';
import {
  RECIPES, settingsFrom, validate, commentBody, flowBody, fromComment, fromFlow, describe, refLinkUrl, RecipeError,
} from './recipes.js';

export { RecipeError, AccessDenied };
export const MESSAGING = new Set(['instagram', 'facebook']);

export class NotFound extends Error {
  constructor(message = 'That automation does not exist in this workspace.') {
    super(message);
    this.status = 404;
  }
}

// The Instagram and Facebook accounts this workspace can automate.
export async function automationAccounts(profileId) {
  const list = await workspaceAccounts(profileId);
  return list.filter((a) => MESSAGING.has(a.platform)).map((a) => ({
    id: accountIdOf(a), platform: a.platform, username: a.username || a.displayName || '', platformUserId: a.platformUserId || null,
    followers: a.followersCount ?? null, picture: a.profilePicture || null,
  }));
}

const STATS0 = { triggered: 0, sent: 0, failed: 0, clicks: 0, skipped: 0, gated: 0, gatePassed: 0, runs: 0, completed: 0 };

function shapeComment(a, accounts) {
  const s = fromComment(a);
  const acct = accounts.find((x) => x.id === a.accountId);
  const st = a.stats ?? {};
  return {
    kind: 'comment',
    id: a.id ?? a._id,
    recipe: s.recipe,
    title: RECIPES[s.recipe].title,
    name: s.name,
    live: s.isActive,
    status: s.isActive ? 'live' : 'paused',
    platform: a.platform ?? acct?.platform,
    account: acct ? { id: acct.id, username: acct.username, platform: acct.platform, followers: acct.followers, picture: acct.picture } : { id: a.accountId },
    read: describe(s, { username: acct?.username }),
    settings: s,
    stats: {
      ...STATS0,
      triggered: st.triggered ?? 0, sent: st.dmsSent ?? 0, failed: st.dmsFailed ?? 0, clicks: st.linkClicks ?? 0,
      uniqueClicks: st.uniqueClicks ?? 0, trackedSends: st.trackedSends ?? 0, read: st.read ?? 0, skipped: st.audienceSkipped ?? 0,
      gated: st.followGateSent ?? 0, gatePassed: st.followGatePassed ?? 0, gateFailed: st.followGateFailed ?? 0,
      contacts: st.uniqueContacts ?? 0,
    },
    createdAt: a.createdAt ?? null,
  };
}

function shapeFlow(w, accounts) {
  const s = fromFlow(w);
  const acct = accounts.find((x) => x.id === w.accountId);
  const recipe = s.recipe ?? 'ref_link';
  return {
    kind: 'flow',
    id: w.id ?? w._id,
    recipe,
    ours: s.ours,
    title: s.recipe ? RECIPES[s.recipe].title : 'Workflow',
    name: s.name,
    live: w.status === 'active',
    status: w.status === 'active' ? 'live' : w.status === 'paused' ? 'paused' : 'draft',
    platform: w.platform ?? acct?.platform,
    account: acct ? { id: acct.id, username: acct.username, platform: acct.platform, followers: acct.followers, picture: acct.picture } : { id: w.accountId },
    read: s.recipe ? describe(s, { username: acct?.username }) : { when: 'A workflow made outside this tab', then: [`${w.nodeCount ?? (w.nodes ?? []).length} steps`], repeat: '' },
    settings: s,
    link: s.recipe === 'ref_link' && acct && s.ref ? refLinkUrl(acct, s.ref) : null,
    stats: { ...STATS0, runs: w.totalStarted ?? 0, completed: w.totalCompleted ?? 0, exited: w.totalExited ?? 0 },
    createdAt: w.createdAt ?? null,
  };
}

const inWorkspace = (accounts, accountId) => accounts.some((a) => a.id === accountId);

// Everything on this workspace's Instagram and Facebook accounts, comment automations and flows together.
export async function listAutomations(profileId) {
  const accounts = await automationAccounts(profileId);
  const [comments, flows] = await Promise.all([api.listCommentAutomations(profileId), api.listWorkflows(profileId)]);
  const ownFlows = flows.filter((w) => inWorkspace(accounts, w.accountId));
  // The list has no graph; each flow's settings live in its nodes.
  const full = await Promise.all(ownFlows.map((w) => api.getWorkflow(w.id ?? w._id).then((g) => ({ ...w, ...g }), () => w)));
  const items = [
    ...comments.filter((a) => inWorkspace(accounts, a.accountId)).map((a) => shapeComment(a, accounts)),
    ...full.map((w) => shapeFlow(w, accounts)),
  ].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
  return { accounts, items, totals: totals(items) };
}

export const totals = (items) => ({
  live: items.filter((i) => i.live).length,
  count: items.length,
  sent: items.reduce((n, i) => n + i.stats.sent, 0),
  clicks: items.reduce((n, i) => n + i.stats.clicks, 0),
  gatePassed: items.reduce((n, i) => n + i.stats.gatePassed, 0),
  runs: items.reduce((n, i) => n + i.stats.runs, 0),
});

const KINDS = new Set(['comment', 'flow']);
export async function getAutomation(profileId, kind, id) {
  if (!KINDS.has(kind)) throw new NotFound();
  const accounts = await automationAccounts(profileId);
  let raw;
  try {
    raw = kind === 'comment' ? await api.getCommentAutomation(id) : await api.getWorkflow(id);
  } catch (e) {
    if (e.status === 404 || e.status === 400) throw new NotFound();
    throw e;
  }
  // Zernio's key sees the whole team: the account decides whether this workspace may see it.
  if (!raw || !inWorkspace(accounts, raw.accountId)) throw new NotFound();
  return { accounts, item: kind === 'comment' ? shapeComment(raw, accounts) : shapeFlow(raw, accounts) };
}

async function accountFor(profileId, accountId, recipe) {
  const a = await assertAccount(profileId, accountId); // 403 when the account is not this workspace's
  if (!MESSAGING.has(a.platform)) throw new RecipeError([`Automations run on Instagram and Facebook; that account is ${a.platform}.`]);
  if (a.platform !== 'instagram' && ['followers_only', 'story_mention'].includes(recipe))
    throw new RecipeError([`${RECIPES[recipe].title} is Instagram only: Meta shares follows and story mentions on Instagram alone.`]);
  return a;
}

// input: { recipe, name, accountId, ... } as in recipes.js; returns the created automation, shaped.
export async function createAutomation(profileId, input) {
  const s = validate(settingsFrom(input.recipe, input));
  const acct = await accountFor(profileId, s.accountId, s.recipe);
  if (RECIPES[s.recipe].kind === 'comment') {
    const made = await api.createCommentAutomation(commentBody(s, { profileId }));
    return (await getAutomation(profileId, 'comment', made.id ?? made._id)).item;
  }
  const made = await api.createWorkflow(flowBody(s, { profileId, platform: acct.platform }));
  const id = made.id ?? made._id;
  if (s.isActive) await api.activateWorkflow(id);
  return (await getAutomation(profileId, 'flow', id)).item;
}

// A full replacement of the settings (the form sends every field). Kind and recipe stay what they were.
export async function updateAutomation(profileId, kind, id, input) {
  const { item } = await getAutomation(profileId, kind, id);
  if (kind === 'flow' && !item.ours) throw new RecipeError(['This workflow was made outside this tab; edit it where it was made.']);
  const s = validate(settingsFrom(item.recipe, { ...item.settings, ...input, accountId: item.account.id, isActive: input.isActive ?? item.live }));
  if (kind === 'comment') {
    await api.updateCommentAutomation(id, commentBody(s, { profileId, forUpdate: true }));
  } else {
    await api.updateWorkflow(id, flowBody(s, { forUpdate: true }));
    if (s.isActive !== item.live) await (s.isActive ? api.activateWorkflow(id) : api.pauseWorkflow(id));
  }
  return (await getAutomation(profileId, kind, id)).item;
}

export async function setLive(profileId, kind, id, live) {
  await getAutomation(profileId, kind, id);
  if (kind === 'comment') await api.updateCommentAutomation(id, { isActive: Boolean(live) });
  else await (live ? api.activateWorkflow(id) : api.pauseWorkflow(id));
  return (await getAutomation(profileId, kind, id)).item;
}

export async function deleteAutomation(profileId, kind, id) {
  await getAutomation(profileId, kind, id);
  await (kind === 'comment' ? api.deleteCommentAutomation(id) : api.deleteWorkflow(id));
  return { deleted: true, kind, id };
}

/* ---------------------------------------------------------------- activity */
// Comment automations: one row per trigger with its outcome. Flows: one row per run.
export async function activity(profileId, kind, id, { limit = 50 } = {}) {
  const { item } = await getAutomation(profileId, kind, id);
  if (kind === 'comment') {
    const { logs, pagination, misses } = await api.commentAutomationLogs(id, { limit });
    return { item, kind, rows: logs.map(logRow), total: pagination?.total ?? logs.length, misses };
  }
  const runs = await api.workflowRuns(id, { limit });
  return { item, kind, rows: runs.map(runRow), total: runs.length, misses: null };
}

// What happened, in words a person reads at a glance.
export function logRow(l) {
  const outcome =
    l.status === 'sent' ? (l.audienceOutcome === 'gate_passed' ? 'Unlocked after the tap' : 'DM sent')
      : l.status === 'gated' ? 'Waiting for the “I’m following” tap'
        : l.status === 'pending' ? 'Queued'
          : l.status === 'skipped' ? `Skipped${l.error ? `: ${l.error}` : ''}`
            : l.status === 'failed' ? `Failed${l.error ? `: ${l.error}` : ''}` : l.status;
  return {
    id: l.id,
    at: l.createdAt,
    who: l.commenterUsername || l.commenterName || 'someone',
    door: l.source || 'comment',
    text: l.commentText ?? null,
    status: l.status,
    outcome,
    follower: l.commenterIsFollower,
    gate: l.gateButtonStatus ?? null,
    audience: l.audienceOutcome ?? null,
    reply: l.commentReplyStatus ?? null,
    replyError: l.commentReplyError ?? null,
    likeSkipped: l.likeSkipped ?? null,
    clicks: l.clickCount ?? 0,
  };
}

export function runRow(r) {
  const v = r.variables ?? {};
  return {
    id: r.id,
    at: r.createdAt,
    who: v.contact?.handle || v['contact.handle'] || v.contact?.name || v['contact.name'] || r.platformIdentifier || 'someone',
    door: v.referral?.ref || v['referral.ref'] ? 'link' : v.comment?.id || v['comment.id'] ? 'comment' : 'dm',
    status: r.status,
    outcome: { running: 'Running', waiting: r.waitingFor ? 'Waiting for their reply' : 'Waiting', completed: 'Finished', exited: 'Ended early', failed: `Failed${r.lastError ? `: ${r.lastError}` : ''}` }[r.status] ?? r.status,
    step: r.currentNodeId ?? null,
    steps: r.stepCount ?? 0,
  };
}

export async function postsFor(profileId, accountId) {
  await assertAccount(profileId, accountId);
  const posts = await api.recentPosts(profileId, accountId);
  return posts.map((p) => ({
    id: p.id, title: (p.content || '').split('\n')[0].slice(0, 80) || 'Untitled post', createdAt: p.createdTime ?? null,
    picture: p.picture ?? null, permalink: p.permalink ?? null, comments: p.commentCount ?? 0,
  }));
}
