# Initiation prompt — empty folder → the thin white-label portal

> Paste this into Claude Code in an empty folder. Prereqs: Node installed,
> your Zernio API key ready (never paste the key in the chat — it goes in
> `.env`). Then continue with `stage-prompts.md`, one stage at a time.

```
Build a minimal white-label social media portal for my agency (pick a neutral
placeholder brand name and one accent color I can change later). Node +
Express, server-rendered HTML, no React, no build step, no database — keep
the whole thing under ~200 lines across a few files.

Pages:
1. "/" — the AGENCY dashboard: list of clients (from a local clients.json:
   name + zernio profileId), an "Add client" form, and under each client the
   social accounts connected to their workspace (fetched live from the Zernio
   API: GET https://api.zernio.com/v1/profiles and its accounts) plus a
   copyable link to that client's connect page.
2. "/c/:profileId/connect" — the CLIENT-facing connect page: MY branding
   only, buttons to connect Instagram, TikTok and LinkedIn, and the list of
   accounts already connected in that client's workspace.

The Zernio API key lives in .env as ZERNIO_API_KEY and is only ever used
server-side (Authorization: Bearer). BASE_URL in .env too. Clean, minimal,
readable code. Start the server on port 3000 and show me both pages working.
```
