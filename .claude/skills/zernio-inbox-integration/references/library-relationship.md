# Relationship to Zernio Library Skills

Repository inspected September 25, 2026: https://github.com/Enriquemarq1/zernio-library-skills

Read the current source when integrating with it:
- `.claude/skills/white-label-blueprint/SKILL.md`
- `.claude/skills/white-label-blueprint/reference/stage-prompts.md`, especially stage 7.

## Existing scope

The white-label blueprint creates a thin branded client portal with embedded account connection, per-client profiles, publishing and account-health webhooks. Its optional stage 7 adds a conversation list, selected message history, replies, mark-read behavior and a separate comments tab. Other library skills cover publishing, comment-to-DM automations, conversation workflows and voice agents.

## This skill's distinct job

Add and deepen messaging capabilities inside an existing application. Begin by mapping what stage 7 or the user's own code already implements. Fill the gaps: channel-specific onboarding, send/receive behavior, conversation state, selected rich-message features, event handling, delivery failures, tenant authorization and verification. Preserve existing working routes and design. Comments are adjacent to DMs; include them only when requested and document support separately.

Do not force app scaffolding, Node/Express, two-page layouts, database-free architecture or a hosting provider into unrelated existing projects. API documentation is authoritative for current schemas and channel support. General statements in older starter prompts do not establish that all connected platforms support DMs or that a profile ID alone enforces app-user isolation.

## Stage 7 gaps to fix when integrating a blueprint-derived app

Compared with the current docs on September 25, 2026, the stage 7 prompt:
- calls `https://api.zernio.com/v1`, while the documented server is `https://zernio.com/api/v1`;
- opens history without `sortOrder`, so long threads show their oldest page (the default is `asc`);
- marks a conversation read automatically after every reply;
- sends replies without an `Idempotency-Key`, and has no unknown-outcome state;
- has no durable store for webhook events ("no database"), so inbound events cannot survive a crash between receipt and processing.

A blueprint app's own webhook registration script may also print the full settings response, which includes the secret. Fix these in the target app; the blueprint itself is a separate repository.

Suggested viewer prompt: "My app is already built. Use the messaging integration skill to add Zernio conversations, history and replies, reusing my existing account connections and client workspaces."

This local skill has not been published into the public library. Reading the library does not imply a remote repository update. As of September 25, 2026, the library's only inbox material is blueprint stage 7; this skill lives only in the local Codex skills folder.
