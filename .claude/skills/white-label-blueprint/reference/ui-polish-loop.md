# THE POLISH LOOP — from working portal to SaaS-grade dashboard

> One paste. Claude Code loops AUDIT → SCORE → FIX until the dashboard passes
> a high SaaS-product bar — twice in a row. Run it after the build stages
> (any time from Stage 3 on). It never rubber-stamps: every pass must either
> find real defects or prove with evidence that the bar is met.
>
> **Style-agnostic.** Fill the `YOUR STYLE` slot with your own direction — a
> brief, a reference screenshot, a token list, or nothing at all. The loop
> never overrides your taste. It enforces that your style is applied
> *consistently* and that the accessibility and data floors are met.

````
Turn this portal's UI into a professional SaaS-product dashboard — and run
the improvement as a LOOP until it truly meets the standard below. Keep the
architecture laws: server-rendered HTML, no React, no build step — design
tokens in one CSS file (:root variables for color/spacing/type/radii/shadows).

YOUR STYLE: {paste your direction here — a brief, a screenshot, a palette, or
"clean modern SaaS" if you have none. Never override it to hit the bar; if a
token of mine breaks the accessibility floor, change the smallest thing that
fixes it, keep the intent, and tell me what you changed and the measurement
that forced it.}

THE STANDARD (score each category 0–10 every pass; the bar is 9+):

1. LAYOUT & HIERARCHY — a real app shell (persistent nav), one spacing scale,
   aligned grids, no orphan elements, one obvious primary action per view.
2. TYPOGRAPHY — one family, a declared scale reused everywhere, tabular
   figures for any number in a column, no default-browser rendering anywhere.
3. COLOR & THEME — tokenized palette in ONE place; changing the accent token
   must rebrand the whole app. Consistent surface levels. WCAG AA on every
   text pairing (4.5:1 normal, 3:1 large) — measured, not eyeballed.
4. COMPONENTS — cards, tables, chips, buttons, inputs, modals share radii /
   shadows / borders; hover, focus, active and disabled on ALL interactive
   elements; status chips (connected / reconnect needed / scheduled / failed)
   unmistakable at a glance.
5. STATES — every view has designed EMPTY (with a useful CTA), LOADING
   (skeletons that actually render), ERROR (human sentence + retry), and
   SUCCESS. No raw JSON, no unstyled errors, no dead ends. This INCLUDES the
   framework's own error pages: a bare "Cannot GET /path", a stack trace or a
   white screen is an automatic 0. Ship a styled 404 and 500.
6. MICRO-INTERACTIONS — transitions on interactive elements, copy/save give
   visible feedback, nothing jumps after load, prefers-reduced-motion honoured.
7. RESPONSIVE — clean at 1440, 1024 and 768; nav collapses; the page body
   never scrolls horizontally; wide content scrolls inside its own container.
8. ACCESSIBILITY — visible focus rings, every control has an accessible name,
   correct heading order (one h1, no skipped levels), labels bound to real
   inputs, img alt, decorative svg aria-hidden, modals are real modals.
9. DATA INTEGRITY — the hardest category, and the one most often faked. Score
   it against the API, not the screen. The failure mode is not fake data — it
   is REAL data computed wrong, which looks completely convincing:
     · aggregates computed over the WHOLE window, never the current page
     · anything labelled a total IS the total; if it's a page, say so
     · time windows filtered by DATE, never by array position
     · numbers formatted (1.2k), dates humanized ("2h ago"), units stated
     · where two figures can legitimately disagree, label them so they don't
       read as a contradiction
     · every field rendered is one you PROBED in a live response, not one you
       inferred from docs or from its name
10. PRODUCT FEEL — brand everywhere (mark, accent, favicon, page titles); no
    placeholder copy, no lorem, no TODO. Reads as a product, not a demo.

SOCIAL-APP SPECIFICS (fold into the categories above):
 · real platform brand logos, not letter tiles; correct casing (TikTok,
   LinkedIn, X) — never raw API slugs (tiktok, metaads)
 · the same platform can appear several times under one owner — every account
   row must be unambiguous about WHICH handle it is
 · connection health (connected / needs reconnection / not connected) readable
   at a glance, with a one-click path to fix a broken token
 · a post to four platforms can succeed on three — never roll per-platform
   status into a single status when the API gives you both
 · scheduling shows its timezone and is never ambiguous
 · platform rules (character limits, media requirements) surface as text
   BEFORE submit, not as a failure after
 · inbox threads show direction, sender, timestamp, and which of your accounts
   a reply sends from
 · destructive actions on a live post or a real audience are confirmed, clearly
   labelled, never the default; if the API refuses an operation in some states,
   don't render the button in those states

THE AUDIT — run all four every pass, BEFORE scoring.
Screenshots alone are not sufficient evidence and never will be. Most real
defects are invisible in a render, and a screenshot pass only ever walks the
happy path, so it structurally cannot find a broken link.

