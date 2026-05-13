# Snapchat — Posting Reference

> Canonical schema: `SnapchatPlatformData` in `zernio-openapi.yaml` lines 1871-1879

## Quick summary

Ephemeral and permanent content for a youth-skewing audience. Three content types: Stories (24h ephemeral), Saved Stories (permanent on Public Profile), and Spotlight (public video feed). **Requires a Public Profile.** Single media item only — no carousels.

## Capabilities

| Feature | Supported | Notes |
|---------|-----------|-------|
| Video | Yes | Single video only |
| Image | Yes | Single image only |
| Carousel | No | Single media item per post |
| Text-only | No | Media required |
| Thumbnail | No | Not available |
| First comment | No | Not available |
| Scheduled posting | Yes | Via `scheduledFor` on PlatformTarget |
| Content types | story (24h), saved_story (permanent), spotlight (video feed) |

## `platformSpecificData` fields

```json
{
  "contentType": "story"
}
```

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `contentType` | string | No | `story` | `story` / `saved_story` / `spotlight` |

### Content types explained

- **`story`** — Ephemeral, auto-deletes after 24 hours. Default. Image or video.
- **`saved_story`** — Permanent on the Public Profile. Title max 45 chars. Image or video.
- **`spotlight`** — Public video feed (Snapchat's TikTok equivalent). Video only. Caption max 160 chars.

## Media spec

- **Single media item only.** Providing multiple media items will fail.
- Upload via `POST /v1/media/presign` for files up to 5GB. Zernio auto-compresses images and videos exceeding platform limits (videos over 200MB may not compress).

## Content rules by type

### Story
- Caption via top-level `content` field.
- Ephemeral — gone in 24h. Treat as disposable, high-frequency content.
- Image or video.

### Saved Story
- Title max **45 chars** — hard limit.
- Permanent on Public Profile — treat as evergreen/portfolio content.
- Image or video.

### Spotlight
- Caption max **160 chars** via top-level `content` field.
- **Video only** — images not supported for Spotlight.
- Public feed — optimized for discovery. Think TikTok-style vertical video.

## Pre-flight validation

1. **contentType selected** — explicitly set, don't rely on default for saved_story/spotlight
2. **Single media item** — exactly one MediaItem in the media array
3. **Title limit** — saved_story title under 45 chars
4. **Caption limit** — spotlight caption under 160 chars
5. **Video for spotlight** — spotlight requires video, not image
6. **Public Profile connected** — account must have a Public Profile or publish will fail

## Gotchas

- **Public Profile required** — all Snapchat posting via API requires a Public Profile. Without one, every publish fails.
- **Single media only** — no carousels, no multi-media. One image or one video per post.
- **Content types have different rules** — story is ephemeral, saved_story is permanent with a 45-char title, spotlight is video-only with a 160-char caption. Mixing these up causes silent failures or truncation.
- **Story disappears in 24h** — don't use story for content you want to persist. Use saved_story instead.
- **Spotlight is video-only** — sending an image to spotlight will fail.

## CTA & craft notes

- Stories: urgency-driven ("swipe up", "tap now") — the 24h window IS the CTA.
- Saved Stories: evergreen value — tutorials, highlights, portfolio pieces.
- Spotlight: hook in the first 2 seconds. Discovery-driven like TikTok — raw and fast.
- Keep captions short across all types. Snapchat's audience scans, doesn't read.

## Cross-posting notes

- Spotlight shares the 9:16 vertical format with TikTok and Instagram Reels — same video, different caption/tone.
- Snapchat skews younger — adjust language and references accordingly.
- Stagger 2-6 hours after primary platform to avoid duplicate content penalties.
- Use `customContent` on PlatformTarget to tailor caption length and tone for Snapchat.
