# The stage prompts — one paste per check, each a visible win

> Run `initiation-prompt.md` first (the scaffold). Then paste these ONE AT A
> TIME into the same Claude Code session. Each stage ends with something you
> can see working before you move on. Docs the session can read:
> https://docs.zernio.com

## STAGE 1 · CHECK 1 — the embedded connect flow

```
Wire the Connect buttons to Zernio's embedded OAuth so my client never sees
the vendor:

1. The button hits our server route GET /connect/:profileId/:platform, which
   calls GET https://api.zernio.com/v1/connect/{platform}?profileId=...&
   headless=true&redirect_url={BASE_URL}/callback/{platform} with the bearer
   key, then redirects the browser to the returned authUrl (the platform's
   own OAuth dialog).
2. Our GET /callback/:platform route receives the OAuth params on the
   redirect and completes the connection with POST https://api.zernio.com/
   v1/connect/{platform} (code, state, profileId), then sends the client back
   to their connect page showing the new account with a success banner.
3. If a platform returns selection data instead of a finished account (some
   need a page/org selection), render a minimal branded selection step using
   the platform's selection endpoint from the docs.

Keep every page on MY brand — at no point may the client see Zernio's name
or UI. Then walk me through the flow once so I can run it with a test
account.
```

## STAGE 2 · CHECK 2 — one workspace per client

```
Make client isolation visible:

1. "Add client" on the dashboard creates a real Zernio profile via
   POST https://api.zernio.com/v1/profiles (name = client name, pick a
   color), stores name + profileId in clients.json, and renders the new
   workspace.
2. Each client's row shows ONLY the accounts inside their own profile.
3. Add a tiny "prove isolation" dev route: it deliberately requests client
   B's accounts while scoped to client A's profile and renders the API's 403
   response raw on screen — I want to SEE the boundary.

Keep it minimal. Show me the dashboard with two clients and the 403 proof.
```

## STAGE 3 · CHECK 3 — post on their behalf

```
Add posting from the agency dashboard:

1. Under each client: a small "New post" box — text field, optional image
   URL, checkboxes for that client's connected platforms.
2. Submit calls Zernio's create-post endpoint (read the docs at
   https://docs.zernio.com — one request, content + platforms + that
   client's accountIds/profile scope) server-side with the bearer key.
3. Render the API response (post id + per-platform status) under the box,
   and add a "scheduled/published" chip per platform.

One request per post, scoped to the client's workspace. Show me a post going
out on a test client across two platforms.
```

## STAGE 4 · CHECK 4 — webhooks: know before the client does

```
Add token-health monitoring via Zernio webhooks:

1. POST https://api.zernio.com/v1/webhooks (server-side, on boot or via a
   one-off setup script) registering {BASE_URL}/webhooks/zernio for the
   events account.connected, account.disconnected, post.failed.
2. Our POST /webhooks/zernio route verifies the X-Zernio-Signature
   HMAC-SHA256 header against WEBHOOK_SECRET from .env, stores the last
   events in memory, and when an account.disconnected arrives, the dashboard
   shows a "reconnect needed" flag on that client's account with a one-click
   link to their branded connect page.
3. Add a small "recent events" panel on the dashboard (event type + client +
   time) so the webhook traffic is visible.

Read the webhook payload shapes at https://docs.zernio.com. Show me the flag
appearing when I disconnect a test account.
```

## STAGE 5 · CHECK 5 — the tour of what you never built

```
No new features. Give me a tour of the codebase:

1. Count the total lines of code across the project (excluding node_modules)
   and print the number big.
2. List what this portal does NOT contain even though it runs a multi-client
   social platform: no token refresh jobs, no per-platform SDKs, no OAuth app
   registrations, no API version handling, no rate-limit bookkeeping — point
   at where each WOULD live if we had built it ourselves.
3. Print the final file tree.
```

## STAGE 6 · Deploy

```
Deploy this portal to my host (Railway/Render/Fly — I'll say which):

1. Add a start script and PORT handling. .env stays out of git — set
   ZERNIO_API_KEY, BASE_URL (the public URL) and WEBHOOK_SECRET as host
   variables.
2. Deploy, then update the Zernio webhook registration to the public URL.
3. Smoke-test live: open the client connect page on the public URL, run one
   connect, confirm the webhook lands.
```

---

# DEPTH STAGES — grow the starter into a product (optional)

Same two pages, new tabs per client workspace. Still no database — every tab
reads live from the API scoped to that client's profileId.

## STAGE 7 · MESSAGING — the unified inbox tab

```
Add an "Inbox" tab to each client's workspace, powered by Zernio's unified
inbox API (docs at https://docs.zernio.com):

1. GET https://api.zernio.com/v1/inbox/conversations filtered to that
   client's accounts — render the conversation list (platform icon,
   participant, last message, unread state).
2. Clicking a conversation loads its messages via GET /v1/inbox/
   conversations/{conversationId}/messages and shows a reply box that sends
   through POST on the same route, then marks it read via the /read endpoint.
3. A second sub-tab "Comments" lists post comments via GET /v1/inbox/comments
   (per client account), each with a reply box.

One inbox for DMs and comments across every platform the client connected —
all under MY brand.
```

## STAGE 8 · ANALYTICS + the client report

```
Add an "Analytics" tab to each client's workspace, scoped by profileId:

1. Overview: GET https://api.zernio.com/v1/analytics?profileId={id} — render
   the overview stats + the recent posts table (per-post metrics per
   platform).
2. Trend: GET /v1/analytics/daily-metrics for the last 30 days — one simple
   line chart (inline SVG, no build step).
3. A "Best time to post" card from GET /v1/analytics/best-time.
4. A "Download report" button that renders the same data as a clean printable
   HTML report page — the report I send to my client, under MY brand.

Everything read live from the API — no local storage.
```

## STAGE 9 · CONTENT — the queue tab

```
Add a "Content" tab to each client's workspace — the posting queue:

1. GET https://api.zernio.com/v1/posts filtered to the client's profile —
   render three groups: scheduled (with countdown), published (with
   per-platform status chips), failed.
2. Row actions wired to the real endpoints: retry a failed post
   (POST /v1/posts/{postId}/retry), edit a scheduled one (/edit), unpublish
   (/unpublish), delete.
3. Move the "New post" box into this tab and add a datetime picker for
   scheduling (scheduledDate on the create call).

The agency queues a week of content per client from one screen.
```
