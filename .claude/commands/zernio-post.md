---
description: Ship a post via Zernio. Uses the zernio-publish skill.
argument-hint: [optional manifest path or chat-described request]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# /zernio-post

The user wants to publish content to one or more social platforms through Zernio.

You have the `zernio-publish` skill at `.claude/skills/zernio-publish/`. Use it as a reference — Zernio API knowledge, platform quirks, gotchas — not a script.

Decide how to help. The user may have given you a manifest path, a chat-described request, or nothing at all. Whatever shape it's in, your job is to:

1. Understand what they want to ship and where
2. Make sure you have the inputs (media on disk, API key, target platforms)
3. Show them the package and wait for explicit approval
4. POST via the Zernio API (`scheduledFor` 2-3 min ahead — never `publishNow: true`)
5. Verify it landed on each platform (oEmbed for YouTube, HEAD for others)
6. Log the result to `./posts/YYYY-MM-DD-{slug}.json`

`$ARGUMENTS` is whatever the user passed. Could be a path. Could be empty. Could be a sentence. Handle it.

When inputs are missing, ask one thing at a time. When something is out of scope (rendering a video from images, generating captions, connecting a new Zernio account), say so plainly — tell the user what they need to do first, then come back and you'll ship it.

The hard rules from `CLAUDE.md` apply. The rest is judgment.
