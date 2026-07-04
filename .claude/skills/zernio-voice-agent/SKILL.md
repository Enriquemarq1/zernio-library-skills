---
name: zernio-voice-agent
description: >-
  Give ONE WhatsApp number a full AI front desk — text it and an AI replies (Zernio workflow with
  memory); CALL it and an AI voice picks up (Zernio WhatsApp Calling routes inbound calls via
  forwardTo to a Retell AI voice agent). Claude wires the whole thing: the Retell agent + voice
  prompt, the calling config on the number, and the text workflow with a tap-to-call escalation.
  Live-proven inbound-first; also covers the outbound start_call node for when Meta grants outbound.
  Triggers on: "AI answers my WhatsApp calls", "WhatsApp voice agent", "AI receptionist on
  WhatsApp", "connect Retell to Zernio", "route my WhatsApp calls to an AI", "AI front desk".
---

# zernio-voice-agent

One WhatsApp number, full AI front desk. **Text it → an AI answers in chat. Call it → an AI voice
picks up.** Two tools, one bridge:

- **Zernio** owns the WhatsApp number: the text workflow (chat brain) **and** the call routing.
- **Retell AI** is the voice: real-time listen → think → talk, human-sounding.
- The bridge is one field: the number's **`forwardTo`** → your Retell agent's SIP/wss endpoint.

> **The skill informs; the agent acts.** This file + `reference/` give Claude the verified
> contract. **You stay in control** — Claude shows you both prompts, the graph, and the calling
> config before creating or activating anything (it goes live on a real business number).

## The architecture (live-proven shape)

```
                       ONE WhatsApp NUMBER (Zernio, calling-eligible)
                      /                                              \
   TEXT: inbound message                                    CALL: inbound WhatsApp call
        │                                                            │
   Zernio workflow: tag → human-escape → ai (memory) → reply → wait  │ number's calling config:
        │  contact asks to TALK                                      │ forwardTo: sip:<retell>@sip.retellai.com
        └─▶ send TAP-TO-CALL deep link (wa.me/call/<number>) ────────┤
                                                                     ▼
                                                        Retell voice agent ANSWERS
                                                     (same persona as the text agent)
```

**Why tap-to-call instead of the outbound `start_call` node:** outbound calling is gated
separately by Meta (`outboundDisabled` stays true on most numbers). The deep link needs only
INBOUND calling, works the moment `forwardTo` is set, and converts better anyway — the contact
chooses to call. Keep `start_call` for when outbound unlocks.

## What Claude needs (ask once, remember in-session)
1. **ZERNIO_API_KEY** + **RETELL_API_KEY** (Retell needs a card on file to provision a number).
2. **profileId + accountId** of the WhatsApp account (`GET /v1/profiles`, `GET /v1/accounts`).
3. A **calling-eligible WhatsApp number** — see the gates below. This is the long pole.
4. The **business details** in plain words — for BOTH prompts (text + voice), same persona.

## The three gates (check BEFORE building — each returns a specific 4xx)
1. **Retell card on file** — `create-phone-number` returns 402 without payment.
2. **Zernio usage-based plan** — calling is metered; flat plans return 422
   *"available on usage-based billing only"*. Only the account **owner** can switch plans.
3. **Meta messaging tier** — a fresh number (TIER_250) cannot call; enabling returns 422
   *"requires a daily messaging limit of at least 2,000"*. The tier is EARNED: message ~2× your
   current limit in unique opted-in recipients over 7 days with good quality (250→1K→10K...).
   No API, payment, or support ticket bypasses this — use a warmed number or budget weeks.

## The recipe (Claude follows this)

### 1. Build the voice agent (Retell)
Prompt from `templates/retell-voice-agent.base.md` (voice discipline: short turns, one question,
confirm names/numbers back, no lists/URLs read aloud). Create the LLM + agent:
`POST /create-retell-llm` → `POST /create-agent` (`response_engine: {type: retell-llm, llm_id}`,
`voice_id`). Test in the Retell playground before wiring anything.

