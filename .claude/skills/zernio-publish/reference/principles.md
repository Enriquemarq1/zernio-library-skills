# Posting Principles — Pre-Post, Approval, Verification, Anti-Patterns

Called from `zernio-publish` Steps 1, 4, and 6. These are the load-bearing rules that apply to every post regardless of platform.

---

## The non-negotiables

1. **NEVER post without explicit user approval.** Present the complete package (content, media, schedule) and wait for an affirmative "ship it." An unapproved post is a violation regardless of how confident the system is in the package.
2. **One idea per post.** Don't bundle multiple messages into one shipment to "batch." Each piece gets its own approval + its own log entry.
3. **Adapt content per platform.** Never copy-paste. LinkedIn ≠ Instagram ≠ YouTube. Adapt at minimum: hook length, hashtag count, tone, line breaks. See `reference/platforms.md`.
4. **Schedule, don't push.** Use `scheduledFor` (2-3 min ahead) for multi-platform — never `publishNow: true`. See `reference/zernio-post.md` § Scheduling Rules.
5. **Verify after publish.** Zernio's 200 OK is acceptance, not landing. The Step 6 verifier is mandatory.

---

## Pre-Post checklist (run before Step 4 approval)

- [ ] API key resolved (env var on CLI, chat paste on web — see `SKILL.md § Resolving the API key`)
- [ ] Manifest exists and parses as JSON
- [ ] Per-platform `accountId` resolved from `GET /accounts` for every platform named in the manifest
- [ ] Media uploaded and HEAD-verified (see `reference/zernio-upload.md`)
- [ ] Thumbnail uploaded (JPEG, 1280×720 for YouTube — see `reference/zernio-post.md` rule 7)
- [ ] Per-platform content adapted in the manifest (not copy-paste)
- [ ] Platform-specific pre-flight validation (e.g., YouTube tag length, Twitter character count) — see per-platform docs
- [ ] `firstComment` drafted in the manifest if the platform supports pinned comments (YouTube/Instagram/LinkedIn)
- [ ] `scheduledFor` calculated (2-3 min ahead for multi-platform)

If ANY box is unchecked, stop and complete it before requesting approval.

---

## Approval gate (Step 4)

Present a single block showing:

```
## Ready to post — please confirm

Platforms:       [list]
Schedule:        [ISO datetime]
Content preview: [first 3 lines of each platform adaptation]
Media:           [thumbnail URL + media URL]
First comment:   [text, if applicable]

Reply "ship it" / "post" / "approved" to publish, or tell me what to change.
```

**Rules:**

- Require an affirmative word. Silence is NOT approval.
- "Looks good" or "OK" counts. "Let me think about it" does NOT.
- If the user asks for a change, re-show the full block after the edit — never ship based on a partial re-approval.
- This skill has no auto-publish flag. Every post passes through this gate.

---

## Verification protocol (Step 6 — MANDATORY, executable)

**Why this is non-negotiable:** Zernio's 200 OK means the request was accepted, not that the destination platform applied the metadata. YouTube routinely silently drops title / tags / thumbnail / pinned-comment on accepted posts. The fix is to verify at the destination, not trust the transport layer.

After POST succeeds, run the protocol below. **Each step is required; no skipping for "the API said 200."**

1. **Read the Zernio response** — extract `postId`, `status`, and the resolved `url` for each platform.
2. **Echo-verify Zernio** — `GET https://zernio.com/api/v1/posts/{postId}` and confirm the fields we sent are present in Zernio's record (title, tags, firstComment, thumbnail). If Zernio dropped a field, the platform never saw it — surface immediately.
3. **Live-verify the destination** (after `scheduledFor` + 60s; retry once at +120s):
   - **YouTube** → `curl -s "https://www.youtube.com/oembed?url={video_url}&format=json"`. Confirms title and thumbnail rendered. For tags, hit YouTube Data API v3 (`videos.list?part=snippet&id={videoId}`) — requires a `YOUTUBE_API_KEY` with read scope.
   - **Other platforms** → HEAD the public URL via `curl -I` (200 = soft success). Per-platform verifiers (instagram-verify, linkedin-verify) can be layered later.
4. **On any mismatch**:
   - Name the specific dropped fields. *"YouTube dropped: thumbnail (still on auto-generated default), tags (returned empty)."*
   - Offer a remediation: retry, manual fix in the destination's studio, or escalate.
   - Log the mismatch in `./posts/YYYY-MM-DD-{slug}.json` under `verification_result: failed` with the field-level detail.
5. **On verification failure across all retries**, the post is NOT considered shipped. Mark `published: null` in the log and surface plainly so downstream consumers correctly exclude it from "shipped this week."

**Manual sanity check** is the LAST resort, not the only check. The Zernio dashboard sometimes hides accepted-but-unrendered fields — running the live-verify is what surfaces those silently dropped.

---

## Anti-patterns (never do these)

- **`publishNow: true` for multi-platform posts.** Causes timeouts, duplicate posts, and 30+ second response times. HARD RULE: always use `scheduledFor`.
- **Copy-pasting the same caption across platforms.** Each platform has different culture, audience, and format expectations. Even "the same post" needs adaptation (hook length, hashtag count, emoji density, CTA style).
- **Skipping the tag pre-flight validator.** YouTube rejects the entire post if a single tag is ≥28 chars OR combined tag text ≥300 chars. The upload gets wasted — you have to re-upload media and re-POST. Pre-flight takes 2 seconds.
- **Missing `firstComment` on the create call.** Cannot be added after publish via the Zernio API. Missing it means manually pinning a comment from the dashboard, and the automation bragging rights dissolve.
- **Non-JPEG thumbnails.** PNGs (especially large ones) cause Zernio API 500 errors. Always convert first: `ffmpeg -i thumb.png -q:v 2 thumb.jpg`.
- **External thumbnail URLs.** Must be uploaded to Zernio storage first via the presigned upload flow. External URLs cause "Failed to process media files."
- **Reusing a failed upload's temp URLs.** Each temp URL is single-use. If the POST fails, re-upload the media before retrying.
- **Posting without a log entry.** Every shipped post MUST produce a `./posts/YYYY-MM-DD-{slug}.json` record. Skill is NOT complete until the log is written.
- **Inventing metadata.** Titles, tags, captions, thumbnails all come from the manifest. Never generate them inside this skill — that lives upstream where you author content.
