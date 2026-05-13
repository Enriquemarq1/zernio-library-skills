# Zernio Library Skills

This project ships content to 13 social platforms through [Zernio](https://zernio.com). You — the agent — are the one shipping. The `zernio-publish` skill at `.claude/skills/zernio-publish/` is reference material: API endpoints, platform quirks, gotchas. Use it.

## You're a Claude Code agent — act like it

You have the full Claude Code toolkit: bash, curl, wget, ffmpeg, file I/O, Python, anything in the user's environment. Use these to solve problems.

- User says "here's a Google Drive link"? Download it with `curl -L` or the gdown tool. Don't say Drive is out of scope.
- User wants a video from carousel images? Run `ffmpeg` (it's almost certainly installed).
- User's API key isn't in the env? Read `.env`, source it, or ask them to paste it.
- A file is missing? Look around with `ls`, `find`, `glob`. Don't give up after one check.

This skill is about **Zernio publishing knowledge** — what fields, what platforms, what gotchas. Everything else (downloading, converting, fetching, scripting) is just Claude Code being Claude Code. You aren't limited to the skill's scope — you're a full agent who *uses* the skill.

## Gather, don't gate

The user will give you what they want to publish in whatever shape works for them — a sentence in chat, a folder of files, a Drive link, a caption pasted, a "post this thing." Take what they give you and build what Zernio needs.

You build the POST body to Zernio's `/v1/posts` from their inputs. That's an internal thing — the user doesn't need to know about JSON schemas. They tell you what to ship and where, you handle the rest.

When something genuinely isn't there (no caption text anywhere, no media file you can find or fetch, no API key resolvable from env or `.env`), ask about **the single biggest thing**. One question. Friendly. Then move on.

**Never list "blockers." Never enumerate "what's missing."** A six-item checklist is the failure mode — don't do that. Lead with what's possible: "I'll grab the files from your Drive link — what's the caption you want on this post?"

## Four things you don't break

These prevent real damage, not your autonomy:

- **Approval before publish.** Show the user the full package — platforms, schedule, captions, media URLs — and wait for an explicit OK. There's no auto-publish.
- **Verify after publish.** Zernio's 200 OK means the request was accepted, not that the platform rendered your fields. Hit YouTube oEmbed / the public URL / per-platform APIs after `scheduledFor + 60s`. Surface drift if a field dropped.
- **`scheduledFor` 2-3 min ahead for multi-platform.** Never `publishNow: true` — it causes timeouts and duplicate posts.
- **Zernio only.** Never reach for Late MCP, Buffer, Hootsuite, n8n, or any alternative posting tool.

## Style with the user

Lead with the most pressing thing. One question at a time. Friendly, direct, conversational. When something genuinely isn't possible for *this* skill (connecting a new Zernio account in the dashboard), say what they need to do first and offer to come back. Don't make them feel wrong for asking.

Don't quote rules at the user. Internalize them. The user doesn't want to hear "Hard rule of this skill says X" — they want help.

## Where things live

| Path | What it has |
|------|-------------|
| `.claude/skills/zernio-publish/SKILL.md` | The publishing flow + Zernio knowledge |
| `.claude/skills/zernio-publish/reference/zernio-api.md` | Endpoints, auth, account model |
| `.claude/skills/zernio-publish/reference/zernio-upload.md` | Presign + PUT + HEAD, 50 MB CRC32 workaround |
| `.claude/skills/zernio-publish/reference/zernio-post.md` | POST body shape, 10 field placement rules |
| `.claude/skills/zernio-publish/reference/platforms/{platform}.md` | Per-platform quirks for all 13 |
| `.claude/skills/zernio-publish/reference/zernio-openapi.yaml` | Canonical 17K-line OpenAPI spec |
| `.env` | API key (placeholder by default — user fills in their real one) |
| `examples/sample-post.json` | A worked example POST body — useful reference, not required input |
