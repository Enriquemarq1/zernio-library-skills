// The Automations tab on FIXTURE data, for screenshots and design passes. Never the real API.
//   node scripts/demo-automations.mjs [port]      → http://127.0.0.1:<port>/w/demo_bakery/automations
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeAutomations } from '../tests/fake-automations.mjs';

const PORT = Number(process.argv[2] || 3901);
const A = 'demo_bakery';
const B = 'demo_northwind';
// Demo pictures: soft gradients with an emoji, so the post picker and the Instagram preview look like a real feed.
const pic = (a, b, e) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><text x='200' y='290' font-size='170' text-anchor='middle'>${e}</text></svg>`);
const fake = fakeAutomations({
  accounts: [
    { _id: 'ig_a', platform: 'instagram', username: 'harbour.bakery', profileId: A, platformUserId: '1784' },
    { _id: 'ig_b', platform: 'instagram', username: 'northwind.studio', profileId: B },
  ],
  posts: [
    { id: '1806', accountId: 'ig_a', platform: 'instagram', content: '¿Para cuántos alcanza? 🧁', createdTime: '2026-08-18T16:04:40.000Z', commentCount: 3, picture: pic('#FFE3D3', '#F8B4C8', '🧁') },
    { id: '1811', accountId: 'ig_a', platform: 'instagram', content: 'De la primera mezcla a tu mesa 🤍', createdTime: '2026-08-16T17:04:00.000Z', commentCount: 0, picture: pic('#FFF4D6', '#F3D2A2', '🥐') },
    { id: '1812', accountId: 'ig_a', platform: 'instagram', content: 'Guarda este post 📌', createdTime: '2026-08-11T16:05:21.000Z', commentCount: 0, picture: pic('#E6F0FF', '#C9B8F5', '🍰') },
    { id: '1813', accountId: 'ig_a', platform: 'instagram', content: 'El que más me piden', createdTime: '2026-08-14T02:01:11.000Z', commentCount: 0, picture: pic('#E2F7EC', '#A8E0C4', '🍪') },
  ],
  misses: { total: 1, retentionDays: 7, samples: [{ commentText: 'so cute!!', commenterName: 'Fixture', at: new Date(Date.now() - 36e5).toISOString() }] },
});
const api = await fake.listen();
const dir = mkdtempSync(join(tmpdir(), 'automations-demo-'));
writeFileSync(join(dir, 'clients.json'), JSON.stringify([{ name: 'Harbour Bakery', profileId: A }, { name: 'Northwind Studio', profileId: B }]));
Object.assign(process.env, { DEMO_MODE: '1', ZERNIO_API_BASE: api, ZERNIO_API_KEY: 'test-key', CLIENTS_FILE: join(dir, 'clients.json'), INBOX_DB: ':memory:', BASE_URL: `http://127.0.0.1:${PORT}` });
const { default: app } = await import('../server.js');
await new Promise((r) => app.listen(PORT, '127.0.0.1', r));

const post = (path, body) => fetch(`http://127.0.0.1:${PORT}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const guide = await post(`/w/${A}/automations`, { recipe: 'comment_dm', name: 'Recipe giveaway', accountId: 'ig_a', keywords: 'RECIPE', dmMessage: 'Hey {{first_name}}! Here’s the cupcake recipe you asked for 🧁', buttons: [{ title: 'Get the recipe', url: 'https://example.com/recipe' }], commentReply: 'Sent it to your DMs, {{first_name}} 📩', alsoMatchInDms: true });
const vip = await post(`/w/${A}/automations`, { recipe: 'followers_only', name: 'Followers get 20% off', accountId: 'ig_a', keywords: 'VIP', platformPostId: '1806', postTitle: '¿Para cuántos alcanza? 🧁', dmMessage: 'You’re in, {{first_name}}! 20% off this week, followers only 🎉', buttons: [{ title: 'Claim 20% off', url: 'https://example.com/vip' }], commentReply: 'Check your DMs 👀', gateMessage: 'Follow us, then tap below to unlock your discount 👇', gateButton: 'I’m following ✅', gateNotFollowing: 'Looks like you’re not following yet. Follow and tap again 🙌' });
await post(`/w/${A}/automations`, { recipe: 'story_mention', name: 'Story shout-out thank-you', accountId: 'ig_a', dmMessage: 'Thank you for the shout-out, {{first_name}}! 💛 A free cupcake on your next visit.', repeat: 'every', cooldownHours: 24 });
const qr = await post(`/w/${A}/automations`, { recipe: 'ref_link', name: 'QR at the counter', accountId: 'ig_a', ref: 'counter', dmMessage: 'Hi {{contact.name}}! Thanks for scanning 🙌 Here’s today’s menu.', buttons: [{ title: 'See the menu', url: 'https://example.com/menu' }], tag: 'came-from-qr' });
await post(`/w/${B}/automations`, { recipe: 'comment_dm', name: 'Free template', accountId: 'ig_b', keywords: 'TEMPLATE', dmMessage: 'Here’s the template 👇', buttons: [{ title: 'Get it', url: 'https://example.com/t' }] });

const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
Object.assign(fake.state.comment.get(guide.id).stats, { triggered: 3, dmsSent: 2, linkClicks: 2, uniqueClicks: 1, trackedSends: 2 });
fake.state.logs.set(guide.id, [
  { id: 'l1', commenterUsername: 'alex.test', commentText: 'RECIPE please!', source: 'comment', status: 'sent', commentReplyStatus: 'sent', commenterIsFollower: null, clickCount: 1, createdAt: ago(1) },
  { id: 'l2', commenterUsername: 'alex.test', commentText: 'recipe again', source: 'comment', status: 'skipped', error: 'already sent to this person (once per person)', createdAt: ago(0.5) },
  { id: 'l3', commenterUsername: 'sam.tester', commentText: 'RECIPE', source: 'dm', status: 'sent', commenterIsFollower: true, clickCount: 1, createdAt: ago(6) },
]);
Object.assign(fake.state.comment.get(vip.id).stats, { triggered: 2, dmsSent: 1, followGateSent: 2, followGatePassed: 1 });
fake.state.logs.set(vip.id, [
  { id: 'v1', commenterUsername: 'alex.test', commentText: 'VIP', source: 'comment', status: 'sent', audienceOutcome: 'gate_passed', gateButtonStatus: 'delivered', commenterIsFollower: true, commentReplyStatus: 'sent', createdAt: ago(2) },
  { id: 'v2', commenterUsername: 'new.person', commentText: 'vip', source: 'comment', status: 'gated', audienceOutcome: 'gate_sent', gateButtonStatus: 'delivered', commenterIsFollower: null, commentReplyStatus: 'sent', createdAt: ago(1) },
]);
Object.assign(fake.state.flows.get(qr.id), { totalStarted: 2, totalCompleted: 2 });
fake.state.runs.set(qr.id, [
  { id: 'r1', status: 'completed', variables: { contact: { handle: 'alex.test' }, referral: { ref: 'counter' } }, stepCount: 3, createdAt: ago(3) },
  { id: 'r2', status: 'completed', variables: { contact: { handle: 'sam.tester' }, referral: { ref: 'counter' } }, stepCount: 3, createdAt: ago(40) },
]);
console.log(JSON.stringify({ url: `http://127.0.0.1:${PORT}/w/${A}/automations`, guide: guide.id, vip: vip.id, qr: qr.id }));
