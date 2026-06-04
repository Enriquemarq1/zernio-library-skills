---
name: zernio-comment-to-dm
description: >-
  Build Instagram/Facebook comment-to-DM automations through the Zernio API on command.
  Tell Claude a post, a keyword, and the message — Claude creates the comment automation
  (and orchestrates a short follow-up DM "sequence") via Zernio, so you never click through
  a dashboard or clone workflows. Reuse it for any new post or keyword in seconds. Triggers
  on: "set up a comment to DM", "new keyword automation", "when someone comments X DM them",
  "build a comment trigger", "make a Zernio comment automation", "comment-to-DM sequence".
---

# zernio-comment-to-dm

Turn a comment section into captured leads. When someone comments your **keyword** on a
post, Zernio auto-DMs them — and this skill lets you set that up just by *asking Claude*,
for any post or keyword, in seconds. No dashboard clicking, no cloning workflows.

> **The skill informs; the agent acts.** This file gives Claude the Zernio API contract +
> the recipe. Claude executes with `curl` (or the user's HTTP tool). Always confirm with the
> user before creating/activating an automation (it goes live on a real audience).

## What you can ask
- "When someone comments **GUIDE** on my latest post, DM them my free template link."
- "New automation: post `<id>`, keyword **PRICING**, DM the pricing + ask if they want a call."
- "Pause / update / delete the **GUIDE** automation."
- "Walk a short sequence: DM them the resource, then if they reply, ask for their email."

## What Claude needs (ask the user once, then remember in-session)
1. **ZERNIO_API_KEY** — `Authorization: Bearer <key>` (zernio.com → Settings → API keys).
2. **profileId** + **accountId** — the Zernio profile + connected IG/FB account
   (`GET /profiles`, `GET /accounts` if unknown).
3. **platformPostId** — the post the automation watches (the IG/FB post ID).
4. **keyword(s)**, the **DM message**, optional **public comment reply**.

## The recipe (Claude follows this)

### 1. Create the comment automation (the core — native, one call)
```bash
curl -s -X POST "https://zernio.com/api/v1/automations" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "profileId": "<profileId>",
    "accountId": "<accountId>",
    "platformPostId": "<platformPostId>",
    "name": "GUIDE — free template",
    "keywords": "GUIDE",
    "dmMessage": "Hey! Here is the free template you asked for 👇 [link]. Want me to walk you through it?",
    "commentReply": "Check your DMs 📩",
    "isActive": true
  }'
```
Returns the automation id. From now on, every comment matching the keyword auto-DMs.

### 2. Reuse for a NEW post / keyword (the whole point)
Just change `platformPostId`, `keywords`, `name`, `dmMessage` and POST again. Claude can do
this from one sentence — "same thing but keyword PRICING on post <id>, DM the pricing." No
cloning, no dashboard. Manage them: `GET /automations`, `PUT /automations/{id}` (pause via
`isActive:false`), `DELETE /automations/{id}`, logs via `GET /automations/{id}/logs?status=sent`.

### 3. The "sequence" (follow-up DMs — Claude-orchestrated)
Zernio's automation sends ONE DM per matching comment (no native multi-step sequence). For a
real sequence, the host app/agent watches the conversation and sends follow-ups:
- New replies arrive via the inbox (`GET /inbox/conversations`, `GET /inbox/messages/{conversationId}`).
- Send the next step: `POST /inbox/send` `{ "conversationId", "accountId", "message" }`.
- e.g. step 1 = the resource (the automation's dmMessage), step 2 (after they reply) = "great
  — what's the best email to send the full thing to?", step 3 = deliver + confirm.
Claude composes each step in the creator's voice; keep it short, one ask at a time.

## Guardrails
- **Confirm before going live.** Show the user the keyword + DM + reply, get a yes, then POST.
- **Never print the API key.** It lives in env/the user's secret store.
- **One keyword per automation** (keeps it intentional); create separate automations for
  separate keywords/posts.
- **Voice:** warm, direct, human, no spam. The DM should sound like the creator.

## Reference
- `reference/zernio-automations-api.md` — full endpoint contract (verified from docs.zernio.com).
- `templates/automation.json` — copy-paste body for a new comment automation.
