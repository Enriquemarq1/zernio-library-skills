---
name: zernio-publish
description: "Publish content from a manifest to any of 13 social platforms through Zernio — upload media, build per-platform post bodies, prompt for approval, schedule with staggered rollout, verify live, and log the result. Use when you have a finished content piece + a manifest.json describing where it should go."
---

# Skill: Zernio Publish — One Manifest, Up to 13 Platforms

You hand this skill a `manifest.json` that names the platforms, the per-platform metadata, and the media files. The skill handles the rest:

```
CHECK → UPLOAD → BUILD → APPROVE → POST → VERIFY → LOG
```

**Supported platforms (13):** YouTube, Instagram, TikTok, LinkedIn, X/Twitter, Threads, Facebook, Pinterest, Bluesky, Reddit, Snapchat, Telegram, Google Business.

**What you need before running:**

- A Zernio API key (resolved at runtime — see § Resolving the API key below)
- A Zernio account with the platforms you want to post to already connected via the Zernio dashboard
- A `manifest.json` (see `templates/manifest.json` and `examples/`)

**Zero local config.** No `config.json`, no profile YAML, no env files beyond the API key. Account IDs are resolved at runtime from `GET /v1/accounts`. If a platform isn't connected in your Zernio dashboard, the skill fails with a clear message naming the platform.

---

## Resolving the API key

**The API key is NEVER bundled in this skill, this repo, or any committed file.** It must come from the user at runtime. The resolution differs by runtime:

**Claude Code CLI (shell available):**

1. Check `$ZERNIO_API_KEY` in the environment.
2. If not set, check for a `.env` file next to the manifest, then at the project root. If found, source it (`set -a; source .env; set +a`).
3. If set: use it directly in `Authorization: Bearer $ZERNIO_API_KEY` headers.
4. If still not set after step 2 (or `.env` still has the placeholder value): surface a clear message and stop:
   ```
   ZERNIO_API_KEY is not set.
     Option A: edit .env at the repo root and replace the placeholder
               (then `git update-index --skip-worktree .env` to keep your
                real key out of commits)
     Option B: export ZERNIO_API_KEY="zk_xxx"   (macOS / Linux)
               $env:ZERNIO_API_KEY = "zk_xxx"   (Windows PowerShell)
   Get your key from https://zernio.com/dashboard/api-keys
   ```

**Claude.ai web (no shell — runs in chat UI):**

1. At Step 1, ask the user (once per conversation):
   > "Paste your Zernio API key — I'll hold it in memory for this conversation only. Get one at https://zernio.com/dashboard/api-keys."
2. Hold the key in working memory for the rest of the conversation.
3. Use it in every API call. **Never echo it back in chat output.** **Never write it to a file.**
4. If the user starts a new conversation, ask again. The key does not persist across conversations.

**Universal rules (both runtimes):**

- Never write the key to disk inside this skill folder, the manifest, or any log file.
- Never include the key in `./posts/*.json` output. The log records the Zernio response (post IDs, URLs) but not the auth header.
- If a user pastes a key into a file (e.g., a config they intend to commit), refuse it and redirect them to the env var / chat paste path.

---

## Step 1: Check prerequisites

Run the pre-post checklist from `reference/principles.md`:

- API key resolved (per § Resolving the API key above)
- Manifest exists and parses as JSON
- Every platform in `manifest.platforms` has the required fields for that platform (see `reference/platforms/{platform}.md`)
- Media files referenced by `manifest.media.video` / `manifest.media.thumbnail` exist on disk
- Thumbnail is JPEG (PNG → convert with `ffmpeg -i thumb.png -q:v 2 thumb.jpg`)

If any check fails, stop and fix. Never improvise around a missing prerequisite — the failure modes are expensive (silent upload fails, rejected tags, duplicate posts).

Resolve `accountId` per platform:

```bash
curl -s "https://zernio.com/api/v1/accounts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```

Map `platform` → `id` for every platform named in `manifest.platforms`. Missing one = "{platform} is not connected in your Zernio dashboard."

---

## Step 2: Upload media

See `reference/zernio-upload.md` for the full flow:

