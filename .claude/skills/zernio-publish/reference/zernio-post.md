# Zernio POST /v1/posts — Field Mapping, Gotchas, Category IDs

Called from `zernio-publish` Step 5. This reference covers the exact POST body shape, field placement rules, and the critical mistakes to avoid across all supported platforms.

---

## The Request

**The correct field is `platformSpecificData` (flat). NOT `platformSettings.youtube` (nested).** This is the #1 mistake to avoid.

```bash
curl -s -X POST "https://zernio.com/api/v1/posts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "[DESCRIPTION]",
    "mediaItems": [{
      "url": "[VIDEO_PUBLIC_URL]",
      "type": "video",
      "thumbnail": "[THUMBNAIL_PUBLIC_URL]"
    }],
    "platforms": [{
      "platform": "youtube",
      "accountId": "[YT_ACCOUNT_ID]",
      "platformSpecificData": {
        "title": "[VIDEO_TITLE]",
        "visibility": "public",
        "tags": "[COMMA_SEPARATED_TAGS_STRING]",
        "firstComment": "[FIRST_COMMENT_CTA]",
        "categoryId": "[CATEGORY_ID]"
      }
    }],
    "scheduledFor": "[ISO_DATETIME_2_3_MIN_AHEAD]"
  }'
```

---

## Scheduling Rules

**HARD RULE: NEVER use `publishNow: true` for multi-platform posts.** Always use `scheduledFor` with a time 2-3 minutes ahead of now. `publishNow` with 5+ platforms causes 30+ second response times, timeouts, and duplicate posts (a single clip can ship 3-4 times across platforms).

**To calculate `scheduledFor`:**

```bash
# 3 minutes from now, macOS date
date -u -v+3M +"%Y-%m-%dT%H:%M:%SZ"

# 3 minutes from now, GNU date (Linux)
date -u -d "+3 minutes" +"%Y-%m-%dT%H:%M:%SZ"

# JavaScript
new Date(Date.now() + 3 * 60 * 1000).toISOString()
```

`publishNow: true` is ONLY safe for single-platform posts.

---

## Critical Field Placement Rules

### 1. `platformSpecificData` is FLAT

Title, tags, firstComment, categoryId, visibility — all at the top level inside `platformSpecificData`. **NOT nested under the platform name.**

Wrong:
```json
"platformSpecificData": { "youtube": { "title": "..." } }
```

Right:
```json
"platformSpecificData": { "title": "...", "tags": "...", "firstComment": "..." }
```

### 2. `content` field = the caption / description / post body

Whatever the platform calls it (YouTube description, Instagram caption, LinkedIn post body, Twitter text, TikTok caption) — it goes in the top-level `content` field, NOT `platformSpecificData.description`. One field, all platforms.

### 3. `firstComment` MUST be in the create call

Cannot be added after publish via the Zernio API. Missing it means manually pinning a comment from the destination platform after the fact.

### 4. Tags MUST be a COMMA-SEPARATED STRING

- Right: `"tags": "tag1,tag2,tag3"`
- Wrong: `"tags": ["tag1", "tag2", "tag3"]`

Per Zernio docs it says `string[]`, but YouTube requires a single comma-separated string. See per-platform docs for tag length limits.

### 5. Thumbnail is a PLAIN STRING URL, not an object

- Right: `"thumbnail": "https://..."`
- Wrong: `"thumbnail": { "url": "https://..." }`

The object format causes HTTP 500 "Failed to process media files."

### 6. Thumbnail must be uploaded to Zernio storage first

Don't use external URLs. Use the presigned upload path from `reference/zernio-upload.md`.

### 7. Thumbnail must be JPEG, 1280×720

```bash
ffmpeg -i thumbnail.png -vf scale=1280:720 -q:v 2 thumbnail.jpg
```

### 8. Each media temp URL can only be used ONCE per post

If a post fails, re-upload the video and thumbnail before retrying. Reusing a temp URL will silently fail.

### 9. `platformSpecificData` title/tags may NOT display in the Zernio dashboard

Always verify manually after posting — the dashboard UI sometimes doesn't reflect what was sent via API. This is the reason Step 6 hits the destination platform directly.

### 10. YouTube uploads as private first

Then goes public at the scheduled time. This is expected behavior — don't panic when you see the video as private in YouTube Studio immediately after the POST.

---

## YouTube-specific fields

These only apply when the platform is `youtube` in the `platforms[]` array.

### Category IDs

| ID | Category |
|----|----------|
| `"1"`  | Film & Animation |
| `"10"` | Music |
| `"20"` | Gaming |
| `"22"` | People & Blogs |
| `"24"` | Entertainment |
| `"25"` | News & Politics |
| `"26"` | Howto & Style |
| `"27"` | Education |
| `"28"` | Science & Technology |

Pick the most specific one for the video's topic. Default to `"28"` for tech tutorials, `"26"` for how-to content.

### Video length determines format

- **≤ 3 minutes** → YouTube Shorts (no custom thumbnail via API)
- **> 3 minutes** → Regular video (custom thumbnail supported)

This also matters for the external-storage fallback path — short-form videos are almost always under 50 MB and go through the direct Zernio upload path, while long-form videos over 50 MB need the fallback (`reference/zernio-upload.md`).

### Tag format

Comma-separated string, not a JSON array. YouTube hard limits: each tag under 100 chars, combined under 500 chars. Empirical safe limit: each tag under 28 chars, combined under 300 chars.

---

## Per-platform `platformSpecificData` quick reference

See `reference/platforms.md` for the full capability matrix. Summary:

| Platform | Required fields | Notable gotchas |
|----------|-----------------|-----------------|
| youtube | `title`, `categoryId`, `visibility` | Tags as comma-string, not array |
| instagram | `visibility` | Caption in `content` field |
| tiktok | `visibility` | 9:16 aspect ratio only |
| linkedin | `visibility` | Post body in `content` field |
| twitter | `visibility` | 280 chars in `content`; thread for longer |
| threads | `visibility` | 500 char limit on `content` |
| facebook | `visibility` | OG-image-style thumbnail |

For everything else, see the per-platform deep dives in `reference/platforms/`.
