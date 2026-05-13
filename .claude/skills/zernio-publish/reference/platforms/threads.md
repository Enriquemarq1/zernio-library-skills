# Threads — Posting Reference

> Canonical schema: `ThreadsPlatformData` in `zernio-openapi.yaml` lines 1583-1601

## Quick summary

Threads is a text-first, conversational platform. Posts are short (500 chars), casual, and optimized for replies and discussion. Supports images, video, and carousels, but text alone performs well. Publish via `POST /v1/posts` with `platform: "threads"` in the `platforms[]` array.

## Capabilities

- Video upload: YES (H.264/AAC MP4, max 5 minutes)
- Image post: YES
- Carousel: YES (up to 10 images, no videos in carousel)
- Text-only: YES (primary use case)
- Custom thumbnail: NO
- First comment: NO
- Scheduled publish: YES
- Caption limit: 500 chars (top-level `content` field, or `customContent` override)

## `platformSpecificData` fields

```json
{
  "topic_tag": "remotion",
  "threadItems": [
    { "content": "First reply in the thread" },
    { "content": "Second reply", "mediaItems": [{ "type": "image", "url": "https://..." }] }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `topic_tag` | `string` (1-50 chars) | _(none)_ | Topic tag for discoverability. No periods (`.`) or ampersands (`&`). Overrides auto-extraction from content hashtags when provided. |
| `threadItems` | `array` of objects | _(none)_ | Reply chain below the root post. Each item has `content` (string) and optional `mediaItems[]` (array of `MediaItem`). Posts appear as root + replies in order. |

### `threadItems[].mediaItems` follow the standard `MediaItem` schema:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` enum: `image`, `video`, `gif`, `document` | Media type. |
| `url` | `string` (URI) | Publicly reachable HTTPS URL. |
| `filename` | `string` | Optional filename. |
| `size` | `integer` | Optional file size in bytes. |
| `mimeType` | `string` | Optional MIME type (e.g. `image/jpeg`, `video/mp4`). |

## Media spec

- **Video:** H.264/AAC MP4. Max 5 minutes. Aspect ratio 9:16 or 1:1.
- **Images:** JPEG or PNG. Max 8 MB per image.
- **Carousel:** Up to 10 images. No videos allowed in carousels.
- **Aspect ratios:** 9:16 (portrait, best for feed), 1:1 (square).
- **Upload:** Use `POST /v1/media/presign` for files up to 5 GB. URL must be publicly reachable over HTTPS.

## Content rules

- **500 char hard limit.** Write tight. One idea per post.
- **Tone:** Conversational, casual, opinionated. Threads rewards personality over polish.
- **Hashtags:** 1-3 max, woven into the text or at the end. Less is more.
- **topic_tag:** Use for discoverability when there's a clear topic. Keep it short and specific (e.g. `remotion`, `aitools`, `contentcreation`). No periods or ampersands.
- **Reply chains:** Use `threadItems` to expand on the root post. Each reply can have its own media. Good for listicles, breakdowns, hot takes with receipts.

## Pre-flight validation

- [ ] `content` is under 500 chars
- [ ] `topic_tag` (if set) is 1-50 chars, no periods (`.`), no ampersands (`&`)
- [ ] Carousel contains images only (no videos)
- [ ] Carousel has 10 or fewer items
- [ ] Video is H.264/AAC MP4, under 5 minutes
- [ ] Images are JPEG/PNG, under 8 MB each
- [ ] Each `threadItems[].content` is under 500 chars
- [ ] Media URLs are publicly reachable HTTPS

## Gotchas

1. **topic_tag overrides hashtag extraction.** When `topic_tag` is set, Threads uses it instead of auto-extracting topics from hashtags in the content. Set it intentionally or omit it to let the platform infer.
2. **Carousel is images-only.** Unlike Instagram, Threads carousels cannot contain videos. A post with one video is fine; a carousel with mixed media is not.
3. **threadItems for reply chains.** Threads does not support `firstComment` or `replyToPostId`. To create a thread (multi-post chain), use the `threadItems` array. The root post is the top-level `content`; each `threadItems` entry becomes a reply in order.
4. **No custom thumbnail.** Threads auto-generates video previews. No `MediaItem.thumbnail` support.
5. **500 chars is strict.** Unlike Twitter/X where premium extends the limit, 500 is the ceiling for everyone on Threads. Emoji and URLs count toward the limit.

## CTA & craft notes

- **Text-first craft:** The best Threads posts read like a message to a friend. Skip the corporate voice. One strong opinion or observation beats a polished paragraph.
- **External CTAs:** Weave naturally into the post or the last `threadItem` reply (e.g., `Talk to me: https://wa.me/...`). Threads links are clickable, so you don't need a link-in-bio pattern.
- **Reply chains for depth:** Use `threadItems` to break a longer thought into 2-4 bite-sized replies. Each reply stands alone in the feed if it gets engagement.

## Cross-posting notes

- Threads is a **Tier-2/3 platform** for most creators. Publish after the primary platform (YouTube, LinkedIn, Instagram).
- Stagger **2-6 hours** after the primary post. Rewrite the caption in your manifest for Threads' casual tone — do not paste the LinkedIn caption verbatim.
- Short-form video clips can go to Threads as standalone video posts (not carousel), but the real leverage is text adaptation of the video's core insight.
