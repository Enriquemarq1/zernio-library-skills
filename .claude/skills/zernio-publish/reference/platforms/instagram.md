# Instagram — Posting Reference

> Canonical schema: `InstagramPlatformData` in `zernio-openapi.yaml` lines 1621-1692

## Quick summary

Instagram supports Reels (short-form video), feed posts (image/video), carousels (2-10 slides), and Stories. No text-only posts — every publish requires media. The top-level `content` field becomes the caption. `PlatformTarget.customContent` overrides the caption for Instagram specifically when cross-posting.

## Capabilities

| Feature | Supported | Notes |
|---------|:---------:|-------|
| Video (Reels) | ✅ | 9:16, up to 90 sec |
| Video (feed) | ✅ | 1:1 or 4:5, up to 60 sec |
| Video (Stories) | ✅ | 9:16, up to 60 sec, no caption |
| Image | ✅ | Feed + Stories |
| Carousel | ✅ | 2-10 slides |
| Text-only | ❌ | Media always required |
| Thumbnail | ✅ | `instagramThumbnail` / `reelCover` / `thumbOffset` |
| First comment | ✅ | Feed + Reels only, not Stories |
| Scheduled publish | ✅ | Via `scheduledFor` on PlatformTarget |
| Caption limit | — | 2200 characters |

## `platformSpecificData` fields

```json
{
  "contentType": "story",
  "shareToFeed": true,
  "collaborators": ["username1", "username2"],
  "firstComment": "Engagement hook or second CTA",
  "trialParams": {
    "graduationStrategy": "SS_PERFORMANCE"
  },
  "userTags": [
    { "username": "friend", "x": 0.5, "y": 0.5, "mediaIndex": 0 }
  ],
  "audioName": "My Podcast Intro",
  "thumbOffset": 5000,
  "instagramThumbnail": "https://cdn.example.com/cover.jpg",
  "reelCover": "https://cdn.example.com/cover-alt.jpg"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contentType` | `"story"` | omit | Set to `"story"` to publish as a Story. Omit for feed/Reels (auto-detected from media). |
| `shareToFeed` | boolean | `true` | Reels only. `true` = appears on Reels tab + main profile grid. `false` = Reels tab only. |
| `collaborators` | string[] | — | Up to 3 Instagram usernames invited as collaborators. Feed/Reels only. |
| `firstComment` | string | — | Posted immediately after publish. Not applied to Stories. |
| `trialParams.graduationStrategy` | `"MANUAL"` \| `"SS_PERFORMANCE"` | — | Trial Reels: shown to non-followers first. `MANUAL` = graduate from IG app. `SS_PERFORMANCE` = auto-graduate if it performs well. |
| `userTags` | array | — | Tag users in photos by position. `username` (@ optional, auto-stripped), `x`/`y` (0.0-1.0 from top-left), `mediaIndex` (carousel slide, default 0). Photos only — tags on video items silently skipped. |
| `audioName` | string | — | Custom label for original audio on Reels. Replaces "Original Audio". **Can only be set once per Reel — cannot be changed after publish.** |
| `thumbOffset` | integer (ms) | `0` | Millisecond offset for the auto-generated Reel cover frame. Ignored when `instagramThumbnail` or `reelCover` is provided. |
| `instagramThumbnail` | URI (JPG/PNG) | — | Custom cover image URL for Reels. Must be publicly accessible. Takes priority over all other thumbnail fields. |
| `reelCover` | URI | — | Alias for `instagramThumbnail`. If both are set, `instagramThumbnail` wins. |

## Media spec

| Format | Aspect ratio | Max duration | Notes |
|--------|-------------|-------------|-------|
| Reels | 9:16 | 90 sec | Vertical video, main distribution format |
| Feed video | 1:1, 4:5 | 60 sec | Square or portrait |
| Feed image | 0.8:1 to 1.91:1 | — | Wide landscape to tall portrait |
| Carousel | 0.8:1 to 1.91:1 | 2-10 items | All slides share the same aspect ratio |
| Stories | 9:16 | 60 sec | Single media item, no caption text |

