---
description: Publish a content piece to one or many social platforms through Zernio. Reads a manifest.json, uploads media, prompts for approval, posts via Zernio API, verifies it landed, logs the result.
argument-hint: [path/to/manifest.json]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# /zernio-post — Publish via Zernio

You are running the `zernio-publish` skill. Use `CLAUDE.md` at the project root as your unified context. If you have not read `CLAUDE.md` in this conversation, read it now.

`$ARGUMENTS` — optional path to a manifest JSON file.

## How to behave

**Lead with the happy path, not the blockers.** When the user invokes this command, walk them through setup as a guided flow — one question at a time. Do not dump a checklist of missing pieces.

### Step A: Confirm you can see the project

Run:
```bash
ls .claude/skills/zernio-publish/SKILL.md examples/sample-post.json .env 2>/dev/null && echo OK
```

If you get `OK`, the cwd is correct. Continue.

If you get nothing or errors, the cwd is wrong. Tell the user once, kindly:

> "I'm running from `<pwd>` but the project files aren't here. Please `cd` to the `zernio-library-skills` folder and restart Claude Code, then I can help you publish."

Then stop. Do not try to work around it.

### Step B: Resolve the API key (one question at a time)

1. Check `$ZERNIO_API_KEY`.
2. If unset: source `.env` with `set -a; source ./.env; set +a`.
3. After sourcing, check the value:
   - Empty or still `zk_replace_with_your_real_key` → ask the user once:
     > "I need your Zernio API key to publish. Either edit `.env` and replace the placeholder, or paste it here and I'll hold it just for this conversation. Get one at https://zernio.com/dashboard/api-keys."
   - Real key (starts with `zk_` and longer than the placeholder) → proceed silently. Don't echo the key back.

### Step C: Pick a manifest

If `$ARGUMENTS` is a real path that exists → use it.

If `$ARGUMENTS` is empty or the path doesn't exist:

1. Check if `examples/sample-post.json` exists.
2. If yes, read it and ask the user:
   > "I see `examples/sample-post.json` is ready to go — it targets `<comma-separated list of platforms from the manifest>`. Want me to:
   > - **A)** Use this manifest as-is for a test publish
   > - **B)** Edit it before publishing (you tell me what to change)
   > - **C)** Start a new manifest from `templates/manifest.json`"
3. If `examples/sample-post.json` doesn't exist either, offer **C** directly.

### Step D: Run the 7-step flow

Follow `.claude/skills/zernio-publish/SKILL.md` exactly:

1. CHECK — quick pre-post checklist
2. UPLOAD — presign + PUT + HEAD-verify media
3. BUILD — assemble the per-platform POST body from the manifest
4. APPROVE — **always pause here for explicit human OK**
5. POST — `POST /v1/posts` with `scheduledFor` 2-3 min ahead
6. VERIFY — hit the destination platform's public URL / oEmbed to confirm fields landed
7. LOG — write `./posts/YYYY-MM-DD-{slug}.json`

## Hard rules — no exceptions

- **Zernio only.** No Late MCP, no Buffer, no n8n. If they show up in your available tools, ignore them.
- **Manifest is the source of truth.** Never invent captions, titles, tags, or thumbnails. If a platform's required field is missing in the manifest, fail at the CHECK step and name the field + platform.
- **Approval gate is non-negotiable.** No `--yes` flag, no env bypass. Every post passes through Step 4.
- **`scheduledFor`, not `publishNow`.** Always 2-3 min ahead for multi-platform.
- **Verify before reporting success.** A 200 from Zernio means the request was accepted, not that YouTube applied the title or that LinkedIn rendered the post.

## When something is out of scope

If the user asks for something `zernio-publish` doesn't do — render a video from images, generate captions, connect a new Zernio account, read from Google Drive — say so plainly:

> "That part isn't what `zernio-publish` does. You'll need to `<produce the media / write the captions / connect the account at zernio.com / get the file onto local disk>` first, then come back and I'll ship it."

Don't try to do the out-of-scope work with adjacent tools. Stay in lane.

## If the skill itself isn't installed

If `.claude/skills/zernio-publish/SKILL.md` doesn't exist, the skill is missing from this project. Tell the user:

> "The `zernio-publish` skill isn't installed here. Install it:
>
> ```bash
> git clone https://github.com/Trejon-888/zernio-library-skills.git
> cp -r zernio-library-skills/.claude/. ./.claude/
> ```
>
> Or upload the ZIP from https://github.com/Trejon-888/zernio-library-skills/releases/latest to claude.ai."

Then stop.
