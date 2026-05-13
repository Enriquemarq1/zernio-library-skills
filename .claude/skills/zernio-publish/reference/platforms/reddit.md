# Reddit — Posting Reference

> Canonical schema: `RedditPlatformData` in `zernio-openapi.yaml` lines 1881-1903

## Quick summary

Reddit is community-driven and subreddit-specific. Every post targets a single subreddit with its own rules, flair requirements, and culture. Posts are either link posts (URL or media) or self/text posts. Publish via `POST /v1/posts` with `platform: "reddit"` in the `platforms[]` array. The title is the entire hook — Reddit has no algorithm feed; users scan titles and vote.

## Capabilities

- Video upload: YES
- Image upload: YES
- Carousel: NO
- Text-only (self post): YES
- Custom thumbnail: NO (Reddit auto-generates)
- First comment: NO (not supported via API)
- Scheduled publish: YES
- Title limit: 300 chars
- Content limit: 40,000 chars (self post body)

## `platformSpecificData` fields

```json
{
  "subreddit": "socialmedia",
  "title": "I analyzed 500 posts — here's what actually gets engagement",
  "url": null,
  "forceSelf": false,
  "flairId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `subreddit` | `string` | Account default | Target subreddit name **without** `r/` prefix. List options via `GET /v1/accounts/{id}/reddit-subreddits`. |
| `title` | `string` | First line of content, truncated to 300 chars | Post title. Max 300 chars. This is the hook — it determines whether anyone clicks. |
| `url` | `string` (URI) | _(none)_ | URL for link posts. When set (and `forceSelf` is not `true`), creates a link post instead of a self post. |
| `forceSelf` | `boolean` | `false` | When `true`, creates a text/self post even when `url` or media is provided. Use for discussion posts that reference external content in the body. |
| `flairId` | `string` | _(none)_ | Flair ID for the post. **Required by some subreddits** — omitting it will cause a rejected publish. Fetch available flairs via `GET /v1/accounts/{id}/reddit-flairs?subreddit={name}`. |

## Media spec

- **Image formats:** JPEG, PNG. URL must be publicly reachable over HTTPS.
- **Video formats:** H.264/AAC MP4 recommended. URL must be publicly reachable over HTTPS.
- **Max file size:** 5 GB (via `POST /v1/media/presign`). Videos over 200 MB may not be auto-compressed.
- **Single media per post:** Reddit supports one image or one video per post (not multiple).
- **Link vs media:** Attaching media creates a media post (a type of link post). Use `forceSelf: true` to override this and post as self/text instead.

## Content rules

- **Title is everything:** Reddit users scan titles, not previews. Write a title that provokes curiosity or promises specific value. No generic "Check this out" titles.
- **Self posts:** Use for discussions, breakdowns, AMA-style content, tutorials, personal stories. The `content` field becomes the post body (Markdown supported).
- **Link posts:** Use when the value IS the link (article, tool, resource). The `url` field becomes the post destination. No body text on link posts.
- **No promotional tone:** Reddit communities actively downvote and report overt self-promotion. Frame content as value-first: sharing learnings, asking questions, contributing to discussion.
- **Subreddit voice:** Match the subreddit's tone. r/Entrepreneur is different from r/webdev is different from r/smallbusiness. Read before posting.

## Pre-flight validation

- [ ] `subreddit` is set and valid (exists, account can post there)
- [ ] `flairId` is set if the subreddit requires flair — call `GET /v1/accounts/{id}/reddit-flairs?subreddit={name}` first
- [ ] `title` exists and is under 300 chars
- [ ] Post type is intentional: link post (has `url` or media) vs self post (text only or `forceSelf: true`)
- [ ] Content does not read as promotional — reframe as value contribution
- [ ] Media URL is publicly reachable over HTTPS (if media post)

## Gotchas

1. **Flair is often mandatory:** Many subreddits reject posts without flair. Always call `GET /v1/accounts/{id}/reddit-flairs?subreddit={name}` before publishing to a new subreddit. If the endpoint returns flairs, assume at least one is required.
2. **Link vs self logic:** If `url` is set and `forceSelf` is not `true`, the post becomes a link post (no body text). If you want body text WITH a link, use `forceSelf: true` and put the URL in the content body.
3. **forceSelf override:** When `true`, always creates a self/text post regardless of `url` or media presence. Use this for discussion posts that happen to reference links.
4. **Title defaults are dangerous:** If `title` is omitted, it defaults to the first line of `content` truncated to 300 chars. This almost never produces a good Reddit title. Always set `title` explicitly.
5. **No carousel/gallery via API:** Reddit has native galleries on-site, but the Zernio API does not support multi-image gallery posts. One image or one video per post.
6. **No first comment:** Unlike YouTube or LinkedIn, you cannot set a first comment via the API. If a comment strategy is needed, flag it for manual follow-up.

## CTA & craft notes

- **Reddit hates CTAs.** Do not put WhatsApp links, "follow me," or promotional CTAs in the post. Reddit communities will downvote and possibly ban the account.
- **Value-first formula:** Share a genuine insight, breakdown, or resource. If the creator's product/service is relevant, mention it naturally in context — never as the point of the post.
- **Engagement comes from discussion:** End self posts with a question that invites replies. Reddit's algorithm rewards comment activity.
- **Bio link is the only safe CTA:** The account profile can contain a link. Direct people there only if asked, never in the post body.

## Cross-posting notes

- Reddit posts should be **unique to Reddit** — not repurposed captions from Twitter or LinkedIn. The tone and format are fundamentally different.
- Long-form content (tutorials, breakdowns) that works on YouTube or LinkedIn can be adapted into a Reddit self post, but must be rewritten for Reddit's conversational, peer-to-peer tone.
- Reddit is a **discovery channel**, not a distribution channel. Content that performs here drives organic traffic; content that feels distributed here gets buried.
