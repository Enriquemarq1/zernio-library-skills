# Supported Platforms — Capability Matrix

Called from `zernio-publish` Step 3 (Build Post Body). This is the master index for all 13 supported platforms. For per-platform detail files (fields, media spec, gotchas, pre-flight), see `reference/platforms/{platform}.md`.

Every platform listed here must be connected in your Zernio dashboard. Resolve `accountId` per platform at runtime via `GET /v1/accounts` — see `reference/zernio-api.md` § Account model.

> **Canonical source:** `zernio-openapi.yaml` (17K-line OpenAPI spec, version-controlled in this folder). The per-platform markdown files are friendly guides; the spec is the source of truth for field names and types.

---

## Per-platform detail files

| Platform | Reference file | Schema source (OpenAPI lines) |
|----------|---------------|-------------------------------|
| YouTube | `platforms/youtube.md` | `YouTubePlatformData` 1733-1764 |
| Instagram | `platforms/instagram.md` | `InstagramPlatformData` 1621-1692 |
| TikTok | `platforms/tiktok.md` | `TikTokPlatformData` 1791-1851 |
| LinkedIn | `platforms/linkedin.md` | `LinkedInPlatformData` 1694-1709 |
| Twitter/X | `platforms/twitter.md` | `TwitterPlatformData` 1541-1581 |
| Threads | `platforms/threads.md` | `ThreadsPlatformData` 1583-1601 |
| Facebook | `platforms/facebook.md` | `FacebookPlatformData` 1603-1619 |
| Bluesky | `platforms/bluesky.md` | `BlueskyPlatformData` 1905-1921 |
| Reddit | `platforms/reddit.md` | `RedditPlatformData` 1881-1903 |
| Pinterest | `platforms/pinterest.md` | `PinterestPlatformData` 1711-1731 |
| Google Business | `platforms/googlebusiness.md` | `GoogleBusinessPlatformData` 1766-1789 |
| Telegram | `platforms/telegram.md` | `TelegramPlatformData` 1853-1869 |
| Snapchat | `platforms/snapchat.md` | `SnapchatPlatformData` 1871-1879 |

---

## Full capability matrix

| Platform | Video | Image | Carousel | Text-only | Thumbnail | First comment | Scheduled | Caption limit |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| youtube | yes | no | no | no | yes (JPEG 1280×720) | yes (pinned, 10K chars) | yes | 5000 chars |
| instagram | yes (reels/posts/stories) | yes | yes (2-10) | no | yes (reel cover) | yes (not stories) | yes | 2200 chars |
| tiktok | yes (9:16) | yes (carousel up to 35) | yes (up to 35 photos) | no | yes (cover URL/timestamp) | no (via API) | yes | 2200 video / 90 photo |
| linkedin | yes | yes (up to 20) | yes (PDF, 100MB) | yes | no | yes | yes | 3000 chars |
| twitter | yes (2m20s) | yes (up to 4) | yes (up to 4 images) | yes | no | yes (reply) | yes | 280 / 4000 Blue |
| threads | yes (5 min) | yes (up to 10) | yes (images only, 10) | yes | no | no | yes | 500 chars |
| facebook | yes (reels/feed/stories) | yes (up to 10) | yes | yes | yes (video) | yes (feed only) | yes | 63206 chars |
| bluesky | yes (single) | yes (up to 4) | no | yes | no | no | yes | 300 chars |
| reddit | yes | yes | no | yes (self post) | no | no | yes | title 300 chars |
| pinterest | yes (with cover) | yes | no | no | yes (cover URL) | no | yes | title 100 chars |
| googlebusiness | no | yes (single) | no | yes | no | no | yes | ~1500 chars |
| telegram | yes (up to 10) | yes (up to 10) | yes (mixed albums) | yes | no | no | yes | 1024/4096 chars |
| snapchat | yes (single) | yes (single) | no | no | no | no | yes | varies by type |

---

## Per-platform `platformSpecificData` fields

### youtube

```json
"platformSpecificData": {
  "title": "Video title (<100 chars)",
  "visibility": "public" | "unlisted" | "private",
  "tags": "comma,separated,string",
  "firstComment": "Engagement question + CTA",
  "categoryId": "28",
  "madeForKids": false
}
```

Caption goes in the top-level `content` field (becomes the YouTube description).

### instagram

```json
"platformSpecificData": {
  "visibility": "public",
  "firstComment": "Follow-up question or second-line hook"
}
```

Caption goes in the top-level `content` field. Hashtags at the end of the caption or first comment.

### tiktok

```json
"platformSpecificData": {
  "visibility": "public"
}
```

Caption goes in `content`. Keep under 150 chars for best discovery. 3-5 hashtags max.

### linkedin

```json
"platformSpecificData": {
  "visibility": "public"
}
```

Post body goes in `content`. Minimal hashtags (0-3). First 2 lines are the feed preview — treat them as the hook.

### twitter

```json
"platformSpecificData": {
  "visibility": "public"
}
```

Tweet text in `content`. 280 chars unless the account has Blue/X Premium (then 4000). For threads, send multiple posts with the `replyToPostId` linkage.

### threads

```json
"platformSpecificData": {
  "visibility": "public"
}
```

Post text in `content`, 500 char hard limit. Conversational tone, minimal hashtags.

### facebook

```json
"platformSpecificData": {
  "visibility": "public"
}
```

Caption in `content`. Supports the longest caption of any platform but rarely needs more than 500 words.

---

## Media spec per platform

| Platform | Video aspect | Video max duration | Image aspect |
|----------|--------------|-------------------|--------------|
| youtube | 16:9 (normal), 9:16 (Shorts ≤3 min) | 12 hours | — |
| instagram reels | 9:16 | 90 sec | — |
| instagram posts | 1:1, 4:5 | 60 sec | 1:1, 4:5 |
| instagram stories | 9:16 | 60 sec | 9:16 |
| tiktok | 9:16 | 10 min | — |
| linkedin | 16:9, 1:1 | 10 min | 1.91:1 (link preview), 1:1 |
| twitter | 16:9, 1:1 | 2 min 20 sec | 16:9, 1:1 |
| threads | 9:16, 1:1 | 5 min | 1:1 |
| facebook | 16:9, 9:16, 1:1 | 240 min | 1.91:1 |

**Short-form rule:** Anything under 3 minutes is short-form. Route vertical (9:16) short-form videos to Shorts/Reels/TikTok. Long-form routes to YouTube primary + LinkedIn-native as applicable.

---

## Cross-posting strategy

When you have a primary platform (usually YouTube for video, LinkedIn for B2B), stagger the cross-posts to avoid algorithmic penalties for duplicate content. Set this in your manifest:

1. **Primary platform** — Hour 0 (`scheduledFor` +2-3 min)
2. **Tier-2 platforms** — Hour 2-6 (`scheduledFor` +2-6 hours)
3. **Tier-3 platforms** — Hour 12-48 (`scheduledFor` +12-48 hours)

A simple approach: ship the manifest as multiple POSTs (one per platform tier) with staggered `scheduledFor` values. Or build a single multi-platform manifest and let Zernio handle the per-platform timing — but stick to one tier per POST call for the cleanest verification.

---

## Adding a new platform

When Zernio adds support for a new platform:

1. Add a row to the capability matrix above
2. Add a `platformSpecificData` example block
3. Add a media spec row
4. Create `reference/platforms/{newplatform}.md` with the platform-specific deep dive
5. No SKILL.md changes needed — the orchestration is platform-agnostic
