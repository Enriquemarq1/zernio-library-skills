---
name: white-label-blueprint
description: "Build your own white-label social media tool on the Zernio API — the five checks: embedded OAuth under YOUR brand (headless connect), one isolated workspace per client (profiles), full-capability posting, webhooks for token health, and the maintenance you never build. Use when the user wants a branded portal/dashboard where THEIR clients connect social accounts and the app posts, monitors and reports for them — an agency tool, a SaaS feature, a client portal. Triggers: 'white label', 'build my own buffer', 'client portal for social', 'let clients connect their accounts', 'agency dashboard', 'embed social login in my app'."
---

# White-Label Blueprint — your own social media tool, one API underneath

Your brand. Their accounts. One API. The client connects Instagram on YOUR
page, under YOUR logo — and never sees the vendor.

```
YOUR PORTAL → [1 CONNECT] → [2 WORKSPACES] → [3 POST] → [4 WEBHOOKS] → [5 NOTHING]
                embedded       one per          on their    know before    the upkeep
                OAuth          client           behalf      the client     you never build
```

**The law: white-label ≠ your logo on someone's dashboard.** A logo swap is
cosmetics. Real white-label is YOUR product running on invisible
infrastructure — and it takes exactly five checks:

| # | Check | What proves it |
|---|---|---|
| 1 | Embedded OAuth, your brand | your page → the platform's own consent dialog → your page. The vendor never enters the frame. |
| 2 | One workspace per client | client B's accounts are unreachable from client A's scope — the API answers 403, not the UI. |
| 3 | Full platform capability | one request posts native everywhere, with the official APIs' depth — not a vendor's subset. |
| 4 | Webhooks | a client's token dies → a signed event hits your server → your portal flags it before the client notices. |
| 5 | Maintenance you never touch | token refresh, app reviews, API version bumps, platform quirks, rate handling — all run, none are yours. |

**Starting from zero?** Paste `reference/initiation-prompt.md` into Claude
Code in an empty folder — it scaffolds the thin portal. Then build check by
check with `reference/stage-prompts.md`, one prompt per stage, each a visible
win.

## The architecture (deliberately thin)

- **No database.** Zernio is the record: `GET /v1/profiles` lists your
  clients, accounts live under each profile, `GET /v1/posts` is the queue.
  A local `clients.json` (name → profileId) is the only state, and even that
  is optional.
- **No auth in the starter.** Each client gets an unlisted connect link. In
  production you put your existing login in front (Supabase, Clerk, whatever
  you run) — one line of honesty, zero extra stages.
- **One tiny server.** Node + Express, ~200 lines. It exists for two reasons
  only: the API key stays server-side, and webhooks need a public URL.
  Deploy anywhere that gives you a URL (Railway, Render, Fly).
- **Two pages.** The agency dashboard (clients + accounts + flags) and the
  client's branded connect page. More pages = a different project.

## The endpoints that carry each check

1. **CONNECT** — `GET /v1/connect/{platform}?profileId=…&headless=true&
   redirect_url={yours}` → returns the platform's own OAuth `authUrl`;
   `POST /v1/connect/{platform}` (code, state, profileId) completes it.
   Platforms that need a page/org selection expose selection endpoints —
   render that step under your brand too.
2. **WORKSPACES** — `POST /v1/profiles` per client. Accounts belong to
   exactly one profile; cross-profile access returns 403.
3. **POST** — the create-post endpoint, scoped to the client's accounts.
   One request, per-platform captions, native upload.
4. **WEBHOOKS** — `POST /v1/webhooks` for `account.connected`,
   `account.disconnected`, `post.failed`. Verify `X-Zernio-Signature`
   (HMAC-SHA256) before trusting a payload.
5. **NOTHING** — there is no endpoint for check 5. That's the point.

## Growing past the starter (optional depth)

The same two pages grow into a real product as tabs on each client's
workspace, still reading live from the API: the unified **inbox**
(`/v1/inbox/conversations` + comments), **analytics + a client report**
(`/v1/analytics?profileId=…`, `daily-metrics`, `best-time` — render it
printable under your brand), and the **content queue** (`/v1/posts` +
retry / edit / unpublish, scheduled posting). The prompts for all three are
in `reference/stage-prompts.md` under DEPTH STAGES.

## Honest limits (say them out loud)

X (Twitter) requires a payment method (API pass-through costs) · request
rate scales with your connected-account count · past 2,000 accounts it's an
enterprise conversation · docs: https://docs.zernio.com

## Make it look like a product — THE POLISH LOOP

A working portal isn't a product until the UI holds a SaaS bar. Paste
`reference/ui-polish-loop.md` and Claude Code runs a scored loop — screenshot
→ score 10 categories against the standard → fix → repeat — until the
dashboard passes 9+ across the board on two consecutive passes. It saves every
pass's screenshots, so you get the before/after for free.

Read `reference/white-label-checklist.md` for the checklist as a shareable
one-pager.
