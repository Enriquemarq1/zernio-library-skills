# Facebook — Posting Reference

> Canonical schema: `FacebookPlatformData` in `zernio-openapi.yaml` lines 1603-1619

## Quick summary

Facebook supports feed posts (text, image, video, multi-image), Stories (24h ephemeral single media), and Reels (short vertical video). Publish via `POST /v1/posts` with `platform: "facebook"` in the `platforms[]` array. The top-level `content` field becomes the caption/post body for feed posts and Reels. Stories ignore captions entirely.

## Capabilities

- Video post: YES (feed or Reel)
- Image post: YES (up to 10 images per feed post)
- Carousel: YES (multi-image feed post, up to 10)
- Text-only: YES (feed post with no media)
- Custom thumbnail: YES (video posts — set via `MediaItem.thumbnail`, JPG/PNG, max 10 MB)
- First comment: YES (feed posts only — not Stories or Reels)
- Scheduled publish: YES (per-platform `scheduledFor` override supported)
- Caption limit: 63,206 chars (top-level `content` field, or `customContent` override)

## `platformSpecificData` fields

```json
{
  "contentType": "reel",
  "title": "How I 10x'd My Output",
  "firstComment": "What's your biggest content bottleneck?",
  "pageId": "123456789012345"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contentType` | `string` enum: `story`, `reel` | _(omit for feed)_ | Set `"story"` for Page Stories (24h ephemeral) or `"reel"` for Reels. Omit entirely for a standard feed post. |
| `title` | `string` | _(none)_ | Reel title. Only applies when `contentType: "reel"`. Separate from the caption (`content` field). |
| `firstComment` | `string` | _(none)_ | First comment posted immediately after publishing. **Feed posts only** — ignored for Stories and Reels. |
| `pageId` | `string` | Default connected page | Target Facebook Page ID for multi-page accounts. List pages via `GET /v1/accounts/{id}/facebook-page`. Omit to use the default page. |

## Media spec

### Feed posts
- Up to **10 images** per post. No mixed media — cannot combine images and video in a single post.
- Single video supported. URL must be publicly reachable over HTTPS.
- Text-only posts (no media) are valid.

### Stories
- **Single media only** (one image or one video).
- Content is ephemeral — disappears after **24 hours**.
- **Captions are ignored** — Facebook Stories do not display post body text.

### Reels
- **Single vertical video** required. Aspect ratio: **9:16**.
- Duration: **3-60 seconds**.
- H.264/AAC MP4 recommended.
- Custom thumbnail supported via `MediaItem.thumbnail` (JPG/PNG, max 10 MB).
- Max file size: 5 GB (via `POST /v1/media/presign`). Videos over 200 MB may not be auto-compressed.

## Content rules

- **Caption:** Under 63,206 chars but keep it punchy — Facebook truncates after ~477 chars behind a "See more" fold. Front-load the hook and CTA.
- **Reel title:** Short, benefit-driven. Separate from the caption — set via `platformSpecificData.title`.
- **Hashtags:** Include in the caption body. 3-5 relevant tags. Facebook hashtags have lower discoverability than Instagram — use them for categorization, not reach.
- **No em-dashes** in captions or titles. Use colons or commas.
- **Line breaks:** Use double line breaks for visual spacing — Facebook collapses single line breaks.

## Pre-flight validation

- [ ] `content` (caption) exists for feed posts and Reels
- [ ] `contentType` is omitted (feed), `"story"`, or `"reel"` — no other values
- [ ] Feed post media: 0-10 images OR 1 video (not mixed)
- [ ] Story media: exactly 1 image or 1 video
- [ ] Reel media: exactly 1 vertical video, 9:16 aspect ratio, 3-60s duration
- [ ] `firstComment` only set when `contentType` is omitted (feed post)
- [ ] `pageId` valid if set (multi-page accounts)
- [ ] `MediaItem.thumbnail` set for video posts and Reels
- [ ] Media URLs are publicly reachable over HTTPS
- [ ] Video files under 5 GB

## Gotchas

1. **Stories ignore captions.** The `content` field is silently discarded for Stories. All context must be baked into the media itself (text overlays, etc.).
2. **Reels require vertical video.** Non-9:16 video will be cropped or rejected. Always verify aspect ratio before publishing.
3. **firstComment is feed-only.** Setting `firstComment` on a Story or Reel is silently ignored. Do not rely on it for CTA placement on those content types.
4. **No mixed media on feed.** A feed post with images cannot also include a video. Pick one media type per post.
5. **pageId for multi-page accounts.** If the connected Facebook account manages multiple Pages, omitting `pageId` publishes to the default page. Use `GET /v1/accounts/{id}/facebook-page` to list available pages and set explicitly.
6. **"See more" fold.** Facebook truncates captions at ~477 chars. Place hook + CTA above that threshold.

## CTA & craft notes

- **Above the fold:** Place the hook and primary CTA in the first 2-3 lines (before the ~477 char truncation point).
- **First comment CTA (feed only):** Engagement question + link. Must be set in the create call via `firstComment`.
- **Reel title:** Use as a secondary hook — viewers see the title in the Reels feed alongside the caption.
- **Social links:** Include in the caption body for feed posts. Stories and Reels should drive CTAs via on-screen text overlays or pinned comments (where supported).

## Cross-posting notes

- Facebook feed posts pair well with LinkedIn — similar caption length tolerance and professional tone. Use `customContent` to adjust voice per platform.
- Reels share the same 9:16 vertical format as Instagram Reels, TikTok, and YouTube Shorts. Use the same source video with platform-specific `customContent` for captions.
- Stories are Facebook-only in terms of posting behavior — do not cross-post Story content as feed posts without reformatting.
- Stagger cross-posts **1-4 hours** after primary publish to avoid duplicate-content suppression.