A. SCREENSHOTS — full-page, 1440 and 768, every view, into _polish/pass-{N}/.
   Actually read the images.

B. DOM — in each live view, check: unnamed controls, dangling label[for],
   heading order, bare svg, missing img alt, horizontal overflow, and measured
   contrast on every pairing you ship. Confirm transitions and focus rules
   exist on interactive elements.

C. DATA — for every number on screen, trace it to its source call. Confirm the
   denominator, the window, and the total. Where a value comes from a paginated
   response, confirm you are not presenting a page as the whole.

D. ROUTES — the happy path is the one path a screenshot pass always takes, so
   route bugs survive every visual pass and then greet the user on day one.
   1. Crawl every link the app generates — fetch each view, extract every
      href, action and <option value>, request them all. Nothing may 404 or
      500, and nothing may contain "//" (a doubled slash means a URL builder
      concatenated an empty or wrongly-typed segment).
   2. Request the ugly URLs by hand, confirm each returns a STYLED page:
      trailing slash, doubled slash, unknown sub-path, missing id, non-existent
      id, bare unrouted path.
   3. Feed every query param a hostile value — out of range (month=13), wrong
      type, empty, traversal string. A param that fails validation must fall
      back visibly, never render a broken string, and never silently show
      different data than it claims.
   4. Confirm every deep link works pasted cold into a fresh tab.

GREP each pass for leaks: vendor names in a white-labelled UI, TODO, lorem,
placeholder, hardcoded test values.

PROVING STATES: a loading state you cannot screenshot is decorative. Add a
dev-only hook (e.g. ?delay= and ?fail=, gated on NODE_ENV !== 'production')
so empty / loading / error are all reachable, and capture each as evidence.
Note a headless screenshot with a virtual-time budget WAITS for pending
fetches — capture the loading frame at load, without that flag.

KNOWN TRAPS — cheap to check, expensive to ship. Verify each explicitly:
 · URL built from the wrong variable — a switcher emitting /x/<id>// because
   "active section" was a path on one page and a slug on another
 · no framework error handler — "Cannot GET /path" in Times New Roman
 · unvalidated range param — ?month=13 rolls into next year, prints "undefined"
 · dead link still functional — an invite/connect link for a deleted record
   still rendering working auth buttons
 · paginated page shown as a total — "50 posts" when the account has 319
 · aggregate over one page — summing the visible 8 of 161 and calling it total
 · window filtered by index — "last 28 days" that is the last 28 ROWS
 · action the API refuses — a Delete button on a state the endpoint rejects,
   with the error swallowed
 · component built but never called — a skeleton exported, styled, never rendered
 · vendor name in a white-label UI — found by grep, never by eye

THE LOOP (repeat until DONE):
a. RENDER: start the server, capture every view at 1440 and 768 into
   _polish/pass-{N}/ (gitignored). Keep every pass; the before/after is part
   of the deliverable.
b. AUDIT: run A, B, C and D. All four, every pass.
c. SCORE: print the pass scorecard — pass number, all 10 scores, and every
   defect tagged P0 (breaks the standard) / P1 (visible or measurable flaw) /
   P2 (nitpick). Cite evidence for each: a screenshot region, an audit value,
   or an API response.
d. FIX every P0 and P1 (P2s as time allows). Commit after each pass with
   message "polish pass N: {score summary}".
e. Repeat. DONE = two CONSECUTIVE passes where all 10 categories score 9+ AND
   zero P0/P1 remain. A pass needing no code changes still counts, provided
   the full audit ran. If you hit pass 8 without converging, stop and hand me
   the scorecard with what's still failing and why.

RULES: never lower the bar to pass. Never claim a category is 9+ without
evidence — point at the screenshot, the audit number, or the API response;
"looks fine" is not a score. Fix forward — if a fix regresses another
category the next pass catches it; don't hide it. Report honestly: a pass
that finds a P0 in your own earlier work is a BETTER pass than one that finds
nothing. With real accounts connected, never publish, delete, unpublish or
send a message as part of the loop — build the UI, leave the trigger to a
human. When DONE, show me the final scorecard + the pass-1 vs final
side-by-side.
````

**Why it works:** the screenshots make Claude judge what a USER sees (not what
the code says), the scorecard forces specificity, and the two-clean-passes exit
kills "good enough" drift. The `_polish/` folder gives you the before/after
montage for free.

**Why the audit is four parts:** a screenshots-only loop can score 9/10 for
eight passes on a portal that 404s the moment you use the nav — because it
never leaves the happy path. Audit B catches what the eye can't measure
(contrast, heading order, label bindings), C catches numbers that are wrong
rather than ugly, and D catches the bugs that only appear when a real user
pastes a URL or clicks the one control the screenshots never exercised.
