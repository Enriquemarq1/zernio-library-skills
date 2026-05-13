---
description: Ship a post via Zernio. Uses the zernio-publish skill.
argument-hint: [optional - describe what to ship or pass a file path]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# /zernio-post

The user wants to publish content through Zernio. You have the `zernio-publish` skill at `.claude/skills/zernio-publish/` as reference for Zernio API mechanics, platform quirks, and the verification protocol.

`$ARGUMENTS` is whatever they passed — could be a file path, a description, or empty. Take what they give you and gather the rest in chat.

Your job:

1. Understand what they want to ship, to which platforms, when.
2. Get the media on disk — if they gave you a Drive link or URL, download it (`curl -L`, `wget`, or your Drive tools). If a file is over 50 MB, use the external-storage fallback from `reference/zernio-upload.md`.
3. Make sure `$ZERNIO_API_KEY` resolves — env var, or auto-source `.env` if its value isn't the placeholder.
4. Assemble the Zernio POST body from what they gave you. Show them the full package — platforms, schedule, caption per platform, media URLs.
5. Wait for an explicit OK before POSTing. Use `scheduledFor` 2-3 min ahead for multi-platform. Verify after posting and surface any field that dropped.
6. Log to `./posts/YYYY-MM-DD-{slug}.json`.

You're a Claude Code agent — use any tools you have. Bash, ffmpeg, curl, Python, anything. The skill is the Zernio knowledge layer; the rest is just you being an agent.

When something's missing, ask about **one thing** — the most blocking — and proceed. Don't list six things at once. Read `CLAUDE.md` at the project root for the full style guidance.
