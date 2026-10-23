# White-Label Client Report: the stage prompts

Paste one at a time into Claude Code, inside the app that already has one Zernio profile per client (the white-label-blueprint app, or your own). Each stage is a visible win. The Zernio API key stays in `.env` and never goes on screen. Docs the session can read: https://docs.zernio.com (every page also reads as text at `<path>.mdx`).

---

## STAGE 0 · Read the app, add the Report tab

```
This app is my agency's white-label social media portal on the Zernio API
(one Zernio profile per client). Read the codebase first and keep its
framework, routing, styles and data model. Don't add a database.

Add a "Report" tab to each client's workspace at /w/:profileId/report.
For now it shows:
- my agency's logo and name at the top (from the app's existing brand
  settings), the client's name, and the report period;
- a period selector: last 30 days or last 90 days, each compared with the
  period before it;
- four empty sections in this order: Organic, Paid, Community, Sentiment.

Keep the key server-side. Show me the empty report for one client.
```

## STAGE 1 · Organic in one call

```
Fill the Organic section with Zernio's one-call analytics dashboard:

GET https://zernio.com/api/v1/analytics/dashboard?profileId={id}
  &fromDate={from}&toDate={to}&compare=previous_period&topPosts=5

(read https://docs.zernio.com/analytics/get-analytics-dashboard.mdx).

Show:
1. Four headline numbers with the change against the previous period:
   views + impressions, engagement rate, followers gained, current followers.
2. Followers by account, one row per platform with its real logo.
3. A daily line for views and engagement (inline SVG, no chart library).
4. A "Platform breakdown" table, one row per platform: posts, likes,
   comments, shares, saves, clicks, views, impressions, reach and engagement
   rate, from GET /v1/analytics/daily-metrics?profileId={id}&fromDate={from}
   &toDate={to} (its platformBreakdown; pass the dates, not days=).
5. A "Top performing posts" table: the top 5 posts of the period from
   GET /v1/analytics?profileId={id}&fromDate={from}&toDate={to}, with the
   post's text on one line, its date, platform and the same metrics. Label
   them as lifetime metrics; they won't add up to the totals.
6. A "Content format breakdown": group those posts by their mediaType
   (text, image, video, carousel), show each format's average engagement
   rate, its post count and how far it is above or below the average, and
   mark the best one.
7. A small "Data as of" line from dataAsOf.

Some platforms report views, others impressions, TikTok has no reach: show
what exists, never fill gaps with zeros that look like results.
```

## STAGE 2 · Paid next to organic

```
Fill the Paid section, right beside Organic, for the same client and the
same dates:

1. Find the client's ad account once: the client's ads connection (for
   Meta, the account with platform "metaads") ->
   GET https://zernio.com/api/v1/ads/accounts?accountId={that account's id}
   lists its ad accounts. Let me pin one per client (adAccountId) in the
   client's settings.
2. GET https://zernio.com/api/v1/ads?adAccountId={pinned id}&source=all
     &fromDate={from}&toDate={to}
   (read https://docs.zernio.com/ad-campaigns/list-ads.mdx and
   https://docs.zernio.com/ad-accounts/list-ad-accounts.mdx). Filtering by
   the ad account is the reliable scope; a profile-wide list can come back
   empty while the history is still syncing.

Then:

1. Sum the ads' metrics for the period: impressions, reach, clicks, CTR,
   and spend, CPC and cost per result in the ad account's currency.
2. Lay Organic and Paid out as two columns with the same rows where they
   match (impressions, reach, clicks), so the client reads them side by side.
3. A "Show spend" switch, off by default: when off, hide spend, CPC and cost
   per result everywhere, including the client link and the PDF.
4. Number of active ads and the top 3 ads by clicks (name, status, clicks,
   CTR).
5. If the API answers 202 with backfillPending, show "Syncing your ad
   history" instead of zeros. If the client has no ads, say "No ads running
   in this period" plainly.
```

## STAGE 3 · Community: how fast the brand answers

```
Fill the Community section from Zernio's inbox analytics, same client and
dates:

GET https://zernio.com/api/v1/analytics/inbox/response-time?profileId={id}
  &fromDate={from}&toDate={to}
GET https://zernio.com/api/v1/analytics/inbox/volume?profileId={id}
  &fromDate={from}&toDate={to}

(read https://docs.zernio.com/inbox-analytics/get-inbox-response-time.mdx).

1. The headline: median time to first reply, in plain words ("3 minutes",
   "1 hour 30 minutes").
2. The share of replies sent within one hour, from the histogram.
3. The histogram as horizontal bars: under 1 min, 1 to 5 min, 5 to 15 min,
   15 to 60 min, 1 to 4 h, 4 to 24 h, over a day.
4. Messages received, messages sent and conversations, by platform.
5. One line under it: "Response time counts conversations that got an
   answer." Numbers only: no message text, no names.
```

## STAGE 4 · Sentiment, built on top

```
Zernio returns the raw comments; the analysis is ours. Fill the Sentiment
section:

1. GET https://zernio.com/api/v1/inbox/comments?profileId={id}&minComments=1
   lists the client's posts that have comments; for each post in the period,
   GET /v1/inbox/comments/{postId}?accountId={accountId} returns its
   comments (read https://docs.zernio.com/comments/list-inbox-comments.mdx).
   Skip the brand's own replies (from.isOwner).
2. Score each comment positive, neutral or negative with the "sentiment"
   npm package (word-list scorer, free, no API key). Keep the scorer behind
   one function, scoreComment(text), so an LLM can replace it later.
3. Show the counts and percentages as one stacked bar, the number of
   comments read, and the three most frequent words in negative comments as
   "worth a look".
4. Never show commenter names or full comment text on the report. Cache the
   scores in memory for 10 minutes, the same as Zernio's cache.
```

## STAGE 5 · White label: the client's link and the PDF

```
Make the report something I hand to the client, under my brand only:

1. /c/:profileId/report renders the same report with the client-facing
   shell the app already uses for the connect page: my logo, my colours, none
   of my agency navigation, and no vendor name anywhere (check the page
   source too).
2. A "Download PDF" button that uses the browser's print to PDF with a print
   stylesheet: A4, my logo in the header, the period and "prepared by
   {agency}" in the footer, page breaks between sections.
3. A "Copy client link" button on the agency tab.
4. The spend switch from Stage 2 applies to the link and the PDF.

Open the client link in a private window and show me there is no vendor
name on the page or in the PDF.
```

## STAGE 6 · The look

```
Apply the design system in reference/design-system.md to the WHOLE app:
the agency shell and sidebar, every workspace tab, the Report tab, the
client's report link, the connect page and the PDF. Use its tokens, its
five patterns (sidebar and switcher, cards, ranked rows, tables with the
coloured metric icons, pills and deltas) and its font. Swap the accent for
my brand colour [YOUR HEX] and use my logo (or my photo, in a circle) as the
agency mark everywhere the agency appears, including the favicon. Keep every
route and behaviour, and keep the client pages free of any vendor name.
Screenshot every page at 1440 wide when you're done and show me.
```

## STAGE 7 · Polish

```
Run the polish loop in ../white-label-blueprint/reference/ui-polish-loop.md
on the Report tab and the client link, until two consecutive clean passes.
Keep the design system from Stage 6.
```