### 2. Give the agent an inbound line (Retell)
`POST /create-phone-number` with **`inbound_agents: [{agent_id, weight: 1}]`**
(the old `inbound_agent_id` field is deprecated — returns 400). This number is the forward target.

### 3. Enable calling on the WhatsApp number (Zernio — THE bridge)
```bash
curl -s -X POST "https://zernio.com/api/v1/whatsapp/phone-numbers/{phoneNumberDocId}/calling" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" -H "Content-Type: application/json" \
  -d '{"accountId":"<accountId>","forwardTo":"sip:+1<retellNumber>@sip.retellai.com;transport=tcp","recordingEnabled":false}'
```
Verify with `GET /v1/whatsapp/calling?accountId=<accountId>` → expect `callingEnabled: true` and a
**`callDeepLink`** (`https://wa.me/call/<number>`) — save that link for step 4.
Full endpoint set + field semantics: `reference/whatsapp-calling-api.md`.

### 4. Build the text agent (Zernio workflow)
Start from **`templates/whatsapp-ai-front-desk.workflow.json`** — the live-tested graph: memory
loop + human-escape + call-intent detection → sends the `callDeepLink`. Fill the `[BRACKETS]`,
paste the deep link, `POST /v1/workflows`, confirm with the user, `/activate`.

### 5. Test end to end (in this order)
Text → short reply with memory → "can we talk on a call?" → deep link arrives → tap → **the voice
agent answers** → give a name + number → it confirms them back → hang up → chat continues →
"let me talk to a REAL person" → handoff fires. Inspect runs: `GET /v1/workflows/{id}/executions`.

## Gaps to design around (all live-verified)
- **Condition regex needs `operator: "matches"`** — with `contains` the regex is treated as a
  literal substring and the rule silently NEVER fires (everything falls to the AI). This bug ships
  easily and looks like "the AI just talks a lot."
- **One persona across text + voice** — same name, same warmth in both prompts, or the chat→call
  hop feels like a transfer. The voice agent must NOT pretend to remember chat specifics (the two
  brains share no history) — instruct it to "continue helping naturally."
- **Keep text replies SHORT** — hard-rule the style block (max 1–2 sentences, one question). Long
  AI replies read as spam on WhatsApp and hurt the quality rating your tier depends on.
- **Memory accumulator** on the text AI node (`set_variable` history trick) — without it the agent
  re-greets every message. Unbounded growth caveat applies (see zernio-workflow-creator).
- **`outboundDisabled` is separate from inbound** — inbound calling live ≠ `start_call` works.
  Wire outbound only after checking the flag.
- **Recording off by default** — enable only with consent + disclosure (two-party-consent laws).
- **Two bills** — Zernio meters the WhatsApp/carrier side; Retell bills voice minutes + the
  number's monthly fee. Cents per call, but know it.
- **Both APIs move fast** — re-verify against live docs before a production deploy.

## Guardrails
- **Confirm before create/activate/enable-calling.** Show both prompts, the graph, the forwardTo.
- **Never print API keys.**
- **Workflow edits only while paused/draft** — pause → PATCH → activate.
- **The voice IS the brand on the phone** — pick it deliberately, test by talking, not reading.

## Reference
- `reference/whatsapp-calling-api.md` — Zernio WhatsApp Calling: all four calling endpoints,
  `forwardTo` forms, gates, deep link, `start_call` node spec.
- `reference/retell-voice-api.md` — Retell wiring: agent/LLM creation, `inbound_agents`, SIP forms.
- `templates/whatsapp-ai-front-desk.workflow.json` — **the proven inbound graph** (text + tap-to-call).
- `templates/whatsapp-voice-agent.workflow.json` — the outbound `start_call` variant (for when
  Meta grants outbound).
- `templates/retell-voice-agent.base.md` / `.example.md` — the voice prompt (blank + filled).
- Pairs with `zernio-workflow-creator` (full 16-node Workflow API contract) and
  `zernio-comment-to-dm` (comment → DM → this front desk).
