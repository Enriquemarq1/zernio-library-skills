# Twitter/X — Posting Reference

Quick reference for publishing to Twitter via Zernio API. The top-level `content` field becomes the tweet text.

---

## Capabilities

| Feature | Supported | Notes |
|---------|-----------|-------|
| Text-only | Yes | 280 chars (standard) or 4000 chars (X Blue/Premium) |
| Image | Yes | Up to 4 images per tweet |
| Video | Yes | Max 2 min 20 s |
| GIF | Yes | Single GIF per tweet |
| Carousel | Yes | Up to 4 images (native multi-image post) |
| Thumbnail | No | Twitter auto-generates video thumbnails |
| First comment (reply) | Yes | Use `replyToTweetId` pointing at the just-published tweet |
| Scheduled | Yes | Via `scheduledFor` on the post or per-platform override |
| Threads | Yes | Via `platformSpecificData.threadItems` |
| Polls | Yes | Via `platformSpecificData.poll` |

---

## PlatformTarget Fields

Set on the `platforms[]` entry:

| Field | Type | Purpose |
|-------|------|---------|
| `platform` | `"twitter"` | Required |
| `accountId` | string | Zernio social account ID |
| `customContent` | string | Override top-level `content` for this platform (e.g. trim to 280 chars) |
| `customMedia` | MediaItem[] | Override top-level media for this platform |
| `scheduledFor` | ISO 8601 datetime | Per-platform schedule override |

---

## platformSpecificData (TwitterPlatformData)

All fields are optional. Pass as `platformSpecificData` on the Twitter platform target.

### replyToTweetId
- **Type:** string
- Tweet ID to reply to. The published tweet appears as a reply in that tweet's thread.
- For threads, only the first tweet replies to the target; subsequent tweets chain normally.
- **Cannot combine with `replySettings`.**

### replySettings
- **Type:** enum — `following` | `mentionedUsers` | `subscribers` | `verified`
- Controls who can reply. Omit for default (everyone).
- For threads, applies to the first tweet only.
- **Cannot combine with `replyToTweetId`.**

### threadItems
- **Type:** array of `{ content: string, mediaItems?: MediaItem[] }`
- Sequence of tweets in a thread. **First item is the root tweet** (replaces top-level `content`).
- Each item can have its own media attachments.
- **Mutually exclusive with `poll`.**

### poll
- **Type:** object — `{ options: string[], duration_minutes: number }`
- `options`: 2-4 choices, each max 25 characters.
- `duration_minutes`: 5 (min) to 10080 (7 days).
- Both `options` and `duration_minutes` are required.
- **Mutually exclusive with media attachments and `threadItems`.**

---

## Media Spec

| Type | Limit | Notes |
|------|-------|-------|
| Images | Up to 4 | HTTPS URLs, auto-compressed by Zernio if oversized |
| Video | 1 per tweet | Max 2 min 20 s. Videos over 200 MB may not be auto-compressed. Use `/v1/media/presign` for large uploads. |
| GIF | 1 per tweet | Counts as media slot |
| Document | Not supported | Twitter does not accept document uploads |

MediaItem fields: `type` (image/video/gif), `url` (HTTPS), optional `filename`, `size`, `mimeType`.

---

## Content Rules

1. **Character limit:** 280 characters standard, 4000 for X Blue/Premium accounts. Always assume 280 unless the creator's config confirms Blue.
2. **Threads for longer content:** Split into `threadItems`. Each item is its own tweet with its own 280-char limit.
3. **Polls are exclusive:** A tweet with a `poll` cannot have media or be part of a thread.
4. **Hashtags count toward the character limit.** Use 1-3 max — they're less effective on X than other platforms.
5. **Links auto-shorten** to ~23 characters regardless of actual URL length.
6. **Mentions** (`@handle`) count toward character limit and trigger notifications.

---

## Pre-flight Checklist

Before calling the Zernio publish endpoint:

- [ ] Character count is within limit (280 standard / 4000 Blue) — count after link shortening (~23 chars per URL)
- [ ] If poll: exactly 2-4 options, each <= 25 chars, `duration_minutes` between 5 and 10080
- [ ] If poll: no media attached, no `threadItems`
- [ ] If thread: each item's `content` is within 280 chars individually
- [ ] If `replyToTweetId` set: `replySettings` is NOT set (mutually exclusive)
- [ ] Media URLs are publicly reachable over HTTPS
- [ ] Video is under 2 min 20 s and ideally under 200 MB

---

## Gotchas

1. **`replySettings` + `replyToTweetId` conflict.** API will reject if both are set. Use one or the other.
2. **`threadItems[0]` is the root tweet.** It replaces top-level `content` — don't duplicate text in both places.
3. **Poll exclusivity is hard.** A poll tweet cannot have images, videos, or thread items. Zernio will reject the request.
4. **Video thumbnail is not settable.** The `thumbnail` field on MediaItem is ignored for Twitter; the platform auto-generates one.
5. **Scheduled + thread:** Zernio publishes the entire thread atomically at the scheduled time.
6. **`customContent` on PlatformTarget** overrides top-level `content`. Use it to trim cross-posted text to 280 chars without affecting other platforms.

---

## CTA & Craft Notes

- Lead with a hook or hot take in the first line — it's the only line visible in the timeline before "Show more."
- Threads work best when each tweet stands alone but gains meaning in sequence. Don't write "1/7" — let the thread indicator do that.
- Polls drive engagement but suppress link clicks. Use them for audience research, not traffic.
- Replies (`replyToTweetId`) are useful for "first comment" patterns — post the main tweet, then immediately reply with a link or CTA.

---

## Cross-posting Notes

- When cross-posting from a longer platform (LinkedIn, YouTube description), use `customContent` to write a Twitter-native version under 280 chars rather than truncating.
- Image carousels on Twitter are 4 max vs. 20 on LinkedIn/Instagram — select the strongest 4.
- Twitter threads can approximate carousel storytelling from other platforms, but each slide becomes a tweet.
