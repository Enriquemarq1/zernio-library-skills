---
name: clip-machine
description: "Turn ONE long video into native TikTok + Reels + Shorts posts — the four stations: CUT (word-level transcript, best moments, 9:16 reframe), CAPTION (burned word captions + per-platform caption text), COVER (per-platform cover rules), POST (one Zernio request per clip). Use when the user hands a long video and wants short clips selected, produced, and published natively everywhere. Triggers: 'run the clip machine', 'turn this video into clips', 'repurpose this video', 'post clips to tiktok reels shorts'."
---

# Clip Machine — one long video in, native posts out

Four stations. Claude runs the first three, Zernio ships the fourth.
No timeline software ever opens.

```
LONG VIDEO → [1 CUT] → [2 CAPTION] → [3 COVER] → [4 POST] → native posts live
```

The math this kills: 1 video → 3 clips × 3 platforms = 9 manual uploads,
every week, forever. With the machine it's 3 requests.

**Starting from zero?** Copy-paste `reference/initiation-prompt.md` to Claude
Code in an empty folder — it sets up the whole system for you.

## STATION 1 — CUT

1. **Transcribe with word timestamps.** WhisperX is the reference model —
   open source, free, runs on your machine (`pip install whisperx`, needs
   ffmpeg):
   `whisperx video.mp4 --model large-v3 --output_format json`
   The JSON gives every word a start/end timestamp via forced alignment
   (GPU: add `--device cuda`; CPU works with `--compute_type int8`). Any
   word-level transcription service works too — the machine only needs
   words with millisecond timing. No ground truth, no clean cut.
2. **Pick the best moments** with the selection framework in
   `reference/best-moments-prompt.md`. That file IS the prompt — paste it
   with the transcript. Core law: **finish the point** — a clip starts at the
   beginning of a thought and ends after the payoff, never mid-sentence.
3. **Cut on word boundaries.** Start ~0.15s before the first word, end
   ~0.25s after the last (never past the next word's start). ffmpeg:
   `ffmpeg -ss {start} -to {end} -i long.mp4 -c:v libx264 -crf 18 -c:a aac clip.mp4`
4. **Reframe to 9:16 (1080×1920).** Crop to the speaker (face-tracking via
   MediaPipe if available; a fixed crop works when the framing is static).
   Screen-share sources: stack the screen crop on top, the face cam below.

## STATION 2 — CAPTION (there are TWO captions — that's the teach)

1. **Burned-in word captions on the video.** Most people watch muted.
   Word-synced from the transcript timestamps (that's why Station 1 needs
   millisecond words), 3-4 words per line, high-contrast, inside the
   caption-safe band (keep out of the bottom ~20% and top ~12% — platform
   UI lives there).
2. **Caption TEXT per platform — never the same text three times.**
   Copy-pasting one caption everywhere is the amateur tell. Claude writes
   all three from the transcript:
   - TikTok: conversational hook + 3-5 niche hashtags.
   - Reels: the first ~125 chars must stop the scroll (that's all that
     shows before "...more").
   - Shorts: barely displays text — put the value in the TITLE instead.
   Full rules per platform: `reference/platform-cheat-sheet.md`.

## STATION 3 — COVER

The first impression is platform-specific — one cover does not fit all:
- **Reels**: the grid shows a 1:1 CENTER crop of your cover. Title text
  must live inside the center square or it gets amputated.
- **TikTok**: pick the cover frame + big readable cover text (profile grid
  is how binge-viewers navigate).
- **Shorts**: pulls a frame — make frame 0 count (cover-as-first-frame:
  the cover IS frame 0, the video starts on frame 1; no 1-second intro
  card — it kills retention).
Details and dimensions: `reference/platform-cheat-sheet.md`.

## STATION 4 — POST (the one-request money shot)

One request per clip through Zernio — the video + the per-platform captions
+ the platform list. Zernio uploads NATIVE to each platform (platforms bury
links and reward native uploads — that's the whole reason the treadmill
exists).

```json
POST https://api.zernio.com/api/v1/posts
{
  "title": "Clip title (YouTube uses this)",
  "content": "fallback caption",
  "mediaItems": [{ "type": "video", "url": "https://.../clip.mp4",
                   "filename": "clip.mp4", "mimeType": "video/mp4" }],
  "platforms": [
    { "platform": "tiktok",    "accountId": "...", "customContent": "TikTok caption + hashtags",
      "platformSpecificData": { "privacy": "PUBLIC_TO_EVERYONE" } },
    { "platform": "instagram", "accountId": "...", "customContent": "Reels caption, hook in line 1" },
    { "platform": "youtube",   "accountId": "...", "customContent": "Shorts description",
      "platformSpecificData": { "title": "Value-first title #Shorts", "visibility": "public",
                                 "categoryId": "27", "madeForKids": false } }
  ],
  "scheduledFor": "2026-08-20T18:30:00Z"
}
```

Media upload for local files: `POST /v1/media/presign` → PUT the file →
use the returned `publicUrl` in `mediaItems`. The full publishing flow
(approval gates, scheduling, verification) lives in the `zernio-publish`
skill — this station rides it.

Hard-won gotchas:
- Post platforms SERIALLY, never two multi-platform posts in parallel.
- A timeout does NOT mean the post wasn't created — GET the post before
  retrying (blind retries create 409s or duplicates).
- Space clips out: 1-2 per day beats 9 in one hour.

## The loop

Clips point viewers to the long video. The long video feeds the machine.
Every clip carries an end-card or caption line back to the source — the
machine is a circle, not a pipe.
