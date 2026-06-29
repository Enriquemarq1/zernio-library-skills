# Zernio Library Skills

A library of Claude Code skills for working with [Zernio](https://zernio.com). It currently contains five skills — `zernio-publish` (end-to-end social publishing), `zernio-comment-to-dm` (comment-to-DM automations + DM sequences), `meta-ads-launch` (Meta ad batches through Zernio's ads API, launch-then-pause), `zernio-workflow-creator` (Zernio conversation Workflows / WhatsApp text AI agents), and `zernio-voice-agent` (WhatsApp VOICE AI agent — Zernio `start_call` bridged to a Retell AI voice agent). More Zernio-related skills (analytics, account management, content calendaring) get added to `.claude/skills/` as they're built.

This is a **Claude Code skill repo**, not a runtime or SDK project. The agent (Claude) has its native toolkit available — bash, curl, ffmpeg, vision, transcript extraction, web fetching. The skill is *instructions* for using those tools well; it isn't a framework around them.

## Project layout

```
zernio-library-skills/
├── .claude/
│   └── skills/
│       ├── zernio-publish/                    ← end-to-end social publishing
│       │   ├── SKILL.md                          the workflow + Zernio API knowledge
│       │   ├── reference/                        deep docs (loaded on demand)
│       │   │   ├── zernio-api.md
│       │   │   ├── zernio-upload.md
│       │   │   ├── zernio-post.md
│       │   │   ├── principles.md
│       │   │   ├── platforms.md
│       │   │   ├── platforms/{platform}.md        per-platform deep dives (13 of them)
│       │   │   └── zernio-openapi.yaml            canonical 17K-line OpenAPI spec
│       │   └── templates/manifest.json           reference shape of a Zernio POST body
│       │
│       ├── zernio-comment-to-dm/              ← comment-to-DM automations + sequences
│       │   ├── SKILL.md
│       │   ├── reference/zernio-automations-api.md
│       │   └── templates/automation.json
│       │
│       ├── meta-ads-launch/                   ← Meta ad batches via Zernio's ads API
│       │   ├── SKILL.md                          launch-then-pause co-pilot (operator decides)
│       │   ├── reference/zernio-ads-api.md       complete verified ads API reference
│       │   └── templates/campaign-plan.json      multi-creative request template
│       │
│       ├── zernio-workflow-creator/           ← Zernio Workflows / WhatsApp text AI agents
│       │   ├── SKILL.md
│       │   ├── reference/zernio-workflows-api.md  full node/edge contract (16 node types)
│       │   └── templates/whatsapp-customer-service-agent.json
│       │
│       ├── zernio-voice-agent/                ← WhatsApp VOICE AI agent (Zernio + Retell AI)
│       │   ├── SKILL.md                          architecture: text qualify → start_call → Retell
│       │   ├── reference/whatsapp-calling-api.md  Zernio WhatsApp Calling + start_call node
│       │   ├── reference/retell-voice-api.md      Retell connection (SIP / wss / Register API)
│       │   └── templates/
│       │       ├── whatsapp-voice-agent.workflow.json   the Zernio workflow graph
│       │       ├── retell-voice-agent.base.md           fill-in-the-blank voice prompt
│       │       └── retell-voice-agent.example.md        a filled voice prompt (booking)
│       │
│       └── skill-creator/                     ← Anthropic's official skill-creator (bundled)
│                                                  use this when adding more skills to the library
│
├── .env                                       ← ZERNIO_API_KEY (placeholder by default; user fills in)
├── CLAUDE.md                                  ← this file
├── README.md
├── LICENSE
└── .gitignore
```

## How to use this library

1. Drop the `.claude/skills/zernio-publish/` folder into any Claude Code project, OR open this repo directly as a Claude Code project.
2. Edit `.env` to put your real `ZERNIO_API_KEY` in place of the placeholder. Then `git update-index --skip-worktree .env` to keep your key out of commits.
3. Talk to Claude. Drop a video file, paste a Drive link, describe what you want to publish — Claude reads `SKILL.md`, follows the workflow, and ships.

The agent uses its own tools — `source .env` to load the key, `curl -L` for URLs and Drive single-file shares, `ffmpeg` for video format conversion, vision to read images, transcript tools for video/audio. There are no helper scripts in this repo; the agent doesn't need them.

## Adding more skills to the library

The point of the "library" name: more Zernio-related skills land here as they're built. To add one:

1. Create `.claude/skills/{skill-name}/SKILL.md` with YAML frontmatter and the skill's instructions.
2. Optional: add `reference/` for deep docs the skill pulls on demand, `templates/` for reusable shapes.
3. The bundled `skill-creator` at `.claude/skills/skill-creator/` is Anthropic's official tool for designing and improving skills — invoke it when building a new one.

## Hard rules embedded in `zernio-publish`

These four constraints live inside `SKILL.md`. They prevent real damage, not autonomy:

- **Approval before publish.** Show the full package, wait for an explicit OK.
- **Verify after publish.** Zernio's 200 OK ≠ landed on the platform.
- **`scheduledFor` 2-3 min ahead** for multi-platform. Never `publishNow: true`.
- **Zernio only.** No Late, Buffer, Hootsuite, or any alternative posting tool.

Everything else is judgment.
