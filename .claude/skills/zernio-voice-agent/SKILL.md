---
name: zernio-voice-agent
description: >-
  Build a WhatsApp VOICE AI agent — a Zernio workflow that qualifies an inbound WhatsApp chat with
  Claude, then escalates to a LIVE AI voice call answered by a Retell AI voice agent (via the start_call
  node's forwardTo → Retell SIP/WebSocket endpoint). Claude builds the node graph, wires the Retell
  bridge, and writes the Retell voice-agent prompt. Pairs with zernio-workflow-creator (the text agent)
  and zernio-comment-to-dm (comment → DM → this). Triggers on: "build a WhatsApp voice agent", "AI
  voice agent on WhatsApp", "connect Retell to Zernio", "make my WhatsApp answer calls with AI", "voice
  AI agent workflow", "add a voice call to my Zernio workflow".
---

# zernio-voice-agent

Build a **WhatsApp Voice AI agent** by asking Claude. Two tools, one flow:

- **Zernio** runs the messaging + orchestration and **places the WhatsApp call** (`start_call`).
- **Retell AI** runs the **real-time voice conversation** (STT → LLM → TTS, low-latency, human-sounding).
- The bridge between them is one field: **`start_call.forwardTo`** → a Retell SIP/WebSocket endpoint.

> **The skill informs; the agent acts.** This file + the two `reference/` docs give Claude the full
> contract. Claude builds the node graph, creates it through the Zernio API, and writes the Retell
> agent's prompt. **You stay in control** — Claude shows you the graph + both prompts and confirms
> before creating or activating (it goes live on a real number, and a call costs money).

## The architecture (memorize this)

```
WhatsApp inbound message
   └─▶ Zernio workflow: tag ─▶ human-escape ─▶ [ai] greet + qualify (text, with memory) ─▶ reply ─▶ wait
                                                          │
                                  contact replies "CALL"  ▼
                                              [start_call]  forwardTo ──▶  Retell AI voice agent
                                                  │ success → post-call text          (answers, talks, books)
                                                  │ permission_required → ask + loop
                                                  └ failed → fall back to text
```

Two brains, kept consistent: the **Zernio `ai` node** triages in chat; the **Retell agent** talks on
the call. Same name, same warmth, so it feels like one assistant.

## What you can ask
- "Build me a WhatsApp voice agent that books appointments."
- "When someone DMs and wants to talk, have an AI voice agent call them."
- "Connect my Retell agent to my Zernio WhatsApp number."
- "Write the voice prompt for the Retell agent."

## What Claude needs (ask once, remember in-session)
1. **ZERNIO_API_KEY** — `Authorization: Bearer <key>` (zernio.com → Settings → API keys).
2. **profileId + accountId** — `GET /v1/profiles`, `GET /v1/accounts`.
3. **A WhatsApp Business CALLING number bought + KYC'd inside Zernio** — `start_call` is WhatsApp-only
   and needs a real, verified number. **KYC can take days — start it first.** (Text-only testing works
   on the sandbox; the voice bridge needs the live number.) See `reference/whatsapp-calling-api.md`.
4. **A Retell AI account + a built agent** (voice, model, and the prompt from `templates/retell-voice-agent.base.md`),
   exposed for inbound calls — see `reference/retell-voice-api.md` for the SIP-bound-agent setup.
5. The **business details** in plain words — for BOTH prompts (the chat triage + the voice agent).

## The recipe (Claude follows this)

### 1. Write the two prompts
- **Text triage** — the Zernio `ai` node's systemPrompt (in the workflow template). Greets, answers,
  and offers the call. Fill the `[BRACKETS]`.
- **Voice agent** — the Retell agent's prompt. Start from `templates/retell-voice-agent.base.md`
  (read `templates/retell-voice-agent.example.md` for a filled one). Voice rules matter: no markdown,
  one question per turn, confirm names/numbers/times, end the call cleanly.

### 2. Stand up the Retell side (so `forwardTo` has a target)
Recommended: **static SIP-bound agent** (Path 1 in `reference/retell-voice-api.md`) — import a number
into Retell, bind your `agent_id`, and you get a fixed SIP address. Set the workflow's
`start_call.forwardTo` to it (`sip:…@sip.retellai.com`, or your trunk URI; `wss://…` also supported per
Zernio's WhatsApp Calling docs). Test the agent in Retell's playground first.

### 3. Build + create the Zernio workflow (one call, draft)
Start from `templates/whatsapp-voice-agent.workflow.json` — the memory-enabled text loop **plus** the
`start_call` escalation with `success` / `permission_required` / `failed` handled. Fill `<profileId>`,
`<accountId>`, `<model>`, `<RETELL_FORWARD_URI>`, and the systemPrompt `[BRACKETS]`; strip `_` keys.
```bash
curl -s -X POST "https://zernio.com/api/v1/workflows" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" -H "Content-Type: application/json" \
  -d @workflow.json
```
Returns the workflow **id** in `draft`.

### 4. Activate
```bash
curl -s -X POST "https://zernio.com/api/v1/workflows/<id>/activate" -H "Authorization: Bearer $ZERNIO_API_KEY"
```
Pause anytime: `POST /v1/workflows/<id>/pause`. Edit only while `draft`/`paused`: pause → `PATCH` → activate.

### 5. Test the whole bridge end to end
On the live WhatsApp number: send a message → confirm the text agent replies with memory → reply `CALL`
→ confirm the phone rings, the Retell agent answers, and the conversation flows → hang up → confirm the
`success` post-call text. Then test the failure paths (deny permission → `permission_required`; bad
`forwardTo` → `failed` fallback). Inspect runs: `GET /v1/workflows/<id>/executions`.

## Gaps to design around (learned the hard way)
- **`start_call` is WhatsApp-only** and needs a **KYC'd calling number** — this is the long pole. Start KYC early.
- **The contact-number variable** in `start_call.to` — `{{contactPhone}}` is a placeholder. **Verify the
  exact run variable Zernio exposes** for the contact's number against a live execution before trusting it.
- **Always wire the `failed` edge** — a dropped call with no fallback strands the contact. The template
  falls back to text.
- **`permission_required`** — WhatsApp gates calls on contact opt-in (`requirePermissionFirst: true`).
  Handle the edge (ask them to allow calls, loop back) or the escalation silently dies.
- **Recording is off by default** — only `recordingEnabled: true` **with consent + disclosure** (and per
  local two-party-consent law).
- **Two bills, two brains** — Retell bills voice minutes/usage directly to your Retell account, separate
  from Zernio's carrier charges. And the voice prompt ≠ the text prompt; keep their tone consistent.
- **Retell ships fast / Zernio API evolves** — verify SIP endpoint shapes + the WhatsApp calling fields
  against live docs before a production deploy. Both reference files flag the spots to check.
- **Memory** — the text `ai` node has no built-in history; the `remember` set_variable accumulator is what
  gives multi-turn chat memory (same trick as `zernio-workflow-creator`). The Retell agent keeps its own
  per-call context.

## Guardrails
- **Confirm before create + before activate + before the first real call.** Show the graph, both prompts,
  and the `forwardTo` target. Get a yes.
- **Never print the API key.** It lives in env / the user's secret store.
- **Edit only while paused/draft.**
- **Voice = the brand on the phone.** The Retell prompt should sound like a warm human, one ask at a time —
  not a robotic IVR.

## Reference
- `reference/whatsapp-calling-api.md` — Zernio WhatsApp Calling + the `start_call` node (forwardTo, edges, prereqs).
- `reference/retell-voice-api.md` — Retell connection (SIP-bound agent, Register API, WebSocket) + gotchas.
- `templates/whatsapp-voice-agent.workflow.json` — the full Zernio workflow (text qualify → start_call → Retell).
- `templates/retell-voice-agent.base.md` — fill-in-the-blank Retell voice-agent prompt.
- `templates/retell-voice-agent.example.md` — a fully-filled voice prompt (appointment booking).
- Pairs with `zernio-workflow-creator` (the text-only agent + full 16-node Workflow API contract).
