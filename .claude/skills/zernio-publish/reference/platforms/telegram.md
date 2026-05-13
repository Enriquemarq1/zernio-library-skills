# Telegram — Posting Reference

> Canonical schema: `TelegramPlatformData` in `zernio-openapi.yaml` lines 1853-1869

## Quick summary

Telegram is a direct-distribution channel — posts land in subscribers' chat list with push notification, no algorithm filtering. Publish via `POST /v1/posts` with `platform: "telegram"` in the `platforms[]` array. Every post goes to the connected Telegram channel.

## Capabilities

- Image post: YES (up to 10 per album)
- Video post: YES (up to 10 per album)
- Mixed media album: YES (images + videos in one post)
- Text-only: YES
- Custom thumbnail: NO
- First comment: NO
- Scheduled publish: YES
- Caption limit: 1,024 chars (media posts) / 4,096 chars (text-only posts)

## `platformSpecificData` fields

```json
{
  "parseMode": "HTML",
  "disableWebPagePreview": false,
  "disableNotification": false,
  "protectContent": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parseMode` | `string` enum: `HTML`, `Markdown`, `MarkdownV2` | `HTML` | Text formatting mode. `HTML` is safest — supports `<b>`, `<i>`, `<a href>`, `<code>`, `<pre>`. `MarkdownV2` requires escaping special chars. |
| `disableWebPagePreview` | `boolean` | `false` | Suppress link preview cards. Set `true` when the link preview distracts from the message content. |
| `disableNotification` | `boolean` | `false` | Silent send — subscribers receive the message without sound/vibration. Useful for high-frequency or off-hours posts. |
| `protectContent` | `boolean` | `false` | Prevent subscribers from forwarding, saving, or copying the message. Use for exclusive or time-sensitive content. |

## Media spec

- **Images:** Up to 10 per post. HTTPS URL, publicly reachable. JPG/PNG recommended.
- **Videos:** Up to 10 per post. H.264/AAC MP4 recommended. HTTPS URL.
- **Mixed albums:** Images and videos can be combined in one post (up to 10 total items).
- **Max file size:** 5 GB via `POST /v1/media/presign`. Videos over 200 MB may not be auto-compressed.
- **Thumbnails:** Not supported. Telegram auto-generates video previews.

## Content rules

- **Caption with media:** Max 1,024 chars. This is the hard limit — Telegram truncates or rejects beyond this.
- **Text-only posts:** Max 4,096 chars. Use for long-form updates, newsletters, or link-heavy posts.
- **Formatted text:** Use `parseMode: "HTML"` for rich formatting. Supported tags: `<b>`, `<i>`, `<u>`, `<s>`, `<a href="...">`, `<code>`, `<pre>`, `<blockquote>`.
- **No title field:** Telegram has no separate title — bold the first line of the caption to create a visual header.
- **Links:** Inline via `<a href="...">text</a>`. Link previews auto-generate unless `disableWebPagePreview: true`.
- **Tags:** Telegram does not have hashtag discovery. Use sparingly or skip entirely.

## Pre-flight validation

- [ ] Caption under 1,024 chars if `mediaItems[]` is non-empty
- [ ] Caption under 4,096 chars if text-only (no media)
- [ ] `parseMode` is one of `HTML`, `Markdown`, `MarkdownV2`
- [ ] All media URLs are publicly reachable HTTPS
- [ ] Total media items do not exceed 10
- [ ] `disableNotification` is intentional (not accidentally silencing a key post)

## Gotchas

1. **Caption limit depends on media:** 1,024 chars when any media is attached, 4,096 for text-only. This is the most common Telegram publish failure — a 2,000-char caption works for text-only but fails the moment you add an image.
2. **Silent send is sticky in perception:** Using `disableNotification` for routine posts trains subscribers to stop checking. Reserve for off-hours or bulk posts, not the default.
3. **protectContent is channel-wide visible:** Subscribers see "forwarding restricted" UI. Only use when the content genuinely warrants it — overuse feels hostile.
4. **MarkdownV2 escaping:** Characters `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!` must be escaped with `\`. Prefer `HTML` parseMode to avoid this.
5. **No edit window pressure:** Telegram allows unlimited edits after publish. Typos are fixable, but subscribers who already read the notification see the original.

## CTA & craft notes

- **Bold first line:** Use `<b>Title or hook here</b>` as the first line — it acts as the visual header in the chat list.
- **Link CTA:** Place the primary CTA link on its own line near the end. Telegram renders link previews prominently.
- **WhatsApp link:** `https://wa.me/{{CTA_WHATSAPP_NUMBER}}?text=Hey+{{CTA_CONTACT_NAME}}` — place at the end of the caption.
- **Channel tone:** Telegram channels feel personal and direct. Write like a message, not a social post.

## Cross-posting notes

- Telegram is a **distribution endpoint**, not a discovery platform. Use it to push content to existing audience, not to attract new followers.
- Pair with a discovery platform (YouTube, Instagram, TikTok) — publish there first, then push a Telegram message linking to it or sharing the key takeaway.
- Text-only Telegram posts work well as **companion commentary** for video content published elsewhere.
- Caption limit (1,024 with media) means cross-posted captions from Instagram (2,200) or YouTube (5,000) must be trimmed. Use `customContent` to write a Telegram-native version.
