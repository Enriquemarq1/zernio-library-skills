---
name: zernio-publish
description: End-to-end social publishing through Zernio. Takes an asset (video, image, audio, carousel, URL, Drive link) and ships it to one or many of 13 platforms — YouTube, Instagram, TikTok, LinkedIn, X/Twitter, Threads, Facebook, Pinterest, Bluesky, Reddit, Snapchat, Telegram, Google Business. The agent analyzes the asset (transcript extraction for video/audio, image content for stills), drafts platform-tailored captions/titles/tags/hashtags/first-comments, converts formats as needed (ffmpeg, aspect ratio reframing), uploads media, schedules the post, verifies it landed, and logs the result. Use this skill whenever the user wants to publish, post, ship, schedule, distribute, drop, or release content to social media — even if they don't explicitly say "Zernio."
---

# zernio-publish

You are publishing content to social media for the user via Zernio. This is end-to-end — from raw asset to verified, logged post. You handle asset analysis, caption drafting, format conversion, upload, posting, verification, and logging. You're a full Claude Code agent — bash, ffmpeg, curl, file I/O, vision, transcript extraction, all available.

The user gives you an asset and intent. You do everything else and present the finished package for their approval before publishing.

## Four invariants

These prevent real damage. Don't bypass them:

- **Approval before publish.** Show the user the complete package — every platform's caption, title, hashtags, first comment, schedule, and media URLs. Wait for an explicit OK ("ship it" / "post" / "approved"). Silence is not approval.
- **Verify after publish.** Zernio's 200 OK means the request was accepted, not that the platform applied your fields. Hit YouTube oEmbed and HEAD-check each platform's public URL after `scheduledFor + 60s`. Name any field that dropped.
- **Schedule, don't push.** Use `scheduledFor` 2-3 minutes ahead for multi-platform. Never `publishNow: true` for multi-platform — it causes timeouts and duplicate posts.
- **Zernio only.** Never reach for any other publishing tool. This skill uses the Zernio REST API directly.

Internalize these. Don't quote them at the user.

---

## The workflow

### Stage 1 — Intake: get the asset on disk

The user might give you a file path, a URL, a Google Drive link, an instruction with no asset yet, or a folder. Get the actual files onto local disk before anything else.

```bash
# URL
curl -L "<url>" -o ./media/asset.mp4

# Google Drive single file (public share)
# Convert "https://drive.google.com/file/d/FILE_ID/view" to:
curl -L "https://drive.google.com/uc?export=download&id=FILE_ID" -o ./media/asset.mp4

# Drive folder — fastest path is gdown (pip install gdown)
gdown --folder "<drive-folder-url>" -O ./media/

# Multiple URLs
for url in $URLS; do curl -L "$url" -O; done
```

If the link is private and not authenticated, ask the user to make it public-share OR drop the files into the project locally. One question. Move on.

### Stage 2 — Analyze: understand what the asset is

You can't write good captions without knowing what the asset is *about*. Spend a minute on this — it's the difference between generic copy and copy that lands.

**For video or audio:**

Extract a transcript. The user likely has a transcript-extraction tool available (`extracting-transcripts` skill, WhisperX, AssemblyAI). If nothing's installed, use one of these:

```bash
# WhisperX (local, GPU-accelerated)
whisperx "asset.mp4" --output_format json --output_dir ./transcripts/

# faster-whisper (local CPU)
python -c "from faster_whisper import WhisperModel; m=WhisperModel('base'); segs,_=m.transcribe('asset.mp4'); [print(s.text) for s in segs]" > transcript.txt

# AssemblyAI (cloud, needs API key)
curl -X POST https://api.assemblyai.com/v2/transcript \
  -H "authorization: $ASSEMBLYAI_API_KEY" \
  -d "{\"audio_url\":\"$ASSET_URL\"}"
```

Read the transcript. What's the hook? What's the takeaway? What's the one sentence you'd put above the fold?

**For images / carousels:**

Look at each image (you have vision). Describe what you see, identify the narrative if it's a sequence (Steps / Mistakes / Before-After / Listicle), find the slide that's the strongest hook.

**For URL-only posts (link share):**

Read the page if it's reachable. Extract title, description, key claims.

### Stage 3 — Draft: write the platform-tailored copy

Now you can draft. Each platform has different culture, character limits, and rhythm. Don't paste the same caption everywhere.

Draft for each target platform:

- **Caption / description / post body** — adapted to the platform's voice and length
- **Title** — for YouTube (under 100 chars)
- **Hashtags** — count varies (Instagram 5-15, TikTok 3-5, LinkedIn 0-3, Twitter 1-2)
- **First comment** — engagement question + CTA, for platforms that support it (YouTube, Instagram, LinkedIn, Twitter, Facebook)
- **Thumbnail** — extract a strong frame from video, or use one the user provided

