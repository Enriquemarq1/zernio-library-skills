# The Best-Moments Prompt (Station 1 selection framework)

Paste this prompt to Claude together with the word-timestamped transcript
(or a sentence-grouped version with timestamps). It is the exact framework —
selection rules, scoring, anchors, and red flags.

---

You are selecting short-form clips from a long-form video transcript. Your
job is to find moments that stand alone as compelling short videos for
TikTok, Instagram Reels, and YouTube Shorts.

## What makes a great clip (all four required)

1. **Strong opening** — the first 3 seconds must hook: a bold claim, a
   number, a relatable pain, a curiosity gap. If the hook needs setup, it
   is not a hook.
2. **Self-contained** — a viewer who never saw the full video must
   understand it. No "as I mentioned earlier", no references to something
   on screen that won't be in the clip.
3. **Finish the point** — start at the beginning of a thought, end after
   the complete payoff, punchline, or conclusion. Never cut mid-idea. A
   clip that finishes its point beats a shorter clip that doesn't.
4. **One message** — exactly one takeaway per clip. Multi-topic segments
   get split or trimmed.

## Duration

Target 45–90 seconds. 30–45s is fine when the moment is exceptionally
strong. Under 30s almost never carries a complete point from long-form.

## Score every candidate (0–20 each, 100 max)

| Category | What 18–20 looks like |
|---|---|
| Hook strength | impossible to scroll past in the first 3 seconds |
| Value delivery | the viewer saves it — a framework, a number, a step-by-step |
| Clarity | one crystal-clear message, zero effort to follow |
| Shareability | "I need to send this to someone" |
| Completeness | feels like it was always meant to be a short |

Rank by total score; break ties with hook strength. Flag anything under 50.

## Anchor every clip in verbatim words

For each selected clip return:

```json
{
  "id": 1,
  "title": "descriptive-kebab-case-title",
  "srt_start_words": "five to eight EXACT words from the transcript",
  "srt_end_words": "five to eight EXACT words from the transcript",
  "time_start_estimate": 45.0,
  "time_end_estimate": 120.0,
  "hook_summary": "why this hooks in 3 seconds",
  "category": "educational | tactical | inspirational | personal_story | entertaining",
  "scores": { "hook": 0, "value": 0, "clarity": 0, "share": 0, "complete": 0 }
}
```

Anchors must be copy-pasted verbatim (5–8 consecutive words, distinctive
ones — numbers, product names, unique phrases — never "and then we" or
"so basically"). The anchors get matched back to word timestamps to cut
frame-accurately; paraphrased anchors break the cut.

## Red flags — skip these moments

- Starts with "um", "so", "bueno", "anyway" or any filler → move the start
  to the first real word.
- References something visible on screen that the clip won't include.
- Inside jokes that need full-video context.
- Long pauses or dead air inside the window (or plan an internal cut).
- The speaker's camera is frozen or broken in that window — CHECK the
  actual frames of the segment before producing, not just the transcript.
- "As I said before / like I mentioned" — the clip admits it's a fragment.

## Also allowed: internal trims (radio edit)

A great 90-second moment often carries 15 wasted seconds in the middle
(a tangent, a technical aside). Mark internal cut windows — start/end on
word boundaries, keep the breath before a sentence — so the clip flies
from hook to payoff. Two or three segments concatenated is normal.
