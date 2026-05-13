---
name: zernio-publish
description: "Ship a content piece to one or many of 13 social platforms through Zernio. Handles media upload, per-platform post bodies, scheduled posting, verification, and logging. Use when the user wants to publish, post, ship, schedule, or distribute content."
---

# zernio-publish

This skill is knowledge about Zernio — endpoints, platform quirks, gotchas — for when you're shipping content for a user. You're the agent doing the shipping. The skill is your reference.

Platforms covered: YouTube, Instagram, TikTok, LinkedIn, X/Twitter, Threads, Facebook, Pinterest, Bluesky, Reddit, Snapchat, Telegram, Google Business.

## How this works in practice

The user tells you what to ship and where, in whatever form is natural — a sentence, a folder, a Drive link, a caption pasted in chat. You gather:

- **What they want to say** — captions, titles, hashtags, first comments. From the user, in chat or in a file they pointed at. You write nothing they didn't give you.
- **What media to ship** — a video file, an image, a carousel. On disk by the time you POST. If they gave you a Drive link or a URL, download it with `curl -L` or your Drive tools. Files over 50 MB need the external-storage fallback (`reference/zernio-upload.md`) because of Zernio's CRC32 bug.
- **Which platforms** — they tell you. You resolve each platform's `accountId` at runtime via `GET /v1/accounts`. If a platform isn't connected in Zernio, the API tells you, and you tell the user (so they can connect it in the Zernio dashboard).
- **The API key** — `$ZERNIO_API_KEY` env var, or auto-source `.env` at the project root if the value isn't the placeholder `zk_replace_with_your_real_key`. On claude.ai web (no shell), ask the user once to paste it.

You assemble all of this into a Zernio POST body internally — see `reference/zernio-post.md` for the exact shape and the 10 field placement rules. The user doesn't need to write JSON.

## The flow that works

**CHECK** — Confirm quietly what you have. If one critical thing is missing (caption, media, key), ask about that one thing. Don't list everything that isn't ready.

**UPLOAD** — For each media file: presign with `/v1/media/presign` (lowercase `filename` / `contentType` in the body), PUT with `--tls-max 1.2`, HEAD-verify the public URL returns 200. JPEG thumbnails only — convert PNGs with `ffmpeg -i thumb.png -q:v 2 thumb.jpg`. See `reference/zernio-upload.md` for the full flow + the >50 MB workaround.

**BUILD** — Assemble the POST body. The 10 placement rules in `reference/zernio-post.md` are mistakes that silently break the post — get them right: top-level `content` is the caption everywhere; `platformSpecificData` is flat per platform (not nested under platform name); `tags` is a comma-separated string (not JSON array); `thumbnail` is a plain URL string (not an object); `firstComment` must be in the create call (cannot be added after).

**APPROVE** — Show the user the full package: platforms, schedule, the caption preview per platform, media URLs, first comment. Wait for an explicit OK — "ship it," "post," "approved." If they ask for changes, apply them and re-show the package. Silence is never approval.

**POST** — `POST https://zernio.com/api/v1/posts` with the body. Use `scheduledFor` 2-3 minutes ahead for any multi-platform post. Never `publishNow: true` for multi-platform — it causes 30-second response times and duplicate posts.

**VERIFY** — After `scheduledFor + 60s`, hit the destination platform directly:
- YouTube → `GET https://www.youtube.com/oembed?url={video_url}&format=json` to confirm title and thumbnail rendered
- Others → HEAD the public URL with `curl -I`; 200 is a soft success

If a field dropped (YouTube routinely strips title/tags/thumbnail silently), name the field and tell the user. Don't report success on a post that didn't fully land.

**LOG** — Write `./posts/YYYY-MM-DD-{slug}.json` with the full Zernio response + per-platform verification verdict + ISO timestamp.

## What this skill doesn't do (but you might still help with)

Some things this skill isn't about, but you're still a Claude Code agent — use your other tools:

- **Render a video from images.** Not Zernio's job, but `ffmpeg` is probably installed. Suggest the command, or run it yourself if the user wants you to.
  ```bash
  ffmpeg -framerate 1/4 -i "slide_%02d.jpg" -c:v libx264 \
    -vf "scale=1080:1920,setsar=1" -pix_fmt yuv420p -r 30 out.mp4
  ```
- **Download media from a URL or Drive link.** Use `curl -L "<url>" -o file.ext`. For Drive, the share link can be converted to a direct download: `https://drive.google.com/uc?export=download&id=<FILE_ID>`.
- **Write captions.** You don't invent them from nothing — but if the user said "make it about X," you can draft from what they said, show them, ask for edits. They give you the words; you arrange them.

What you genuinely can't do without the user: connect a new Zernio account (that's in the Zernio dashboard at zernio.com), get a Zernio API key (also dashboard), or read their private Drive folder without authentication or a shared link.

## Hard rules — internalize them, don't quote them at the user

- Never publish without an explicit human "ship it."
- Always verify after posting. Zernio 200 OK ≠ landed.
- `scheduledFor` 2-3 min ahead. Never `publishNow` for multi-platform.
- Zernio only. Never reach for Late MCP, Buffer, Hootsuite, n8n, or any alternative.
- You write nothing the user didn't say. Captions / titles / tags / thumbnails come from them — by chat, file, or pointer. If something's genuinely missing, ask about that ONE thing.

## Reference depth (when you need it)

| File | When |
|------|------|
| `reference/zernio-api.md` | You need the endpoint list, auth model, or `/accounts` shape |
| `reference/zernio-upload.md` | Media upload — presign mechanics, the >50 MB CRC32 workaround |
| `reference/zernio-post.md` | The POST body shape and the 10 field placement rules |
| `reference/principles.md` | The full verification protocol + anti-patterns |
| `reference/platforms.md` | The 13-platform capability matrix |
| `reference/platforms/{platform}.md` | Per-platform quirks for one specific platform |
| `reference/zernio-openapi.yaml` | The 17K-line OpenAPI spec — source of truth if anything else disagrees |
