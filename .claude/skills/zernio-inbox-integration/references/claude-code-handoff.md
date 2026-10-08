# Claude Code: test the standalone integration skill

## Paste this into Claude Code in the target app repository

Read `.claude/skills/zernio-inbox-integration/SKILL.md` and its linked agent brief and API-contract reference. Use that standalone skill to add and test Zernio messaging in this existing application. Do not depend on the white-label blueprint, create a replacement app, or change the stack. Read repository instructions first and preserve unrelated work.

Follow Map → Connect → Integrate → Verify. Start by identifying the app's framework, auth, tenant boundaries, existing connections and test commands. Read the current official Zernio docs and compare the skill against them. Keep a concise integration progress record and capability matrix in this project. Record any skill gap you encounter, its source and the proposed correction.

For this evaluation, use SMS, WhatsApp and Instagram if eligible test accounts are available; these are test choices, not limits on the skill. Existing accounts should be reused. Inspect environment variable names without printing secrets. If an account-owner action is required, tell me exactly what to do and how you will verify it. Do not purchase numbers, activate paid extras, deploy publicly or send to unrelated contacts. Live sends must use my designated test recipients; ask me to identify them if the project does not already do so.

Implement one complete channel first: authorized connection → inbox list → history → app reply → recipient confirmation → inbound reply visible in the app. Then extend to the remaining selected channels. Build the real adapter and integration even if credentials are unavailable, but label fixtures clearly. Do not claim live success from a mocked response.

Run the evaluation below using this app's existing testing tools. Return changed file paths, exact commands/results, sanitized evidence for each live loop, setup instructions, unresolved issues and skill-improvement findings. Separate local tests from live checks. Keep unrelated features out of scope. Do not modify the source skill silently during the evaluation; report proposed changes so we can review its behavior.

## Evaluation sequence

1. **Map:** produce the capability matrix with source URLs/date, routes/components touched and prerequisites. Confirm that new-thread creation and replies are distinguished. Resolve documentation disagreements for the selected channels or mark the claim unverified.
2. **Connect:** demonstrate successful mapping to the correct tenant/account, cancelled/failed consent, and actual account health. Reuse connections first; simulate destructive reconnect/replacement cases locally. Check that changing callback/profile/account IDs cannot attach another tenant's account.
3. **Read:** exercise multiple pages of threads/history, empty data, partial account failure and a late historical import without a webhook. Verify ordering and no duplicate messages. Opening history must not accidentally send a read receipt. This is a fixture check by nature (it cannot be observed live), so don't report it as a live gap.
4. **Send:** show one accepted message and its actual arrival on the designated recipient's device. Reply back and verify it reaches the same channel thread. Repeat for each available channel. Check closed WhatsApp windows/templates and unsupported new-recipient initiation in controlled tests: reproduce the documented error codes from the API-contract reference with fixtures, and don't spam live recipients to provoke failures.
5. **Retry:** simulate a lost response, in-flight idempotency key, same key with changed body, ambiguous 5xx, and a partial send. A partial send applies only where the build sends an attachment and text in one Facebook/Instagram request; otherwise mark it `not applicable`. Confirm the UI does not falsely report failed/unsent then automatically resend an unknown outcome.
6. **Receive:** if using webhooks, test invalid signature rejection, duplicate delivery, worker restart after persistence, out-of-order status and cross-tenant routing. Before real inbound traffic, confirm that no other active subscription will auto-reply to the test recipient, and that subscription changes and any public tunnel are approved. Then trigger the provider's webhook test and real inbound traffic. If polling instead, verify refresh/reconnect behavior and document the event capabilities it cannot offer.
7. **Protect access:** with two local test tenants, try reading history, sending, media access and connection actions using the other tenant's IDs. These must fail server-side. Test incoming HTML/script-like text as inert content. Keep secrets and callback tokens out of browser output and logs.
8. **Finish:** run relevant app checks and inspect the actual UI or backend responses. Provide an operating handoff: start/test commands, variable names, callback/webhook configuration, health/reconnect steps, where to inspect errors and how to recover missed updates. Describe deployment requirements; deploy only if requested.

For optional capabilities selected by the user, add a success and failure case per feature. Inapplicable cases are `not applicable` with a reason, not automatic passes.

## Required report

| Capability / channel | Documentation checked | Files / commands | Local result | Live evidence | Blocker / next action |
| --- | --- | --- | --- | --- | --- |
| Fill from actual evaluation | URL and date | Reproducible locations | Pass / fail / not run | Sanitized evidence or not run | Concrete remaining action |

Classify the final result as **implemented and live verified**, **implemented but partially verified**, or **blocked**, with the reason. A live pass requires recipient receipt AND an inbound reply visible in the app. A working mock, a successful HTTP send alone, or a webhook test alone is insufficient.

## Skill access on another computer

Copy the complete `zernio-inbox-integration` folder into the app's `.claude/skills/zernio-inbox-integration/` directory; the first line of the prompt already points to that path. Keep the references together. This handoff is prepared for evaluation; it does not claim Claude Code has already run it.
