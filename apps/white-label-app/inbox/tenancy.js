// Server-side workspace authorization for the inbox.
// A workspace (tenant) is a clients.json entry bound to one Zernio profile. Every inbox action names an
// account; that account must belong to the workspace's profile according to Zernio's own account list for
// that profile — never according to an id the browser supplied. The API key sees the whole team, so this
// check is what keeps one client's conversations out of another client's pages.
import { listAccounts } from '../zernio.js';

const TTL_MS = 30_000;
const cache = new Map(); // profileId -> { at, accounts }

export class AccessDenied extends Error {
  constructor(message = 'That conversation or account is not part of this workspace.') {
    super(message);
    this.status = 403;
  }
}

export async function workspaceAccounts(profileId, { fresh = false } = {}) {
  const hit = cache.get(profileId);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.accounts;
  const accounts = await listAccounts(profileId);
  // Zernio returns accounts for the requested profile; keep only rows that say so, in case a filter is ignored.
  const own = accounts.filter((a) => !a.profileId || String(a.profileId?._id ?? a.profileId) === profileId);
  cache.set(profileId, { at: Date.now(), accounts: own });
  return own;
}

export const accountIdOf = (a) => a._id ?? a.id ?? a.accountId;

export async function assertAccount(profileId, accountId) {
  if (!accountId) throw new AccessDenied('No account was named for this action.');
  let found = (await workspaceAccounts(profileId)).find((a) => accountIdOf(a) === accountId);
  if (!found) found = (await workspaceAccounts(profileId, { fresh: true })).find((a) => accountIdOf(a) === accountId);
  if (!found) throw new AccessDenied();
  return found;
}

// Webhook routing: the account must belong to a workspace in this portal. When the payload names a profile it
// must be that workspace; when it omits one (WhatsApp sandbox events do) the owning workspace is looked up.
export async function tenantForEvent(clientList, { profileId, accountId }) {
  if (!accountId) return null;
  const candidates = profileId ? clientList.filter((c) => c.profileId === profileId) : clientList;
  for (const ws of candidates) {
    try {
      await assertAccount(ws.profileId, accountId);
      return ws;
    } catch {
      /* not this workspace */
    }
  }
  return null;
}

export const _resetTenancyCache = () => cache.clear();
