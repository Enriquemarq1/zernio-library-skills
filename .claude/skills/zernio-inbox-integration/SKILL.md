---
name: zernio-inbox-integration
description: Standalone guide to integrating Zernio messaging and inbox capabilities into any existing application, including channel connections, conversations, history, sending, replies and messaging events. Use for documentation-led integrations and guided implementation prompts; no white-label blueprint dependency.
---

# Zernio inbox integration

This is a **standalone integration skill**, not a stage of the white-label blueprint. It works with existing apps regardless of how they were built. Its instructions and official-documentation links are self-contained; the library relationship below is optional compatibility context.

Use **Map → Connect → Integrate → Verify** to add Zernio's messaging capabilities to the user's own application. The app already exists by default. This is an implementation framework, not a software package or a guarantee of instant channel activation. Follow the [agent brief and prompt sequence](references/agent-brief.md).

Start from official documentation, not Enrique's legacy Zernio skills. Adapt to the application's existing framework, authentication, data model and design. Do not scaffold a new app or replace its stack unless requested. If no repository is available, produce an integration plan and ask for the target app before making architectural commitments.

Use the [API contracts and integration pitfalls](references/api-contracts.md) while implementing; it records the documentation audit and points to the exact sources. Use the [Claude Code testing handoff](references/claude-code-handoff.md) for a realistic end-to-end evaluation. Neither reference substitutes for live verification.

Guide the user through the process: identify the next action, implement everything possible autonomously, and ask only for account-owner actions the agent cannot perform, such as completing consent. Explain where to click and how readiness will be checked. Keep an integration progress record in the target project with stage, completed evidence, blocked prerequisites and next action. Never label a stage complete just because its code exists.

## Relationship to Enrique's library

The [white-label-blueprint](https://github.com/Enriquemarq1/zernio-library-skills/tree/main/.claude/skills/white-label-blueprint) already covers creating a branded social app: account connection, client workspaces, publishing and account-health webhooks. Its stage 7 already sketches an inbox tab with history, replies, read state and comments. This skill develops that messaging integration in depth and can also operate on any existing app; the blueprint is not a required dependency. Reuse existing connections, profile mappings, routes and components instead of rebuilding them. Verify current API contracts and authorization requirements independently; the starter's unlisted client links and UI profile filters are not production access control. See [library relationship](references/library-relationship.md) when integrating into a blueprint-derived app.

## Decisions that matter

- Identify the target repository, selected channels, intended users and live versus fixture mode. Infer established answers from context rather than repeating discovery.
- Map the requested messaging capabilities against current documentation and channel support. The baseline is connection/status, conversation list, history, sending and replies. Where requested and supported, include attachments, templates, read/delivery events, conversation status, reactions, typing indicators and other messaging operations. Record channel differences and unsupported combinations; a shared API does not make every feature universal.
- Implement a small working slice first, then extend to the selected capability set. Do not silently restrict this reusable skill to three video-demo channels, or automatically implement every endpoint. Publishing, analytics, autonomous agents and voice calls require their own scope decision.
- Read the current endpoint definitions and platform rules before writing requests. Record the documentation checked and unresolved requirements. Do not invent SDK methods or API fields from this skill.
- Distinguish starting a conversation from replying, initial history import from live events, and accepted sends from delivery/read confirmation. These are separate contracts; test each requested behavior.
- Keep Zernio credentials on the server. Authenticate app users and enforce ownership of profiles, accounts and conversations on every server route. A profile filter or browser-provided account ID is not authorization. If the app has no user login, keep it on localhost, say it cannot be deployed, and treat tenant ID checks as defence in depth.
- Before any live test, check what else shares the accounts, using read-only calls:
  - other active webhook subscriptions on `message.*` (for example auto-reply agents);
  - the same social account connected under several tenants;
  - selected accounts that the conversation list skips;
  - test channels that exist only on profiles outside the app's tenants.
  Report each as a setup decision. Never remap another profile's account, or change another integration's subscription, to make a test work.
- One inbox means multiple channel threads in one list. Do not silently merge identities across platforms or promise that one HTTP request sends to every channel.
- Account approvals, number registration, permissions and channel messaging windows remain relevant. Show setup-pending states instead of claiming Zernio removes all requirements.
- Begin with human-controlled replies. Adding an autonomous reply agent is a separate scope choice.

## Completion

Verify the selected messaging capabilities, isolation between users if applicable, failure states and duplicate-send handling. Clearly distinguish fixture checks, live verified channels and channels still pending setup. A mock UI is not a verified integration. Deliver integration instructions, environment variable names without secrets, code locations, a capability coverage report and remaining requirements. Include a recording sequence when the task is a video demo.
