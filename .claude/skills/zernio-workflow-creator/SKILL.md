---
name: zernio-workflow-creator
description: >-
  Build Zernio conversation Workflows — including 24/7 WhatsApp AI agents — through the Zernio API on
  command. Tell Claude what the agent should do (answer questions, qualify, book a call) and it builds
  the whole node graph (trigger → AI node → reply → wait → loop) via Zernio, activates it, and edits it
  later when you ask — no dragging nodes one by one. Pairs with zernio-comment-to-dm (comment → DM →
  this AI agent runs the conversation). Triggers on: "build a Zernio workflow", "make a WhatsApp AI
  agent", "create an AI agent that answers my DMs", "add a step to the workflow", "edit the workflow",
  "build a booking agent in Zernio".
---

# zernio-workflow-creator

Build a Zernio **Workflow** — a branching conversation automation that can run a **24/7 AI agent** on
WhatsApp, Instagram, Facebook, Telegram, and more — just by *asking Claude*. Claude writes the node
graph, creates it through the Zernio API, activates it, and edits it later on command. No node-by-node
dragging, no cloning workflows.

> **The skill informs; the agent acts.** This file + `reference/zernio-workflows-api.md` give Claude
> the Zernio Workflow API contract + the recipes. Claude executes with `curl` (or the user's HTTP tool).
> **You stay in control** — Claude shows you the graph and confirms before creating or activating
> anything (it goes live on a real audience).

## What you can ask
- "Build a WhatsApp AI agent that answers questions and books a call."
- "Make a workflow: when someone DMs PRICING, an AI agent walks them through the plans."
- "Add an email-capture step before the booking question." → Claude edits the graph.
- "Pause / activate / duplicate / roll back the booking workflow."

## What Claude needs (ask once, then remember in-session)
1. **ZERNIO_API_KEY** — `Authorization: Bearer <key>` (zernio.com → Settings → API keys).
2. **profileId** + **accountId** — the Zernio profile + connected account (`GET /v1/profiles`, `GET /v1/accounts`).
3. **platform** — `whatsapp` (default), `instagram`, `facebook`, `telegram`, `twitter`, `bluesky`, `reddit`.
4. The **behavior** in plain words — what the agent should do, the system prompt's job, the booking link / next step.

### WhatsApp prerequisites (one-time)
- A WhatsApp number **bought inside Zernio** — `POST /v1/whatsapp/phone-numbers/purchase` (needs a paid
  plan + **KYC**, which can take days — start early). Test first on the **sandbox**:
  `POST /v1/whatsapp/sandbox/sessions`.
- For the **AI node on Claude (BYOK):** store your **Anthropic API key** in Zernio. Set `provider:
  anthropic` + `model` on the node to use it; omit `provider` for Zernio's built-in path.

## The recipe (Claude follows this)

### 1. Design the graph (the core)
A 24/7 conversational AI agent is a small loop **with memory**. Default shape:

```
trigger ─▶ add_tag ─▶ condition(route) ─default─▶ ai(agent) ─success─▶ set_variable(remember) ─▶ send_message ─▶ wait_for_reply ─reply─▶ condition(route)  (loop)
                            │ wants_human─▶ handoff               │ error─▶ handoff                                                      └────timeout─▶ end
```

- **trigger** — `inbound_message` (optionally gated by `keywords` + `matchType`).
- **add_tag** — tag the contact once (e.g. `whatsapp-ai-lead`) so leads are findable. Put it
  *before* the routing/AI so it fires a single time (the loop re-enters at `route`, not `tag`).
- **condition (route) — the human-escape.** Check each inbound message for a human request
  (`operator: matches`, a regex like `(?i)(human|real person|representative)`) → `handoff`; the
  `'default'` handle flows to the AI. If the rule never matches it safely falls through to the agent.
- **ai** — `provider: anthropic`, your `model`, a `systemPrompt` defining the job (tone, what to
  collect, when to book), `userPromptTemplate` that feeds memory + the new message, `saveAs: "aiReply"`.
- **set_variable (remember) — THE MEMORY TRICK.** The AI node has **no built-in conversation
  history** (it only sees `systemPrompt` + `userPromptTemplate` per call). Without memory it
  re-greets and re-asks every message. So append each turn to a `history` variable
  (`value: "{{history}}\nThem: {{lastMessage}}\nYou: {{aiReply}}"`) and put `{{history}}` back in
  `userPromptTemplate`. Now the agent has real multi-turn context.
- **send_message** — `messageType: text`, `text: "{{aiReply}}"`.
- **wait_for_reply** — `timeoutMinutes` + `saveAs: "lastMessage"` (reuse the same var the AI reads);
  `'reply'` edge loops back to the AI, `'timeout'` ends.
- **handoff** — on the AI `'error'` edge, hand the conversation to a human.

Copy-paste starting point: `templates/whatsapp-ai-agent.json` (this exact memory-enabled graph).
Full node/edge contract + all 16 node types: `reference/zernio-workflows-api.md`.

#### Gaps to design around (learned the hard way)
- **Memory** — the #1 gap. Always add the `set_variable` accumulator above; a stateless agent feels broken.
- **`userPromptTemplate` is REQUIRED** on the AI node (the spec marks it optional; the API rejects without it).
  The inbound message arrives as `{{lastMessage}}`.
- **BYOK** — `provider: anthropic` needs the user's Anthropic key stored in Zernio. If it's missing the
  AI node errors → the `handoff` path fires (no reply). Verify by testing, or omit `provider` for the
  built-in path. Always wire an `error` → `handoff` edge so failures degrade gracefully.
- **Double-reply** — `onlyFirstMessage: false` + the wait-loop can let rapid messages spawn parallel
  runs. If you see duplicate replies in testing, flip the trigger to `onlyFirstMessage: true`.
- **Lead capture (advanced)** — to *persist* a booking, give the AI node a `tools:[{name:"save_lead",…}]`
  and branch the `'tool:save_lead'` edge into `set_field` + `add_tag` + `handoff`. Verify how tool-call
  args surface as variables before relying on it.
- **Graph edits are draft/paused only** — to change a live workflow: `pause` → `PATCH` → `activate`.

### 2. Create it (one call, draft)
```bash
curl -s -X POST "https://zernio.com/api/v1/workflows" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" -H "Content-Type: application/json" \
  -d @workflow.json
```
Body = `{ profileId, accountId, platform, name, description, nodes[], edges[] }`. Returns the workflow
**id** in `draft`. `entryNodeId` is derived from the single trigger node.

### 3. Activate it
```bash
curl -s -X POST "https://zernio.com/api/v1/workflows/<id>/activate" -H "Authorization: Bearer $ZERNIO_API_KEY"
```
Now it matches inbound messages. Pause anytime: `POST /v1/workflows/<id>/pause`.

### 4. Edit it later (the "you're still steering" part)
- **Graph edits only while `draft` or `paused`** (a live edit returns 400). So: pause → `PATCH` the
  graph → activate again.
```bash
curl -s -X PATCH "https://zernio.com/api/v1/workflows/<id>" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" -H "Content-Type: application/json" \
  -d '{ "nodes": [ ... updated ... ], "edges": [ ... updated ... ] }'
```
- Versioned: `GET /v1/workflows/<id>/versions`, restore via `POST /v1/workflows/<id>/versions/<v>/restore`.
- Fork a working one: `POST /v1/workflows/<id>/duplicate`.

### 5. Inspect runs
`GET /v1/workflows/<id>/executions` (runs) · `.../executions/<execId>/events` (per-node timeline).

## Guardrails
- **Confirm before create + before activate.** Show the user the graph (or a plain-English summary of
  each node) and the system prompt, get a yes, then POST.
- **Never print the API key.** It lives in env / the user's secret store.
- **Edit only while paused/draft** — pause first, then PATCH, then re-activate. Don't attempt a live graph edit.
- **Voice:** the AI node's `systemPrompt` should make the agent sound like the creator — warm, direct,
  human, one ask at a time. Not a robotic FAQ bot.
- **WhatsApp-only nodes:** `template` / `interactive` messages and `start_call` only work on WhatsApp.

## Reference
- `reference/zernio-workflows-api.md` — full endpoint + node/edge contract (verified from docs.zernio.com).
- `templates/whatsapp-ai-agent.json` — copy-paste 24/7 WhatsApp AI-agent workflow graph.
