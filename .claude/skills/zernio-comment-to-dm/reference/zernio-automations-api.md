# Zernio API — comment automations + inbox (skill reference)

Verified from docs.zernio.com/llms-full.txt (2026-06-02). Quote-accurate endpoint contract
for the zernio-comment-to-dm skill. If a field/endpoint isn't here, it's NOT confirmed —
check docs.zernio.com/api/openapi before relying on it.

**Auth:** `Authorization: Bearer <ZERNIO_API_KEY>`  ·  **Base URL:** `https://zernio.com/api/v1`

---

## Comment-to-DM automations (the core — native, single auto-DM per matching comment)

### Create — `POST /automations`
Body:
| field | type | req | notes |
|---|---|---|---|
| `profileId` | string | ✓ | the Zernio profile |
| `accountId` | string | ✓ | connected IG/FB account |
| `platformPostId` | string | ✓ | the post the automation watches (IG/FB post id) |
| `name` | string | ✓ | label for the automation |
| `keywords` | string | – | comma-separated trigger words; OMIT = fires on ALL comments |
| `dmMessage` | string | ✓ | the auto-DM text sent to the commenter |
| `commentReply` | string | – | public reply left on the comment (e.g. "Check your DMs 📩") |
| `isActive` | boolean | – | turn on/off |

Returns the created automation (incl. its id).

### Manage
- `GET /automations` — list all
- `GET /automations/{automationId}` — get one
- `PUT /automations/{automationId}` — update (same fields; pause via `isActive:false`)
- `DELETE /automations/{automationId}` — delete
- `GET /automations/{automationId}/logs?status=sent|failed` — delivery logs

> NOTE (verified): an automation fires ONE DM per matching comment. There is **no native
> multi-step sequence/drip** in the automations API. Multi-step = orchestrate via inbox below.

---

## Inbox & DM (for the follow-up "sequence" — developer/agent-orchestrated)

- **Send a DM:** `POST /inbox/send` → `{ "conversationId", "accountId", "message" }`
- **List conversations:** `GET /inbox/conversations?platform=&accountId=&limit=`
- **Get messages in a thread:** `GET /inbox/messages/{conversationId}?accountId=`
- **Reply to a comment (manual):** `POST /inbox/reply` → `{ "postId", "accountId", "commentId", "message" }`

### How a real SEQUENCE works (since Zernio has no native one)
1. The automation sends step-1 (the resource) when the keyword comment lands.
2. The person replies → that arrives in the inbox (`GET /inbox/conversations` / messages).
3. The host app/agent decides + sends step-2 via `POST /inbox/send` ("what's the best email?"),
   step-3 (deliver + confirm), etc. — one ask at a time, in the creator's voice.
4. To make it real-time/24-7, drive step-2+ off an inbound-reply webhook if available
   (`message.received`) — CONFIRM the webhook + payload at docs.zernio.com before building on it
   (not verified in this pass). Otherwise poll conversations.

---

## NOT verified in this pass (do not assume — check openapi first)
- `matchMode` (exact vs contains) field name — not confirmed present on `/automations`.
- The exact `message.received` webhook payload + how to register it.
- How to LIST a user's posts to get `platformPostId` via the API (may need it from the IG post URL).