- Images over 8 MB are auto-compressed by Zernio.
- Videos exceeding platform limits are auto-compressed (videos over 200 MB may not be compressed).
- Media URLs must be publicly reachable over HTTPS. Use `POST /v1/media/presign` for uploads up to 5 GB.

## Content rules

- **Caption limit:** 2200 characters hard cap.
- **First line is the hook** — it's the only text visible in the feed before the user taps "more." Front-load value or curiosity.
- **Hashtags:** 5-15, placed at the end of the caption (or in the first comment to keep the caption clean).
- **Short paragraphs** with line breaks for readability. No walls of text.
- **No em-dashes** — use commas, periods, or line breaks instead.
- **Emojis:** Use sparingly as visual anchors, not as sentence filler.

## Pre-flight validation

Before calling `POST /v1/posts`:

1. **Caption length** — must be under 2200 chars (including hashtags if inline).
2. **Media present** — Instagram rejects text-only posts.
3. **Aspect ratio** — Reels must be 9:16. Feed images within 0.8:1-1.91:1.
4. **Carousel count** — minimum 2, maximum 10 items.
5. **Reel thumbnail** — provide `instagramThumbnail` or `reelCover` for a branded cover; fall back to `thumbOffset` if no custom image.
6. **Collaborator usernames** — max 3, must be valid Instagram handles.
7. **Story constraints** — single media item, `firstComment` will be silently ignored.
8. **`audioName` intent** — confirm with creator before setting (cannot be changed after publish).

## Gotchas

- **Thumbnail resolution order:** `MediaItem.instagramThumbnail` > `platformSpecificData.instagramThumbnail` > `platformSpecificData.reelCover` > `platformSpecificData.thumbnailUrl` (legacy). Set the field closest to the media item for clarity.
- **`audioName` is permanent** — once set on a Reel, it cannot be updated. Always confirm the label before publish.
- **`userTags` on video items are silently skipped** — the API won't error, it just ignores them. Only tag on photo carousel slides.
- **`userTags` out-of-range `mediaIndex`** — also silently ignored. Validate the index against the actual media array length.
- **Trial Reels** — shown only to non-followers initially. `SS_PERFORMANCE` auto-graduates if engagement is strong; `MANUAL` requires you to graduate from the Instagram app. Use trial Reels for experimental content you're unsure about.
- **Stories have no caption** — the `content` field is ignored. Any text must be baked into the media asset itself.
- **Auto-compression** — images over 8 MB and videos over platform limits are compressed server-side. Videos over 200 MB may fail to compress.
- **Carousel consistency** — all slides should share the same aspect ratio for a clean presentation.

## CTA & craft notes

- **Link in bio** — Instagram captions don't support clickable links for most accounts. Direct users to the bio link or use the CTA link in `firstComment` (where supported).
- **CTA in caption:** Place the CTA text + your link directly in the `content` field of the manifest. For DM-driven CTAs ("DM me"), don't include a URL — the action is the DM itself.
- **First comment CTA strategy:** Place the CTA and engagement question in `firstComment` to keep the caption focused on content. Format: engagement question + line break + CTA link.
- **Single CTA focus** — keep one clear call to action per post. Multiple competing CTAs (community + resources + repo + newsletter) dilute conversion.

## Cross-posting notes

- **Reels vs TikTok:** Same 9:16 format but different culture. TikTok favors raw/fast energy; Reels reward polished hooks and trending audio. Avoid identical captions — tailor voice per platform in your manifest.
- **Stagger timing:** Post to the primary platform first, then Instagram 2-6 hours later (Tier 2) to avoid duplicate-content penalties.
- **Hashtag divergence:** Instagram uses 5-15 discovery hashtags; TikTok uses 3-5 shorter ones; LinkedIn uses 0-3. Never copy-paste hashtag blocks across platforms.
