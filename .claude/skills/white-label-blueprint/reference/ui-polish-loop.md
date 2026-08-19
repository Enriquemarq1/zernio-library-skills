# THE POLISH LOOP — from working portal to SaaS-grade dashboard

> One paste. Claude Code loops LOOK → SCORE → FIX until the dashboard passes
> a high SaaS-product bar — twice in a row. Run it after the build stages
> (any time from Stage 3 on). It never rubber-stamps: every pass must either
> find real defects or prove with evidence that the bar is met.

```
Turn this portal's UI into a professional SaaS-product dashboard — and run
the improvement as a LOOP until it truly meets the standard below. Keep the
architecture laws: server-rendered HTML, no React, no build step — design
tokens in one CSS file (:root variables for color/spacing/type/radii/shadows).

THE STANDARD (score each category 0–10 every pass; the bar is 9+):

1. LAYOUT & HIERARCHY — app shell (sidebar or topbar), one 4/8px spacing
   scale, aligned grids, no orphan elements, clear primary action per view.
2. TYPOGRAPHY — one family, a real scale (12/14/16/20/24/32), tabular
   numbers for metrics, no default-browser look anywhere.
3. COLOR & THEME — tokenized palette: one brand accent, neutral greys,
   semantic green/amber/red; WCAG AA contrast; consistent surface levels.
4. COMPONENTS — cards, tables, badges, buttons, inputs, modals share the
   same radii/shadows/borders; hover/focus/active/disabled states on ALL
   interactive elements; status chips (connected / reconnect needed /
   scheduled / failed) are unmistakable at a glance.
5. STATES — every view has designed EMPTY (with a helpful CTA), LOADING
   (skeletons, not spinners-only), ERROR (human message + retry), and
   SUCCESS states. No raw JSON, no unstyled errors, ever.
6. MICRO-INTERACTIONS — transitions 120–200ms, hover affordances, copy
   buttons give feedback, nothing jumps or flashes.
7. RESPONSIVE — clean at 1440, 1024, and 768 (sidebar collapses); no
   horizontal scroll on the page body; tables scroll inside their container.
8. ACCESSIBILITY — visible focus rings, labeled inputs, alt/aria where due,
   keyboard-navigable menus and modals.
9. DATA PRESENTATION — numbers formatted (1.2k, not 1234), dates humanized
   ("2h ago"), charts minimal and labeled, no fake data left anywhere.
10. PRODUCT FEEL — the agency brand carried everywhere (logo, accent,
    favicon, page titles); it reads as a real product screenshot, not a demo.

THE LOOP (repeat until DONE):
a. RENDER: start the server; with headless Chrome (or Playwright) capture
   full-page screenshots of the agency dashboard AND the client connect page
   at 1440px and 768px. Save to _polish/pass-{N}/ (gitignored) — keep every
   pass; the before/after is part of the deliverable.
b. LOOK at the screenshots (actually read the images) and score all 10
   categories honestly. List every defect you can see, tagged P0 (breaks the
   standard) / P1 (visible flaw) / P2 (nitpick).
c. Print the pass scorecard: pass number, 10 scores, defect list.
d. FIX every P0 and P1 (P2s as time allows). Commit after each pass with
   message "polish pass N: {score summary}".
e. Repeat. DONE = two CONSECUTIVE passes where all 10 categories score 9+
   AND zero P0/P1 remain. If you hit pass 8 without converging, stop and
   hand me the scorecard with what's still failing and why.

Rules: never lower the bar to pass; never claim a category is 9+ without
pointing at the screenshot evidence; if a fix regresses another category,
the loop catches it next pass — fix forward, don't hide it. When DONE, show
me the final scorecard + the pass-1 vs final side-by-side.
```

**Why it works:** the screenshots make Claude judge what a USER sees (not
what the code says), the scorecard forces specificity, and the
two-clean-passes exit kills "good enough" drift. The `_polish/` folder gives
you the before/after montage for free.