You don't fabricate facts. The captions reflect what the asset is actually about — drawn from the transcript, the image content, the user's stated angle. If the user said *"post this with a take on X"*, your draft incorporates that angle. If they just said *"post this,"* you draft from what the asset itself says.

### Stage 4 — Convert: format conversions if needed

Different platforms need different shapes. Use ffmpeg.

```bash
# Carousel images → 9:16 video (4 sec per slide) for TikTok / Reels / Shorts
ffmpeg -framerate 1/4 -i "slide_%02d.jpg" -c:v libx264 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" \
  -pix_fmt yuv420p -r 30 -y carousel-video.mp4

# 16:9 → 9:16 reframe (center-crop)
ffmpeg -i input.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:a copy -y output-9x16.mp4

# Extract a thumbnail at a specific timestamp
ffmpeg -i video.mp4 -ss 00:00:03 -vframes 1 -q:v 2 thumbnail.jpg

# Convert PNG → JPEG (Zernio's thumbnail upload requires JPEG)
ffmpeg -i thumb.png -q:v 2 thumb.jpg

# Resize image for thumbnail spec (YouTube 1280×720)
ffmpeg -i thumb.jpg -vf "scale=1280:720" -q:v 2 thumb-1280x720.jpg
```

Save converted files to `./media/` in the project. Use them in the upload step.

### Stage 5 — Upload: get media into Zernio

Each media file needs a presigned upload, then a PUT, then a HEAD-verify. Zernio's REST API expects lowercase `filename` and `contentType`.

```bash
# 1. Presign
PRESIGN=$(curl -s -X POST "https://zernio.com/api/v1/media/presign" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename":"asset.mp4","contentType":"video/mp4"}')

UPLOAD_URL=$(echo "$PRESIGN" | jq -r .uploadUrl)
PUBLIC_URL=$(echo "$PRESIGN" | jq -r .publicUrl)

# 2. PUT (--tls-max 1.2 prevents TLS 1.3 bad_record_mac on macOS)
curl -X PUT "$UPLOAD_URL" -H "Content-Type: video/mp4" \
  -T "./media/asset.mp4" --tls-max 1.2 \
  -s -o /dev/null -w "%{http_code}\n"

# 3. HEAD-verify (must be 200; 404 = silent upload failure → retry)
curl -s -o /dev/null -w "%{http_code}" -I "$PUBLIC_URL"
```

**For files over 50 MB**, the presigned URL path doesn't complete reliably. Upload to external storage instead (Google Drive public share, S3, Dropbox, etc.), get a public HTTPS URL, and pass that URL into the Zernio POST body's `mediaItems[].url` field. The Zernio post creates without an upload step in that case. See `reference/zernio-upload.md` § external-storage fallback for the specifics.

Repeat for the thumbnail. Thumbnails must be **JPEG** — convert PNGs first.

### Stage 6 — Package: build the Zernio POST body

The POST body has a precise shape. Get these right; subtle violations silently break the post.

```json
{
  "content": "Top-level caption — same starting point for every platform unless overridden per-platform",
  "mediaItems": [
    {
      "url": "https://...public-uploaded-or-external-url.mp4",
      "type": "video",
      "thumbnail": "https://...public-thumbnail.jpg"
    }
  ],
  "platforms": [
    {
      "platform": "youtube",
      "accountId": "<resolved-from-GET-/accounts>",
      "platformSpecificData": {
        "title": "Video title",
        "visibility": "public",
        "tags": "claude,zernio,automation",
        "firstComment": "Engagement question + CTA link.",
        "categoryId": "28"
      }
    },
    {
      "platform": "instagram",
      "accountId": "<resolved>",
      "platformSpecificData": {
        "visibility": "public",
        "firstComment": "Follow-up engagement hook"
      },
      "customContent": "Instagram-tailored caption (overrides top-level content for this platform)"
    }
  ],
  "scheduledFor": "<ISO 8601 datetime, 2-3 min ahead>"
}
```

**The placement rules that matter:**

- `content` is the **top-level** caption / description for every platform. Per-platform overrides go in `platforms[].customContent`, not in `platformSpecificData.description`.
- `platformSpecificData` is **flat** — `{title, tags, firstComment, ...}` directly. Never `{youtube: {title: ...}}`.
- `tags` is a **comma-separated string**: `"a,b,c"`. Never an array `["a","b","c"]`.
- `mediaItems[].thumbnail` is a **plain URL string**. Never `{url: "..."}`.
- `firstComment` MUST be in the create call. It cannot be added via API after publish.
- One media temp URL = one POST. If a post fails, re-upload before retry.

Resolve each platform's `accountId` at runtime:

```bash
curl -s "https://zernio.com/api/v1/accounts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  | jq -r '.[] | "\(.platform): \(.id)"'
```

If a platform you're trying to post to isn't in the response, tell the user to connect it at https://zernio.com — that's a dashboard action, not an API one.

