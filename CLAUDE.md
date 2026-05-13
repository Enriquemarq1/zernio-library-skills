# Zernio Library Skills

A standalone Claude Code project for end-to-end social publishing through [Zernio](https://zernio.com). One asset in → up to 13 platforms out, with the agent handling intake, analysis, caption drafting, format conversion, upload, posting, verification, and logging.

This file is the **architectural map** — what lives here and how the pieces fit together. When you (the agent) land in this project, read this once for orientation, then go to `SKILL.md` for the actual workflow.

---

## Project layout

```
zernio-library-skills/
│
├── .claude/skills/
│   ├── zernio-publish/                     ← the publishing skill (the brain)
│   │   ├── SKILL.md                          10-stage workflow + Zernio knowledge
│   │   ├── reference/                        deep API docs, loaded on demand
│   │   │   ├── zernio-api.md                   endpoints, auth, account model
│   │   │   ├── zernio-upload.md                presign + PUT mechanics, large-file fallback
│   │   │   ├── zernio-post.md                  POST body shape, 10 field placement rules
│   │   │   ├── principles.md                   approval gate + verification protocol
│   │   │   ├── platforms.md                    capability matrix for all 13 platforms
│   │   │   ├── platforms/{platform}.md         per-platform deep dives (one file each)
│   │   │   └── zernio-openapi.yaml             canonical 17K-line OpenAPI spec
│   │   └── templates/manifest.json           reference shape of a finished Zernio POST body
│   │
│   └── skill-creator/                      ← Anthropic's official skill-creator (bundled)
│                                             use when designing or improving any skill
│
├── scripts/                                ← deterministic helpers the agent invokes
│   ├── init.sh                                load .env, validate ZERNIO_API_KEY, probe /v1/accounts
│   ├── fetch.sh                               universal media fetcher (Drive single-files, HTTPS URLs, local paths)
│   ├── post.sh                                bare-bash one-shot publish (no AI agent involved)
│   ├── build-skill-zip.sh                     build dist/*.skill.zip on Linux / macOS
│   └── build-skill-zip.ps1                    build dist/*.skill.zip on Windows
│
├── examples/
│   └── sample-post.json                    ← worked example of a finished POST body
│
├── dist/
│   └── zernio-publish.skill.zip            ← prebuilt artifact, uploadable to claude.ai web
│
├── .env                                    ← ZERNIO_API_KEY lives here (tracked, with placeholder)
├── CLAUDE.md                               ← this file — architectural map
├── README.md                               ← human-facing entry point
├── LICENSE                                 ← MIT
└── .gitignore
```

---

## What each piece is for

**`.claude/skills/zernio-publish/`** — the brain. SKILL.md describes the 10-stage workflow (INTAKE → ANALYZE → DRAFT → CONVERT → UPLOAD → PACKAGE → APPROVE → POST → VERIFY → LOG) and embeds the Zernio API mechanics inline. The `reference/` folder holds deep dives loaded on demand — you don't preload them; you pull them when a specific question lands (e.g., per-platform quirks, the OpenAPI spec). `templates/manifest.json` is the shape of a fully-built Zernio POST body, useful as a reference.

**`.claude/skills/skill-creator/`** — Anthropic's official skill-creator, bundled here. Use it when designing or improving any skill, including this one. Not invoked during normal publishing.

**`scripts/`** — deterministic helpers. The agent invokes these at the start of every publishing task so it doesn't have to reinvent the wheel from prose:

- `init.sh` — sources `.env`, validates `ZERNIO_API_KEY`, probes `https://zernio.com/api/v1/accounts` to confirm auth, reports tool availability (ffmpeg, curl, jq). **Run first.**
- `fetch.sh` — pure bash + curl. Drops a media file onto disk from a Drive single-file share, a regular HTTPS URL, or a local path. Drive folders aren't supported by curl alone — agent handles those with native web tools or asks the user.
- `post.sh` — non-AI fallback. Bare bash that authors must fill in everything for, useful for testing the Zernio API directly.
- `build-skill-zip.{sh,ps1}` — builds the upload-ready ZIP at `dist/zernio-publish.skill.zip` with `SKILL.md` at the root and forward-slash separators (required by claude.ai's Upload Skill UI).

**`examples/sample-post.json`** — a worked example of a finished Zernio POST body. Reference material for understanding the data shape, not required input.

**`.env`** — single source of truth for `ZERNIO_API_KEY`. Tracked in git with a placeholder value (`zk_replace_with_your_real_key`). The user replaces the placeholder locally with their real key, then runs `git update-index --skip-worktree .env` so their real key never lands in a commit. `init.sh` sources this file.

**`dist/zernio-publish.skill.zip`** — the prebuilt artifact users upload to claude.ai web (Capabilities → Skills → Upload skill). Contains just the `zernio-publish` skill contents with `SKILL.md` at the root.

**`README.md`** — human-facing entry. Install paths for claude.ai web and Claude Code CLI, quickstart, design principles.

---

## How the pieces fit together

When a user asks you to publish anything:

1. **Auth + state** — you run `source scripts/init.sh`. Loads the key, confirms it works, shows tool availability.
2. **Intake** — you run `bash scripts/fetch.sh "<their-input>" ./media/` for any URL, Drive link, or path they gave you. Files land in `./media/`.
3. **Workflow** — you follow the 10 stages in `SKILL.md`: analyze the asset (transcribe video, look at images), draft platform-tailored captions/titles/tags, convert formats with ffmpeg if needed, upload to Zernio, build the POST body, show the user the full package, wait for approval, POST, verify, log to `./posts/`.
4. **References** — when you need depth (a specific platform's quirks, the exact OpenAPI shape, a verification edge case), pull the relevant file from `reference/`. Don't preload them.

The skill is the brain. The scripts are deterministic hands. The references are the encyclopedia. `.env` is the credentials. Everything else supports distribution.

---

## Invariants embedded in the workflow

Four constraints live in `SKILL.md` and apply at every stage. They prevent real damage, not autonomy:

- **Approval before publish.** Show the full package, wait for explicit OK.
- **Verify after publish.** Zernio's 200 OK ≠ landed on the platform.
- **`scheduledFor` 2-3 min ahead** for multi-platform. Never `publishNow: true`.
- **Zernio only.** No other publishing tool — not Late, not Buffer, not Hootsuite, not n8n.

Everything else is judgment.
