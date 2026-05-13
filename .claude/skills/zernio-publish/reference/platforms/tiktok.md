# TikTok — Posting Reference

> Canonical schema: `TikTokPlatformData` in `zernio-openapi.yaml` lines 1791-1851

## Quick summary

Short-form vertical video platform. Now supports photo carousels up to 35 images. All posts go through TikTok's processing pipeline. Draft mode sends to Creator Inbox instead of publishing.

## Capabilities

| Feature | Supported | Notes |
|---------|-----------|-------|
| Video | Yes | 9:16 vertical, up to 10 min |
| Standalone image | No | Single images not supported |
| Photo carousel | Yes | Up to 35 images per post |
| Text-only | No | Media required |
| Thumbnail | Yes | `videoCoverImageUrl` (custom) or `videoCoverTimestampMs` (frame select) |
| First comment | No | Not available via API, only in-app |
| Scheduled posting | Yes | Via `scheduledFor` on PlatformTarget |
| Caption limit | 2200 chars (video) / 90 chars (photo title, auto-truncated) |
| Description | 4000 chars (photo posts only, via `description` field) |

## `platformSpecificData` fields

```json
{
  "draft": false,
  "privacyLevel": "PUBLIC_TO_EVERYONE",
  "allowComment": true,
  "allowDuet": true,
  "allowStitch": true,
  "commercialContentType": "none",
  "brandPartnerPromote": false,
  "isBrandOrganicPost": false,
  "contentPreviewConfirmed": true,
  "expressConsentGiven": true,
  "mediaType": "video",
  "videoCoverTimestampMs": 1000,
  "videoCoverImageUrl": "https://...",
  "photoCoverIndex": 0,
  "autoAddMusic": false,
  "videoMadeWithAi": false,
  "description": "Long-form text for photo posts..."
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `draft` | boolean | No | `true` = Creator Inbox draft, not published |
| `privacyLevel` | string | **Yes** | MUST match a value from creator_info (see critical section below) |
| `allowComment` | boolean | No | Allow comments — availability depends on creator_info |
| `allowDuet` | boolean | No | Allow duets — required field for video posts |
| `allowStitch` | boolean | No | Allow stitches — required field for video posts |
| `commercialContentType` | string | No | `none` / `brand_organic` / `brand_content` |
| `brandPartnerPromote` | boolean | No | Promotes a brand partner |
| `isBrandOrganicPost` | boolean | No | Brand organic post flag |
| `contentPreviewConfirmed` | boolean | No | Confirms user previewed content |
| `expressConsentGiven` | boolean | No | Express consent for posting |
| `mediaType` | string | No | `video` / `photo` — auto-detected from media items if omitted |
| `videoCoverTimestampMs` | integer | No | Frame timestamp in ms for thumbnail (default 1000). Ignored when `videoCoverImageUrl` is set |
| `videoCoverImageUrl` | string (URI) | No | Custom thumbnail URL (JPG/PNG/WebP, max 20MB). Stitched as first frame. Overrides `videoCoverTimestampMs` |
| `photoCoverIndex` | integer | No | 0-based index of cover image in carousel (default 0) |
| `autoAddMusic` | boolean | No | Let TikTok add recommended music — photo posts only |
| `videoMadeWithAi` | boolean | No | AI content disclosure flag — set `true` for AI-generated video |
| `description` | string | No | Long-form text for photo posts, max 4000 chars. Use when caption exceeds 90 chars |

## CRITICAL: TikTok creator_info dependency

**MUST call `GET /v1/accounts/{accountId}/tiktok/creator-info` BEFORE posting.** This returns:

- Valid `privacyLevel` options for the account (varies per creator)
- Which toggles (duet, stitch, comment) the creator has enabled

Using an invalid `privacyLevel` causes an immediate **REJECTION** from TikTok. This is the #1 TikTok posting error. Never hardcode privacy levels — always fetch and use what creator_info returns.

## Media spec

- **Video:** 9:16 vertical only, up to 10 minutes. Zernio auto-compresses videos over platform limits (videos over 200MB may not compress). Upload via `POST /v1/media/presign` for files up to 5GB.
- **Photo carousel:** Up to 35 images. TikTok auto-resizes images (sets `tiktokProcessed: true` on MediaItem). Use `photoCoverIndex` to pick the cover.
- **Thumbnail:** Custom image via `videoCoverImageUrl` (JPG/PNG/WebP, max 20MB) or frame selection via `videoCoverTimestampMs`.

## Content rules

- **Video captions:** Max 2200 chars. The top-level `content` field becomes the TikTok caption.
- **Photo titles:** Auto-truncated to 90 chars. For longer text, use the `description` field (up to 4000 chars).
- **Hashtags:** 3-5 max in caption. Keep them relevant and trending.
- **Tone:** Short, punchy, conversational. TikTok rewards informal, personality-driven captions.
- **Per-platform override:** Use `customContent` on PlatformTarget to tailor the caption for TikTok without affecting other platforms.

## Pre-flight validation

1. **creator_info fetched** — privacyLevel matches a returned option
2. **Consent flags set** — `expressConsentGiven` and `contentPreviewConfirmed` if required by policy
3. **Media format correct** — video is 9:16, or photos are provided for carousel
4. **Caption within limits** — video: 2200 chars, photo title: 90 chars (or use `description` for overflow)
5. **Commercial disclosure** — `commercialContentType` set if content is sponsored/branded
6. **AI disclosure** — `videoMadeWithAi: true` if content is AI-generated
7. **Duet/stitch flags** — set for video posts (required fields)

## Gotchas

- **privacyLevel is mandatory and dynamic** — never assume `PUBLIC_TO_EVERYONE` works. Always fetch creator_info first.
- **Draft mode** — `draft: true` sends to Creator Inbox, does NOT publish. Useful for review workflows.
- **Photo title truncation** — titles silently truncated to 90 chars. Always use `description` for anything longer.
- **Both camelCase and snake_case accepted** — Zernio normalizes, but prefer camelCase for consistency.
- **AI disclosure** — `videoMadeWithAi` flag. Set it when the video contains AI-generated content.
- **No first comment via API** — TikTok API does not support posting a first comment. Only available in-app.
- **`autoAddMusic`** — photo posts only. Ignored for video.
- **`tiktokProcessed`** — internal flag on MediaItem, set by Zernio after image resize. Do not set manually.

## CTA & craft notes

- Caption IS the CTA on TikTok. Use "link in bio" pattern for external links.
- WhatsApp CTA works well in caption for direct engagement.
- Keep captions under 150 chars for best discovery — the fold cuts early on mobile.
- Front-load the hook in the first line; most viewers see only that before tapping "more."

## Cross-posting notes

- Same 9:16 aspect ratio as Instagram Reels, but different culture — TikTok is faster, more raw, less polished.
- Stagger 2-6 hours after primary platform to avoid duplicate content penalties.
- Use `customContent` on PlatformTarget to adapt tone (more casual for TikTok vs. Instagram).
- Thumbnail strategy may differ: TikTok auto-selects well; Instagram often needs a custom cover.
