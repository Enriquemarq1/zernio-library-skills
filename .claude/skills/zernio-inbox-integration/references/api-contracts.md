# Implementation contracts and pitfalls

Audited against official documentation on September 25, 2026, then field-tested the same day by integrating an existing Express portal with read-only live checks. Items marked *(live)* were observed on a real account; the rest come from the docs. These are decision aids, not a frozen API specification. Reopen the linked pages before implementing; retrieve schemas through [the documentation index](https://docs.zernio.com/llms.txt) or its OpenAPI link. Record conflicts rather than silently resolving them by guessing.

## Setup and connection

Use the server URL in the current reference; official examples use `https://zernio.com/api` followed by `/v1/...`. Authenticate server requests with the documented bearer credential. Keep profile ownership in the app's server-side tenant mapping; never expose the key or trust an arbitrary profile/account selected by the browser.

1. Reuse an existing authorized profile or create one through [profiles](https://docs.zernio.com/profiles/create-profile). Do not use a shared default profile for unrelated tenants by accident.
2. [Get connect URL](https://docs.zernio.com/connect/get-connect-url): `GET /v1/connect/{platform}` requires `profileId`; `redirect_url` must be absolute. Hosted mode completes selection; headless mode may require another platform-specific selection call. Handle both success and error redirects, including optional error details. Do not treat callback account IDs as ownership proof; re-fetch and verify them server-side. Keep callback tokens out of logs and clean them from the visible URL after completion.
3. Follow each channel's setup guide: [Instagram](https://docs.zernio.com/platforms/instagram), [WhatsApp](https://docs.zernio.com/platforms/whatsapp/connection), [SMS](https://docs.zernio.com/platforms/sms). Other channels come from the index. Connection does not erase eligibility, registration, consent or messaging-window requirements.
   - A profile holds one WhatsApp number and one Instagram account; connecting a different Instagram identity to the same profile purges the previous account's conversations ([select Instagram account](https://docs.zernio.com/connect/select-instagram-account)).
   - The same social account can still be connected under several profiles *(live)*. Every such profile then sees the same conversations, which no app-side check can separate. Compare account identities across the app's tenants and report duplicates as a setup decision.
   - SMS has no OAuth: a number is provisioned or ported, and US numbers stay inactive until [10DLC or toll-free registration](https://docs.zernio.com/platforms/sms/registration) is approved. A recipient who replied STOP makes sends fail with 409. The native [SMS send](https://docs.zernio.com/sms/send-sms) (`POST /v1/sms/messages`) is an alternative to the inbox endpoints.
   - The [WhatsApp sandbox](https://docs.zernio.com/platforms/whatsapp/sandbox) is the free test route: one phone, a daily message cap, and inbox events without `account.profileId`.
4. [Account health](https://docs.zernio.com/accounts/get-account-health): `GET /v1/accounts/{accountId}/health`. WhatsApp token validity alone is insufficient: inspect `platformConnection`, inbound subscription and reported issues. Recheck mappings after reconnect; IDs may change (the docs conflict on whether they do, so stay defensive).
5. [List accounts](https://docs.zernio.com/accounts/list-accounts) returns `_id` (not `id`), and unknown query parameters are silently ignored: a mistyped filter returns every account the key can see. Filter the returned rows by `profileId` yourself before treating them as a tenant's accounts.

## Baseline endpoint map

Read each linked schema for required fields; preserve opaque IDs and encode path/query values safely.

| User action | Contract | Integration consequence |
| --- | --- | --- |
| See inbox | [GET /v1/inbox/conversations](https://docs.zernio.com/messages/list-inbox-conversations) | Apply authorized profile/account scope on the server; follow `pagination.nextCursor`. Defaults: newest activity first, `limit` 50 (max 100). Show `meta.failedAccounts` and `meta.accountsSkipped` rather than turning partial failure into an empty inbox. A whole selected account can be skipped *(live: an SMS number)*: report a skipped messaging account as a blocker, not as "no conversations". |
| Open history | [GET /v1/inbox/conversations/{conversationId}/messages](https://docs.zernio.com/messages/get-inbox-conversation-messages) | Requires `accountId` query. The default is `sortOrder=asc`, oldest first *(live: `sortOrderApplied: "asc"`)*, with `limit` max 100. Relying on the default shows the oldest page of a long thread: request `sortOrder=desc` for the recent page, reverse it for display, and page older with the cursor. |
| Reply | [POST /v1/inbox/conversations/{conversationId}/messages](https://docs.zernio.com/messages/send-inbox-message) | Basic text body uses `accountId` and `message`. Delivery is a later outcome, where supported. Classify responses with the table under "Sending and retries". |
| Start a thread | [POST /v1/inbox/conversations](https://docs.zernio.com/messages/create-inbox-conversation) | Requires account and valid recipient/content; returns **201**. It sends a message, not just an empty local thread. Supported initiation differs from reply support: Instagram/Facebook return `PLATFORM_NOT_SUPPORTED`, WhatsApp without an approved template returns `TEMPLATE_REQUIRED`. No idempotency key is documented. |
| Mark read | [POST /v1/inbox/conversations/{conversationId}/read](https://docs.zernio.com/messages/mark-conversation-read) | Body `{accountId}`. History reads do not mark read. Make read receipt behavior intentional: an explicit action, not a side effect of opening or replying. |
| Archive/restore | [Update conversation](https://docs.zernio.com/messages/update-inbox-conversation) | Respect current schema and channel support; do not imply archive deletes messages. |

### Documentation discrepancy to retain

The list-conversations page's introductory platform list omits WhatsApp/SMS/iMessage while its schema includes WhatsApp/iMessage fields and the inbox-webhook schema lists additional channels. Do not hardcode that introductory list as exhaustive, or infer support solely from an enum. Cross-check the chosen platform guide and a live list/read/reply test. Report unsupported versus not-yet-verified explicitly. For SMS the sources disagree: the list page's `platform` filter omits `sms`, while the channel matrix and multi-tenant guide include it. In the September 25 live check, the account's only SMS number appeared in `meta.accountsSkipped`, so run a read-only list call during Map before promising SMS threads in the inbox.

## History and identity

The [history reference](https://docs.zernio.com/messages/get-inbox-conversation-messages) documents different cursor ordering across platforms. Request recent messages explicitly, deduplicate by account/conversation/platform-message identity, and normalize display order without changing pagination cursors. REST message `id` corresponds to webhook `message.platformMessageId`; webhook text and REST text field names also differ. Normalize in the adapter, not by assuming identical JSON.

Conversation and message IDs differ by source ([inbox webhooks](https://docs.zernio.com/webhooks/inbox)). Key threads by the conversation-list row id and translate webhook fields per platform. Keying threads by `message.conversationId` files every Instagram/Facebook event under a thread the list never shows.

| Identity | REST | Webhook `message.*` |
| --- | --- | --- |
| Message | `messages[].id` | `message.platformMessageId` (`message.id` is internal, with no REST counterpart) |
| Text | `messages[].message` | `message.text` |
| Conversation | list `data[].id` | `conversation.platformConversationId` equals the list id. `message.conversationId` / `conversation.id` are internal ids, which equal the list id only for WhatsApp, SMS, Telegram and Slack; for Instagram, Facebook, Bluesky and Reddit the list id is the platform thread id. |
| Account | `accountId` (`_id` on list accounts) | `account.accountId` (same as `account.id`); `account.profileId` is optional |
| Ordering | `createdAt` / `sentAt` | `message.sentAt` |

On `conversation.started`, `conversation.id` is the platform conversation id, and the docs conflict for WhatsApp: store both ids.

Instagram/Facebook import historical conversations and messages asynchronously, with documented limits. Imported history emits no message webhooks and is already read. An event-only inbox misses it: paginate an initial snapshot, reconcile later, and avoid interpreting old imports as newly received messages. Display platform-inaccessible or deleted content appropriately; a returned deleted message can still include its former content. Never promise a complete archive.

## Sending and retries

The [send reference](https://docs.zernio.com/messages/send-inbox-message) supports `Idempotency-Key` for 24 hours: same request replays a successful response; changed body gives 422 and an in-flight key gives 409. Persist one key per logical attempt. Only successful responses are cached. An ambiguous timeout/5xx can mean the platform accepted a send even though the key was released. Reconcile before retrying; empty history is inconclusive. Expose an unknown outcome rather than silently sending twice. Keys are at most 255 characters and are scoped to the credential and the exact path. A replay returns the original status with `Idempotent-Replayed: true`.

| Response | Meaning | Show the user |
| --- | --- | --- |
| 2xx | Accepted, which is not delivered. A replay carries `Idempotent-Replayed: true`. | accepted |
| 409 | The same key is still processing | sending; never resend |
| 422 | The same key was reused with a different body | refused; a new attempt needs a new key |
| 403 | Credential or inbox add-on problem, **or** Meta refused the send (for example outside the messaging window: `platform_api_error`). From 2026-10-01, also `message_allowance_exceeded` ([message pricing](https://docs.zernio.com/pricing/messages)). | not sent, with the reason |
| 429 | Rate limited (`Retry-After`) | not sent yet; retry later with the same key |
| other 4xx | Definitive rejection | not sent |
| 5xx, timeout, network | Outcome unknown. Zernio does not retry a 500, and the platform may still deliver. | unknown; reconcile; never resend automatically |

`partialFailure`/`messageIds` apply only when a Facebook/Instagram request carries an attachment and text together; `warnings` currently reports an ignored `replyTo`. Do not resend parts that succeeded. A text-only reply has no partial send.

The [create-thread reference](https://docs.zernio.com/messages/create-inbox-conversation) excludes Instagram/Messenger from arbitrary new-recipient initiation. WhatsApp normally needs an approved template to initiate or re-engage; eligible Direct Send utility messaging is conditional, not a universal workaround. Create-thread template fields differ from the reply endpoint's `template` shape. Fetch current definitions and honor exact approved name/language. Check per-channel windows, opt-outs and rate limits; do not generalize reply-endpoint idempotency to another operation without documentation.

Creating a thread has no documented idempotency key. Guard double submits with a per-form attempt key that is stored before the call. Treat an ambiguous result as unknown and tell the user to check the inbox for the new thread; never retry it automatically. Controlled failure tests can reproduce the documented codes with fixtures instead of live recipients:
- `PLATFORM_NOT_SUPPORTED`
- `TEMPLATE_REQUIRED`
- 403 outside the Instagram/Messenger window (the `HUMAN_AGENT` tag has its own rules; see the [Instagram guide](https://docs.zernio.com/platforms/instagram))
- WhatsApp `131056` per-recipient pacing ([WhatsApp reference](https://docs.zernio.com/platforms/whatsapp/reference))

## Receiving and synchronization

Use [webhook setup and delivery](https://docs.zernio.com/webhooks) plus the [inbox payloads/support matrix](https://docs.zernio.com/webhooks/inbox).

- Register the endpoint with an app-generated secret, supported events and appropriate profile scope (`profileIds` is preferred over `accountIds`); unscoped subscriptions receive all profiles. Check existing integration-owned subscriptions before creating duplicates. Updates take `webhookId`, and lists replace.
- Inventory **every other** active subscription that receives `message.*` for the tenant or test profiles *(live: two unscoped team subscriptions received every inbound message)*. Another integration, such as an auto-reply agent, gets the same test traffic and may answer the test recipient. Report it and ask whether to pause or scope it before live tests; never change another integration's subscription on your own.
- The webhook settings responses (create, update, list) include `secret`. Never print or log them unfiltered.
- Verify `X-Zernio-Signature`: lowercase hex HMAC-SHA256 of the raw body using that secret. Compare in constant time; reject invalid/missing signatures before processing. Do not invent a timestamp-signature format.
- Persist a valid event durably before acknowledging within five seconds. Deduplicate with `payload.id` (also `X-Zernio-Event-Id`), but track pending/completed processing separately so a worker crash does not discard an event. Use the existing app's queue/store where possible.
- Map account/profile to tenant before updating data. `account.profileId` is optional (the WhatsApp sandbox omits it): route by account ownership, re-read from Zernio. Use `profileId` only to narrow the lookup, and ignore events whose account no tenant owns. Reconcile out-of-order events and optimistic sends with platform IDs; avoid duplicate bubbles and regressions in status. Implement the receiver in the app AND establish the channel-to-Zernio connection: these are different legs.
- Test subscription delivery, then a real inbound message. `webhook.test` proves reachability/signature handling, not channel activation; it is sent once and ignores `events` and `profileIds`. Failed deliveries are retried (7 attempts over about 51 hours). [Logs](https://docs.zernio.com/webhooks/get-webhook-logs) are kept 30 days, and [redelivery](https://docs.zernio.com/webhooks/redeliver-webhook-event) replays an event with the same id within that window.
- Only show delivered/read states when the selected platform supplies them. SMS does not emit `message.sent` in the current event schema: don't wait for that event to confirm its accepted send. Read the appropriate response and delivery events.
- If WhatsApp has Meta Business Agent enabled, expose thread ownership and standby messages. Do not silently take control; sending can do that. Autonomous replies remain a separate request.

The docs treat webhooks as the primary path and polling as a periodic backfill sweep ([multi-tenant inbox](https://docs.zernio.com/multi-tenant/inbox): "never: poll for new messages"). Reading list and history live on page load, as a server-rendered app can, is not polling. Where no public webhook URL is possible, label any polling honestly and state its refresh latency. Keep it within the documented 60/600/1,200 requests-per-minute tiers, stop it when unused, and reconcile after reconnect. It does not reproduce every lifecycle event.

## Additional capabilities when selected

Build each requested feature from its exact endpoint and platform constraints. Discover search, attachments, templates, interactive replies, reactions, typing, editing/deleting and thread control through the index. Comments/reviews are separate resources; being under the inbox heading does not put them in this DM integration automatically.

[Attachment resolution](https://docs.zernio.com/messages/get-message-attachment) needs special care: Meta URLs expire. Retain the attachment reference/`refreshUrl`, resolve through the authorized app backend with `accountId` and `format=json`, then return permitted media to the user; never put a bearer key in an image URL. Webhook attachments omit `refreshUrl`, so reconstruct the documented route from platform message ID, conversation, account and attachment index. Some unsupported shares cannot be re-minted; use the documented exception and disclose unavailable content rather than an endless retry.

For [uploads](https://docs.zernio.com/messages/upload-media-direct), check platform size/type constraints and the returned URL's visibility before using private media. Do not add media storage or preservation beyond the app's requested data policy.
