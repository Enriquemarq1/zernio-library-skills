// Read-only: finds the Meta ad accounts reachable with a workspace's key file. GET requests only.
//   node scripts/find-ad-account.mjs <keyFile>
// Prints ad account ids and names. Never prints the key.
import { readKeyFile } from '../keyfile.js';

const BASE = process.env.ZERNIO_API_BASE || 'https://zernio.com/api/v1';
const KEY = readKeyFile(process.argv[2] || '');
const get = async (path) => {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

const accts = await get('/accounts');
const list = accts.body.accounts ?? accts.body.data ?? [];
console.log('accounts status', accts.status, 'count', list.length);
for (const a of list.filter((x) => x.platform === 'metaads')) {
  console.log('metaads social account', a._id, 'profile', String(a.profileId?._id ?? a.profileId));
  const r = await get(`/ads/accounts?accountId=${encodeURIComponent(a._id)}`);
  const ads = r.body.accounts ?? r.body.adAccounts ?? r.body.data ?? [];
  console.log('  ad accounts status', r.status, 'keys', Object.keys(r.body));
  for (const x of ads) console.log('  ', x.id ?? x._id, '|', x.name, '|', x.currency, '|', x.businessName ?? x.business?.name ?? '');
}
