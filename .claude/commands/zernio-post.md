---
description: Publish a content piece to one or many social platforms through Zernio. Reads a manifest.json, uploads media, prompts for approval, posts via Zernio API, verifies it landed, logs the result.
argument-hint: [path/to/manifest.json]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# /zernio-post — Publish via Zernio

You are running the `zernio-publish` skill. The user is asking you to ship a content piece through the Zernio API to one or more social platforms.

## Argument

`$ARGUMENTS` — optional path to a manifest JSON file (e.g. `./manifest.json` or `examples/sample-post.json`).

- If `$ARGUMENTS` is empty: ask the user where their manifest lives, or offer to walk them through creating one from `templates/manifest.json`.
- If `$ARGUMENTS` is a path that doesn't exist: tell the user, suggest `examples/sample-post.json` as a starting point.

## What to do

1. **Read the canonical skill instructions** at `.claude/skills/zernio-publish/SKILL.md`. That file has the full 7-step flow (CHECK → UPLOAD → BUILD → APPROVE → POST → VERIFY → LOG), the field placement rules, and all the gotchas. Follow it exactly.

2. **Resolve the Zernio API key** per `SKILL.md § Resolving the API key`:
   - On Claude Code CLI: check `$ZERNIO_API_KEY`; if unset, auto-source `.env` at the repo root (or next to the manifest) if it exists and contains a non-placeholder value.
   - On claude.ai web: ask the user to paste their key, hold it in conversation memory, never write it to a file.

3. **Run the 7-step flow** from `SKILL.md` exactly as written. Do not skip steps. Do not reorder.

4. **Stop at Step 4 (the approval gate) and wait for explicit human approval.** Silence is not approval. "Looks good" / "OK" / "ship it" counts. Anything ambiguous → re-show the package.

5. **Use `scheduledFor` 2-3 minutes ahead for multi-platform posts.** Never `publishNow: true` — it causes timeouts and duplicate posts.

6. **Run the Step 6 verifier** before reporting success. Zernio's 200 OK means the request was accepted, not that the destination platform applied the fields. YouTube routinely strips title/tags/thumbnail silently.

7. **Write the result to `./posts/YYYY-MM-DD-{slug}.json`** with the full Zernio response, per-platform verification verdict, and ISO timestamp. Skill is NOT complete until this file is written.

## Hard rules — no exceptions

- **Zernio only.** Do not reach for Late MCP, Buffer, Hootsuite, n8n, or any other social-posting tool. If one shows up in your available tools, ignore it.
- **Never invent metadata.** Titles, captions, tags, thumbnails, first-comments — all come from the manifest. If a required field for a platform is missing, fail at Step 1 with a clear message naming the field and the platform.
- **Never auto-publish.** No `--yes` flag, no `ZERNIO_AUTO_APPROVE`, no bypass. Every post passes through the Step 4 approval gate.
- **API key never lives in a file you commit.** Don't write it into the manifest, don't write it into the log, don't echo it back in chat output.

## If the skill isn't installed

If `.claude/skills/zernio-publish/SKILL.md` doesn't exist in this project, the skill is missing. Tell the user:

> The `zernio-publish` skill isn't installed in this project. Install it:
>
> **Claude Code CLI:**
> ```bash
> git clone https://github.com/Trejon-888/zernio-library-skills.git
> cp -r zernio-library-skills/.claude/. ./.claude/
> ```
>
> **claude.ai web:** upload `zernio-publish.skill.zip` from https://github.com/Trejon-888/zernio-library-skills/releases/latest

Then stop — don't try to run the flow without the skill.
