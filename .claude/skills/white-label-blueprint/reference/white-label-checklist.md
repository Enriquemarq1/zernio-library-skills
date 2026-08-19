# THE WHITE-LABEL CHECKLIST — the one-pager

> White-label ≠ your logo on someone's dashboard. A logo swap is cosmetics.
> Real white-label is YOUR product on invisible infrastructure. Five checks —
> if a vendor can't give you all five, you're renting a dashboard, not
> building a product.

## ☐ 1. Embedded OAuth, your brand
Your client clicks Connect on YOUR page, approves on the platform's own
consent dialog, and lands back on YOUR page. The vendor never enters the
frame.
*Zernio: `GET /v1/connect/{platform}?headless=true&redirect_url={yours}` →
the platform's own authUrl · `POST /v1/connect/{platform}` completes it.*

## ☐ 2. One workspace per client
Client A can never see client B — enforced at the API (403), not hidden by
the UI.
*Zernio: `POST /v1/profiles` per client; accounts belong to exactly one
profile.*

## ☐ 3. Full platform capability
One request posts native to every platform, with the official APIs' depth —
per-platform captions, covers, scheduling — not a vendor's lowest common
denominator.
*Zernio: the create-post endpoint, scoped to the client's accounts.*

## ☐ 4. Webhooks
A client's token dies → a signed event hits your server → your portal flags
"reconnect needed" before the client notices a missed post.
*Zernio: `POST /v1/webhooks` — `account.disconnected`, `post.failed` —
verify `X-Zernio-Signature` (HMAC-SHA256).*

## ☐ 5. Maintenance you never touch
Token refresh, platform app reviews, API version bumps, per-platform quirks,
rate handling. All of it runs. None of it is yours.
*Zernio: there is no endpoint for this one. That's the point.*

---

**The honest limits** (know them before you commit): X (Twitter) requires a
payment method (API pass-through costs) · request rate scales with your
connected-account count · past 2,000 accounts it's an enterprise
conversation.

**The thin architecture that passes all five:** no database (the API is the
record) · no auth in the starter (put your login in front in production) ·
one tiny server (~200 lines — the key stays server-side, webhooks need a
public URL) · two pages (agency dashboard + the client's branded connect
page).

Build it: `initiation-prompt.md` → `stage-prompts.md`, one stage at a time.
Docs: https://docs.zernio.com