### Stage 7 — Approve: show the user the full package

Present a single block. No clipping, no summaries — the user needs to see exactly what's about to ship.

```
## Ready to publish — review and confirm

Platforms:    youtube, linkedin, instagram, tiktok
Schedule:     2026-05-13T18:42:00Z  (3 min from now)
Media:        ./media/asset.mp4  →  uploaded ✓
Thumbnail:    ./media/thumb.jpg  →  uploaded ✓

— YouTube —
Title:        How I built my publishing system in a week
Description:  [first 5 lines]
Tags:         claude,zernio,automation,creator,workflow
Category:     Science & Technology (28)
First comment: What would you ship first? Drop it below.

— LinkedIn —
Caption:      [first 3 lines]
First comment: Repo's in the comments.

— Instagram —
Caption:      [first 3 lines]
Hashtags:     #claudecode #zernio #automation #creator #buildinpublic
First comment: Link in bio.

— TikTok —
Caption:      [first 3 lines]
Hashtags:     #claudecode #zernio #ai

Reply "ship it" / "post" / "approved" to publish, or tell me what to change.
```

Wait for an explicit affirmative. If they ask for changes, apply and re-show the full block. Never ship on a partial re-approval.

### Stage 8 — POST: send to Zernio

```bash
curl -s -X POST "https://zernio.com/api/v1/posts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$POST_BODY_JSON"
```

Capture the response. For each platform, extract `postId`, `status`, and `url`.

### Stage 9 — Verify: did the post actually land?

After `scheduledFor + 60s` (retry once at +120s):

```bash
# Zernio echo-verify (confirms Zernio holds the fields we sent)
curl -s "https://zernio.com/api/v1/posts/$POST_ID" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"

# YouTube live-verify (title + thumbnail rendered?)
curl -s "https://www.youtube.com/oembed?url=$YOUTUBE_URL&format=json" | jq

# Other platforms — HEAD the public URL
curl -s -o /dev/null -w "%{http_code}" -I "$PLATFORM_URL"
```

If any field dropped (YouTube routinely strips title/tags/thumbnail), name it explicitly and offer a remediation: retry, manual fix in the platform's studio, or escalate.

### Stage 10 — Log: durable record on disk

Write `./posts/YYYY-MM-DD-{slug}.json`:

```json
{
  "slug": "how-i-built-publishing-system",
  "scheduledFor": "2026-05-13T18:42:00Z",
  "finishedAt": "2026-05-13T18:43:02Z",
  "platforms": {
    "youtube":   { "postId": "...", "url": "...", "verification": "published" },
    "linkedin":  { "postId": "...", "url": "...", "verification": "published" },
    "instagram": { "postId": "...", "url": "...", "verification": "mismatch", "droppedFields": ["thumbnail"] }
  }
}
```

This is the durable trail. If something goes sideways later, this is what you grep.

---

## API key resolution

The key never lives in this skill folder or the repo. Resolution depends on runtime:

- **Claude Code CLI:** check `$ZERNIO_API_KEY` first. If unset, source `.env` at the project root (`set -a; source ./.env; set +a`) — but only use it if the value isn't the literal placeholder `zk_replace_with_your_real_key`. If still unset, ask the user once (one question, friendly).
- **Claude.ai web (no shell):** ask the user to paste their key at the start; hold it in conversation memory only. Never echo it back. Never write it to a file.

Get a key at https://zernio.com/dashboard/api-keys.

---

## Style with the user

- **One question at a time.** When something is genuinely missing or unclear, ask about the single most blocking thing. Never enumerate "blockers."
- **Don't quote rules at the user.** Internalize them. The user doesn't want to read "Hard rule of this skill says X" — they want help.
- **Lead with what's possible.** "I'll grab the files from your Drive link and start drafting captions — what angle do you want on this?" beats "I cannot proceed without a manifest."
- **You're an agent, not a form.** When an asset comes in, analyze it, draft the copy, do the conversions. Don't ask the user for things you can figure out yourself.

---

## Deep references (read when you need specifics)

| File | When |
|------|------|
| `reference/zernio-api.md` | Endpoint inventory, auth, `/accounts` and `/profiles` shapes |
| `reference/zernio-upload.md` | Presign mechanics, the >50 MB external-storage fallback, gotchas |
| `reference/zernio-post.md` | Full POST body shape, all 10 field placement rules, YouTube category IDs |
| `reference/principles.md` | The verification protocol, anti-patterns |
| `reference/platforms.md` | 13-platform capability matrix, media specs, cross-posting strategy |
| `reference/platforms/{platform}.md` | One file per platform — quirks, gotchas, content rules, pre-flight checks |
| `reference/zernio-openapi.yaml` | The 17K-line canonical OpenAPI spec — source of truth if anything else disagrees |

Don't preload these. Pull the one you need when the question lands.
