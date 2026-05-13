# YouTube — Posting Reference

> Canonical schema: `YouTubePlatformData` in `zernio-openapi.yaml` lines 1733-1764

## Quick summary

YouTube is the primary platform for long-form video (tutorials, deep-dives, vlogs) and a common source asset for short-form extraction (Shorts, Reels, TikTok). Videos under 3 minutes are auto-detected as Shorts (different UX, no custom thumbnail). Publish via `POST /v1/posts` with `platform: "youtube"` in the `platforms[]` array.

## Capabilities

- Video upload: YES (primary use case)
- Image post: NO (YouTube does not support image-only posts)
- Carousel: NO
- Text-only: NO
- Custom thumbnail: YES (regular videos only; Shorts cannot have custom thumbnails)
- First comment: YES (up to 10,000 chars, must be set in the create call)
- Scheduled publish: YES (video uploads immediately as private, goes public at scheduled time)
- Description limit: 5,000 chars (top-level `content` field, or `customContent` override)
- Title limit: 100 chars

## `platformSpecificData` fields

```json
{
  "title": "How I Built X in 30 Days",
  "visibility": "public",
  "madeForKids": false,
  "firstComment": "What would you build? ...",
  "containsSyntheticMedia": false,
  "categoryId": "28",
  "playlistId": "PLxxxxxxxxxxxxx"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | First line of content or `"Untitled Video"` | Video title. Max 100 chars. |
| `visibility` | `string` enum: `public`, `private`, `unlisted` | `public` | Video visibility setting. |
| `madeForKids` | `boolean` | `false` | COPPA compliance. `true` restricts comments, notifications, ad targeting. YouTube may block views if unset. |
| `firstComment` | `string` | _(none)_ | First comment posted immediately after upload. Max 10,000 chars. Must be included in the create call — cannot be added later. |
| `containsSyntheticMedia` | `boolean` | `false` | AI-generated content disclosure. Set `true` if video contains synthetic content that could be mistaken for real. YouTube may add a label. |
| `categoryId` | `string` | `"22"` (People & Blogs) | YouTube category ID. Common: `1` Film, `10` Music, `20` Gaming, `22` People & Blogs, `24` Entertainment, `25` News, `26` Howto, `27` Education, `28` Science & Tech. |
| `playlistId` | `string` | _(none)_ | Playlist ID to add the video to after upload (e.g. `"PLxxxxxxxxxxxxx"`). List available via `GET /v1/accounts/{id}/youtube-playlists`. Costs 50 YouTube API units per call. |

## Media spec

- **Video formats:** H.264/AAC MP4 recommended. URL must be publicly reachable over HTTPS.
- **Max file size:** 5 GB (via `POST /v1/media/presign`). Videos over 200 MB may not be auto-compressed by Zernio.
- **Shorts auto-detection:** Videos under 3 minutes are automatically treated as Shorts. No custom thumbnail for Shorts.
- **Thumbnail:** Set via `MediaItem.thumbnail` (URL, JPG/PNG, max 10 MB). Only applies to regular videos (not Shorts). Recommended resolution: 1280x720 (16:9).
- **Aspect ratios:** 16:9 standard for long-form. 9:16 for Shorts.

## Content rules

- **Title:** Under 100 chars. Brian Casel style — direct, benefit-driven, no clickbait em-dashes. Avoid ALL CAPS words.
- **Description structure (5,000 char limit):**
  1. Hook + CTA above the fold (first two visible lines before "Show more")
  2. One-paragraph summary of the video
  3. Timestamps (if applicable)
  4. Social links block (your other handles)
  5. Affiliate links / tools mentioned
- **Tags:** Set at the Post level (`tags[]`), NOT in `platformSpecificData`. Each tag max 100 chars (spec limit), but empirical safe limit is under 28 chars each / under 300 chars combined. Combined max per spec: 500 chars. Duplicates auto-removed.
- **No em-dashes** in titles or descriptions. Use colons or commas instead.

## Pre-flight validation

- [ ] `title` exists and is under 100 chars
- [ ] `content` (description) is under 5,000 chars
- [ ] `tags[]` each under 100 chars, combined under 500 chars (prefer <28 each, <300 combined)
- [ ] `mediaItems[]` contains exactly one video with a publicly reachable HTTPS URL
- [ ] `MediaItem.thumbnail` set for regular videos (not Shorts)
- [ ] `firstComment` included in the create call (cannot be added after publish)
- [ ] `containsSyntheticMedia: true` if video includes AI-generated content
- [ ] `madeForKids` explicitly set (YouTube may penalize if omitted)
- [ ] `visibility` is intentional (`public` for publish, `unlisted` for review links)
- [ ] Video file under 5 GB

## Gotchas

1. **Shorts auto-detection:** Videos under 3 min become Shorts automatically. Custom thumbnails are not supported for Shorts.
2. **Scheduled uploads:** Videos upload immediately as private, then transition to the specified visibility at `scheduledFor` time. Viewers may briefly see a private video in their sub feed.
3. **Tags are Post-level:** The `tags` field lives on the `Post` object, not inside `platformSpecificData`. Setting tags inside `platformSpecificData` does nothing.
4. **firstComment is create-only:** Must be included in the initial `POST /v1/posts` call. Cannot be added via update after the video is published.
5. **playlistId quota cost:** Adding to a playlist costs 50 YouTube API units. Use sparingly if the account is near quota limits.
6. **Thumbnail on MediaItem:** Set via `MediaItem.thumbnail` URL field, not a separate upload. JPG/PNG only, max 10 MB.

## CTA & craft notes

- **Above the fold:** Place your CTA in the first two lines of the description — visible before "Show more". This is the highest-leverage real estate on YouTube.
- **First comment CTA (mandatory if you want one):** Engagement question + CTA link in the `firstComment` field of your manifest. Cannot be added after publish via the Zernio API.
- **Per-platform attribution:** If you want to track which platform a click came from, vary the CTA URL per platform in your manifest (e.g., add a `?src=youtube` query param). Zernio does not auto-route this for you.
- **Social links block:** Include your other connected handles below timestamps in the description.

## Cross-posting notes

- YouTube is the **primary platform** for long-form video. Publish here first.
- Common source asset for short-form extraction (Shorts, Reels, TikTok clips).
- Stagger cross-posts to LinkedIn, Twitter, Instagram, etc. **2-48 hours after** the YouTube primary publish to avoid cannibalization.
- Short-form clips extracted from YouTube long-form should use platform-native captions in each target's manifest entry (different hooks, hashtag styles, CTA text).
