# The look: a dashboard that feels like a real product

The report in the video uses the same calm design language as Zernio's own dashboard: white cards, thin warm borders, one accent colour, dense tables with coloured metric icons, and ranked rows that make the winner obvious. Paste this whole file into Stage 6, or hand it to your agent with "apply this design system to the whole app". Swap the accent and the agency mark for your own brand; keep the rest.

## Tokens

| Token | Value | Use |
|---|---|---|
| Page and cards | `#FFFFFF` | background |
| Text, primary buttons | `#2D2D2D` (charcoal) | body text, the dark pill buttons |
| Sidebar, icon tiles, table tint | `#F0EFEB` (cream) | the sidebar and every small icon tile |
| Borders and inputs | `#D9D8D3` | 1px, on every card, row and table line |
| Secondary text | `#6B6B6B` | labels, table headers, dates |
| Active nav item | charcoal at 6% | the selected sidebar item |
| **Accent** | `#EB3514` (swap for your brand) | the winner row, the winner's bar, badges, focus rings. Nothing else |
| Accent soft | accent at 6% | the winner row's background |
| Success | `hsl(163 94% 24%)`, subtle at 12% | positive deltas, engagement-rate pills |
| Danger | `hsl(0 74% 42%)`, subtle at 12% | negative deltas, negative sentiment |
| Radius | 8px cards, 4–6px small parts, full for pills | |
| Font | Geist (Google Fonts), Menlo/Consolas for code | everything |

No shadows, no gradients. Colour comes from the data (bars, pills, deltas) and from the platforms' own logos.

## The five patterns

1. **Sidebar and switcher.** A cream sidebar with a thin right border. On top, the workspace switcher: the agency's mark (your logo, or your own face in a circle), the workspace name in 14px semibold with a small grey label beside it ("Client"), the agency name under it, up/down chevrons. Nav items in 14px with a line icon; the active one on charcoal-6%. At the foot, one dark charcoal pill button with white text (the client report link, for example).
2. **Cards.** White, 1px `#D9D8D3`, 8px radius, 20–24px padding. Title in 15–16px semibold at the top left; a small grey meta at the top right ("avg 2.5%", "top 5", the date range).
3. **Ranked rows.** For anything with a winner: content formats, top ads, the response-time spread, followers by account. Each row is its own bordered box:
   - a 36px cream icon tile;
   - the label in 14px, with a sub-line under it ("12 posts · +444% vs avg"), the delta in success or danger;
   - a horizontal bar, accent for the winner and grey `#B9B8B2` on a `#EAE9E5` track for the rest;
   - the value at the far right in 16px semibold.

   The winner row has the accent-soft background, an accent border and a small outlined **BEST** badge with a trophy icon.
4. **Tables.** The header row in 12–13px grey, each metric with its own small coloured icon and a sort caret (click to sort):

   | Metric | Icon | Colour |
   |---|---|---|
   | Likes | heart | `#E5484D` |
   | Comments | bubble | `#3B82F6` |
   | Shares | arrow | `#16A34A` |
   | Saves | bookmark | `#F59E0B` |
   | Clicks | cursor | `#7C3AED` |
   | Views | eye | `#8B5CF6` |
   | Impressions | chart | `#2563EB` |
   | Reach | people | `#7C3AED` |

   Rows in 13px with thin dividers and the platform's real logo at 16px beside its name. Numbers right-aligned, "–" where the platform doesn't report a metric. A post row shows its text on one line (truncated) with the date under it in 11px grey.
5. **Pills and deltas.** Engagement rate as a pill: success-subtle background, success text, 11–12px, full radius. Every KPI card shows its change against the previous period under the number: ▲ in success, ▼ in danger.

## Where it goes

Everywhere the client or the agency looks:
- the agency shell and every workspace tab;
- the client's report link;
- the connect page;
- the PDF. Keep the print stylesheet A4, one section per page, with your mark in the header and "Prepared by {agency}" in the footer.

No vendor name, link or "powered by" on anything the client sees.

## Check it

Screenshot every page at 1440 wide and put it beside a page of a product you admire. Same density, same borders, same quiet type? Then run the polish loop until two passes in a row find nothing.
