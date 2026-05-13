# Bluesky — Posting Reference

> Canonical schema: `BlueskyPlatformData` in `zernio-openapi.yaml` lines 1905-1921

## Quick summary

Bluesky is a decentralized, open-protocol social network (AT Protocol) positioned as a tech-forward Twitter alternative. Audience skews developer, early-adopter, and tech-curious. Tone is conversational and concise — no algorithmic boost for engagement bait. Publish via `POST /v1/posts` with `platform: "bluesky"` in the `platforms[]` array.

## Capabilities

- Video upload: YES (single video per post)
- Image post: YES (up to 4 images per post)
- Carousel: NO
- Text-only: YES
- Custom thumbnail: NO
- First comment: NO
- Scheduled publish: YES (`scheduledFor` on PlatformTarget or Post level)
- Character limit: 300 chars

## `platformSpecificData` fields

```json
{
  "threadItems": [
    { "content": "First post in the thread", "mediaItems": [] },
    { "content": "Reply extending the thought", "mediaItems": [] }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `threadItems` | `array` | _(none)_ | Sequence of posts in a Bluesky thread. First item is the root post; subsequent items are replies in order. Each item has `content` (string) and optional `mediaItems` (array of `MediaItem`). |

When `threadItems` is set, it overrides the top-level `content` — the thread becomes the full post. Each thread item is an independent post in a reply chain, each subject to the 300-char limit.

## Media spec

- **Images:** Up to 4 per post. JPG/PNG. Images exceeding 1 MB are auto-compressed by Zernio. Alt text supported via `MediaItem` properties.
- **Video:** Single video per post. H.264/AAC MP4 recommended. URL must be publicly reachable over HTTPS.
- **Cannot mix:** A post contains either images OR a video, not both.
- **Upload:** Use `POST /v1/media/presign` for files up to 5 GB. Videos over 200 MB may not be auto-compressed.

## Content rules

- **300-character limit.** Every character counts — write tight.
- **No hashtag culture.** Bluesky does not boost posts by hashtags. Use them sparingly or not at all.
- **Tone:** Direct, conversational, slightly nerdy. The audience rewards authenticity and punishes corporate speak.
- **Links:** Bluesky renders link cards. Place the URL at the end of the post for a clean card preview.
- **Threads for depth:** Use `threadItems` when content exceeds 300 chars or needs a narrative arc. Each reply in the thread gets its own engagement.

## Pre-flight validation

- [ ] `content` (or each `threadItems[].content`) is under 300 chars
- [ ] Media contains at most 4 images OR 1 video (not mixed)
- [ ] All media URLs are publicly reachable over HTTPS
- [ ] Alt text set on images (accessibility best practice)
- [ ] If using `threadItems`, each item has non-empty `content`
- [ ] `scheduledFor` is in the future if scheduling

## Gotchas

1. **Image auto-compression:** Images over 1 MB are automatically compressed by Zernio before upload. If image quality matters (infographics, screenshots with fine text), keep source images under 1 MB.
2. **No carousel support.** Multi-image posts display as a grid, not a swipeable carousel. Design images to work independently, not as sequential slides.
3. **300 chars is strict.** Shorter than Twitter (280 for most, 25K for premium). Ruthlessly trim. If the message needs more space, use `threadItems`.
4. **No first-comment feature.** Cannot pin or auto-post a follow-up comment. Use threads instead for CTA placement.
5. **No custom thumbnail.** Video posts use the platform-generated preview frame.

## CTA & craft notes

- **Thread CTA:** Place the call-to-action in the final thread item, not the root post. Keep the root post focused on the hook.
- **Link placement:** End of post for clean link card rendering. Avoid mid-sentence links.
- **Brevity is the craft.** The 300-char limit forces punchy, quotable writing. Treat every Bluesky post as a headline that stands alone.

## Cross-posting notes

- Bluesky pairs naturally with Twitter/X — similar format, different audience. Use `customContent` to tailor tone (Bluesky skews more technical and less promotional).
- Do not copy-paste Twitter threads verbatim. Bluesky's 300-char limit (vs Twitter's 280) is close but thread UX differs — Bluesky threads are reply chains, not numbered sequences.
- For multi-platform campaigns, publish Bluesky alongside Twitter but with a slightly more casual, community-oriented tone.
