---
name: white-label-client-report
description: "Add a white-label client report to your own social media app on the Zernio API: organic and paid numbers side by side under your agency's logo, how fast the brand answers its messages, what people feel in the comments, and a branded link or PDF the client opens. Part 2 of white-label-blueprint; works on any app that already has one Zernio profile per client. Triggers: 'client report', 'white label report', 'agency report', 'monthly report for my clients', 'organic and paid in one report', 'response time report', 'comment sentiment'."
---

# White-Label Client Report: your logo on every number

Your logo. Their numbers. One API. The client opens a report with your agency's name on it, and every number on it comes from the same API that already posts, answers messages and runs ads for them.

```
YOUR APP → [1 YOUR LOGO] → [2 ORGANIC] → [3 PAID] → [4 RESPONSE TIME] → [5 SENTIMENT]
            your link,      one call,     next to     how fast the       what people
            your PDF        vs last       organic     brand answers      feel, built
                            period                                       on top
```

**The law: a report is only white-label if the client never sees anyone's name but yours,** on the screen, in the link and in the PDF.

| # | Check | What proves it |
|---|---|---|
| 1 | Your logo, your link | The client opens `/c/{profileId}/report` or the PDF: your brand, no vendor name anywhere |
| 2 | Organic in one call | `GET /v1/analytics/dashboard` returns totals, followers, the daily series, top posts and the previous period at once |
| 3 | Paid next to organic | `GET /v1/ads` for the same client and the same dates, in the column beside organic |
| 4 | How fast the brand answers | `GET /v1/analytics/inbox/response-time` and `/volume`: median first reply, the spread, messages received |
| 5 | What people feel | Comments from `GET /v1/inbox/comments`, scored by your own code. Zernio gives you the raw comments; the analysis is yours to add |

**Starting from the blueprint app?** Paste `reference/stage-prompts.md` one stage at a time into Claude Code inside that app. **Starting from your own app?** Stage 0 reads your code first and keeps your framework, design and data model.

## The architecture (still thin)

- **No new database.** Every number is read live, scoped to the client's `profileId`. For many clients in production, Zernio's own guide recommends a sync worker that fills your database once an hour, so a page view never calls the API ([multi-tenant analytics](https://docs.zernio.com/multi-tenant/analytics.mdx)). Say so; don't build it for a demo.
- **One report page, two doors.** The agency sees it as a tab inside the client's workspace; the client gets the same page on a branded link with none of your navigation, plus a Download PDF button (the browser's print to PDF with a print stylesheet; no PDF library).
- **One window for every number.** A 30 or 90 day selector drives organic, paid, response time and sentiment together, with the previous period beside it.
- **Spend is optional on screen.** Some clients don't want their budget in a shared link. A "Show spend" switch, off by default, hides spend, CPC and cost per result and keeps impressions, reach, clicks and CTR.

## The endpoints that carry each check

All on `https://zernio.com/api/v1`, bearer key server-side only. Checked against docs.zernio.com on October 19, 2026.

1. **ORGANIC:** `GET /analytics/dashboard?profileId=…&fromDate=…&toDate=…&compare=previous_period&topPosts=5`. Returns `totals` and `previousTotals` (impressions, reach, likes, comments, shares, saves, clicks, views, engagementRate), `followers` and `previousFollowers` (`current`, `gained`, `byAccount`), `daily[]` and `topPosts[]`. Both dates are required, UTC days, at most 366 days. Add `&platform=facebook` to match a paid column that runs on Meta. Top posts carry lifetime metrics, so they won't add up to the totals; label them "top posts published in this period".
2. **PAID:** `GET /ads/accounts?accountId={the client's ads connection}` once to find the ad account, then `GET /ads?adAccountId=…&source=all&fromDate=…&toDate=…`. Scope by the ad account: a profile-wide list can come back empty while history syncs. `source=all` includes ads made directly in the platform's ads manager. Each ad has `metrics` (spend, impressions, reach, clicks, ctr, cpc, cpm, conversions, costPerConversion, roas) and a `currency`. A `202` with `backfillPending: true` means Zernio is still pulling history: show "syncing", never a zero.
3. **RESPONSE TIME:** `GET /analytics/inbox/response-time?profileId=…&fromDate=…&toDate=…` returns `summary` (`sampleSize`, `medianSeconds`, `p90Seconds`, `fastestSeconds`, `slowestSeconds`) and `histogram[]` (0–1m, 1–5m, 5–15m, 15–60m, 1–4h, 4–24h, 1d+). Unanswered conversations are excluded, so pair it with `GET /analytics/inbox/volume` (`summary.received`, `sent`, `uniqueConversations`, `byPlatform[]`).
4. **COMMENTS:** `GET /inbox/comments?profileId=…&minComments=1` lists the client's posts with comments, then `GET /inbox/comments/{postId}?accountId=…` returns each comment's `message` and `createdTime`. Cached up to 10 minutes. Instagram, Facebook, YouTube, X, Threads, Bluesky, Reddit, LinkedIn (organization pages) and TikTok (Business).
5. **WHITE LABEL:** nothing to call. It's your route, your CSS and your print stylesheet.

## Honest limits to say out loud

- Follower counts refresh once a day; post metrics are cached for an hour; YouTube daily views arrive two to three days late; Instagram insights run about a day behind. Put an "as of" time on the report (`dataAsOf`).
- Some platforms report views and others impressions; TikTok has no reach. Show what each platform gives instead of inventing a common number.
- Response time covers conversations that got an answer. The reply share comes from the volume endpoint.
- Sentiment is your code's estimate, not Zernio's. A word-list scorer is free and runs offline; swap in a language model when you need nuance. Show who said what nowhere: counts and themes are enough for a report.
- Pricing (zernio.com/pricing, October 19, 2026): two accounts free, then $6, $3 and $1 per connected account per month, every feature included. An ad account counts as an account.

## Files

- `reference/stage-prompts.md`: one prompt per stage, paste-ready.
- The polish loop from white-label-blueprint (`../white-label-blueprint/reference/ui-polish-loop.md`) finishes the look.
