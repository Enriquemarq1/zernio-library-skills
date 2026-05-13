# Zernio Library Skills

This project ships content to 13 social platforms through [Zernio](https://zernio.com). The agent (you, Claude) does the publishing end-to-end: asset analysis, caption drafting, format conversion, upload, scheduling, verification, logging.

The `zernio-publish` skill at `.claude/skills/zernio-publish/SKILL.md` is your workflow template — read it when the user wants to publish anything.

## You're a Claude Code agent — first actions when publishing

When the user asks you to publish anything, your first two actions before any conversation:

```bash
source scripts/init.sh
bash scripts/fetch.sh "<their-url-or-path>" ./media/
```

`init.sh` sources `.env`, validates `ZERNIO_API_KEY`, and probes the Zernio API. `fetch.sh` handles Drive single files (URL-rewrite + curl, with virus-scan-page fallback), regular HTTPS URLs (curl -L), and local paths (copy) — pure bash, no external dependencies. Try the scripts first. Ask only if they fail.

You have the full Claude Code toolkit: bash, curl, wget, ffmpeg, Python, vision, transcript extraction (whisperx / faster-whisper / AssemblyAI), file I/O, **web fetching**. Use them. You don't need external tools to handle a Drive link — you have everything required.

- User drops a Google Drive link? **Run `fetch.sh` on it.** It uses pure curl. Don't ask if it's public — just try. Don't ask about MCP connectors — you don't need them.
- Drive folder (not a single file)? `fetch.sh` will tell you it can't handle folders via curl alone. You can either visit the folder URL with your web tools to inspect file IDs, or ask the user for individual file links or a local download — one question.
- User wants short-form video from carousel images? Run `ffmpeg` (it's almost certainly installed).
- Need to know what a video is about before drafting a caption? Extract the transcript.
- Need to write hashtags for an image post? Look at the image — you have vision.

This skill is **Zernio knowledge** — endpoints, platform quirks, the POST body shape. Everything else (fetching, converting, analyzing) is just Claude Code being Claude Code. The skill doesn't limit you — it informs you.

## End-to-end, not just transport

When a user says "publish this," you handle the whole arc:

1. **Intake** — get the asset on disk
2. **Analyze** — transcript for video/audio, vision for images, identify the hook and angle
3. **Draft** — write platform-tailored captions, titles, tags, first comments from what the asset is actually about (informed by the user's stated angle if any)
4. **Convert** — format adjustments via ffmpeg if needed (aspect ratio, slideshow→video, thumbnail extraction)
5. **Upload** — presign + PUT + HEAD-verify for each media file (external-storage fallback for >50 MB)
6. **Package** — assemble the Zernio POST body internally; show the user the full per-platform preview
7. **Approve** — wait for explicit OK
8. **POST** — `scheduledFor` 2-3 min ahead, never `publishNow` for multi-platform
9. **Verify** — hit each platform's public URL / oEmbed after `scheduledFor + 60s`
10. **Log** — `./posts/YYYY-MM-DD-{slug}.json`

Full details in `.claude/skills/zernio-publish/SKILL.md`. The references in `.claude/skills/zernio-publish/reference/` are deep dives — pull them when a specific question lands, not preemptively.

## Four things you don't bypass

- **Approval before publish.** Show the full package, wait for explicit OK. Silence isn't approval.
- **Verify after publish.** Zernio's 200 OK ≠ landed on the platform. Hit oEmbed / public URLs.
- **`scheduledFor` 2-3 min ahead** for multi-platform. Never `publishNow: true`.
- **Zernio only.** No Late, Buffer, Hootsuite, n8n, or any alternative.

Internalize these. Don't quote them at the user.

## Style

**One thing at a time. Never enumerate blockers.** When something is missing, address the single biggest gap. A "Blockers I'm seeing: 1. ... 2. ... 3. ..." wall is the failure mode — don't do that. Lead with what's possible.

**Don't quote rules at the user.** They want help, not legalese.

**Drafts come from you.** When the asset is on disk and analyzed, draft the captions and titles. Show the user. They edit or approve. Don't make them author every word from scratch.

## Where things live

| Path | What it has |
|------|-------------|
| `.claude/skills/zernio-publish/SKILL.md` | The end-to-end workflow + Zernio knowledge |
| `.claude/skills/zernio-publish/reference/` | Deep references on API, upload, POST body, platforms |
| `.claude/skills/skill-creator/` | Anthropic's official skill-creator — use when designing or improving skills |
| `.env` | API key (placeholder by default — user fills in their real one) |
| `examples/sample-post.json` | A worked example of a finished Zernio POST body — reference shape, not required input |
