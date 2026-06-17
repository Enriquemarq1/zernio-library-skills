# Zernio Workflows API — contract (verified 2026-06-16, docs.zernio.com)

Base: `https://zernio.com/api` · Auth: `Authorization: Bearer $ZERNIO_API_KEY`

A **Workflow** is a branching conversation automation defined as a **node/edge graph**. It runs per
contact when an inbound message (or event) matches the trigger. Created in `draft`; **activate** to go
live. The same engine powers simple auto-replies and full 24/7 AI agents.

---

## Endpoints

| Method & path | What it does |
|---|---|
| `GET /v1/workflows` | List (filter `profileId`, `status` = draft\|active\|paused, `limit`, `skip`). |
| `POST /v1/workflows` | **Create** (draft) from a graph. Body below. |
| `GET /v1/workflows/{id}` | Get one **with its full node/edge graph** + run stats. |
| `PATCH /v1/workflows/{id}` | **Update** name/description/graph, or reassign `accountId`. **Graph edits only while `draft` or `paused`** (else 400). Account swap re-validates the graph. |
| `DELETE /v1/workflows/{id}` | Permanently delete the workflow + all its executions. |
| `POST /v1/workflows/{id}/activate` | Draft/paused → **active**. Requires a complete graph (a trigger + reachable entry). |
| `POST /v1/workflows/{id}/pause` | Active → **paused** (stops matching new messages). |
| `POST /v1/workflows/{id}/executions` | Manually start a run (e.g. for an `api_call` trigger). |
| `GET /v1/workflows/{id}/executions` | List runs (started/completed/exited counts). |
| `GET /v1/workflows/{id}/executions/{execId}/events` | Per-node execution timeline. |
| `POST /v1/workflows/{id}/duplicate` | Fork a copy (draft). |
| `GET /v1/workflows/{id}/versions` · `GET .../versions/{v}` · `POST .../versions/{v}/restore` | Version history + restore. |

### Create body — `POST /v1/workflows`
```jsonc
{
  "profileId": "<profileId>",          // required
  "accountId": "<accountId>",          // required — the connected account this runs on
  "platform": "whatsapp",              // whatsapp(default)|instagram|facebook|telegram|twitter|bluesky|reddit
  "name": "WhatsApp AI Agent",         // required
  "description": "24/7 booking agent",
  "nodes": [ /* WorkflowNode[] */ ],
  "edges": [ /* WorkflowEdge[] */ ],
  "entryNodeId": "trigger"             // optional — derived from the single trigger node if omitted
}
```
Returns `{ success, workflow: { id, status: "draft", entryNodeId, ... } }`.
400 on a bad graph (duplicate node ids, edges pointing at missing nodes, a WhatsApp-only node on
another platform).

---

## Nodes — `WorkflowNode` = `{ id, type, config, position? }`

`config` shape depends on `type`. **All string fields support `{{variable}}` interpolation** against
the run's variable bag (resolved at execution). `position` (x,y) is for the visual builder only — the
executor ignores it, so it's optional when building via API.

The 16 types, by group:

### Control flow
- **trigger** — `{ triggerType: inbound_message|api_call|whatsapp_event, keywords:[string],
  matchType: any|contains|exact|regex, onlyFirstMessage: boolean, eventType:
  message_sent|message_delivered|message_read|message_failed|reaction }`.
  `eventType` only when `triggerType: whatsapp_event` (WhatsApp-only). Default `inbound_message`.
- **wait_for_reply** — `{ timeoutMinutes: int (≤43200), saveAs: string }`. Edges: `'reply'` (contact
  replied → save their message to `saveAs`) | `'timeout'` (silence elapsed).
- **condition** — `{ rules:[{ id, variable, operator:
  equals|not_equals|contains|not_contains|starts_with|ends_with|exists|not_exists|matches, value }] }`.
  First matching rule's `id` becomes the `sourceHandle`; else `'default'`.
