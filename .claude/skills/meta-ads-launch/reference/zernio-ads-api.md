# Zernio Ads API — contract for the meta-ads-launch skill

Verified against the LIVE OpenAPI at `docs.zernio.com/api/openapi` (2026-06-09). The live spec is
the field-level authority — the cached genome copy is STALE (no `/v1/ads`), never trust it.

**Auth:** `Authorization: Bearer <ZERNIO_API_KEY>` · **Base:** `https://zernio.com/api/v1`
**Gate:** every `/v1/ads/*` endpoint returns **403 "Ads access required"** without the Ads add-on
(included on usage-based plans, paid add-on on legacy plans).

---

## Connect (one-time) — `GET /v1/connect/{platform}/ads`

Same-token platforms (**facebook, instagram**, linkedin, pinterest): creates a dedicated ads
SocialAccount (`metaads`) with a **copied OAuth token from the parent posting account** — quote:
*"No extra OAuth needed."* If it already exists → `alreadyConnected: true`. (TikTok/X need their own
OAuth flow; Google Ads is standalone.)

## Discover the IDs
- `accountId` — the Zernio SocialAccount for ads (`GET /v1/accounts`, or the id returned by connect).
- `adAccountId` — the Meta ad account; list via `GET /v1/ads/accounts?accountId=<accountId>`
  (`accountId` query param is required — 400 without it).

---

## THE LAUNCH — `POST /v1/ads/create` (operationId `createStandaloneAd`)

Three mutually-exclusive shapes: legacy single-creative (default) · **Meta-only multi-creative via
`creatives[]`** (the hero: 1 campaign + 1 ad set + N ads) · Meta-only attach via `adSetId` (add one
ad to an existing ad set; budget/targeting/goal/bid inherited — passing `bidStrategy` there = 400).

**Required top-level:** `accountId`, `adAccountId`, `name`.

| field | notes |
|---|---|
| `name` | base name; campaign defaults to `<name> - Campaign`, ad set `<name> - Ad Set` (override via `campaignName` / `adSetName` / `adName`) |
| `goal` | **required** (legacy + multi-creative). enum: `engagement, traffic, awareness, video_views, lead_generation, lead_conversion, conversions, app_promotion`. `lead_generation` = instant forms (`leadGenFormId`, optional `promotedObject.pageId` auto-filled); `lead_conversion`/`conversions` need `promotedObject.pixelId` + `customEventType` (leads-class vs commerce-class events — Meta gates by objective) |
| `optimizationGoal` | Meta-only override of the ad-set optimization_goal (e.g. `LANDING_PAGE_VIEWS`); default derived from `goal` (`traffic` → `LINK_CLICKS`) |
| `budgetAmount` + `budgetType` | **required** (legacy + multi-creative). `budgetType`: `daily` \| `lifetime`; `endDate` required for lifetime |
| `budgetLevel` | `adset` (default, ABO) \| `campaign` (CBO — budget + bidStrategy move to the campaign) |
| `tracking` | `{ pixelId, urlTags:[{key,value}] }` — pixel measurement + UTM click tags, applied to every ad |
| targeting | `countries:[]` (ISO-2, defaults `['US']`), `cities:[{key,radius,distance_unit}]` (look up keys via `GET /v1/ads/targeting/search?type=city&q=<name>&country_code=<ISO>`; city+same-country overlap = error), `ageMin` (13–65), `ageMax`, `interests`, … |

### `creatives[]` — the multi-creative shape (Meta-only, THE point)
> *"When present, switches to the multi-creative shape: creates 1 campaign + 1 ad set + N ads (one
> per entry here)."* `minItems: 1`, **no maxItems** — 4, 10, whatever. Top-level
> headline/body/imageUrl/linkUrl/callToAction are ignored in this mode. Mutually exclusive w/ `adSetId`.

Each entry — **required:** `headline`, `body`, `linkUrl`, `callToAction`; plus **exactly one** of
`imageUrl` OR `video:{url, thumbnailUrl}`; optional `name` (falls back to `<name> #N`).
`callToAction` enum: `LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, CONTACT_US, DOWNLOAD, GET_OFFER,
GET_QUOTE, SUBSCRIBE, WATCH_MORE`.

### Idempotency (use it — create is NOT naturally idempotent)
Blind retry = a second campaign/ad set/ads. Send an **`Idempotency-Key` header** (e.g. a UUID):
same key + same body replays the original response (`Idempotent-Replayed: true`); same key +
different body → 422; key still in flight → 409 (back off). Keys scoped to your credential, 24h.

### ⚠️ No paused-on-create
There is **no `status` field** in the create body — the ad launches in its default delivery state.
**To not spend: immediately pause the campaign (next section).** Launch → pause = the $0 demo flow.

---

## Pause / resume — `PUT /v1/ads/campaigns/{campaignId}/status`

Body: `{ "status": "active" | "paused", "platform": "facebook" }`. One platform call — status
cascades through the whole hierarchy (campaign → ad set → ads). Terminal-status ads (rejected/
completed/cancelled) auto-skipped. Response: `{ updated, skipped, skippedReasons[], message }`.
Also: `…/campaigns/bulk-status`, per-ad-set status, per-ad update.

## Verify / read back
- `GET /v1/ads/campaigns` — list campaigns (`{campaigns:[], pagination}`)
- `GET /v1/ads/tree` — the campaign → ad set → ads hierarchy in one call
- `GET /v1/ads/timeline`, `GET /v1/ads/{adId}` — detail views

## Lead capture (the funnel beat)
- `POST /v1/ads/lead-forms` → create instant form; use `goal: lead_generation` + `leadGenFormId`.
- `GET /v1/ads/leads` — *"persisted Meta Lead Gen leads… ingested in real time from the leadgen
  webhook"*; `lead.received` webhook carries `adId`, `campaignId`, `fields`.
- `POST /v1/ads/ctwa` — click-to-WhatsApp ads (supports `creatives[]` too). **CTWA creates AND
  activates in one call** — it cannot launch paused; budget-cap it deliberately.
- Follow-up = Sequences (`/v1/sequences`) / Workflows — pre-built drips, not AI-composed answers.
- Comment-to-DM automations are **organic-only** — the docs do not support them firing on ad
  dark-post comments. Don't claim it.

## Errors (surface verbatim, don't blind-retry)
**401** bad key · **403** Ads add-on missing (or account access) · **400** invalid input (check
required fields, creative entry shape, city/country overlap) · **404** campaign/ad set not found ·
**409** idempotency key in flight · **422** idempotency key reused with a different body.
