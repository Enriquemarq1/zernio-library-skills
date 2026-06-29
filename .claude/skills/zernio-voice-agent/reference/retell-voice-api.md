# Retell AI — connecting a voice agent to an inbound call

> Source: Retell docs (https://docs.retellai.com), Retell custom-telephony + SIP-trunking
> material. Retell ships fast — **verify the exact endpoint shapes against live docs** before
> a production deploy. This file is the "enough to wire it + know the gotchas" reference.

Retell AI runs the **real-time voice conversation**: it does STT → LLM → TTS over a low-latency
audio stream and sounds human. You build the **agent** (voice, model, and a system prompt —
see `retell-voice-agent.base.md`), then expose it to inbound calls so Zernio's `start_call`
`forwardTo` can reach it.

There are **two ways** to bind a call to a Retell agent. Pick by how `forwardTo` is set.

---

## Path 1 — Static SIP-bound number/agent (recommended for `start_call`)

Best when `forwardTo` is a **fixed value** in a Zernio workflow (our case). You bind an agent
to a number once; every call to that number/trunk reaches the agent.

1. **Stand up an elastic SIP trunk** with a carrier Retell supports (Twilio, Telnyx, Vonage,
   or a SIP provider). Retell's SIP server has **no static IP**, so prefer **credential-based
   auth** over IP whitelisting.
2. **Import your number into Retell** in **E.164** format (country code + number, no spaces).
   Provide the trunk's **termination URI** during import.
3. **Bind the agent:** assign your **`agent_id`** to the imported number. Inbound calls to that
   number are then "automatically directed to the specified agent."
4. **Point Zernio at it:** set the workflow's `start_call.forwardTo` to the SIP address that
   reaches that bound number/trunk (e.g. `sip:<number-or-user>@sip.retellai.com`, or your
   trunk's inbound URI). Append transport if needed: `;transport=tcp` (recommended) / `udp` / `tls`.

This is static — no per-call API round-trip, which is what a fixed `forwardTo` wants.

## Path 2 — Per-call Register Phone Call API (dynamic)

Best for programmatic/outbound or when you mint a fresh binding per call. The SIP address is
generated per call and is short-lived.

1. Call the **Register Phone Call API** with:
   - `agent_id` — e.g. `'oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD'`
   - `direction: "inbound"`
   - `from_number` / `to_number` (optional)
2. It returns a **`call_id`**. Construct the SIP URI: **`sip:{call_id}@sip.retellai.com`**.
3. **Dial that URI within 5 minutes** or it times out (`registered_call_timeout`).

Because of the 5-minute window + per-call mint, Path 2 needs a small bridge that calls the
Register API and then sets `forwardTo` dynamically — heavier than Path 1 for a static workflow.
Prefer Path 1 unless you need per-call control.

## Path 3 — WebSocket media (`wss://`)

Zernio's `forwardTo` also accepts `wss://` ("a WebSocket media server so Vapi, Retell, or any
voice agent answers"). Retell's core API streams audio over WebSocket; a thin media server can
accept the WhatsApp call's audio and proxy it to your Retell agent. More moving parts than
Path 1 — use it if you're already running a media server or want provider-agnostic routing.

---

## Recommended for the template
**Path 1** (static SIP-bound agent). It maps cleanly to a fixed `start_call.forwardTo`, needs
no per-call bridge, and is the production pattern carriers document.

## Gotchas
- **No static IP on Retell's SIP server** → use credential auth, not IP allowlists.
- **E.164 only** for imported numbers.
- **Transport:** TCP recommended; TLS for encryption. Mismatched transport = silent failures.
- **The Retell agent prompt is separate** from the Zernio text agent's prompt. Two brains: the
  Zernio `ai` node (text triage) and the Retell agent (voice). Keep their tone consistent.
- **Cost is yours, direct** — Retell bills minutes/usage to your Retell account.

## Sources
- Retell — Custom Telephony Overview: https://docs.retellai.com/deploy/custom-telephony
- Retell — AI in SIP Calling & Telephony: https://www.retellai.com/blog/integrating-ai-with-sip-trunking-and-modern-telephony
- Retell — Integrations: https://www.retellai.com/integrations
- Carrier how-tos (SIP trunk + agent binding): VoIPLine, DIDWW, didlogic, Cloudonix Retell.ai guides