- **delay** — `{ delayMinutes: int (≤43200) }`. Suspends, resumes on timer.
- **a_b_split** — `{ percentage: 0-100 (default 50) }`. Edges: `'a'` (prob `percentage/100`) | `'b'`.
- **end** — no config. Terminates the run as `completed`.

### Messaging
- **send_message** — `{ messageType: text|template|media|interactive, text,
  template:{name,language,variableMapping}, media:{mediaType:image|video|audio|document,url,caption},
  interactive }`. `template` + `interactive` are **WhatsApp-only**.

### Integrations
- **ai** — `{ provider: anthropic|openai|google|mistral|groq, model, preset: smart|tools|cheap,
  systemPrompt, userPromptTemplate, saveAs, temperature, maxTokens, outputType: text|json,
  tools:[{ name, description, parameters }] }`.
  Set `provider` + `model` for **BYOK** (uses your stored API key, e.g. your Anthropic key); omit
  `provider` to use Zernio's built-in path. Edges: `'success'` (text/JSON saved to `saveAs`) |
  `'tool:<name>'` (model invoked that tool) | `'error'`.
- **webhook** — `{ url, method, headers, bodyTemplate, saveAs }`. SSRF-guarded. Response saved as
  `{ status, ok, body }`. Edges: `'success'` (2xx) | `'error'`.
- **handoff** — `{ note, assignTo }`. Ends the run as `exited`, flags the conversation for a human.
- **start_call** — `{ to, forwardTo, requirePermissionFirst, recordingEnabled, saveAs }`.
  **WhatsApp-only.** `forwardTo` = `tel:+E164` | `sip:user@host` | `wss://…` (AI voice agent).
  Edges: `'success'` | `'permission_required'` | `'failed'`.

### Data ops
- **set_variable** — `{ assignments:[{ name, value }] }`. Run-scoped (this execution only).
- **set_field** — `{ field, value }`. **Persistent** custom field on the Contact (name sanitized to
  `[A-Za-z0-9_]`). No-op on `api_call` runs.
- **add_tag** / **remove_tag** — `{ tag }`. Push/pull a Contact tag. No-op on `api_call` runs.
- **enroll_sequence** — `{ sequenceId, saveAs }`. Enroll the contact into a Sequence. Edges:
  `'success'` | `'error'`.

---

## Edges — `WorkflowEdge` = `{ id, source, target, sourceHandle? }`

A directed link from `source` node id → `target` node id. `sourceHandle` selects a branch output of a
multi-output node; `null`/omitted = the node's single/default output.

Known handles: **condition** → a rule `id` or `'default'` · **wait_for_reply** → `'reply'` | `'timeout'`
· **webhook** → `'success'` | `'error'` · **ai** → `'success'` | `'tool:<name>'` | `'error'` ·
**start_call** → `'success'` | `'permission_required'` | `'failed'` · **a_b_split** → `'a'` | `'b'` ·
**enroll_sequence** → `'success'` | `'error'`.

---

## Variables
- `{{var}}` interpolation in any string field, resolved at run time.
- `wait_for_reply.saveAs` stores the contact's reply; `ai.saveAs` stores the model output;
  `webhook.saveAs` stores `{status,ok,body}`.
- `set_variable` = run-scoped; `set_field` = persisted on the Contact across runs.

## WhatsApp prerequisites
- Number bought in-platform: `POST /v1/whatsapp/phone-numbers/purchase` (paid plan + KYC:
  `/v1/whatsapp/phone-numbers/kyc`, `/kyc/upload-document`, `/kyc/validate-address`). Check availability
  with `/v1/whatsapp/phone-numbers/available`.
- Test without a bought number: `POST /v1/whatsapp/sandbox/sessions`.
- For the **ai** node on Claude: store your Anthropic API key in Zernio, then set `provider: anthropic`
  + a Claude `model` on the node.

## Lifecycle gotchas
- Create → **draft**. Nothing runs until `/activate`.
- **Edit the graph only while draft or paused.** Pause → PATCH → activate.
- Activation validates completeness (a trigger node + a reachable entry). A structurally invalid graph
  is rejected at create (400) or activation.
