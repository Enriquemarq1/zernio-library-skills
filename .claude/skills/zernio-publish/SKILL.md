---
name: zernio-publish
description: "Ship a content piece to one or many of 13 social platforms through Zernio. Handles media upload, per-platform post bodies, scheduled posting, verification, and logging. Use when the user wants to publish, post, ship, schedule, or distribute content."
---

# Skill: zernio-publish

This skill is **support material** for shipping content via Zernio. You — the agent — are the actor. Read what's useful here, adapt to the user's situation, and use your judgment.

The skill covers 13 platforms: YouTube, Instagram, TikTok, LinkedIn, X/Twitter, Threads, Facebook, Pinterest, Bluesky, Reddit, Snapchat, Telegram, Google Business.

---

## Hard rules — never break these

1. **Never publish without explicit human approval.** Show the package (platforms, schedule, captions, media). Wait for "ship it" / "post" / "approved." Silence is not approval. There's no `--yes` flag, no env bypass.
2. **Always verify after posting.** Zernio's 200 OK means the request was accepted, not that the destination platform rendered your fields. YouTube routinely drops title/tags/thumbnail silently. Hit oEmbed / the public URL / per-platform APIs to confirm.
3. **`scheduledFor` 2-3 min ahead for multi-platform.** Never `publishNow: true` for multi-platform — it causes 30-second response times and duplicate posts.
4. **Zernio only.** Never reach for Late MCP, Buffer, Hootsuite, n8n, or any alternative.
5. **The manifest (whether you assemble it from chat or read it from disk) is the source of truth for the content.** Don't invent captions, titles, tags, or thumbnails. If a platform's required field is missing, name the field and the platform, ask the user.

Everything else is judgment.

---

## What you have to work with

**Inputs the user might give you:**

- A path to a `manifest.json` (structured input)
- A chat message describing what to post, where, when
- A messy mix — caption pasted in chat, media file path, "post this to LinkedIn and Twitter"
- Nothing — they typed `/zernio-post` cold

Whatever shape it's in, assemble what you need to make the Zernio API call. The manifest is an internal data structure — you can build it from chat. If the user has one, use it. If not, ask for the pieces you need.

**Tools / files:**

- `templates/manifest.json` — the schema with inline help, useful as a reference
- `examples/sample-post.json` — a worked example
- `reference/zernio-api.md` — endpoints, auth, account model
- `reference/zernio-upload.md` — presign → PUT → HEAD, the 50 MB CRC32 workaround
- `reference/zernio-post.md` — POST body shape, 10 field placement rules
- `reference/platforms/{platform}.md` — per-platform deep dives (13 files)
- `reference/platforms.md` — capability matrix across all 13
- `reference/zernio-openapi.yaml` — canonical 17K-line OpenAPI spec (source of truth if other docs disagree)

---

## API key

The key never lives in this skill, the manifest, or any committed file. Resolution differs by runtime:

- **Claude Code CLI:** `$ZERNIO_API_KEY` env var, or source `.env` at the project root if present and the value isn't the placeholder `zk_replace_with_your_real_key`. Get one at https://zernio.com/dashboard/api-keys.
- **Claude.ai web:** ask the user to paste the key in chat at the start; hold it in conversation memory; never echo it back; never write it to a file.

If the key isn't resolvable, ask once, kindly. Don't list it as a blocker.

---

## Suggested flow (adapt as needed)

This is a flow that works — not a script you must execute. Adapt to the user's situation.

**CHECK** — Do you know what they want to ship and where? Do you have media on disk (or a public URL)? Do you have the API key? Have you resolved `accountId` per platform via `GET /v1/accounts`?

**UPLOAD** — Presign + PUT + HEAD-verify each media file. Files >50 MB need the external-storage fallback (see `reference/zernio-upload.md` — Zernio's presigned URLs have a CRC32 bug for large files).

**BUILD** — Assemble the POST body. The 10 field placement rules in `reference/zernio-post.md` are not optional — get them wrong and the post silently breaks. Highlights: `content` is the top-level caption, `platformSpecificData` is flat (not nested under platform name), `tags` is a comma-separated string (not array), `thumbnail` is a plain URL string (not an object), `firstComment` must be in the create call.

**APPROVE** — Show the user the full package: platforms, schedule, content preview per platform, media URLs, first comment. Wait for explicit OK. If they ask for changes, apply them and re-show the full block.

**POST** — `POST https://zernio.com/api/v1/posts` with the assembled body. Always `scheduledFor` for multi-platform.

**VERIFY** — Read the Zernio response. Per platform, after `scheduledFor + 60s` (retry once at +120s):
- YouTube → `GET https://www.youtube.com/oembed?url={video_url}&format=json` confirms title + thumbnail
- Others → HEAD the public URL; 200 = soft success
- On mismatch, name the dropped field and offer a remediation

**LOG** — Write `./posts/YYYY-MM-DD-{slug}.json` with the Zernio response + per-platform verification verdict + ISO timestamp.

---

## When something is out of scope

This skill **ships** content. It doesn't:

- Generate captions, titles, hashtags, or thumbnails (those come from the user)
- Render a video from images (carousel-to-video is a different problem)
- Connect new Zernio accounts (the user does that in the Zernio dashboard)
- Read from Google Drive / Dropbox without an explicit MCP / public URL the user provides

When the user asks for something out of scope, say so plainly without judgment:

> "That part isn't what this skill does. Once you've `<got the file on disk / written the caption / connected the account>`, come back and I'll ship it."

Don't try to do the out-of-scope work with adjacent tools. Stay in lane.

---

## When you're stuck

The OpenAPI spec at `reference/zernio-openapi.yaml` is the source of truth if anything in the markdown files disagrees with it. Grep it.

If you're missing context about a platform's quirks (allowed aspect ratios, character limits, pinned-comment support), read `reference/platforms/{platform}.md` for that specific one.

If you genuinely can't make progress, surface the blocker to the user as a clear single question — not a checklist.
