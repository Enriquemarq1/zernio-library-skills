# Zernio Library Skills

A library of Claude Code skills for [Zernio](https://zernio.com). It ships:
- **`zernio-publish`** — end-to-end social publishing across 13 platforms.
- **`zernio-comment-to-dm`** — build Instagram/Facebook comment-to-DM automations + DM
  sequences on command. Tell Claude a post, a keyword, and the message — it creates the
  Zernio automation and orchestrates the follow-up DMs, so you never click through a
  dashboard or clone workflows. Reuse it for any new post/keyword in seconds.
- **`meta-ads-launch`** — launch Meta (Facebook/Instagram) ad batches through Zernio's ads
  API. You decide the offer, copy, audience, and budget; Claude launches ALL your creative
  variations in one call (1 campaign + 1 ad set + N ads), then immediately pauses the
  campaign so nothing spends until you review and go live. Ships with the complete verified
  Zernio ads API reference (multi-creative shapes, idempotency, pause/resume, targeting,
  lead forms, click-to-WhatsApp). Requires the Zernio Ads add-on (included on usage-based plans).

More Zernio skills (analytics, calendaring, account management) will land over time.

You hand Claude an asset (video file, Drive link, image folder, URL) and tell it where to post. Claude analyzes it, drafts platform-tailored captions and titles and hashtags, converts formats if needed, uploads the media, shows you the full package for approval, schedules the post via the Zernio API, verifies it landed, and logs the result.

## Install

Open the repo as your Claude Code project, or copy `.claude/skills/zernio-publish/` into any Claude Code project's `.claude/skills/` folder.

```bash
git clone https://github.com/Trejon-888/zernio-library-skills.git
cd zernio-library-skills
```

For claude.ai web (Skills upload UI), zip the skill folder yourself:

```bash
cd .claude/skills/zernio-publish && zip -r ../../../zernio-publish.skill.zip .
```

Then upload that ZIP on claude.ai → Capabilities → Skills.

## Configure

Edit `.env` at the repo root, replace the placeholder with your real key from https://zernio.com/dashboard/api-keys, and run:

```bash
git update-index --skip-worktree .env
```

That keeps your local key edits from being staged into commits while the file stays tracked.

## Use

In Claude Code, just say what you want to ship:

> "Publish this video to my YouTube, TikTok, and Reels: `./media/launch.mp4`"
>
> "Drop a carousel post to Instagram and LinkedIn from this Drive folder: `<drive-url>`. Angle: three lessons from launching v1."

Claude reads the skill, runs through the workflow (intake → analyze → draft → convert → upload → package → approve → post → verify → log), shows you the full package, and ships on your approval.

## What's in the box

```
zernio-library-skills/
├── .claude/
│   └── skills/
│       ├── zernio-publish/                    ← the publishing skill
│       │   ├── SKILL.md
│       │   ├── reference/                       deep API + per-platform docs
│       │   └── templates/manifest.json
│       ├── zernio-comment-to-dm/              ← comment-to-DM automations + sequences
│       │   ├── SKILL.md
│       │   ├── reference/zernio-automations-api.md
│       │   └── templates/automation.json
│       ├── meta-ads-launch/                   ← Meta ad batches via Zernio's ads API
│       │   ├── SKILL.md
│       │   ├── reference/zernio-ads-api.md      the complete verified ads API reference
│       │   └── templates/campaign-plan.json
│       └── skill-creator/                     ← Anthropic's official skill-creator
│                                                  bundled for when you add more skills
├── .env                                       ← ZERNIO_API_KEY (placeholder until you fill it)
├── CLAUDE.md                                  ← architectural map of the repo
├── README.md
├── LICENSE                                    ← MIT
└── .gitignore
```

No build scripts, no helper scripts, no auto-generated artifacts. The agent has its native Claude Code toolkit (bash, curl, ffmpeg, vision, transcript extraction, web fetching) and uses those directly.

## Adding more skills to the library

Drop a new folder under `.claude/skills/`:

```bash
mkdir .claude/skills/my-new-zernio-skill
# Create SKILL.md with YAML frontmatter (name + description) and the skill's instructions
```

The bundled `skill-creator` at `.claude/skills/skill-creator/` is Anthropic's official tool for designing and improving skills — invoke it when building a new one.

## Design principles

- **End-to-end agency.** Claude handles intake, analysis, drafting, conversion, upload, posting, verification, logging. Not transport-only.
- **The skill informs; the agent acts.** SKILL.md is reference knowledge plus a suggested workflow — not a script. The agent uses its native tools to execute.
- **Approval before publish.** Every post passes through an explicit gate. No bypass, no auto-publish.
- **Verify, don't trust.** Zernio's 200 OK ≠ landed on the platform. Claude hits each platform's public URL or oEmbed after `scheduledFor + 60s` and surfaces any field drift.
- **Schedule, don't push.** Multi-platform posts always use `scheduledFor` 2-3 minutes ahead.
