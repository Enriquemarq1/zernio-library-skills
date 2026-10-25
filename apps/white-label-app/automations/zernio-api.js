// Zernio's automation endpoints, and nothing else. Field names stay as Zernio documents them:
//   comment automations  https://docs.zernio.com/comment-automations/create-comment-automation.mdx
//   workflows            https://docs.zernio.com/workflows.mdx
//   the patterns         https://docs.zernio.com/guides/manychat-patterns.mdx
// Every call runs with the bound workspace's key (workspace.js), like the rest of the portal.
import zernio from '../zernio.js';

const enc = encodeURIComponent;
const json = (method, body) => ({ method, body: JSON.stringify(body) });

/* ---- comment automations: comment → DM, story mentions, story replies, followers only ---- */
export const listCommentAutomations = (profileId) =>
  zernio(`/comment-automations?profileId=${enc(profileId)}`).then((r) => r.automations ?? []);
export const getCommentAutomation = (id) =>
  zernio(`/comment-automations/${enc(id)}`).then((r) => r.automation ?? r);
export const createCommentAutomation = (body) =>
  zernio('/comment-automations', json('POST', body)).then((r) => r.automation ?? r);
export const updateCommentAutomation = (id, body) =>
  zernio(`/comment-automations/${enc(id)}`, json('PATCH', body)).then((r) => r.automation ?? r);
export const deleteCommentAutomation = (id) =>
  zernio(`/comment-automations/${enc(id)}`, { method: 'DELETE' });
// Every trigger with its outcome, plus `misses`: comments that matched no keyword (the only sign a keyword catches nothing).
export const commentAutomationLogs = (id, { limit = 50, skip = 0 } = {}) =>
  zernio(`/comment-automations/${enc(id)}/logs?limit=${limit}&skip=${skip}`).then((r) => ({
    logs: r.logs ?? [], pagination: r.pagination ?? null, misses: r.misses ?? null,
  }));

/* ---- workflows: ref links, and comment flows that open with plain text ---- */
export const listWorkflows = (profileId) =>
  zernio(`/workflows?profileId=${enc(profileId)}&limit=100`).then((r) => r.workflows ?? []);
export const getWorkflow = (id) => zernio(`/workflows/${enc(id)}`).then((r) => r.workflow ?? r);
// A new workflow is a draft; it runs only after activate.
export const createWorkflow = (body) => zernio('/workflows', json('POST', body)).then((r) => r.workflow ?? r);
export const updateWorkflow = (id, body) => zernio(`/workflows/${enc(id)}`, json('PATCH', body)).then((r) => r.workflow ?? r);
export const activateWorkflow = (id) => zernio(`/workflows/${enc(id)}/activate`, { method: 'POST' });
export const pauseWorkflow = (id) => zernio(`/workflows/${enc(id)}/pause`, { method: 'POST' });
export const deleteWorkflow = (id) => zernio(`/workflows/${enc(id)}`, { method: 'DELETE' });
export const workflowRuns = (id, { limit = 50 } = {}) =>
  zernio(`/workflows/${enc(id)}/executions?limit=${limit}`).then((r) => r.executions ?? []);
export const runTimeline = (workflowId, executionId) =>
  zernio(`/workflows/${enc(workflowId)}/executions/${enc(executionId)}/events`).then((r) => r.events ?? []);

/* ---- posts to bind an automation to ---- */
// The account's recent posts as Zernio's comments inbox sees them (platform post ids, which is what a
// per-post automation binds to). Includes posts with no comments yet.
export const recentPosts = (profileId, accountId) =>
  zernio(`/inbox/comments?profileId=${enc(profileId)}&limit=30`).then((r) =>
    (r.data ?? []).filter((p) => String(p.accountId ?? '') === accountId));
