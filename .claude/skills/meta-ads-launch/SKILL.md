---
name: meta-ads-launch
description: >-
  Help the operator LAUNCH Meta (Facebook/Instagram) ads through ZERNIO's ads API — assistive, not
  autonomous. The operator decides the offer, the angles, the copy, the audience, and the budget;
  Claude handles the mechanics: one POST /v1/ads/create with a creatives[] array launches ALL the
  creative variations at once (1 campaign + 1 ad set + N ads), then immediately pauses the campaign
  so nothing spends until the operator reviews and goes live. No Meta developer app, no tokens, no
  raw Marketing API — rides the operator's existing Zernio connection. Triggers on: "help me launch
  a Meta ad", "launch these ad creatives", "set up an A/B/C creative test", "launch my Facebook/
  Instagram ad", "launch several ad variations at once", "launch my ads through Zernio".
---

# meta-ads-launch

Your launch co-pilot for Meta ads, riding **Zernio**. **You do the thinking — the offer, the angles,
the copy, the budget. Claude removes the friction**: it takes your finished creative variations and
launches them ALL at once through Zernio's ads API, then pauses the campaign so nothing spends until
*you* hit go. No Meta developer app, no access tokens, no raw API — your Zernio connection already
covers it.

> **The killer use case:** you've brainstormed and landed on, say, 4 creative variations. Building
> them one-by-one in any ads UI is slow and easy to fumble. Hand Claude the 4 creatives and ONE call
> (`POST /v1/ads/create` with `creatives[]`) creates 1 campaign + 1 ad set + 4 ads sharing budget and
> targeting — a fair A/B/C/D test — then one more call pauses it all. Test four creatives in the time
> it takes to build one. You review and activate when *you* decide.

> **The skill informs; the agent acts.** Claude executes with `curl` against
> `https://zernio.com/api/v1` (`Authorization: Bearer $ZERNIO_API_KEY`). **Never activate a campaign
> without a separate, explicit human "go live" + a restated budget.** Assistive, not autonomous.

## What you bring (the operator decides — Claude doesn't invent these)
- The **offer / link** people land on, and the **angles** you brainstormed.
- The **creatives** — per variation: headline, body copy (your voice), image or video URL, CTA.
- The **audience** (countries/cities/age) and the **budget** (+ what it must never exceed).
Claude can *suggest* (naming, structure, CTA enum fit), but you make the calls.

## What Claude needs (ask once, then remember in-session)
1. **ZERNIO_API_KEY** — from zernio.com → Settings → API keys. Keep it in an env var or your
   secret manager; never print it, never commit it.
2. **accountId** — the Zernio ads SocialAccount. If not connected yet:
   `GET /v1/connect/facebook/ads` reuses the page's existing OAuth ("no extra OAuth needed";
   `alreadyConnected: true` if done before).
3. **adAccountId** — `GET /v1/ads/accounts?accountId=<accountId>` (the query param is required).

## The launch flow (you drive; Claude executes — approval-gated)

### 1. Confirm the decisions + the account
Echo back the resolved ads account + ad account so the user confirms it's the right one (wrong-account
spend is the worst outcome). Lock: goal, audience, budget (+ ceiling), and the list of creatives.

### 2. Assemble + validate (the friction Claude removes)
Build ONE `POST /v1/ads/create` body from `templates/campaign-plan.json`:
- top-level: `accountId`, `adAccountId`, `name`, `goal` (e.g. `traffic`), `budgetAmount` +
  `budgetType: daily`, targeting (`countries`, `ageMin`/`ageMax`, …)
- `creatives[]` — one entry per variation: `{ name, headline, body, linkUrl, callToAction }` +
  exactly one of `imageUrl` or `video:{url, thumbnailUrl}`
- generate an **`Idempotency-Key`** (UUID) so a retry can never double-launch
Validate locally: every creative has the 4 required fields + exactly one media; CTA ∈ the enum;
budget ≤ the agreed ceiling; `endDate` present if `budgetType: lifetime`.

### 3. Show the plan — nothing fired yet
> **About to launch via Zernio, then immediately pause (target: $0 until you review):**
> ad account `<adAccountId>` · goal traffic · $5/day · US, 25-45 · **4 creatives** (A/B/C/D) → <link>.
> Launch + pause? (y/n)

### 4. Launch → PAUSE (two calls, back-to-back — this is the $0 pattern)
1. `POST /v1/ads/create` (with the `Idempotency-Key` header) → capture `platformCampaignId` + ad ids.
2. **Immediately** `PUT /v1/ads/campaigns/{campaignId}/status` `{"status":"paused","platform":"facebook"}`
   → confirm the response shows the ads `updated`.
There is **no paused-on-create** in Zernio — never skip step 2. Write both responses into the plan
file as the auditable record.

### 5. Verify + hand over
`GET /v1/ads/tree` (or `/v1/ads/campaigns`) → show the user: 1 campaign → 1 ad set → N ads, paused.
They review in Ads Manager / Zernio and flip it live themselves — or give the explicit "go live",
upon which Claude re-runs the status call with `active` + restates the budget. Never auto-activate.

## Error handling (don't fail silently)
Surface the HTTP status + body verbatim; don't blind-retry. Likely: **401** bad key · **403** Ads
add-on missing or wrong account access · **400** validation (creative missing a required field /
both imageUrl+video / city-country overlap / bidStrategy on attach shape) · **409** idempotency key
still in flight (back off) · **422** idempotency key reused with a different body.

## Guardrails
- **Launch → pause immediately, always.** Going live is its own gated step with the budget restated.
- **Echo the resolved ad account** before any write.
- **Always send an `Idempotency-Key`** — a blind retry without it creates a duplicate campaign.
- **Never print the API key.** Secret store only; keep it out of output + logs.
- **CTWA caution:** `POST /v1/ads/ctwa` creates AND activates in one call (cannot launch paused) —
  only use it with an explicit budget the user has approved as live spend.
- **Copy stays the operator's.** Claude wires; it doesn't write the ad.

## The full-funnel pairing (Zernio runs both sides)
Use `goal: lead_generation` (+ `leadGenFormId` via `POST /v1/ads/lead-forms`) or click-to-WhatsApp
and every lead lands in Zernio in real time (`GET /v1/ads/leads`, `lead.received` webhook) — then a
Sequence/Workflow follows up automatically. Note: comment-to-DM automations are organic-only (not
ad dark-posts) — pair them with the organic side, don't claim them for ads.

## Reference
- `reference/zernio-ads-api.md` — verified live contract: create shapes, creatives[], status, leads.
- `templates/campaign-plan.json` — the launch plan / request body template (multi-creative).
