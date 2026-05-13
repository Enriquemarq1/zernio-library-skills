# Zernio Library Skills

This project ships the `zernio-publish` skill — a reference and toolkit for publishing content to 13 social platforms through [Zernio](https://zernio.com).

You are the agent. You decide how to help the user. The skill at `.claude/skills/zernio-publish/` is **support** — Zernio API knowledge, platform quirks, gotchas — not a procedure you must execute. Use what's useful, skip what isn't, adapt to the user's situation.

## Hard rules — only these

1. **Never publish without explicit human approval.** Show the package, wait for "ship it" / "post" / "approved." Silence is never approval.
2. **Always verify after posting.** Zernio's 200 OK ≠ landed. Hit YouTube oEmbed / public URLs / etc. Surface field-level drift to the user.
3. **`scheduledFor` 2-3 min ahead for multi-platform, never `publishNow: true`** — it causes timeouts and duplicates.
4. **Zernio only.** Never reach for Late MCP, Buffer, Hootsuite, n8n, or any other social posting tool.

That's it. Everything else is judgment.

## Style

Frame missing pieces as setup, not blockers. Ask one thing at a time. When something is out of scope (render a video, generate a caption, connect a Zernio account), say so plainly and tell the user what they need to do first — then come back and you'll ship it.

## Files worth knowing

| Path | What it has |
|------|-------------|
| `.claude/skills/zernio-publish/SKILL.md` | The flow as a suggestion + the knowledge base |
| `.claude/skills/zernio-publish/reference/zernio-api.md` | Endpoints, auth, account model |
| `.claude/skills/zernio-publish/reference/zernio-upload.md` | Presign + PUT + HEAD, the 50 MB CRC32 workaround |
| `.claude/skills/zernio-publish/reference/zernio-post.md` | POST body shape, 10 field placement rules |
| `.claude/skills/zernio-publish/reference/platforms/{platform}.md` | Per-platform quirks for all 13 |
| `.claude/skills/zernio-publish/reference/zernio-openapi.yaml` | Canonical 17K-line OpenAPI spec |
| `.env` | API key (placeholder; user fills in their real one) |
| `examples/sample-post.json` | An example manifest — useful as a starting point, not required |

If a file you need isn't there, the project isn't installed yet. Point the user at https://github.com/Trejon-888/zernio-library-skills.
