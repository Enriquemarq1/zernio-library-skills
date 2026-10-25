#!/usr/bin/env node
// MCP server (stdio) for the portal's Automations tab. An AI agent (Claude Code, Codex, any MCP client) gets the
// same actions as the tab: list, read, create, edit, pause/activate, delete and read the activity, per workspace.
// It talks to the running portal over HTTP, never to Zernio directly, so the Zernio key stays in the portal and the
// portal's workspace checks apply to the agent too.
//
//   PORTAL_URL           where the portal runs (default http://127.0.0.1:3000)
//   PORTAL_AGENT_TOKEN   only if the portal was started with one
//
// Claude Code:  claude mcp add futuro-automations -- node mcp/automations-mcp.mjs
// No dependencies: JSON-RPC 2.0 over newline-delimited stdio, as the MCP spec describes.
import { createInterface } from 'node:readline';

const PORTAL = (process.env.PORTAL_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TOKEN = process.env.PORTAL_AGENT_TOKEN || '';

async function call(method, path, body) {
  const res = await fetch(`${PORTAL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((e) => { throw new Error(`The portal is not reachable at ${PORTAL} (${e.cause?.code || e.message}). Start it with npm run dev.`); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${data.error || res.statusText}${data.errors ? `\n- ${data.errors.join('\n- ')}` : ''}`);
  return data;
}

const ws = { type: 'string', description: 'The workspace (client) profileId, from list_workspaces.' };
const kind = { type: 'string', enum: ['comment', 'flow'], description: 'From list_automations: "comment" (comment automations) or "flow" (workflows).' };
const aid = { type: 'string', description: 'The automation id, from list_automations.' };
const settings = {
  type: 'object',
  description: 'Recipe fields. Call get_recipes for every field and an example per recipe. Common: name, accountId, dmMessage, buttons [{title, url}], isActive.',
  additionalProperties: true,
};

const TOOLS = [
  { name: 'list_workspaces', description: 'List the client workspaces in this portal.', inputSchema: { type: 'object', properties: {} },
    run: () => call('GET', '/workspaces') },
  { name: 'get_recipes', description: 'The five automation recipes (comment_dm, followers_only, story_mention, ref_link, ask_first), every field they take, an example of each and the platform rules. Read this before creating one.',
    inputSchema: { type: 'object', properties: {} }, run: () => call('GET', '/recipes') },
  { name: 'list_automations', description: "List a workspace's automations with what each does, its status and its numbers, plus the Instagram/Facebook accounts it can use.",
    inputSchema: { type: 'object', properties: { profileId: ws }, required: ['profileId'] },
    run: (a) => call('GET', `/w/${enc(a.profileId)}/automations`) },
  { name: 'list_posts', description: "Recent posts of a workspace account, to bind a comment automation to one post (platformPostId). Omit accountId for the first Instagram account.",
    inputSchema: { type: 'object', properties: { profileId: ws, accountId: { type: 'string' } }, required: ['profileId'] },
    run: (a) => call('GET', `/w/${enc(a.profileId)}/posts${a.accountId ? `?accountId=${enc(a.accountId)}` : ''}`) },
  { name: 'get_automation', description: 'One automation: what it does, its settings and its numbers.',
    inputSchema: { type: 'object', properties: { profileId: ws, kind, id: aid }, required: ['profileId', 'kind', 'id'] },
    run: (a) => call('GET', `/w/${enc(a.profileId)}/automations/${enc(a.kind)}/${enc(a.id)}`) },
  { name: 'create_automation', description: 'Create an automation from a recipe. It goes live at once unless settings.isActive is false. Confirm the exact DM text and account with the person before creating one that is live: it answers real people.',
    inputSchema: { type: 'object', properties: { profileId: ws, recipe: { type: 'string', enum: ['comment_dm', 'followers_only', 'story_mention', 'ref_link', 'ask_first'] }, settings }, required: ['profileId', 'recipe', 'settings'] },
    run: (a) => call('POST', `/w/${enc(a.profileId)}/automations`, { ...a.settings, recipe: a.recipe }) },
  { name: 'update_automation', description: 'Change an automation. Send only the fields to change; buttons: [] removes the buttons. The recipe and the account stay what they were.',
    inputSchema: { type: 'object', properties: { profileId: ws, kind, id: aid, settings }, required: ['profileId', 'kind', 'id', 'settings'] },
    run: (a) => call('PATCH', `/w/${enc(a.profileId)}/automations/${enc(a.kind)}/${enc(a.id)}`, a.settings) },
  { name: 'set_automation_live', description: 'Turn an automation on (live: true) or pause it (live: false).',
    inputSchema: { type: 'object', properties: { profileId: ws, kind, id: aid, live: { type: 'boolean' } }, required: ['profileId', 'kind', 'id', 'live'] },
    run: (a) => call('POST', `/w/${enc(a.profileId)}/automations/${enc(a.kind)}/${enc(a.id)}/${a.live ? 'activate' : 'pause'}`) },
  { name: 'delete_automation', description: 'Delete an automation for good (its log stays in Zernio). Ask the person first.',
    inputSchema: { type: 'object', properties: { profileId: ws, kind, id: aid }, required: ['profileId', 'kind', 'id'] },
    run: (a) => call('DELETE', `/w/${enc(a.profileId)}/automations/${enc(a.kind)}/${enc(a.id)}`) },
  { name: 'get_activity', description: 'What an automation did, newest first: for comment automations every trigger with its outcome (sent, waiting for the follow tap, skipped and why, failed and why); for flows every run. Handles and outcomes only, never what people wrote.',
    inputSchema: { type: 'object', properties: { profileId: ws, kind, id: aid, limit: { type: 'number' } }, required: ['profileId', 'kind', 'id'] },
    run: (a) => call('GET', `/w/${enc(a.profileId)}/automations/${enc(a.kind)}/${enc(a.id)}/activity${a.limit ? `?limit=${Number(a.limit)}` : ''}`) },
];
const enc = encodeURIComponent;

const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const handlers = {
  initialize: (p) => ({
    protocolVersion: p?.protocolVersion || '2025-06-18',
    capabilities: { tools: {} },
    serverInfo: { name: 'futuro-automations', version: '1.0.0' },
    instructions: 'Automations for the white-label portal: ManyChat-style comment-to-DM, followers-only rewards, story mentions, ref links and ask-first flows on Instagram and Facebook, through Zernio. Start with list_workspaces, then list_automations; read get_recipes before creating.',
  }),
  ping: () => ({}),
  'tools/list': () => ({ tools: TOOLS.map(({ run, ...t }) => t) }),
  'tools/call': async (p) => {
    const tool = TOOLS.find((t) => t.name === p?.name);
    if (!tool) return { content: [{ type: 'text', text: `Unknown tool ${p?.name}` }], isError: true };
    try {
      const out = await tool.run(p.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out };
    } catch (e) {
      return { content: [{ type: 'text', text: e.message }], isError: true };
    }
  },
};

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ id: null, error: { code: -32700, message: 'Parse error' } });
  }
  if (msg.id === undefined) return; // a notification (initialized, cancelled): nothing to answer
  const h = handlers[msg.method];
  if (!h) return send({ id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
  try {
    send({ id: msg.id, result: await h(msg.params) });
  } catch (e) {
    send({ id: msg.id, error: { code: -32603, message: e.message } });
  }
});
