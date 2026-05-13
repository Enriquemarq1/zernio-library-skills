# Zernio Library Skills

> A Claude Code skill that turns one content piece into a 13-platform distribution system through [Zernio](https://zernio.com).

One manifest → upload → POST → verify → log. No config files, no API plumbing, no glue code. You author the captions, the skill ships them.

## Supported platforms (13)

| | | |
|---|---|---|
| YouTube | Instagram | TikTok |
| LinkedIn | X / Twitter | Threads |
| Facebook | Pinterest | Bluesky |
| Reddit | Snapchat | Telegram |
| Google Business | | |

Every platform's quirks documented in `.claude/skills/zernio-publish/reference/platforms/{platform}.md` — field shapes, media specs, character limits, pre-flight checks, common gotchas.

---

## Quickstart

**1. Get a Zernio account.** Sign up at [zernio.com](https://zernio.com), connect the platforms you want to post to, and grab your API key from the dashboard.

**2. Drop this skill into your Claude Code project.**

```bash
git clone https://github.com/your-username/zernio-library-skills.git
cp -r zernio-library-skills/.claude/skills/zernio-publish /path/to/your-project/.claude/skills/
```

**3. Export your API key.**

```bash
export ZERNIO_API_KEY="zk_xxx"
```

**4. Write a manifest** — what you want to ship, where it should go. See `examples/sample-post.json`:

```json
{
  "slug": "my-first-post",
  "content": "The thing I built today",
  "media": {
    "video": "./output.mp4",
    "thumbnail": "./thumb.jpg"
  },
  "platforms": {
    "youtube": {
      "title": "How I built X in 30 days",
      "categoryId": "28",
      "tags": "claude,zernio,automation",
      "firstComment": "What would you build? Drop it below."
    },
    "linkedin": { "visibility": "public" },
    "twitter": { "visibility": "public" },
    "threads": { "visibility": "public" }
  }
}
```

**5. Run it in Claude Code.**

```
publish ./manifest.json
```

Claude reads the skill, walks the seven-step flow (check → upload → build → approve → POST → verify → log), shows you the package, waits for your approval, ships it, verifies it landed, and writes the result to `./posts/`.

You can also call the bare bash flow without Claude — see `scripts/post.sh`.

---

## What's in the box

```
zernio-library-skills/
├── README.md                                         ← you are here
├── LICENSE                                           ← MIT
├── .claude/skills/zernio-publish/
│   ├── SKILL.md                                      ← the seven-step flow
│   ├── reference/
│   │   ├── zernio-api.md                             ← endpoints, auth, account model
│   │   ├── zernio-upload.md                          ← presign → PUT → HEAD, CRC32 bug
│   │   ├── zernio-post.md                            ← POST body shape, 10 field rules
│   │   ├── principles.md                             ← approval gate, verify-don't-trust
│   │   ├── platforms.md                              ← capability matrix
│   │   ├── platforms/{13 platform docs}.md           ← per-platform deep dives
│   │   └── zernio-openapi.yaml                       ← canonical 17K-line OpenAPI spec
│   └── templates/
│       └── manifest.json                             ← the input schema
├── examples/
│   └── sample-post.json                              ← a worked example
└── scripts/
    └── post.sh                                       ← bare bash one-shot flow
```

---

## Design principles

**Zero local config.** No `config.json`, no profile YAML, no `.env.keys`. The only thing you set is `ZERNIO_API_KEY` in your shell environment. Account IDs resolve at runtime from `GET /v1/accounts`. If a platform isn't connected, the skill fails with a clear message naming the platform.

**Manifest-driven.** Captions, titles, tags, first comments — all live in your `manifest.json`. The skill never invents metadata. You author the words; the skill handles the API.

**No auto-publish.** Every post passes through an explicit approval gate. Silence is never approval. There's no `--yes` flag or env var to bypass this — the skill prompts every time.

**Verify, don't trust.** A 200 OK from Zernio means the request was accepted, not that the destination platform rendered your fields. YouTube routinely strips titles, tags, and thumbnails silently. Step 6 hits the destination platform directly (YouTube oEmbed, etc.) and surfaces field-level drift.

**Schedule, don't push.** Multi-platform posts always use `scheduledFor` 2-3 minutes ahead. `publishNow: true` causes timeouts and duplicate posts across platforms.

---

## What this is not

- **Not a content generator.** Captions, titles, hashtags — you write them. The manifest is the source of truth.
- **Not a Zernio replacement.** Zernio handles OAuth, account connections, scheduling, and the platform APIs. This skill is the orchestration layer that talks to Zernio cleanly.
- **Not n8n / Make / Zapier.** It's a Claude Code skill — files on disk that Claude reads and follows. No GUI, no workflow runner. Just a folder you drop into `.claude/skills/`.

---

## Common patterns

**Same content, all platforms:** Fill `content` once. Set `platforms.{each}.visibility: "public"`. Done.

**Per-platform adaptation:** For each platform, write a tailored caption. LinkedIn ≠ Instagram ≠ Threads.

**Staggered rollout:** Run the skill twice with different manifests — primary platform at `scheduledFor +3min`, tier-2 platforms at `+2h`, tier-3 at `+24h`. Avoids duplicate-content penalties.

**Large video (>50 MB):** The skill auto-routes through an external-storage fallback (Drive, S3, etc.) when files exceed Zernio's 50 MB CRC32 limit. See `reference/zernio-upload.md`.

---

## Contributing

Issues and PRs welcome. The OpenAPI spec at `reference/zernio-openapi.yaml` is the source of truth — if Zernio adds a new platform or field, update the spec first, then the markdown.

When Zernio adds a new platform:

1. Add a row to `reference/platforms.md`
2. Create `reference/platforms/{newplatform}.md` (use any existing file as template)
3. Update this README's platform table
4. No SKILL.md changes needed — the orchestration is platform-agnostic.

---

## License

MIT. See `LICENSE`.
