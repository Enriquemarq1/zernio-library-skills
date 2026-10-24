# Zernio inbox — capability matrix

This portal's messaging scope: **list, history, reply, start a thread (where the channel allows it), explicit mark read, receive events, and account health**. The evaluation channels are Instagram, WhatsApp and SMS. Facebook uses the same code paths as Instagram. Attachments, templates beyond thread start, reactions, typing, archive, comments, autonomous replies and publishing are out of scope for this build.

Documentation checked **2026-09-25**; the full audit with every source and conflict is in [zernio-docs-audit-2026-09-25.md](zernio-docs-audit-2026-09-25.md). "Local" means the fixture suite (`npm test`, `tests/fake-zernio.mjs`) and is never live proof. "Live" means [evidence/live-2026-09-25.md](evidence/live-2026-09-25.md).

## Capabilities

| Capability | Contract (docs, 2026-09-25) | Where in the app | Local | Live |
| --- | --- | --- | --- | --- |
| Connect account to the right workspace | [GET /v1/connect/{platform}](https://docs.zernio.com/connect/get-connect-url); the callback is not ownership proof | `server.js` `/connect/:profileId/:platform`, `/callback/:platform` (single-use intent bound to a browser cookie; re-reads the workspace's accounts before announcing success) | pass (tampered, replayed, foreign-browser and cancelled callbacks) | existing connections reused; no new consent run |
| Account health | [GET /v1/accounts/{id}/health](https://docs.zernio.com/accounts/get-account-health); for WhatsApp also `platformConnection` and inbound subscription | `server.js` Connections → Messaging health; `inbox/adapter.js` `accountHealth` | pass | pass (Instagram and Facebook Ready) |
| Conversation list | [GET /v1/inbox/conversations](https://docs.zernio.com/messages/list-inbox-conversations): default `desc`, limit ≤100, cursor, `meta.failedAccounts`, `meta.accountsSkipped` | `inbox/routes.js` `GET /w/:profileId/inbox`; `adapter.listConversations` (≤10 pages, scoped to the workspace's own accounts) | pass (pages, partial failure, skipped account, empty vs error, late import) | pass on Instagram (227 and 220 threads, several pages) |
| History | [GET …/{id}/messages](https://docs.zernio.com/messages/get-inbox-conversation-messages): `accountId` required; **default `asc`** (live-confirmed); limit ≤100 | `adapter.messagesPage` (requests `desc`), `mergeMessages` (dedupe by platform message id, chronological display), "Load older" | pass | pass on Instagram |
| Mark read | [POST …/{id}/read](https://docs.zernio.com/messages/mark-conversation-read) `{accountId}` | explicit button only; opening a thread never marks it read | pass | not run: it would change the read state of real customer threads |
| Reply | [POST …/{id}/messages](https://docs.zernio.com/messages/send-inbox-message) `{accountId, message}`, `Idempotency-Key` (24 h, per key and path; 409 in flight, 422 changed body; only 2xx cached; 5xx = outcome unknown; 403 can be a Meta window refusal) | `inbox/service.js` `reply`/`reconcile`; `inbox/store.js` `sends`; reply form with a per-attempt key; submit disabled after click | pass (accepted, double submit, changed body, lost response, ambiguous 5xx then reconcile, 409, 400) | **not run**: needs a designated test recipient |
| Start a thread | [POST /v1/inbox/conversations](https://docs.zernio.com/messages/create-inbox-conversation) → 201; **no idempotency key**; Instagram/Facebook → `PLATFORM_NOT_SUPPORTED`; WhatsApp needs an approved template | `POST /w/:profileId/inbox/new`; `adapter.newThreadRule`, `createConversation`; local duplicate guard; an ambiguous result is "unknown, do not retry" | pass | **not run** |
| Receive (webhook) | [Webhooks](https://docs.zernio.com/webhooks), [inbox payloads](https://docs.zernio.com/webhooks/inbox): hex HMAC-SHA256 of the raw body; 2xx within 5 s; retried; event id = `payload.id` | `inbox/webhooks.js` (verify → persist → 200 → worker); `server.js` worker at boot and every 15 s; `setup-webhook.js` (dry run by default) | pass (bad signature, duplicate, crash between persist and process, out-of-order status, cross-tenant, sandbox without profileId, Instagram id mapping) | **not run**: no public URL or `portal` subscription yet |
| Delivery / read status | status events only where the platform sends them; the rank never goes backwards | `store.upsertMessage` | pass | not run |
| Tenant isolation | the key sees the whole team; profile filters are not authorization | `inbox/tenancy.js` `assertAccount` on every read and write; webhook routing checks account ownership | pass (history, reply, legacy reply path, mark read, reconcile, new thread, all with the other tenant's ids) | unknown workspace → 404 |
| Untrusted content | messages are data | all output escaped | pass | — |
| Secrets | the key stays server-side; the Webhook schema echoes `secret` | `setup-webhook.js` never prints it; pages and logs checked | pass | pass (no key or secret in any page or the log) |

## Channels

| | Instagram | WhatsApp | SMS |
| --- | --- | --- | --- |
| Account used in the 2026-09-25 evaluation | one healthy Instagram account on a test profile | not connected to any workspace in that test; free [sandbox](https://docs.zernio.com/platforms/whatsapp/sandbox) available (1 phone, 50 msgs/day) | the test number was on a profile outside the portal, and **Zernio skipped it in the conversation list** (live) |
| List / history | live pass | code ready; not read (account not in any workspace) | list: skipped by Zernio for this account; history untested |
| Reply | recipient must message first; 24 h window (outside it Meta refuses with 403; `HUMAN_AGENT` tag not implemented) | 24 h customer-service window; after it, template only (replying with a template is not implemented here) | allowed; STOP opt-out → 409 |
| Start a thread | not supported (`PLATFORM_NOT_SUPPORTED`); the form disables it | approved template (exact name and language) | allowed (`participantId` digits); US numbers need [10DLC/toll-free registration](https://docs.zernio.com/platforms/sms/registration) |
| Status events | `message.sent`, `message.read` | sent / delivered / read / failed | delivered / failed only (no `message.sent`) |
| List row id = | `conversation.platformConversationId` | internal `message.conversationId` | internal `message.conversationId` |

## Identity map (why events land on the right thread)

- A REST message `id` equals the webhook's `message.platformMessageId`. A webhook's `message.id` is internal and has no REST counterpart.
- A conversation-list row id is the platform thread id for Instagram, Facebook, Bluesky and Reddit, and the internal id for WhatsApp, SMS, Telegram and Slack. `adapter.normalizeWebhookMessage` picks the matching field.
- `account.profileId` is optional in inbox payloads and omitted by the WhatsApp sandbox. The worker then finds the owning workspace by asking Zernio which workspace's profile has that account.
- Account ids may change on reconnect; the docs conflict on this (audit §6.10). Every check re-reads the workspace's accounts from Zernio (30 s cache, refreshed on a miss), so nothing depends on a stored mapping.

## Unresolved documentation conflicts (audit §7)

`conversation.started` for SMS; the WhatsApp conversation id on `conversation.started`; the WhatsApp `message.deleted` direction; account-id stability on reconnect; the event-id format (treated as opaque). The app stores and processes only `message.*` events for threads; `conversation.started` is subscribed but only logged.

Pricing note: Zernio's message meter starts **2026-10-01** ([pricing/messages](https://docs.zernio.com/pricing/messages)). After that date a send can fail with `403 message_allowance_exceeded`; the app shows it as "not sent".
