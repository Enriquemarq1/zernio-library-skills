# Pinterest — Posting Reference

> Canonical schema: `PinterestPlatformData` in `zernio-openapi.yaml` lines 1711-1731

## Quick summary

Pinterest is a visual discovery engine with long content shelf life. Pins surface via search and recommendations for months or years — unlike feed-based platforms where posts decay in hours. Publish via `POST /v1/posts` with `platform: "pinterest"` in the `platforms[]` array. Every pin needs an image or video; text-only pins do not exist.

## Capabilities

- Image post: YES (primary use case)
- Video post: YES (with optional cover image)
- Carousel: NO
- Text-only: NO (visual media required)
- Custom thumbnail: YES (via `coverImageUrl` for video pins)
- First comment: NO
- Scheduled publish: YES (via `scheduledFor`)
- Title limit: 100 chars
- Description limit: 500 chars (top-level `content` field, or `customContent` override)

## `platformSpecificData` fields

```json
{
  "title": "5 Remotion Tips You Need to Know",
  "boardId": "123456789012345678",
  "link": "https://example.com/blog/remotion-tips",
  "coverImageUrl": "https://cdn.example.com/cover.jpg",
  "coverImageKeyFrameTime": 3
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | First line of content or `"Pin"` | Pin title. Max 100 chars. Front-load keywords for search. |
| `boardId` | `string` | First available board | Target Pinterest board ID. Omit to use the account's first board. |
| `link` | `string` (URI) | _(none)_ | Destination URL users land on when they click the pin. This is the primary traffic driver — always set it. |
| `coverImageUrl` | `string` (URI) | _(none)_ | Cover image for video pins. JPG/PNG, publicly reachable HTTPS URL. |
| `coverImageKeyFrameTime` | `integer` | _(none)_ | Key frame time in seconds used to derive a cover from the video. Ignored if `coverImageUrl` is set. |

## Media spec

- **Image formats:** JPG, PNG recommended. URL must be publicly reachable over HTTPS.
- **Recommended aspect ratio:** 2:3 (1000x1500 px). Pins taller than 2:3 get truncated in the feed.
- **Video formats:** MP4 (H.264/AAC) recommended. 4 seconds to 15 minutes.
- **Max file size:** 5 GB (via `POST /v1/media/presign`). Videos over 200 MB may not be auto-compressed.
- **Video cover:** Set via `coverImageUrl` in `platformSpecificData`, or let Pinterest auto-derive from `coverImageKeyFrameTime`.
- **One media item per pin.** Pass a single entry in `mediaItems[]`.

## Content rules

- **Title is the hook.** Under 100 chars, keyword-rich, benefit-driven. Pinterest search indexes the title heavily — treat it like an SEO headline, not a social caption.
- **Description goes in the `content` field** (or `customContent` for platform-specific override). Under 500 chars. Write for search: include relevant keywords naturally, avoid hashtag-stuffing.
- **SEO keywords matter.** Pinterest is a search engine. Weave 3-5 target keywords into both title and description. Use terms people actually search for — not clever wordplay.
- **No hashtags.** Pinterest deprecated hashtag search. Keywords in natural sentences outperform hashtags.
- **Link is mandatory for traffic.** Always set the `link` field — it's the entire point of a pin for creator/brand traffic.

## Pre-flight validation

- [ ] `title` exists and is under 100 chars
- [ ] `content` (description) is under 500 chars and keyword-rich
- [ ] `mediaItems[]` contains exactly one image or video with a publicly reachable HTTPS URL
- [ ] `link` is set and valid (HTTPS URL to the destination page)
- [ ] `boardId` is set if the account has multiple boards (otherwise defaults to first)
- [ ] For video pins: `coverImageUrl` or `coverImageKeyFrameTime` is set
- [ ] Image aspect ratio is 2:3 or close (taller images get truncated)

## Gotchas

1. **boardId defaults to first available.** If the creator has multiple boards, always specify `boardId` explicitly — the "first available" fallback is unpredictable.
2. **Title defaults to first line of content.** If `title` is omitted, Zernio uses the first line of the description. This often reads poorly — always set `title` explicitly.
3. **Video cover options are mutually exclusive.** `coverImageUrl` takes priority over `coverImageKeyFrameTime`. Set one or the other, not both.
4. **No carousel support.** Pinterest Idea Pins (multi-image) are not available through the API. One image or video per pin.
5. **Description is not a caption.** Unlike Instagram or Twitter, nobody reads pin descriptions in a feed. Pinterest indexes them for search — write for the algorithm, not the reader.
6. **Link click attribution.** Pinterest analytics track link clicks separately from saves. The `link` field is the only way to drive outbound traffic.

## CTA & craft notes

- **Pins are evergreen.** Optimize for search, not recency. A well-optimized pin can drive traffic for 6-12+ months.
- **Design for the feed.** 2:3 vertical images with readable text overlay perform best. Avoid landscape or square crops — they get lost in the Pinterest grid.
- **Link is the CTA.** Pinterest's native click behavior sends users to the `link` URL. No need for "click the link" language — the platform handles it.
- **Board organization matters.** Group pins into topical boards matching the creator's content pillars. Board names are indexed for search.

## Cross-posting notes

- Pinterest is a **secondary distribution** channel. Repurpose hero images or video thumbnails from primary content (YouTube, blog posts).
- Best for: blog post promotion, product pages, tutorial summaries, infographic-style content.
- Stagger from primary publish by **1-24 hours** — Pinterest's algorithm doesn't penalize delayed posting.
- Always customize `title` and `content` for Pinterest SEO keywords — do not reuse YouTube titles or Twitter captions verbatim.
- Video pins repurposed from Shorts/Reels should include `coverImageUrl` since auto-derived covers are often poor quality.