- Presign (lowercase `filename` / `contentType` — camelCase fails)
- PUT with `--tls-max 1.2` on macOS
- HEAD-verify both video and thumbnail return HTTP 200
- **Files over 50 MB → mandatory external-storage fallback** (CRC32 bug in Zernio's presigned URLs kills large uploads mid-stream)

Thumbnails must be JPEG 1280×720 for YouTube. Convert PNGs: `ffmpeg -i thumb.png -q:v 2 thumb.jpg`.

---

## Step 3: Build post body

See `reference/zernio-post.md` for the POST body shape and the 10 critical field placement rules. The essentials to remember:

- `content` field = the caption / description / post body for every platform (not `platformSpecificData.description`)
- `platformSpecificData` is **flat** — `{ title, tags, firstComment, ... }` — never nested under the platform name
- `mediaItems[].thumbnail` is a **plain string URL**, not an object
- Tags as a **comma-separated string**, not a JSON array
- `firstComment` MUST be in the create call — cannot be added via API after publish

See `reference/platforms.md` for per-platform `platformSpecificData` fields and capability matrix.

**The manifest is the source of truth.** This skill never invents titles, captions, tags, or thumbnails. Whatever is in `manifest.platforms.{platform}` is exactly what ships. If a field is missing for a platform that requires it, fail at Step 1 with a clear message — don't guess.

---

## Step 4: Approval gate (always — no bypass)

Present a single block showing:

```
## Ready to post — please confirm

Platforms:       [list]
Schedule:        [ISO datetime — 2-3 min ahead]
Content preview: [first 3 lines per platform]
Media:           [thumbnail URL + media URL]
First comment:   [text, if applicable]

Reply "ship it" / "post" / "approved" to publish, or tell me what to change.
```

**Wait for an affirmative.** Silence is not approval. "Looks good" / "ok" / "ship it" counts. "Let me think about it" does NOT.

If the user asks for a change, apply it and re-show the full block — never ship based on a partial re-approval.

This skill has no auto-publish flag. Every post passes through this gate.

---

## Step 5: POST via Zernio

```bash
curl -s -X POST "https://zernio.com/api/v1/posts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$POST_BODY_JSON"
```

**Scheduling rule:** always use `scheduledFor` 2-3 minutes ahead of now for multi-platform posts. Never `publishNow: true` — it causes timeouts and duplicate posts. See `reference/zernio-post.md` § Scheduling Rules.

Extract `postId` and `status` from each platform's response for Step 6.

---

## Step 6: Verify published (MANDATORY — verify, don't trust)

**Zernio's 200 OK means the request was accepted, not that the platform applied the metadata.** YouTube routinely strips title/tags/thumbnail silently on accepted posts. Without this step, the skill reports "shipped" while you see a stripped post.

See `reference/principles.md` § Verification protocol for the protocol. The executable steps:

1. Read the Zernio response — confirm all platforms returned a `postId`. Capture each platform's resolved `url`.
2. `GET https://zernio.com/api/v1/posts/{postId}` — confirm Zernio echoes back what we sent (title, tags, firstComment, thumbnail).
3. **Per-platform live verification** (run after `scheduledFor` + 60s, retry once at +120s):
   - **YouTube** → hit oEmbed (`https://www.youtube.com/oembed?url={video_url}&format=json`) to confirm the title and thumbnail rendered live.
   - **Other platforms** → HEAD the public URL with `curl -I`; if 200, treat as a soft success.
4. **On mismatch**, name the specific dropped field and offer a remediation: retry, manual fix in the destination's studio, or escalate.

**Never report success for a post that failed verification.** Log the verification result alongside the post so post-hoc audit sees the truth, not the hopeful 200.

---

## Step 7: Log to disk

Write `./posts/YYYY-MM-DD-{slug}.json` next to your manifest with:

- The full Zernio response per platform (`postId`, `status`, `url`)
- The media URLs that were uploaded
- The verification result per platform (`published` / `mismatch` / `failed` + any dropped fields)
- ISO timestamp of when the skill finished

This is the durable trail. If something goes sideways later, this file is what you grep.

---

## Rules

1. **Follow `reference/principles.md`.** The non-negotiables live there — pre-post checklist, approval gate, verification protocol, anti-patterns.
2. **NEVER post without explicit user approval.** Silence is never approval. This skill has no auto-publish flag.
3. **Use `scheduledFor` 2-3 min ahead for multi-platform.** Never `publishNow: true` for multi-platform — it causes timeouts and duplicate posts.
4. **Adapt content per platform.** Never copy-paste captions across platforms. See `reference/platforms.md`.
5. **Run platform-specific pre-flight validation** before POST (YouTube tags, Instagram caption length, Twitter character count). See per-platform docs in `reference/platforms/`.
6. **`firstComment` MUST be in the create call.** Cannot be added via API after publish.
7. **Thumbnail as plain URL string**, not an object. Must be JPEG, uploaded to Zernio first.
8. **`platformSpecificData` is flat**, not nested under the platform name.
9. **Tags as comma-separated string**, not a JSON array.
10. **Files >50 MB go through external-storage fallback.** Don't fight the CRC32 bug.
11. **Use `--tls-max 1.2`** for all presigned PUT uploads on macOS.
12. **HEAD-verify uploads** before creating the post. 404 = silent failure.
13. **Log every post** to `./posts/`. Skill is NOT complete until the log is written.
14. **Never invent metadata.** Titles, tags, captions, thumbnails all come from the manifest. If a required field is missing for a platform, fail at Step 1.

---

## Reference files

- `reference/principles.md` — Pre-post checklist, approval gate, verification protocol, anti-patterns
- `reference/platforms.md` — Capability matrix + per-platform `platformSpecificData` fields + media specs + cross-posting strategy
- `reference/zernio-api.md` — Master API reference (auth, endpoints, account model, CLI)
- `reference/zernio-upload.md` — Presign → PUT → verify, CRC32 bug, external-storage fallback for files over 50 MB
- `reference/zernio-post.md` — POST /v1/posts body shape, 10 critical field placement rules, scheduling rules, per-platform quick reference, YouTube-specific fields
- `reference/zernio-openapi.yaml` — Canonical OpenAPI spec (the source of truth for field names and types)
- `reference/platforms/{platform}.md` — Per-platform deep dive (one file per supported platform)

For the manifest shape, see `templates/manifest.json` and the worked examples in `examples/`.
