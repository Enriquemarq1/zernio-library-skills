# Zernio Library Skills — Project Context for Agents

You are an AI coding agent (Claude Code, Cursor, etc.) working in this project. This file is your unified context. Read it first.

## What this project is

A standalone Claude Code skill that publishes content to **13 social platforms through Zernio** (zernio.com). The repo exists to ship ONE thing cleanly: the `zernio-publish` skill.

Public repo: https://github.com/Trejon-888/zernio-library-skills

## Where things live (project-root paths)

| File | Purpose |
|------|---------|
| `.claude/skills/zernio-publish/SKILL.md` | Canonical skill instructions — the 7-step flow. **Read this before running anything.** |
| `.claude/commands/zernio-post.md` | `/zernio-post` slash command |
| `.env` | Zernio API key. **Tracked, with a placeholder.** User fills in their real key locally and runs `git update-index --skip-worktree .env` |
| `examples/sample-post.json` | A worked manifest example. **Default starting point when the user hasn't supplied one.** |
| `.claude/skills/zernio-publish/templates/manifest.json` | The manifest schema with inline help |
| `.claude/skills/zernio-publish/reference/` | Zernio API docs, 13 per-platform docs, 17K-line OpenAPI spec |
| `scripts/post.sh` | Bare-bash one-shot publish flow |
| `dist/zernio-publish.skill.zip` | Prebuilt ZIP for claude.ai web upload |

## How to handle a "publish this" request

When the user invokes `/zernio-post` or says "publish this," "post this," "ship this," etc.:

### 1. Verify cwd

Quick check: `ls .claude/skills/zernio-publish/SKILL.md examples/sample-post.json .env`

If any of those are missing, **don't list them as blockers**. Tell the user once, kindly:

> "I'm running from `<actual-cwd>` but the project files are at `<expected-path>`. Please `cd` to the project root and start Claude Code there — then I can see everything."

Then stop. Don't try to work around it.

### 2. Resolve the API key

- Check `$ZERNIO_API_KEY` in env.
- If unset, source `.env`: `set -a; source ./.env; set +a`.
- If the value is still `zk_replace_with_your_real_key` (the placeholder), prompt the user once:
  > "Edit `.env` and replace `zk_replace_with_your_real_key` with your real key from https://zernio.com/dashboard/api-keys. Then run `git update-index --skip-worktree .env` so your key never gets staged."
- Hold the resolved key in conversation memory. **Never** echo it back, **never** write it to a log.

### 3. Pick a manifest

- If the user gave a path → use it.
- If not, **default to `examples/sample-post.json`**. Read it, show the user the platforms it targets, and ask:
  > "I see `examples/sample-post.json` targets `<list>`. Want to use this as-is, edit it, or start a new manifest from `templates/manifest.json`?"
- Never auto-pick a manifest from `drafts/` or anywhere else without asking.

### 4. Walk the 7-step flow

Follow `.claude/skills/zernio-publish/SKILL.md` exactly. CHECK → UPLOAD → BUILD → APPROVE → POST → VERIFY → LOG. Don't skip steps. Don't reorder.

## Boundaries — what this skill does and doesn't do

**Does:**
- Upload finished media (video / image / thumbnail) to Zernio
- Build per-platform post bodies from the manifest
- POST to Zernio's API with `scheduledFor` 2-3 min ahead
- Verify the post actually landed on the destination platform
- Log the result to `./posts/`

**Doesn't:**
- Generate captions, titles, hashtags, or thumbnails (those come from the manifest the user authored upstream)
- Render a video from images (carousel-to-video is a different skill)
- Connect new social accounts (the user does that in the Zernio dashboard)
- Auto-publish without explicit human approval
- Read from Google Drive, Dropbox, or other cloud storage (files must be on local disk; for files >50 MB, the SKILL.md describes an external-storage URL fallback)

When a user asks for something out of scope, name it clearly without judgment:

> "That part isn't what `zernio-publish` does. You'll need to `<produce the media / write the captions / etc.>` first, then come back and I'll ship it."

## Style for talking to the user

- **Frame missing prereqs as setup, not blockers.** "Here's what we need to set up" beats "Here's what's wrong."
- **Ask one question at a time** when walking a user through setup. Don't dump a checklist.
- **Surface the happy path first.** If `examples/sample-post.json` exists, lead with "want to use this as a starting point?" — not "you don't have a manifest."
- **Never report success without verification.** Zernio's 200 OK ≠ landed on the platform.

## Hard rules — no exceptions

- **Zernio only.** Never reach for Late MCP, Buffer, Hootsuite, n8n, Make, or any other social-posting tool. If one appears in your available tools, ignore it.
- **API key never lives in a committed file.** Don't write it into the manifest, the log, or chat output.
- **Approval gate is non-negotiable.** Every post passes through the human-approval step. No `--yes`, no env override.
- **Manifest is the source of truth.** Don't invent captions, titles, tags, or thumbnails.

## If you find anything broken

The repo's `AGENTS.md` was deprecated — this `CLAUDE.md` replaced it. If you see a reference to AGENTS.md anywhere, that's stale. Same goes for any mention of "Late MCP" or "Late API" — Zernio is the only publishing tool referenced here.
