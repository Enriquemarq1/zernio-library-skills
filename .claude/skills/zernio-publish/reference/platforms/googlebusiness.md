# Google Business Profile — Posting Reference

> Canonical schema: `GoogleBusinessPlatformData` in `zernio-openapi.yaml` lines 1766-1789

## Quick summary

Google Business Profile (GBP) posts surface directly on Google Search and Google Maps when users find the business. Posts drive local visibility — they appear alongside reviews, hours, and contact info. GBP supports text-only posts and text + single image. No video, no carousels. The native CTA button is the primary conversion mechanism.

## Capabilities

| Feature | Supported | Notes |
|---------|:---------:|-------|
| Video | :x: | Not supported |
| Image | :white_check_mark: | Single image only |
| Carousel | :x: | Not supported |
| Text-only | :white_check_mark: | Fully supported |
| Thumbnail | :x: | N/A — no video |
| First comment | :x: | Not supported |
| Scheduled publish | :white_check_mark: | Via `scheduledFor` on PlatformTarget |
| CTA button | :white_check_mark: | Native button with 6 action types |

## `platformSpecificData` fields

```json
{
  "locationId": "locations/123456789",
  "languageCode": "en",
  "callToAction": {
    "type": "LEARN_MORE",
    "url": "https://example.com/offer"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `locationId` | string | default location | Target GBP location ID (e.g. `"locations/123456789"`). Omit for single-location businesses. Use `GET /v1/accounts/{id}/gmb-locations` to list available locations. |
| `languageCode` | string (BCP 47) | auto-detected | Language code (e.g. `"en"`, `"de"`, `"es"`). Auto-detected from content when omitted. Set explicitly for short posts or mixed-language content where detection may fail. |
| `callToAction.type` | enum | — | `LEARN_MORE`, `BOOK`, `ORDER`, `SHOP`, `SIGN_UP`, `CALL` |
| `callToAction.url` | URI | — | Destination URL. **Required** when `callToAction` is provided. Must be a valid, publicly reachable URL. |

## Media spec

| Format | Constraints | Notes |
|--------|------------|-------|
| Image | Single image, JPG/PNG | One image per post — no multi-image |
| Video | :x: | Not accepted |
| Carousel | :x: | Not accepted |

- Images over 8 MB are auto-compressed by Zernio.
- Media URLs must be publicly reachable over HTTPS. Use `POST /v1/media/presign` for uploads up to 5 GB.

## Content rules

- **Post types:** Informational (updates, tips), promotional (offers, launches), or event-focused (announcements, openings).
- **Keep it factual and concise.** GBP posts appear alongside business metadata — they read like announcements, not social captions.
- **No hashtags.** GBP is not a discovery feed. Hashtags look out of place and add no SEO value here.
- **Front-load the value proposition.** The post may be truncated in Search/Maps previews.
- **Character limit:** 1500 characters. Keep posts under 300 for maximum readability on mobile.

## Pre-flight validation

Before calling `POST /v1/posts`:

1. **`locationId`** — required for multi-location businesses. Use `GET /v1/accounts/{id}/gmb-locations` to resolve the correct ID.
2. **CTA URL** — if `callToAction` is provided, `url` must be a valid, publicly reachable URI. The `type` field must be one of the 6 accepted values.
3. **Media count** — zero or one image. More than one image will be rejected.
4. **No video** — if the post includes video media items, remove them or skip GBP from the platform targets.

## Gotchas

- **Text + single image only.** No video, no carousels, no multi-image. Including unsupported media types causes a publish failure.
- **CTA button is unique to GBP.** No other platform in the Zernio API has a native call-to-action button. Always consider adding one — it is the main conversion path on GBP.
- **`languageCode` auto-detection is unreliable for short posts.** Posts under ~50 characters or bilingual posts should set `languageCode` explicitly.
- **`locationId` is mandatory for multi-location accounts.** Omitting it when the account has multiple locations defaults to the primary location, which may not be the intended target.
- **Posts expire.** GBP posts are automatically archived after ~6 months. They are not permanent content.
- **No engagement metrics in-platform.** GBP post analytics are limited compared to social platforms. Track CTA clicks via UTM parameters on the destination URL.

## CTA & craft notes

- **Always include a CTA button** unless the post is purely informational. The button is the most prominent interactive element on a GBP post — it sits directly below the content.
- **Match CTA type to intent:** `BOOK` for appointments/reservations, `ORDER` for e-commerce/food delivery, `SHOP` for product pages, `LEARN_MORE` for articles/landing pages, `SIGN_UP` for newsletters/trials, `CALL` for direct phone contact.
- **UTM the URL.** GBP doesn't provide granular click tracking. Append `?utm_source=gbp&utm_medium=post&utm_campaign={slug}` to the CTA URL.

## Cross-posting notes

- **GBP is not social media.** Don't reuse Instagram captions or Twitter threads. GBP posts should read like business announcements — factual, direct, and action-oriented.
- **Image reuse is fine.** The single image from a social post works well on GBP. No reformatting needed.
- **Use `customContent`** on the `PlatformTarget` to write a GBP-native version when cross-posting. Strip hashtags, shorten to under 300 characters, and add a clear value statement.
- **Post timing differs.** GBP posts are evergreen for ~6 months. Schedule them for business relevance (new product launch, seasonal offer), not for social engagement windows.
