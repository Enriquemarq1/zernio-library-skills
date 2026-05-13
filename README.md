# Zernio Library Skills

> A Claude Code skill for end-to-end social publishing through [Zernio](https://zernio.com) — across 13 platforms.

You hand Claude an asset (video, image, audio, carousel, URL, Drive link) and tell it where to post. Claude analyzes the asset (transcript extraction for video/audio, vision for images), drafts platform-tailored captions, titles, hashtags, and first comments, converts formats if needed (`ffmpeg` for slideshow → video, aspect ratio reframing), uploads the media to Zernio, shows you the full package for approval, schedules the post, verifies it landed on each platform, and logs the result.

Drop a video file in chat, say "publish this to my TikTok, Reels, and Shorts." Claude does the rest.

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

## Install

Pick the path that matches how you use Claude.

### Option A: Claude.ai web (Upload Skill UI)

Download the prebuilt skill ZIP from the latest release and upload it on claude.ai:

> [**Download `zernio-publish.skill.zip` (latest release)**](https://github.com/Trejon-888/zernio-library-skills/releases/latest/download/zernio-publish.skill.zip)

Then in claude.ai → **Capabilities → Skills → Upload skill** → drag the downloaded `.zip` file in.

**Why a separate ZIP?** GitHub's "Download ZIP" button zips the whole repo (with `README.md` and `LICENSE` at the root), but Claude's Upload Skill UI requires `SKILL.md` at the root of the upload. The release asset above is built with the correct shape.

### Option B: Claude Code (CLI / local project)

```bash
git clone https://github.com/Trejon-888/zernio-library-skills.git
cp -r zernio-library-skills/.claude/. /path/to/your-project/.claude/
```

This brings into your project:

- The `zernio-publish` skill at `.claude/skills/zernio-publish/` — auto-discovered by Claude Code, triggers whenever you ask to publish / post / ship / schedule social content
- Anthropic's official `skill-creator` at `.claude/skills/skill-creator/` — useful when building or improving other skills

No slash command needed — Claude auto-triggers the skill on intent. Just say what you want to ship in chat.

---

## Quickstart (after install)

**1. Get a Zernio account.** Sign up at [zernio.com](https://zernio.com), connect the platforms you want to post to, and grab your API key from the dashboard.

**2. Hand the key to the skill** — the path depends on where you're running:

- **Claude Code CLI:** either export it in your shell, or edit the `.env` file at the repo root.

  ```bash
  # Option A — export per shell session
  export ZERNIO_API_KEY="zk_xxx"             # macOS / Linux
  $env:ZERNIO_API_KEY = "zk_xxx"             # Windows PowerShell

  # Option B — edit the .env file (recommended for projects you'll use repeatedly)
  # 1. Open .env and replace the placeholder with your real key
  # 2. Tell Git to ignore your local edits so the real key never gets staged:
  git update-index --skip-worktree .env
  ```

  `.env` ships with a placeholder. `scripts/post.sh` auto-sources it. The `--skip-worktree` step is important — `.env` is tracked (so you get the placeholder on clone), but you don't want your real key to land in a commit. See the warning header inside `.env`.

- **Claude.ai web:** at the start of the conversation, paste the key in chat (the skill prompts you for it on the first run). Claude holds it in working memory for that conversation only — it's not persisted across sessions, never written to disk, and never echoed back.

The key is **never bundled with this skill** and never lives inside `manifest.json` or any committed file. See [`.claude/skills/zernio-publish/SKILL.md § Resolving the API key`](.claude/skills/zernio-publish/SKILL.md) for the full rules.

**3. Tell Claude what you want to ship.**

Just talk to it. Examples:

> "Publish this video to my YouTube, TikTok, Reels, and Shorts: `./media/launch.mp4`"
>
> "Drop a carousel post to Instagram and LinkedIn from this Drive folder: `<drive-url>`. The angle is 'three lessons from launching v1'."
>
> "Schedule this announcement to LinkedIn, X, and Threads for tomorrow at 9am: ... [paste text or attach a file]"

Claude:

1. Pulls the asset onto disk (Drive single-file via curl with auto URL-rewrite, regular URLs, file paths)
2. Analyzes it — transcribes the video, looks at the images, reads the page
3. Drafts platform-tailored captions, titles, hashtags, first comments
4. Converts formats if needed (e.g., carousel images → 9:16 video for TikTok)
5. Uploads media to Zernio
6. Shows you the full package — every platform, every caption, schedule, media URLs
7. Waits for your "ship it" / "approved"
8. POSTs to Zernio with `scheduledFor` 2-3 min ahead
9. Verifies it landed on each platform via oEmbed / HEAD checks
10. Logs the result to `./posts/YYYY-MM-DD-{slug}.json`

You can edit any draft caption, change the schedule, swap platforms, or kill the whole thing before approval. The approval gate is non-negotiable — Claude never auto-publishes.

For a bare-bash one-shot publish without Claude (you author everything, the script just calls the API), see `scripts/post.sh`.

---

## What's in the box

```
zernio-library-skills/
├── README.md                                         ← you are here
├── CLAUDE.md                                         ← unified context for AI agents in this project
├── LICENSE                                           ← MIT
├── .claude/skills/
│   ├── zernio-publish/                               ← the publishing skill
│   │   ├── SKILL.md                                  ← end-to-end workflow + Zernio knowledge
│   │   ├── reference/
│   │   │   ├── zernio-api.md                         ← endpoints, auth, account model
│   │   │   ├── zernio-upload.md                      ← presign → PUT → HEAD, large-file fallback
│   │   │   ├── zernio-post.md                        ← POST body shape, 10 field rules
│   │   │   ├── principles.md                         ← approval gate, verification protocol
│   │   │   ├── platforms.md                          ← 13-platform capability matrix
│   │   │   ├── platforms/{13 platform docs}.md       ← per-platform deep dives
│   │   │   └── zernio-openapi.yaml                   ← canonical 17K-line OpenAPI spec
│   │   └── templates/manifest.json                   ← reference shape of the Zernio POST body
│   └── skill-creator/                                ← Anthropic's official skill-creator (bundled)
├── examples/
│   └── sample-post.json                              ← a worked example POST body
├── scripts/
│   ├── post.sh                                       ← bare bash one-shot flow (you author everything)
│   ├── build-skill-zip.sh                            ← build dist/*.skill.zip (Linux/macOS)
│   └── build-skill-zip.ps1                           ← build dist/*.skill.zip (Windows)
└── dist/
    └── zernio-publish.skill.zip                      ← upload-ready ZIP for claude.ai web
```

---

## Design principles

**End-to-end agency.** Claude handles the whole arc — fetch, analyze, draft, convert, upload, package, ship, verify, log. The skill informs; the agent acts.

**Zero local config.** Only `ZERNIO_API_KEY` (env var or `.env`). Account IDs resolve at runtime from `GET /v1/accounts`.

**Drafts come from the asset.** Claude analyzes what the asset is *about* (video transcripts, image content) and writes captions / titles / hashtags from that. You stay in approval, not authorship.

**Approval before publish.** Every post passes through an explicit gate. Silence is never approval. No bypass.

**Verify, don't trust.** Zernio's 200 OK ≠ landed. Claude hits each platform's oEmbed / public URL after `scheduledFor + 60s` and surfaces any field drift.

**Schedule, don't push.** Multi-platform posts always use `scheduledFor` 2-3 minutes ahead.

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
