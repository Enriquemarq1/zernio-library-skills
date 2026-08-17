# The Initiation Prompt

Copy-paste this to Claude Code in an EMPTY folder and you get the full Clip
Machine workflow set up for you: project structure, skills installed, and the
machine ready for your first long video.

---

```
Hey Claude. We're setting up a new project in this empty folder: the Clip Machine —
a system that turns one long video into native short clips for TikTok, Instagram
Reels, and YouTube Shorts.

STEP 1 — Set up the project.
Create the proper Claude Code structure for this folder: a CLAUDE.md that describes
the project (what it is, how we work together, where things live) and the .claude
folder. Keep it clean and simple.

STEP 2 — Install the skills.
Clone this repo: https://github.com/Enriquemarq1/zernio-library-skills
Bring its skills into this project — especially clip-machine (the four stations:
CUT → CAPTION → COVER → POST) and zernio-publish (the posting arm). Before we run
anything, read the clip-machine skill and its two reference files: the best-moments
prompt and the platform cheat-sheet. That's the framework you'll work with.

STEP 3 — Get ready to run.
Set up the .env for my Zernio API key (zernio.com — free to start) and tell me
exactly where to paste it. Check the tools you need for transcription and video
work (ffmpeg, AssemblyAI) and flag anything missing before we start.

When setup is done, give me a short summary of what you built and ask me for the
long-form video. That's next: you'll pick the best moments with the framework, cut
the clips, reframe them to 9:16, caption them per platform, set the covers, and
stage them to post — one Zernio request per clip. Nothing publishes without my
approval.

Do your proper job. Go.
```

---

## Why it's written this way

- **Manager structure**: role + context → clear steps → what "done" looks like
  → what comes next. The agent never guesses.
- **The repo URL is the root repo** — cloning it brings every skill; skills in
  `.claude/skills/` load automatically when Claude Code works in the folder.
  Cloning IS installing.
- **"Read the skill and its reference files before we run anything"** forces
  the agent to absorb the best-moments framework and the platform cheat-sheet
  BEFORE acting.
- **The approval gate** ("nothing publishes without my approval") protects you
  from an accidental auto-post while you're still learning the machine.
- **It ends by asking for your video** — the next message you send is just a
  YouTube link, and the machine starts.
