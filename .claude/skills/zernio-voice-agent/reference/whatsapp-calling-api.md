# Zernio WhatsApp Calling + `start_call` — reference

> Source of truth: `docs.zernio.com` + the OpenAPI spec + Zernio's blog
> "WhatsApp Calling API: route calls to AI voice agents or any number"
> (https://zernio.com/blog/whatsapp-calling-api). API shapes evolve — **verify against the
> live spec before relying on an exact field**, especially the contact-number variable in `start_call`.

WhatsApp now supports **business calling**. Zernio exposes it two ways: a per-number
**call routing config** (`enableWhatsAppCalling`) and an in-workflow **`start_call` node**.
Both place/bridge a real WhatsApp voice call. The AI voice brain is **not** Zernio — it's
whatever you point `forwardTo` at (Retell AI, Vapi, or any WebSocket media server / SIP endpoint).

---

## The `forwardTo` contract — the bridge to a voice agent

`forwardTo` accepts three destination shapes:

| Shape | Value | Use |
|---|---|---|
| **Phone line** | `tel:+E164` | Bridge the call to any real phone number (a human, a call center DID). |
| **SIP endpoint** | `sip:user@host` | Connect existing contact-center / SIP infra **or** a Retell SIP-bound agent. |
| **AI voice agent** | `wss://…` | "Connect a WebSocket media server so Vapi, Retell, or any voice agent answers the call." |

When you point `forwardTo` at a voice-agent endpoint, "an AI voice agent picks up, listens,
and talks back in real time." That is the integration in one line.

**Billing:** "Your provider, direct" — the voice-agent cost (Retell minutes, LLM, TTS/STT) is
billed by your provider at their rates, **separate** from Zernio's carrier connection charges.

---

## A. The `start_call` workflow node (what the template uses)

WhatsApp-only node. Config:

```jsonc
{
  "to": "{{contactPhone}}",          // who to call — the contact's WhatsApp number
                                     //   ⚠ verify the exact run variable Zernio exposes for the
                                     //     contact number against a live execution; {{contactPhone}} is a placeholder
  "forwardTo": "sip:agent@sip.retellai.com",  // or wss://…  or tel:+E164
  "requirePermissionFirst": true,    // ask the contact to accept calls from your business (WhatsApp opt-in)
  "recordingEnabled": false,         // off by default — only enable WITH consent + disclosure
  "saveAs": "callResult"             // stores the call outcome in the run variable bag
}
```

**Edges (branch handles):** `'success'` · `'permission_required'` · `'failed'`.
- `success` — the call connected (and ended). Continue the flow (e.g. a post-call text).
- `permission_required` — the contact hasn't granted call permission. Send a message asking
  them to allow calls, then loop back.
- `failed` — couldn't connect. Fall back to text or hand off to a human. **Always wire this** —
  a dropped call with no fallback is a dead end.

## B. The per-number routing config (alternative / always-on)

`enableWhatsAppCalling` binds a destination to one of your WhatsApp numbers, so **every**
inbound call to that number is routed — no workflow needed. Useful when you want the number
itself to be "the AI line."

```javascript
const { data } = await zernio.whatsappcalling.enableWhatsAppCalling({
  path: { id: 'PHONE_NUMBER_DOC_ID' },     // phoneNumberDocId from your calling config
  body: {
    accountId: 'YOUR_ACCOUNT_ID',
    forwardTo: 'wss://your-agent-endpoint.com',  // or sip:… or tel:+E164
    recordingEnabled: false,
  }
});
```

`start_call` (A) is the right tool when the **agent decides** to escalate mid-conversation
(our template). `enableWhatsAppCalling` (B) is right when **the number is the front door**.

---

## Prerequisites (one-time, can take days)

- **A WhatsApp Business calling number bought inside Zernio.** Zernio sells these in 53
  countries. `POST /v1/whatsapp/phone-numbers/purchase`; check availability with
  `/v1/whatsapp/phone-numbers/available`.
- **KYC** for the number: `/v1/whatsapp/phone-numbers/kyc`, `/kyc/upload-document`,
  `/kyc/validate-address`. **Start this early** — it gates everything.
- **A usage-based plan** (includes WhatsApp + calling features).
- **Customer opt-in** for calls — `requirePermissionFirst: true` enforces it per contact.

**Test without a bought number:** `POST /v1/whatsapp/sandbox/sessions` for the text path.
(Live calling needs the real, KYC'd number — sandbox covers messaging, not the voice bridge.)

---

## Sources
- Zernio blog — WhatsApp Calling API: https://zernio.com/blog/whatsapp-calling-api
- Zernio Workflow API node contract — see `zernio-workflow-creator/reference/zernio-workflows-api.md`
  (the `start_call` node spec lives there; this file is the voice-specific deep dive).
