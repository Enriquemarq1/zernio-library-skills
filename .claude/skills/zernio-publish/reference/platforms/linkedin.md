# LinkedIn -- Posting Reference

> Canonical schema: `LinkedInPlatformData` in `zernio-openapi.yaml` lines 1694-1709

## Quick summary

Professional platform. B2B authority building, creator-led education, and thought leadership. Four angles that work: **Educate** (highest engagement), **Document** (journey sharing), **Provoke** (contrarian takes), **Story** (narrative arc with resolution). The feed rewards authenticity over polish.

## Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| Video | Yes | 16:9 or 1:1, max 10 min |
| Image | Yes | Up to 20 images per post |
| Carousel / PDF | Yes | Single PDF document upload, max 100 MB |
| Text-only | Yes | |
| Thumbnail | No | Uses first frame of video |
| First comment | Yes | Via `platformSpecificData.firstComment` |
| Scheduled publish | Yes | Via `scheduledFor` |
| Post body limit | -- | 3000 characters |

## `platformSpecificData` fields

```json
{
  "documentTitle": "State of AI in Content Production 2026",
  "organizationUrn": "urn:li:organization:123456789",
  "firstComment": "What's your biggest challenge with content workflows? Drop it below.",
  "disableLinkPreview": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `documentTitle` | string | For PDF posts | Title displayed on LinkedIn document posts. Falls back to `MediaItem.title`, then filename. |
| `organizationUrn` | string | For org pages | Target LinkedIn Organization URN. Omit to post as personal profile. List orgs via `GET /v1/accounts/{id}/linkedin-organizations`. |
| `firstComment` | string | No | Comment added automatically after the post is created. |
| `disableLinkPreview` | boolean | No | Set `true` to suppress auto-generated link preview cards. Default `false`. |

## Media spec

- **Images:** Up to 20. 1:1 or landscape. No minimum resolution enforced by the API.
- **Video:** Single video only (no multi-video). 16:9 or 1:1 aspect ratio. Max 10 minutes.
- **PDF / Carousel:** Single document, type `document` in `MediaItem`, max 100 MB. This is how LinkedIn "carousels" work -- each PDF page becomes a slide.
- **Link previews:** Auto-generated when no media is attached and the post body contains a URL. Optimal preview image ratio is 1.91:1.
- **Media upload:** Use `POST /v1/media/presign` for files up to 5 GB. Videos over 200 MB may not be auto-compressed by Zernio.

## Content rules

1. **3000 characters max.** Enforce strictly -- LinkedIn truncates silently.
2. **First 2 lines are the feed preview.** They must stop the scroll. Everything after "...see more" is earned, not given.
3. **Short paragraphs.** One idea per paragraph. Line breaks between them.
4. **0-3 hashtags at the end.** More than 3 signals spam. Place them after the CTA, never inline.
5. **No em-dashes.** Use periods or line breaks instead. Matches the creator's voice rules.
6. **Professional but human.** No corporate jargon, no "leveraging synergies." Write like you talk.
7. **EDUCATE angle outperforms.** Default to it unless the creator or content specifically calls for another angle.

## Pre-flight validation

Before calling `POST /v1/posts`:

- [ ] `content` (post body) is 3000 chars or fewer
- [ ] `documentTitle` is set when media type is `document` (PDF)
- [ ] `organizationUrn` is set if posting to a company/organization page
- [ ] Media format is one of: image, video, document -- no gif support
- [ ] Only one video or one document per post (no multi-video, no multi-document)
- [ ] `accountId` for `linkedin` resolves via `GET /v1/accounts`
- [ ] `scheduledFor` is set (never use `publishNow` for multi-platform posts)

## Gotchas

1. **`documentTitle` is required for PDF posts.** If omitted, LinkedIn falls back to `MediaItem.title`, then the raw filename. "document (3).pdf" as a carousel title is a bad look.
2. **`organizationUrn` is required for org pages.** Without it, the post goes to the personal profile even if you intended the company page. Fetch available orgs via `GET /v1/accounts/{id}/linkedin-organizations`.
3. **`mentions` field is storage-only.** The `Post.mentions` array does NOT auto-resolve @mentions when publishing. To @mention someone on LinkedIn: call `GET /v1/accounts/{id}/linkedin-mentions?url={profileUrl}&displayName={name}`, get the `mentionFormat` back, and embed it directly in the `content` field.
4. **Link previews are auto-generated** when no media is attached and a URL is in the post body. Use `disableLinkPreview: true` to suppress when the link card is unwanted (e.g., the post is about the text, not the link).
5. **No multi-video.** One video per post. For multi-visual content, use images or a PDF carousel.
6. **No custom thumbnail.** LinkedIn always uses the first frame. If the first frame is black or a title card, re-edit the video to start on a visually strong frame.

## CTA & craft notes

- **Inline CTA in post body.** LinkedIn allows clickable links inline — no link-in-bio workaround needed. Place the CTA link directly in your manifest's `content` field.
- **Direct CTA works.** For B2B, this might be a Calendly link, email, or landing page. Put it inline in the post.
- **Engagement driver.** LinkedIn's algorithm rewards comments — end with a question or contrarian take that invites response. This is separate from the CTA (engagement ≠ conversion).
- **First comment for engagement.** Use `firstComment` to add a follow-up question, resource link, or engagement prompt without cluttering the main post body.
- **No hashtag-as-CTA.** Branded hashtags don't drive action on LinkedIn the way they do on Instagram.

## Cross-posting notes

- **Stagger 2-6 hours after the primary platform** (usually YouTube). See `platforms.md` cross-posting strategy.
- **Native video outperforms shared links.** Upload the video file directly to LinkedIn rather than sharing a YouTube URL. LinkedIn deprioritizes external links in the feed.
- **PDF carousels need LinkedIn-specific formatting.** Don't reuse Instagram carousel images as-is -- LinkedIn carousels are full PDF pages (landscape or portrait), not square slides. Text-heavy slides with clear takeaways per page work best.
- **Repurpose, don't duplicate.** A YouTube video's key insight becomes a standalone LinkedIn post. Extract the single best idea, reframe it for a professional audience.
