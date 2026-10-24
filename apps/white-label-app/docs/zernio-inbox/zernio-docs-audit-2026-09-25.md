# Zernio inbox/messaging docs audit — 2026-09-25

Scope: exact current contracts for a Node/Express inbox integration (SMS, WhatsApp, Instagram), compared with
the `zernio-inbox-integration` skill's `references/api-contracts.md` (in this repo under `.claude/skills/`).
Read-only research. No Zernio API call was made, nothing was sent, no file other than this one was written.

## Method and sources

- Index: https://docs.zernio.com/llms.txt (452 KB; every page is linked as `<url>.mdx`; full dump at https://docs.zernio.com/llms-full.txt).
- Pages were downloaded as raw MDX with curl (all returned HTTP 200) instead of WebFetch, so nothing passed through a summarizer. The canonical page URL is the same path without `.mdx` (verified: https://docs.zernio.com/messages/update-inbox-conversation returns 200).
- OpenAPI spec linked from https://docs.zernio.com/changelog : https://zernio.com/openapi.yaml (`info.version: "1.96.0"`, OpenAPI 3.1.0, 3.26 MB). Used for enums, defaults and header parameters that the MDX pages render without values.
- Changelog page (https://docs.zernio.com/changelog) renders its entries client-side; no dated entries were readable. Changes after today's fetch are UNVERIFIED.

Abbreviations: "spec" = https://zernio.com/openapi.yaml. All docs URLs below are canonical (no `.mdx`).

---

## 0. Global contract

| Item | Current documentation | Source |
|---|---|---|
| Base URL | `https://zernio.com/api` + `/v1/...` (servers: production `https://zernio.com/api`) | spec `info.description` and `servers`; https://docs.zernio.com/changelog |
| Auth | `Authorization: Bearer <API key>` (securityScheme `bearerAuth`). Connect flows also accept `X-Connect-Token` (15-minute token scoped to profile+platform) on endpoints that list it | spec `components.securitySchemes`; https://docs.zernio.com/connect/list-instagram-pages |
| Versioning | Breaking changes only in a new path version; new fields/codes can appear in `/v1` any time; branch on `code`, not `error` text | https://docs.zernio.com/changelog ; https://docs.zernio.com/guides/error-handling |
| Error envelope | `{ error, type, code, param?, details?, platform?, platformError? }`; `type` ∈ invalid_request_error, authentication_error, permission_error, not_found, rate_limit_error, platform_error, api_error. Inbox send endpoints use their own UPPER_CASE codes (`PLATFORM_LIMITATION`, `TEMPLATE_REQUIRED`, `PLATFORM_NOT_SUPPORTED`, ...): compare case-sensitively, never lowercase | https://docs.zernio.com/guides/error-handling |
| Request id | Responses carry `X-Request-Id`; a valid `x-request-id` you send is reused | spec `info.description` |
| Unknown params | Silently ignored, not rejected (e.g. `profile_id` instead of `profileId` returns every account). Fields are camelCase except `redirect_url` on connect | https://docs.zernio.com/guides/error-handling |
| Rate limits (Zernio) | 60 req/min (0-2 connected accounts), 600 (3-2,000), 1,200 (2,001+), sliding window, per team key. Headers `X-RateLimit-Limit/Remaining/Reset`; `429` + `Retry-After` (seconds). The API-key 429 body is `{error, details{currentCount,limit,retryAfterSeconds}}` with no `code` | https://docs.zernio.com/guides/rate-limits |
| Rate limits (platform) | WhatsApp: ~10 msgs/min to one recipient, excess → `400` code `131056`; per-number messaging tiers (`messagingLimitTier`) for business-initiated conversations; coexistence numbers fixed at 20 msg/s. X DM: 200/15 min, 1,000/24 h per account. Zernio retries platform 429/5xx up to 3 times for platform limits generally, but does NOT retry a message send | https://docs.zernio.com/messages/send-inbox-message ; https://docs.zernio.com/messages/create-inbox-conversation ; https://docs.zernio.com/platforms/whatsapp/connection ; https://docs.zernio.com/guides/rate-limits |
| Inbox access gate | Every inbox endpoint documents `403 Inbox addon required`. Current pricing says every account includes the inbox; legacy AppSumo plans keep it off (webhook subscription to inbox events then fails `403 feature_not_available`) | https://docs.zernio.com/pricing ; https://docs.zernio.com/webhooks/inbox |

---

## 1. Endpoint contracts

### 1.1 List conversations — `GET /v1/inbox/conversations`
Source: https://docs.zernio.com/messages/list-inbox-conversations ; spec `listInboxConversations`.

Query (all optional):
- `profileId` string
- `platform` enum (spec): `facebook, instagram, twitter, bluesky, reddit, telegram, whatsapp, imessage` — **no `sms`, `slack`, `tiktok`** in the filter enum.
- `status` enum `active | archived`
- `sortOrder` enum `asc | desc`, **default `desc`**, "Sort order by updated time"
- `limit` integer 1-100, **default 50**
- `cursor` string (from `pagination.nextCursor`)
- `accountId` string

200 body:
- `data[]`: `id` (opaque; "pass it back verbatim"), `platform`, `accountId`, `accountUsername`, `participantId`, `participantName`, `participantPicture` (string|null), `participantVerifiedType` (X only), `lastMessage` (string), `updatedTime` (date-time), `status` (active|archived), `unreadCount` (int|null), `threadControl` (WhatsApp only: app|ai_agent|other), `isGroup` (iMessage only), `url` (string|null), `instagramProfile` ({isFollower,isFollowing,followerCount,isVerified,fetchedAt}|null, Instagram only), `metadata` (ad/ref click attribution: `ctwa_*` on WhatsApp, `meta_ad_*` on IG/Messenger).
- `pagination`: `{ hasMore: boolean, nextCursor: string|null }`
- `meta`: `{ accountsQueried, accountsFailed, failedAccounts[{accountId, accountUsername, platform, error, code, retryAfter}], lastUpdated, accountsSkipped[{accountId, platform}] }` (`accountsSkipped` = platform not supported or account not enabled for the feature).

Errors: 401, 403 (inbox add-on).
Behavior: "aggregated and deduplicated" across accounts. Intro says "Supported platforms: Facebook, Instagram, X, Bluesky, Reddit, Telegram." Instagram/Facebook pre-connect replay: up to 500 conversations per account, runs in the background, keeps original `lastMessageAt` (sorts into date order, not to the top), emits no webhooks, stored as read; accounts with Instagram "connected tools" message access off are not replayed. Docs advise re-running the sweep (multi-tenant guide: "re-run the sweep an hour later") — https://docs.zernio.com/multi-tenant/inbox .

### 1.2 Get conversation — `GET /v1/inbox/conversations/{conversationId}`
Source: https://docs.zernio.com/messages/get-inbox-conversation
- Query `accountId` **required**.
- 200 `data`: `id, accountId, accountUsername, platform, status, participantName, participantId, participantVerifiedType, lastMessage, lastMessageAt, updatedTime, participants[{id,name}], instagramProfile, metadata` (only `meta_ad_*`; WhatsApp `ctwa_*` only via the list endpoint).
- 401, 403, 404.

### 1.3 List messages — `GET /v1/inbox/conversations/{conversationId}/messages`
Source: https://docs.zernio.com/messages/get-inbox-conversation-messages
- Path `conversationId`: opaque, accepted "verbatim from the list endpoint or from the conversationId on inbox webhooks".
- Query: `accountId` **required**; `limit` default 100, max 100; `cursor` opaque (an unparseable cursor returns **400**, never silently restarts); `sortOrder` `asc|desc`, **default `asc`** (oldest first).
- Ordering: X, Instagram, Telegram, WhatsApp, Reddit honor the order across pages; Facebook and Bluesky only reverse within a page and pages always walk newest→oldest. `sortOrderApplied` reports what was applied. "Latest messages" pattern: `?sortOrder=desc&limit=N`.
- 200 body: `status`, `pagination{hasMore, nextCursor|null}`, `sortOrderApplied` (asc|desc), `lastUpdated`, `messages[]`:
  - `id` = **the platform's own message id** (WhatsApp `wamid`, IG/Messenger `mid`); webhooks deliver the same value as `message.platformMessageId`; "this response has no field by that name".
  - `conversationId, accountId, platform`
  - **`message`** (the text), `senderId`, `senderName`, `senderVerifiedType`
  - `direction` `incoming|outgoing`, `createdAt` (date-time)
  - `attachments[]{id, type(image|video|audio|file|sticker|share|template|unsupported_type), originalType, mimeType, url, refreshUrl (IG/FB only), filename, previewUrl, payload}`
  - `subject` (Reddit), `storyReply{storyId,storyUrl}` and `isStoryMention` (Instagram), `noRenderableContent` (IG/Messenger)
  - `isEdited, editedAt, editCount, editHistory[{text,attachments,editedAt}]`, `isDeleted, deletedAt` (deleted messages keep original text/attachments)
  - `deliveryStatus` (`sent|delivered|read|failed|deleted`|null), `deliveredAt, readAt, sentAt`, `deliveryError{code:int, title, message, details (absent on SMS), href}`
  - `reactions[{emoji, fromMe, reactedAt}]` (WhatsApp/Telegram), `metadata` (e.g. `quotedMessageId`, `waInteractive`, `metaInteractive`, `interactiveType/Id`, `source`), `sentVia` (human|api|broadcast|sequence|workflow|comment_automation|bulk-api|null; null = unknown, not backfilled before 2026-08)
- Read-only; does **not** mark read or send receipts.
- Errors: 400 (canonical envelope), 401, 403, 502 upstream, 503 `temporarily_unavailable` + Retry-After.
- IG/FB replay: newest 500 messages per conversation; older not retrievable.

### 1.4 Send message (reply) — `POST /v1/inbox/conversations/{conversationId}/messages`
Source: https://docs.zernio.com/messages/send-inbox-message ; spec params include `components/parameters/IdempotencyKeyHeader`.
- Header `Idempotency-Key` optional, string maxLength 255 (see 1.12).
- JSON body: `accountId` **required**; `message` (text); `attachmentUrl` (public URL), `attachmentType` (`image|video|audio|file`, default `file`), `attachmentName` (WA docs); `voiceNote` (WA, OGG/Opus mono); `category: "utility"` (WA Direct Send, JSON only); `linkPreview` (WA/iMessage, JSON only); `quickReplies` (max 13) or `buttons` (max 3; mutually exclusive; IG/FB also exclusive with `template`); `template` (IG/FB generic template up to 10 elements; **WhatsApp: `{ "elements": [{ "name", "language", "components": [...] }] }`**, components forwarded verbatim to Meta, media-header templates must include the header component here); `interactive` (WA only; session messages, need open 24h window); `replyMarkup` (Telegram); `messagingType` (`RESPONSE|UPDATE|MESSAGE_TAG`); `messageTag` (`CONFIRMED_EVENT_UPDATE|POST_PURCHASE_UPDATE|ACCOUNT_UPDATE|HUMAN_AGENT`; **Instagram only supports `HUMAN_AGENT`**, requires `messagingType: MESSAGE_TAG`); `replyTo` (platform message id; IG/Messenger ignore it and return a `warnings` entry); `location` (WA/iMessage); `contacts` (WA); iMessage-only `subject, effect, contactCard, channel`.
- `multipart/form-data` is the route for binary file uploads; template fields and `category`/`linkPreview` are JSON-only.
- 200 body: `success`, `warnings[{code:"ignored_field", param:"replyTo", message}]`, `data{ messageId, conversationId, attachments[{type,url}], messageIds[] (FB/IG), partialFailure{part:"text", error, platformError{code,subcode,fbtraceId,type}} }`.
  - `messageId` = platform id of the sent message (WhatsApp raw `wamid`, same as `message.platformMessageId` on webhooks). Not returned for Reddit.
  - `conversationId` = Zernio conversation id; "equals the id the list-conversations endpoint returns for Telegram, WhatsApp, SMS and Slack; for Facebook, Instagram, Bluesky and Reddit that endpoint returns the platform thread id instead, so do not correlate the two by equality." May be omitted.
  - `messageIds`/`partialFailure`: FB/IG only, when an attachment **and** text were both requested (two Meta messages); 200 even if the text part failed.
- Errors: 400 (`PLATFORM_LIMITATION, MISSING_PARTICIPANT, INVALID_TEMPLATE_HEADER, DIRECT_SEND_NOT_ELIGIBLE, DIRECT_SEND_LIMITED, DIRECT_SEND_BLOCKED, platform_api_error`; WhatsApp `131056` too-many-to-recipient); 401; 403 (inbox add-on, **or Meta rejected the send outside the messaging window**: `type platform_error, code platform_api_error`); **409 same Idempotency-Key still processing**; **422 Idempotency-Key reused with a different request**; 429 (`rate_limited` + Retry-After, or WA template lookup rejected); **500 platform rejected/failed — Zernio does not retry, delivery unknown, retry may duplicate**; 502 WA template definition unavailable / upstream failure; 503 `temporarily_unavailable`; default = WA template-lookup error envelope (`details.phase: "template_lookup"`).

### 1.5 Create conversation (start new thread) — `POST /v1/inbox/conversations`
Source: https://docs.zernio.com/messages/create-inbox-conversation ; spec `createInboxConversation`.
- **Supported: X, Bluesky, Reddit, WhatsApp, SMS, Slack, iMessage. Other platforms (including Instagram and Facebook) return `PLATFORM_NOT_SUPPORTED`.**
- If a conversation with that recipient exists, the message is added to that thread. It always sends a message.
- **No `Idempotency-Key` header is documented** on this operation (spec lists none; https://docs.zernio.com/guides/idempotency does not list it).
- JSON body: `accountId` **required**; `participantId` (WhatsApp and SMS: recipient phone "in international format (digits, country code included)"; WhatsApp guide says "no `+`") or `participantUsername` (X/Bluesky/Reddit); `message` ("At least one of message, attachment, or (for WhatsApp) templateName is required"); `skipDmCheck` (X); WhatsApp: `templateName`, `templateLanguage` (e.g. `en_US`; exact approved language required), `templateParams` (flat string array: text-header vars, then body vars, then one per dynamic URL button; too few → 400 `INVALID_TEMPLATE_PARAMS`), `templateButtonParams[{index, subType, value}]`, `templateCards[{cardIndex, params[], headerMedia, ...}]`, `headerMedia{type, link|id, filename?}` (defaults to the template's approved sample asset), `headerLocation{latitude, longitude, name?, address?}`, `category: "utility"` (Direct Send, needs `message`, no `templateName`), `linkPreview`.
- `multipart/form-data` variant: `accountId, participantId, participantUsername, message, attachment` ("Media attachment (image or video). One attachment per message."). Template fields are JSON-only.
- 201: `{ success: true, data: { messageId, conversationId, participantId, participantName|null, participantUsername|null } }`. For WhatsApp `conversationId` is Zernio's internal 24-hex id and "matches the id returned by the list-conversations endpoint and the conversationId in the message.received and conversation.started webhooks".
- Errors: 400 (validation, `PLATFORM_NOT_SUPPORTED`, `PLATFORM_LIMITATION`, `TEMPLATE_REQUIRED`, `INVALID_TEMPLATE_PARAMS`, `INVALID_TEMPLATE_BUTTON_PARAM`, `INVALID_TEMPLATE_HEADER`, `INVALID_TEMPLATE_CARD_PARAM`, `DIRECT_SEND_*`, iMessage `invalid_content`); 401; 403 inbox add-on or profile limit; 404 account/recipient not found; 409 (iMessage only: `recipient_opted_out`, `recipient_must_message_first`); 422 (X/Reddit DM not allowed); 429 (X/Reddit limits, WA template lookup, iMessage `new_contact_limit`); 502 exact approved WA template unavailable (nothing sent); default = WA template lookup error.

### 1.6 Mark read — `POST /v1/inbox/conversations/{conversationId}/read`
Source: https://docs.zernio.com/messages/mark-conversation-read
- Body `{ accountId }` (required). 200 `{ success, markedCount }`. 401, 403, 404.
- Marks all unread incoming messages read. WhatsApp: also sends blue ticks, **except on coexistence accounts**. Reading messages via GET never marks read.

### 1.7 Update conversation (archive/restore) — `PUT /v1/inbox/conversations/{conversationId}`
Source: https://docs.zernio.com/messages/update-inbox-conversation (page exists)
- Body `{ accountId (required), status: "active" | "archived" (required) }`.
- 200 `{ success, data{ id, accountId, status, platform, updatedAt } }`. 401, 403, **404 "Conversation not found (WhatsApp only; other platforms upsert)"**.
- Archive is supported for SMS, WhatsApp, Instagram (DM matrix) — https://docs.zernio.com/platforms

### 1.8 Media: resolve attachment, inbound WhatsApp media, upload
- `GET /v1/inbox/conversations/{conversationId}/messages/{messageId}/attachments/{index}` — `messageId` = platform message id, `index` zero-based, `accountId` **required** (else 400 `missing_required_field`), `format=redirect` (default, 302) or `json` → `{status, url, refreshed}`. Only IG/FB re-mint; other platforms return the stored url or 404. Unsupported-type shares cannot be re-minted. https://docs.zernio.com/messages/get-message-attachment
- Inbound WhatsApp media in webhooks points to `GET /v1/whatsapp/media/{mediaId}` (Bearer required; also takes `accountId`); download on receipt, Meta drops it after a retention window then 400 permanently. https://docs.zernio.com/webhooks/inbox ; spec
- `POST /v1/media/upload-direct` (API key) → `{url, filename, contentType, size}`; public URL usable as `attachmentUrl`; max 25 MB; auto-deleted after 7 days. https://docs.zernio.com/messages/upload-media-direct

### 1.9 SMS native send — `POST /v1/sms/messages` (alternative to inbox endpoints)
Source: https://docs.zernio.com/sms/send-sms ; https://docs.zernio.com/platforms/sms/sending
- Header `Idempotency-Key` supported (same semantics).
- Body: `from` (required, one of your SMS-enabled numbers, E.164 normalized), `to` (required, E.164), `text` (≤10 segments: 1,530 GSM-7 / 670 unicode; required unless `mediaUrls`), `mediaUrls` (≤10 public URLs → MMS), `sendAt` (future ISO 8601 with offset).
- 200 `{ id, conversationId, status: "sent" }` ("accepted for delivery"). `conversationId` = inbox conversation the message threaded into.
- Errors: 400; 401; **404 no active SMS-enabled number matches `from`** (includes US numbers whose registration is not approved); **409 recipient opted out (STOP) or Idempotency-Key in flight**; 422 key reused with different body; 502 carrier-side failure.
- Opt-outs: `GET /v1/sms/opt-outs` (limit default 500, max 5,000, no cursor).

### 1.10 Accounts
- `GET /v1/accounts` — query `profileId`, `platform`, `status` (`connected|disconnected`), `includeOverLimit`, `page`+`limit` (must be sent together, else 400). 200 `{ accounts[SocialAccount], hasAnalyticsAccess, pagination? }`. `SocialAccount`: **`_id`** (not `id`), `platform` (enum includes `instagram`, `whatsapp`, **`sms`**, `phone`, `rcs`, ...), `profileId`, `username`, `displayName`, `profilePicture`, `profileUrl`, `isActive`, `needsReconnection`, `enabled`, `metadata` (WhatsApp: `qualityRating, nameStatus, messagingLimitTier, verifiedName, displayPhoneNumber, wabaId, phoneNumberId`; Instagram: `loginMethod` when facebook_login). https://docs.zernio.com/accounts/list-accounts ; spec `SocialAccount`
- `GET /v1/accounts/{accountId}/health` — 200 `{ accountId, platform, integrationLane?, username, displayName, status: healthy|warning|error, tokenStatus{valid, expiresAt, expiresIn, needsRefresh}, permissions{posting[], analytics[], optional[], canPost, canFetchAnalytics, missingRequired[]}, issues[], recommendations[], messagingRestriction (object|null; from Meta subcodes 2534122/1893063/2534029 on own sends, lags one send), platformConnection (WhatsApp only){status: connected|disconnected|unknown, checkedAt, phoneStatus, metaError, inboundWebhookSubscribed: true|false|null} }`. WhatsApp: `tokenStatus` alone is not liveness; dead Meta link → `status: error`; `inboundWebhookSubscribed:false` → issue + at least `warning`. https://docs.zernio.com/accounts/get-account-health
- `GET /v1/accounts/health` — bulk `{summary{total,healthy,warning,error,needsReconnect}, accounts[...]}`, filters `profileId`, `platform`, `status`. https://docs.zernio.com/guides/error-handling ; https://docs.zernio.com/accounts/get-all-accounts-health

### 1.11 Connect
Source: https://docs.zernio.com/connect/get-connect-url ; https://docs.zernio.com/guides/connecting-accounts
- `GET /v1/connect/{platform}` — `profileId` **required**; `redirect_url` optional but, when sent, must be absolute http(s) or a custom app scheme (relative → 400 `INVALID_REDIRECT_URL`); `headless` (bool); `loginMethod` (Instagram: `instagram_login` default, no selection step; `facebook_login` → select-account step); `onboarding` (WhatsApp: `api` | `business_app` = coexistence, **default coexistence**); `signup=hosted` (WhatsApp only, else 400) with optional `brandName`, `primaryColor`, `language` (en|es|pt-BR).
- 200 `{ authUrl, state }` (hosted: `authUrl` only). 400, 401, 402 `PAYMENT_REQUIRED` (`reason`: free_tier_exceeded | twitter_passthrough | enterprise_required | card_verification_required, `dashboard_url`), 403, 404.
- Success redirect appends `connected={platform}&profileId&accountId&username` (+ `connect_token` for API-key callers), plus `request_id` and `stage`. Failure redirect: `error` and `platform` always; `error_message, is_user_fixable, reason, dashboard_url, missing_scopes, error_reason, platform_error*` optional; list "NOT exhaustive". WhatsApp error values: `whatsapp_error, one_whatsapp_per_profile, whatsapp_number_already_connected, whatsapp_number_pinned_to_profile, whatsapp_coexistence_not_registered, connection_cancelled` (+ `session_expired`, `payment_required` on hosted). `code_already_redeemed` is not a failure (check accounts / `account.connected`).
- Instagram headless (facebook_login only): redirect carries `profileId, tempToken, platform=instagram, step=select_account, connect_token` → `GET /v1/connect/instagram/select-account?profileId&tempToken` (use `X-Connect-Token` when via API key) → `pages[{id, name, access_token, instagram_business_account{id, username, profile_picture_url}}]` → `POST /v1/connect/instagram/select-account {profileId, pageId, tempToken, redirect_url?}` → `{message, redirect_url?, account{accountId, platform:"instagram", username, displayName, profilePicture, isActive, loginMethod:"facebook_login"}}`. One Instagram account per profile; selecting a different identity **purges the previous account's conversations**. https://docs.zernio.com/connect/select-instagram-account
- WhatsApp headless (only when the WABA has ≥2 numbers): redirect `step=select_phone_number, profileId, tempToken` → `GET /v1/connect/whatsapp/select-phone-number?profileId&tempToken` → `phoneNumbers[{id, display_phone_number, verified_name, quality_rating, name_status, messaging_limit_tier, wabaId, wabaName}]` → `POST /v1/connect/whatsapp/select-phone-number {profileId, phoneNumberId, wabaId, tempToken}` → `{message, account{accountId, platform, username, displayName, isActive, selectedPhoneNumber}}`. https://docs.zernio.com/platforms/whatsapp/connection ; https://docs.zernio.com/connect/complete-whatsapp-phone-selection
- WhatsApp credentials (headless, no browser): `POST /v1/connect/whatsapp/credentials {profileId, accessToken, wabaId, phoneNumberId, pin?}`; takes over the WABA's webhook callback (your old callback stops immediately). https://docs.zernio.com/platforms/whatsapp/connection
- WhatsApp rules: one WhatsApp number per profile; Zernio-provisioned numbers are pinned to their profile (409 elsewhere); coexistence limits (20 msg/s, no groups/calls, profile photo locked, read receipts not sent on mark-read).
- SMS has no OAuth connect: provision/port a number, `POST /v1/phone-numbers/{id}/sms` (response `id` "is the account id the number sends from"; `isActive:false` on US numbers until registration approved), then register. https://docs.zernio.com/platforms/sms/registration

### 1.12 Idempotency (consolidated)
Sources: https://docs.zernio.com/guides/idempotency ; https://docs.zernio.com/messages/send-inbox-message ; spec `IdempotencyKeyHeader`, `IdempotencyKeyInFlight`, `IdempotencyKeyReused`.
- Endpoints accepting `Idempotency-Key` (inbox-relevant): **send inbox message**, **send SMS**, reply to comments, reply to review, create profile, WhatsApp/voice calls, ads create/boost. **Not listed: create inbox conversation, mark read, update conversation, webhook create.**
- Key: client-generated, ≤255 chars; retained **24 hours**; scoped to **your credential and that exact path** (same key on another path → 422).
- Same key + same body → replays the stored response with its **original status** and header **`Idempotent-Replayed: true`**; no second send.
- Same key + different body → **422**. Key still in flight → **409** ("retry after a short backoff"; no Retry-After documented for this 409 on the inbox route).
- **Only 2xx responses are stored.** Any non-2xx or thrown request releases the key, including a failure after the platform already accepted the message. For 5xx/timeouts: reconcile first (list the conversation's messages; an empty result is inconclusive). Works for JSON and multipart.
- Posts use a different system (`x-request-id` + 24 h content-hash dedup); do not apply it to inbox.

### 1.13 Other relevant endpoints seen in the index (not fetched in detail)
`GET /v1/inbox/conversations/search`, message edit/delete, reactions, typing indicator, thread-control (`POST .../thread-control` with `action: release|take`), `GET /v1/whatsapp/templates?accountId&status=APPROVED` (templates read live from Meta, one entry per name+language) — https://docs.zernio.com/platforms/whatsapp/templates ; WhatsApp sandbox (1.14).

### 1.14 WhatsApp sandbox (free test path)
Source: https://docs.zernio.com/platforms/whatsapp/sandbox
- `GET /v1/phone-numbers` → `sandbox{phoneNumber, accountId, template{name:"sandbox_start", language:"en"}, isSandbox}`.
- `POST /v1/whatsapp/sandbox/sessions {phone}` sends `sandbox_start`; the phone's owner replies → session `active` (pending TTL 24 h, active 7 days). Then `POST /v1/inbox/conversations` with sandbox `accountId`, `participantId` digits only, `templateName:"sandbox_start"`, `templateLanguage:"en"`, `templateParams:[]`; free-form replies inside the 24 h window.
- Limits: 1 test phone per user, 50 messages and 5 recipients per 24 h; free. `account.profileId` is omitted on sandbox webhooks (spec `InboxWebhookAccount`). Legacy billing → `403 INBOX_REQUIRED`.

---

## 2. Identifier map (read before coding)

| Value | REST | Webhook | Notes / source |
|---|---|---|---|
| Platform message id | list-messages `messages[].id`; send `data.messageId`; create `data.messageId` | `message.platformMessageId`; `reaction.platformMessageId` | Same value (WA `wamid`, IG `mid`). https://docs.zernio.com/messages/get-inbox-conversation-messages ; https://docs.zernio.com/webhooks/inbox |
| Zernio internal message id | not exposed on list-messages | `message.id` ("Internal message ID"); `reaction.messageId` | Do not match webhook `message.id` against REST `id`. spec `InboxWebhookMessage` |
| Message text | `messages[].message` | `message.text` (string|null) | Different field names. |
| Conversation id (internal) | send `data.conversationId`; create `data.conversationId` (WA: 24-hex internal) | `message.conversationId` and `conversation.id` on `message.*`, `reaction.*` events | spec `InboxWebhookConversation`; https://docs.zernio.com/messages/send-inbox-message |
| Conversation id (list row) | list `data[].id` | `conversation.platformConversationId` | List id = internal id for Telegram/WhatsApp/SMS/Slack, but platform thread id for FB/IG/Bluesky/Reddit (IG: participant IGSID). Both ids are accepted by all `/conversations/{id}` routes. |
| conversation.started / control_changed `conversation.id` | — | **platform conversation id** (= `platformConversationId`), NOT the internal id used on `message.*` events | spec `InboxWebhookConversationDetail`. Conflicts with the WhatsApp statement in create-conversation (see §7). |
| Account | `accountId` (REST), `_id` on `GET /v1/accounts` items | `account.id` and `account.accountId` (same), `account.profileId` (optional) | https://docs.zernio.com/webhooks/inbox ; spec `InboxWebhookAccount` |
| WhatsApp contact | `participantId` phone digits | `message.sender.id` = phone without `+` or BSUID; `sender.phoneNumber` (E.164, nullable during BSUID rollout); `sender.businessScopedUserId` = recommended primary anchor | https://docs.zernio.com/webhooks/inbox |
| Webhook event id | — | `payload.id` = `X-Zernio-Event-Id` = legacy `X-Late-Event-Id` (UUID; identical across every subscribed endpoint, retries and redeliveries) | https://docs.zernio.com/webhooks ; spec info |

---

## 3. Channel specifics

### 3.1 Support table (SMS / WhatsApp / Instagram)

| Capability | SMS | WhatsApp | Instagram |
|---|---|---|---|
| Inbox list | Yes per DM matrix (https://docs.zernio.com/platforms) and multi-tenant guide; **but** list page intro and `platform` filter enum omit `sms` → verify live | Yes (filter enum has `whatsapp`; intro list omits it) | Yes |
| Read history | Yes (matrix) | Yes | Yes (+ replay of up to 500 convs / newest 500 msgs each) |
| Reply in thread | Yes (matrix; send response documents SMS conversationId) | Yes; free-form only inside 24 h customer-service window; otherwise `template.elements[...]` or Direct Send `category:"utility"` | Yes; inside 24 h window; outside it `messagingType:"MESSAGE_TAG"` + `messageTag:"HUMAN_AGENT"` (tag window length not stated by Zernio: UNVERIFIED) |
| Start new conversation to arbitrary recipient | Yes: `POST /v1/inbox/conversations` with `participantId` phone (or `POST /v1/sms/messages` `from`/`to`) | Yes, **approved template required** (`templateName`, `templateLanguage`, `templateParams` ...) or Direct Send utility text if WABA eligible; missing → `TEMPLATE_REQUIRED` | **No** (`PLATFORM_NOT_SUPPORTED`); user must message first |
| Attachments | Yes (MMS; `mediaUrls` ≤10 on SMS API; inbox matrix Yes) | Image 5 MB, video 16 MB, document 100 MB, audio 16 MB | PNG/JPEG 8 MB; MP4/OGG/AVI/MOV/WEBM 25 MB; AAC/M4A/WAV/MP4 audio 25 MB; PDF 25 MB; no MP3/Opus |
| `message.received` | Yes (`platform:"sms"`) | Yes (standby flagged `metadata.standby:true` under Business Agent) | Yes |
| `message.sent` | **No** (sms deliberately absent) | Yes (`source`: cloud_api / whatsapp_business_app / meta_business_agent) | Yes |
| `message.delivered` | Yes | Yes | **No** |
| `message.read` | No | Yes | Yes |
| `message.failed` | Yes (carrier error code) | Yes (e.g. 131026) | **No** |
| `conversation.started` | Yes (first message of a new thread) | Yes | Yes (not for replayed history) |
| `message.edited` / `message.deleted` | No | No edits (Cloud API does not expose incoming edits); deleted: see §7 conflict | Yes / Yes (incoming unsend) |
| `reaction.received` | No | Yes | Yes (accounts connected before Aug 2026 need reconnect) |
| Mark read side effect | — | Blue ticks except coexistence | UNVERIFIED (not stated) |
| Registration / eligibility | Usage-based billing required; US numbers need approved 10DLC or toll-free before sending (send → 404 until approved); other countries send once SMS enabled | WABA connected (Embedded Signup / credentials); approved templates; payment method on WABA for template delivery; sandbox available | Business/Creator account; `instagram_business_manage_messages` (IG Login) or `instagram_manage_messages` (FB Login); Connected tools message access on |

Sources: https://docs.zernio.com/platforms ; https://docs.zernio.com/webhooks/inbox ; https://docs.zernio.com/platforms/sms ; https://docs.zernio.com/platforms/sms/sending ; https://docs.zernio.com/platforms/whatsapp/inbox ; https://docs.zernio.com/platforms/instagram ; https://docs.zernio.com/messages/create-inbox-conversation

### 3.2 SMS details
- Inbound SMS appears in the inbox ("Replies land in the same inbox") and fires `message.received` with `platform:"sms"`; first message of a new thread fires `conversation.started`; outbound outcome fires `message.delivered` or `message.failed` only. https://docs.zernio.com/platforms/sms ; https://docs.zernio.com/sms/send-sms
- US 10DLC: `POST /v1/sms/registrations` (`registrationType`: `standard_10dlc` | `sole_prop_10dlc` | `toll_free`); brand needs website, full address, phone (non-sole-prop); campaign needs use case, description, `messageFlow` with opt-in link, keywords, two samples ≥20 chars; sole-prop OTP step; asynchronous; status can drop back from `approved` to `pending`. Webhooks `sms.registration.status_updated` / `sms.registration.action_required` exist in the spec enum (not on the webhooks overview table). https://docs.zernio.com/platforms/sms/registration ; spec
- STOP → carrier opt-out; sends return 409; only START re-subscribes. https://docs.zernio.com/platforms/sms/sending
- No messaging window for SMS.

### 3.3 WhatsApp details
- 24 h customer-service window after the customer's last message; outside it (and to open) send an approved template. Meta errors: `131047` window closed, `132001` template not found (`en` ≠ `en_US`), `131026` undeliverable, `131056` per-recipient rate. https://docs.zernio.com/platforms/whatsapp/inbox ; https://docs.zernio.com/platforms/whatsapp/reference
- Create vs reply template shapes differ (flat `templateName/templateLanguage/templateParams` + automatic media header vs nested `template.elements[{name, language, components}]` with explicit header component). Zernio resolves the exact APPROVED name+language before sending; failure sends nothing (502 / `platform_api_error`, `details.phase:"template_lookup"`).
- Direct Send utility: `category:"utility"` + `message`, WABA eligibility required (`DIRECT_SEND_NOT_ELIGIBLE|LIMITED|BLOCKED`).
- Interactive messages are session-only (24 h).
- Meta Business Agent: `threadControl`, `conversation.control_changed`, `metadata.standby:true`; any send takes control back; `POST .../thread-control` `action: release|take`.

### 3.4 Instagram details
- Replies only (no create). 24 h window; `HUMAN_AGENT` tag for outside it. Quick replies (13), buttons (3), generic template carousel (10). `replyTo` ignored with a `warnings` entry. Attachment + text = two Meta messages (`messageIds`, possible `partialFailure`). https://docs.zernio.com/platforms/instagram ; https://docs.zernio.com/messages/send-inbox-message
- Delivery signals: `message.read` only (no delivered/failed). Mid-send 403 = Meta rejected outside window.
- Signed CDN attachment URLs expire; persist `refreshUrl` (REST) or reconstruct the resolve route (webhooks).

---

## 4. Webhooks

Sources: https://docs.zernio.com/webhooks ; https://docs.zernio.com/webhooks/inbox ; https://docs.zernio.com/webhooks/accounts ; https://docs.zernio.com/webhooks/create-webhook-settings ; https://docs.zernio.com/webhooks/update-webhook-settings ; https://docs.zernio.com/webhooks/get-webhook-settings ; https://docs.zernio.com/webhooks/delete-webhook-settings ; https://docs.zernio.com/webhooks/test-webhook ; https://docs.zernio.com/webhooks/get-webhook-logs ; https://docs.zernio.com/webhooks/redeliver-webhook-event ; spec.

### 4.1 Signature
- Header **`X-Zernio-Signature`** = **lowercase hex HMAC-SHA256 of the raw request body**, keyed by the `secret` you set on the subscription. Legacy alias `X-Late-Signature` (same value). No timestamp component.
- Zernio **never generates** the secret; you send it in `POST /v1/webhooks/settings`. Deliveries are signed only "when the endpoint has a `secret`".
- Official sample: 401 when signature header missing, 400 on mismatch; Node sample compares with `!==`, Python with `hmac.compare_digest` (constant-time is our choice, docs do not mandate it).
- Other delivery headers: `Content-Type: application/json`, `User-Agent: Zernio-Webhooks/1.0`, `X-Zernio-Event` (event name), `X-Zernio-Event-Id`. Optional `customHeaders` on the subscription.

### 4.2 Delivery, retries, response time
- Success = any 2xx **within 5 seconds**. At-least-once; handlers must be idempotent.
- Up to **7 attempts** total: immediate, +10 s, +1 m 40 s, +16 m 40 s, +2 h 46 m 40 s, +24 h, +24 h (≈51 h cumulative); then dead-letter queue.
- Auto-disable only when no success for 3 days AND (20 consecutive terminal failures OR failing continuously 3 days); owner emailed; re-enable with `isActive:true`.
- Logs: `GET /v1/webhooks/logs?limit&skip&status(success|failed)&event&webhookId&eventId` → `logs[{webhookId, webhookName, eventId, event, url, status, statusCode, requestPayload, responseBody, errorMessage, attemptNumber, responseTime, createdAt}]`, `pagination{total, limit, skip, pages, hasMore}`; 30-day retention.
- Redeliver: `POST /v1/webhooks/logs/redeliver {webhookId, eventId}` → byte-for-byte replay to current URL, same event id; 422 outside 30 days; 502 if your endpoint errors again.

### 4.3 Subscription management
- Create `POST /v1/webhooks/settings`: `name` (1-50, required), `url` (required), `events[]` (required, ≥1), `secret`, `isActive` (default true), `customHeaders{}`, `disabledResourceGroups[]`, **`profileIds[]`**, `accountIds[]` (both lists must match when both set; unknown id → 404 `profile_not_found` / `account_not_found`). Response **200** `{ success, webhook{ _id, name, url, events, isActive, failureCount, ... } }`. Max **50 webhooks per user**. Unscoped endpoints receive every profile's events. Docs recommend `profileIds` over `accountIds` ("an account id changes when the account is reconnected").
- List `GET /v1/webhooks/settings` → `{ webhooks[Webhook] }` (Webhook schema includes `secret`, `lastFiredAt`, `failureCount`).
- Update `PUT /v1/webhooks/settings` with `webhookId` (or deprecated `_id`) plus any fields; lists replace; empty array clears.
- Delete `DELETE /v1/webhooks/settings?webhookId=` (or deprecated `id`).
- Test `POST /v1/webhooks/test {webhookId}` → 200 `{success, message:"Test webhook sent successfully"}` or **500** `{success:false, message:"Test webhook failed"}`; sends `webhook.test` `{id, event:"webhook.test", message, timestamp}` once, synchronously, never retried, **ignores the `events` list and `profileIds`**.
- Inbox events on legacy AppSumo plans: subscription refused with `403 feature_not_available`.

### 4.4 Inbox-relevant events and payloads
Event names (spec enum): `message.received, message.sent, message.delivered, message.read, message.failed, message.edited, message.deleted, conversation.started, conversation.control_changed, reaction.received, referral.received` (+ `comment.received`, `review.*`), account events `account.connected, account.disconnected`, WhatsApp `whatsapp.template.status_updated`, SMS `sms.registration.status_updated|action_required`, and `webhook.test`.

`message.received` / `message.sent` top level: `id` (event id), `event`, `message`, `conversation`, `account`, `metadata` (received: object|null; sent: present only with context), `timestamp` (event generation time, stable across retries).
- `message`: `id` (internal), `conversationId` (internal), `platform` (received enum: instagram, facebook, telegram, whatsapp, **sms**, twitter, bluesky, reddit, slack, tiktok, imessage; sent enum excludes sms), `platformMessageId`, `direction`, **`text`** (string|null), `attachments[{type, originalType?, mimeType?, url, payload?}]` (no `refreshUrl`), `sender{id, contactId?, name?, username?, picture?, phoneNumber? (WA), businessScopedUserId? (WA), parentBusinessScopedUserId?, whatsappUsername?, instagramProfile?}` (on `message.sent` the sender is **your business account**, use `conversation.participant*`), `sentAt` (ordering key), `isRead`, `sentVia` (null on received), `source` (WA on sent).
- `conversation` (`InboxWebhookConversation`): `id` (internal), `platformConversationId` (= list row id), `participantId`, `participantName`, `participantUsername`, `participantPicture`, `status`, `contactId?`.
- `account` (`InboxWebhookAccount`): `id`, `accountId` (same), `profileId` (optional; omitted on WA sandbox), `platform`, `username`, `displayName?`.
- `message.delivered|read|failed`: `id, event, message (InboxWebhookMessage; platform enum instagram|facebook|telegram|whatsapp|sms), statusAt, error (object|null, only on failed: code/title/message), conversation, account, timestamp`.
- `conversation.started`: `id, event, conversation (InboxWebhookConversationDetail: id = platform conversation id, platform, platformConversationId, participantId, participantName, participantUsername?, participantPicture?, status, contactId?), account, startedAt, timestamp`.
- `conversation.control_changed`: `control{owner, previousOwner, metadata?}`, `changedAt`.
- `reaction.received`: `reaction{emoji ("" on some removals), action added|removed, messageId?, platformMessageId, sender, reactedAt}`.
- `account.connected|disconnected`: `account{accountId, profileId, platform, username, displayName?, disconnectionType (intentional|unintentional), reason}`; reconnect fires `account.connected` again "with the same accountId".
- Replayed IG/FB history fires neither `conversation.started` nor `message.received`.

---

## 5. Pricing that affects test sends

- Outbound message meter **starts 1 October 2026**: first 10,000 per team per month free, then $0.0001/message. Counts inbox replies on Instagram and WhatsApp (and broadcasts per recipient). **SMS excluded** (billed per segment). Receiving, reading, marking read, typing are free. Failed sends are not billed. Without a card, Zernio emails at 7,500 and the send that would pass 10,000 fails **`403 message_allowance_exceeded`**. No endpoint reports the running count. https://docs.zernio.com/pricing/messages
- SMS: from $0.008/segment (US long code); inbound free on most numbers; MMS per message; US 10DLC $9 brand one-time + $20/month campaign ($4 sole prop), reuse free; destinations outside the list are blocked. Requires usage-based billing. https://docs.zernio.com/pricing/sms ; https://docs.zernio.com/platforms/sms
- WhatsApp: in-window non-template and utility-in-window: no Meta fee; templates billed by Meta to the WABA per delivery; Zernio number from $3/month; sandbox free. Meta needs a payment method on the WABA or template delivery stops after its free tier. https://docs.zernio.com/pricing/whatsapp ; https://docs.zernio.com/platforms/whatsapp/pricing
- Connected accounts: free allowance 2 accounts; `402 PAYMENT_REQUIRED` on connect when exceeded without a card. https://docs.zernio.com/pricing ; https://docs.zernio.com/connect/get-connect-url

---

## 6. Comparison with `api-contracts.md`

Legend: AGREE / DISAGREE / PARTIAL / UNVERIFIABLE (not stated in current docs; practice or requires live test).

### Setup and connection
1. Base URL `https://zernio.com/api` + `/v1`, bearer credential — **AGREE**. spec `servers`, `bearerAuth`.
2. Never expose the key / trust browser-chosen profile or account — **UNVERIFIABLE** (sound practice; docs do say `X-Connect-Token` exists for API-key connect flows). https://docs.zernio.com/connect/get-connect-url
3. Reuse or create profile — **AGREE** (profileId required for connect). Note an extra constraint missing from the skill: **one WhatsApp number per profile and one Instagram account per profile**; a different Instagram identity on the same profile purges the previous account's conversations. https://docs.zernio.com/platforms/whatsapp/connection ; https://docs.zernio.com/connect/select-instagram-account
4. `GET /v1/connect/{platform}` requires `profileId`; `redirect_url` must be absolute — **AGREE, with nuance**: `redirect_url` is optional; when sent it must be absolute http(s) **or a custom app scheme**. https://docs.zernio.com/connect/get-connect-url
5. Hosted mode completes selection; headless may need a platform-specific selection call — **AGREE**. For Instagram the default `instagram_login` has no selection step; only `loginMethod=facebook_login` uses select-account. WhatsApp selection only when the WABA has ≥2 numbers. `signup=hosted` is a separate WhatsApp feature. Same URL.
6. Handle success and error redirects with optional details — **AGREE** (list "NOT exhaustive"; also `request_id`, `stage`).
7. Callback account IDs are not ownership proof; re-fetch server-side — **UNVERIFIABLE** (practice). Docs only say `code_already_redeemed` → check `GET /v1/accounts` / `account.connected`.
8. Keep callback tokens out of logs, clean visible URL — **UNVERIFIABLE** (practice; `tempToken`/`connect_token` do appear in the redirect URL per docs).
9. Account health path and WhatsApp `platformConnection` / inbound subscription / issues — **AGREE**. https://docs.zernio.com/accounts/get-account-health
10. "Recheck mappings after reconnect; IDs may change" — **PARTIAL / docs conflict**: https://docs.zernio.com/webhooks says an account id changes on reconnect; https://docs.zernio.com/webhooks/accounts says reconnect "carries the same accountId rather than a new one"; https://docs.zernio.com/guides/error-handling says read `GET /v1/accounts` for the current id after reconnect. Keep the skill's defensive rule.

### Baseline endpoint map
11. List `GET /v1/inbox/conversations`, follow `pagination.nextCursor`, surface `meta.failedAccounts` and `accountsSkipped` — **AGREE** (`accountsSkipped` lives under `meta`). Missing from skill: default `sortOrder=desc` by updated time, `limit` default 50 max 100, `platform` filter enum without `sms`.
12. History requires `accountId`; cursor pagination; `sortOrderApplied`; pages not universally chronological — **AGREE**. Missing: default `asc`, limit default/max 100, bad cursor → 400.
13. Reply uses `accountId` + `message`; delivery is later — **AGREE**.
14. Create: requires account + recipient/content, sends a message, initiation support differs — **AGREE**. Response is **201** (not 200).
15. Mark read `POST .../read`, history reads do not mark read — **AGREE**. Body `{accountId}`; WhatsApp blue ticks except coexistence.
16. Archive/restore via update conversation — **AGREE**; concrete contract is `PUT /v1/inbox/conversations/{id}` `{accountId, status}`; 404 only for WhatsApp, other platforms upsert. Page exists.

### Documentation discrepancy retained by the skill
17. List intro omits WhatsApp/SMS/iMessage while schema includes WhatsApp/iMessage fields and the webhook schema lists more channels — **AGREE** (still true). Additional current evidence: the list `platform` filter enum (spec) includes `whatsapp` and `imessage` but **not `sms`, `slack`, `tiktok`**; https://docs.zernio.com/platforms DM matrix marks SMS List/Fetch/Send = Yes; https://docs.zernio.com/multi-tenant/inbox says the list aggregates "Facebook, Instagram, X, Bluesky, Reddit, Telegram, WhatsApp, SMS, Slack". Whether SMS rows appear, and whether `platform=sms` is accepted or silently ignored, is **UNVERIFIED** until a live read.

### History and identity
18. Different cursor ordering across platforms; request recent explicitly; dedupe; normalize display order — **AGREE**.
19. REST `id` = webhook `message.platformMessageId`; text field names differ — **AGREE** (REST `message` vs webhook `text`). Missing: webhook `message.id` is an **internal** id with no REST counterpart; `conversation.id` on `conversation.started` is the **platform** conversation id while on `message.*` it is the **internal** id; list `data[].id` equals `conversation.platformConversationId`, and equals the internal id only for Telegram/WhatsApp/SMS/Slack.
20. IG/FB async import with limits, no message webhooks, already read — **AGREE** (500 conversations/account, newest 500 messages/conversation; also no `conversation.started`).
21. Deleted messages can keep former content — **AGREE** (`isDeleted`, content retained; `message.deleted` payload keeps text).

### Sending and retries
22. `Idempotency-Key` 24 h; replay on same request; 422 changed body; 409 in flight; only successful responses cached; ambiguous timeout/5xx can mean accepted; reconcile; empty history inconclusive — **AGREE**. Missing: max 255 chars; scoped to credential **and exact path**; replay returns original status plus `Idempotent-Replayed: true`; works for multipart; `500` on send explicitly means "Zernio does NOT retry... may deliver twice".
23. "Inspect warnings/partial failures for multipart sends" — **PARTIAL**: `partialFailure`/`messageIds` are FB/IG-only and triggered by attachment + text in one request (JSON `attachmentUrl` too), not by multipart as such; `warnings` currently only covers ignored `replyTo` on IG/Messenger.
24. Create excludes Instagram/Messenger from new-recipient initiation — **AGREE** (`PLATFORM_NOT_SUPPORTED`; supported: X, Bluesky, Reddit, WhatsApp, SMS, Slack, iMessage).
25. WhatsApp needs approved template; Direct Send utility conditional; create template fields differ from reply `template` — **AGREE**; exact approved name+language enforced before send (502 / `template_lookup` if not).
26. Do not generalize reply idempotency to other operations — **AGREE**: create conversation has **no documented** Idempotency-Key (spec and guide). SMS send does have it.

### Receiving and synchronization
27. Register with app-generated secret, supported events, profile scope; unscoped = all profiles; avoid duplicates — **AGREE** (secret optional in schema but unsigned deliveries result without it; 50 endpoints/user; docs prefer `profileIds` over `accountIds`).
28. `X-Zernio-Signature` lowercase hex HMAC-SHA256 of raw body; constant-time compare; reject missing/invalid; no timestamp scheme — **AGREE** (constant-time is stricter than the docs' Node sample; legacy `X-Late-Signature`).
29. Persist before ack within 5 s; dedupe on `payload.id` / `X-Zernio-Event-Id`; track processing state — **AGREE** (7-attempt ladder; event id identical across all subscribed endpoints).
30. Map account/profile to tenant; reconcile out-of-order and optimistic sends by platform ids — **AGREE** (`account.accountId`, `account.profileId` optional; `sentAt` is the ordering key).
31. Test delivery then a real inbound; `webhook.test` proves reachability only; logs and redelivery — **AGREE** (test ignores `events` and `profileIds`; single synchronous attempt; redeliver within 30 days).
32. Delivered/read only where supplied; SMS emits no `message.sent` — **AGREE**. For our channels: SMS delivered+failed; WhatsApp sent/delivered/read/failed; Instagram sent+read only.
33. Meta Business Agent standby/thread ownership; sending takes control — **AGREE**.
34. "Polling is acceptable when it meets the app's needs" — **PARTIAL**: docs position webhooks as the primary path ("never: poll for new messages" in https://docs.zernio.com/multi-tenant/inbox) and recommend a periodic backfill sweep only; polling must fit 60/600/1,200 req/min.

### Additional capabilities
35. Attachment resolution: keep `refreshUrl`, resolve with `accountId` and `format=json`; webhook attachments lack `refreshUrl`; unsupported shares not re-mintable — **AGREE**. Missing: inbound **WhatsApp** media is a Bearer-authenticated `GET /v1/whatsapp/media/{mediaId}` that must be downloaded on receipt (Meta retention), and only IG/FB can be re-minted.
36. Uploads: check size/type and URL visibility — **AGREE**; `POST /v1/media/upload-direct` returns a **public** URL, 25 MB max, auto-deleted after 7 days.

### Items the skill does not cover (gaps)
- SMS native send `POST /v1/sms/messages` (`from`/`to`/`text`/`mediaUrls`/`sendAt`) and its errors (404 unregistered US number, 409 STOP). https://docs.zernio.com/sms/send-sms
- US SMS 10DLC/toll-free registration requirement and fees. https://docs.zernio.com/platforms/sms/registration
- Instagram outside-window rule (`HUMAN_AGENT` tag) and 403 on Meta window rejection. https://docs.zernio.com/platforms/instagram ; https://docs.zernio.com/messages/send-inbox-message
- WhatsApp per-recipient pacing (`131056`), window/template error codes. https://docs.zernio.com/platforms/whatsapp/reference
- Message meter start 2026-10-01 and `403 message_allowance_exceeded`. https://docs.zernio.com/pricing/messages
- WhatsApp sandbox as the free test route. https://docs.zernio.com/platforms/whatsapp/sandbox
- `GET /v1/accounts` returns `_id` (not `id`); unknown query params silently ignored.

---

## 7. Internal documentation conflicts and UNVERIFIED items (resolve with live read-only tests)

1. **SMS in list conversations**: excluded by the list page intro and `platform` enum; included by the DM matrix, multi-tenant guide and send-response doc. UNVERIFIED. https://docs.zernio.com/messages/list-inbox-conversations vs https://docs.zernio.com/platforms
2. **`conversation.started` for SMS**: the inbox webhook prose lists "Instagram, Messenger, Telegram, WhatsApp, X, Reddit, Bluesky", but the SMS pages, spec info and `InboxWebhookConversationDetail.platform` enum include SMS. Treat as supported; verify. https://docs.zernio.com/webhooks/inbox vs https://docs.zernio.com/sms/send-sms
3. **WhatsApp conversation id on `conversation.started`**: schema says `conversation.id` there is the platform conversation id; create-conversation says the WhatsApp internal id matches `conversationId` on `conversation.started`. Store both `id` and `platformConversationId`. https://docs.zernio.com/messages/create-inbox-conversation vs spec `InboxWebhookConversationDetail`
4. **WhatsApp `message.deleted` direction**: "both directions" (https://docs.zernio.com/webhooks/inbox and spec info) vs "business-side" (https://docs.zernio.com/platforms) vs "an incoming `message.deleted` [is] never emitted for WhatsApp" (https://docs.zernio.com/platforms/whatsapp/inbox).
5. **Account id stability on reconnect**: see §6 item 10.
6. **Webhook profile data**: https://docs.zernio.com/multi-tenant/inbox says "Inbox payloads carry the account, not the profile", yet its own example and the schema include `account.profileId` (optional). Treat `profileId` as optional.
7. **Event id format**: documented as UUID; the multi-tenant example shows `"evt_5f8e2a1c"`. Treat as opaque string.
8. **SMS `POST /v1/sms/messages` response `id`**: "Message ID" — not stated whether internal or carrier/platform id. UNVERIFIED.
9. **SMS `participantId` format on create** (`+` or digits only): docs say "international format (digits, country code included)"; WhatsApp page says no `+`. UNVERIFIED for SMS.
10. **Instagram `HUMAN_AGENT` window length** and mark-read side effects on Instagram: not stated by Zernio. UNVERIFIED.
11. **Rate limit on inbox 409 in-flight**: no `Retry-After` documented for the Idempotency 409 on the inbox send route ("retry after a short backoff"). UNVERIFIED.
12. Changelog entries render client-side and could not be read; any change after this fetch is UNVERIFIED. https://docs.zernio.com/changelog
