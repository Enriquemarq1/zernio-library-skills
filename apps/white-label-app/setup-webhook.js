// Tell Zernio where to deliver this portal's webhooks. Dry run by default: it changes nothing until --apply.
//   node --env-file=.env setup-webhook.js            show the planned subscription (secret redacted)
//   node --env-file=.env setup-webhook.js --apply    create or update the "portal" subscription
//   node --env-file=.env setup-webhook.js --test     also send Zernio's one-off webhook.test afterwards
// Contract: https://docs.zernio.com/webhooks/create-webhook-settings and /webhooks/update-webhook-settings
// (update takes webhookId; lists replace). webhook.test proves reachability only — it ignores events and
// profile scope — so a real inbound message is still required as evidence (see README.md).
import { readFileSync } from 'node:fs';
import zernio from './zernio.js';

const apply = process.argv.includes('--apply') || process.argv.includes('--test');
const sendTest = process.argv.includes('--test');

// Separate from BASE_URL on purpose: the tunnel exposes only /webhooks publicly,
// while BASE_URL stays localhost for the browser-side OAuth redirects.
const url = process.env.WEBHOOK_URL || `${process.env.BASE_URL}/webhooks/zernio`;
const secret = process.env.WEBHOOK_SECRET || '';
const events = [
  'message.received', 'message.sent', 'message.delivered', 'message.read', 'message.failed', 'conversation.started',
  'account.connected', 'account.disconnected', 'post.failed',
];
// Scope to this portal's workspaces. An unscoped endpoint would receive every profile on the team key.
const clientsFile = process.env.CLIENTS_FILE || new URL('./clients.json', import.meta.url);
let profileIds = [];
try {
  profileIds = JSON.parse(readFileSync(clientsFile, 'utf8')).map((c) => c.profileId).filter(Boolean);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

const problems = [];
if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) problems.push('WEBHOOK_URL must be a public https URL (a tunnel to this machine) ending in /webhooks/zernio');
if (secret.length < 32) problems.push('WEBHOOK_SECRET must be set and at least 32 characters (Zernio signs deliveries only when a secret is set)');
if (!profileIds.length) problems.push('clients.json is missing or lists no profileId to scope the subscription to (copy clients.example.json)');

const { webhooks = [] } = await zernio('/webhooks/settings');
const existing = webhooks.find((w) => w.name === 'portal');
const plan = { action: existing ? 'update' : 'create', name: 'portal', url, events, profileIds, secret: secret ? '[redacted]' : '(missing)' };
console.log(JSON.stringify(plan, null, 2));

// process.exitCode, not process.exit(): exiting while fetch sockets close trips a libuv assertion on Windows.
if (problems.length) {
  console.error(`\nNot applied:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else if (!apply) {
  console.log('\nDry run only. Re-run with --apply to create/update, or --test to also send webhook.test.');
} else {
  await register();
}

async function register() {
  const body = { name: 'portal', url, events, secret, profileIds, isActive: true };
  const r = await zernio('/webhooks/settings', {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify(existing ? { webhookId: existing._id, ...body } : body),
  });
  const saved = r.webhook ?? r;
  const webhookId = saved._id ?? existing?._id;
  // The Webhook schema echoes `secret`; never print it.
  console.log(`${existing ? 'updated' : 'created'} →`, JSON.stringify({ webhookId, url: saved.url, events: saved.events, profileIds: saved.profileIds, isActive: saved.isActive }, null, 2));

  if (sendTest && webhookId) {
    const t = await zernio('/webhooks/test', { method: 'POST', body: JSON.stringify({ webhookId }) });
    console.log('webhook.test →', JSON.stringify({ success: t.success, message: t.message }));
  }
}
