# Map → Connect → Integrate → Verify

## Outcome

Standalone integration guide. No other Zernio library skill or white-label starter is required. Existing account connections can be reused; if absent, this guide includes their setup.

Integrate Zernio's messaging capabilities into an existing application: **I can add these conversations to my own product.** Users can connect supported messaging accounts, see channel conversations in one list, open message history and reply inside that application. Preserve its architecture and design. App creation is an optional separate request.

## Paste into Claude Code or Codex

Use $zernio-inbox-integration to integrate Zernio's messaging and inbox capabilities into my existing app. Follow Map → Connect → Integrate → Verify. Inspect my repository and preserve its framework, authentication, data model and design. Read Zernio's current official documentation and map the messaging capabilities we need to the supported channels. Cover connection, sending, receiving, conversations, history and replies first; identify which additional messaging features fit the requirements. Do not create a new application, migrate my stack, add unrelated social publishing or activate an autonomous agent unless requested.

Build a working vertical slice: connected account → conversation list → message history → reply. Then extend that same flow to the other channels. Read the documentation below and verify exact request/response schemas before coding. Keep credentials server-side and provide .env.example with variable names only. If credentials or approved accounts are missing, build a clearly labeled fixture mode and list the exact remaining setup steps. Do not present fixture output as live proof.

### 1. Map — fit messaging into the existing app

Read [API contracts](api-contracts.md) for the known pitfalls, then check current official references. Record the agreed scope and stage checkpoints in the target project. Guide account-owner setup with concrete instructions instead of simply saying "configure credentials."

- Inspect existing UI, server routes, authentication, tenant model and persistence. Identify where the Zernio adapter, connection settings and conversation components belong. Create a new app shell only if explicitly requested.
- Build a capability matrix: requested feature, selected channels, documented support, prerequisites, implementation location and verification status. Use current endpoint and platform docs. This supports the full selected messaging scope without promising identical support across channels.
- Adapt existing inbox components or add those needed: channel/account filters; conversation list with sender, channel and latest activity; thread history; reply composer with pending, sent and failed states. A backend-only request need not add a UI.
- Separate the application UI, server routes and Zernio adapter. Keep provider field names in the adapter; preserve opaque IDs verbatim.
- Use existing authentication. For a local single-user demo, bind local development to localhost and document that it is not ready for public deployment. Before hosting or multi-user use, enforce authentication and server-side tenant authorization.
- Explain how the integration fits the existing framework and data flow in ordinary language. Do not add a database unless persistence or the chosen auth/event approach needs it.
- Establish prerequisites: a Zernio account with inbox access, a server-side API credential with the selected resources enabled, authorized profile/account mappings, app callback URL, and a consenting recipient for each live test. Show the user where to obtain missing credentials in the Zernio dashboard and where to set the app's secret environment variables; never request keys in chat. Use documented authenticated reads to check access without sending messages.
- Run a read-only probe before committing to channels. Print masked handles and counts only; keep raw output out of version control when the key sees other teams' profiles. Probe:
  - each tenant's accounts (filter the rows by `profileId` yourself);
  - account health;
  - one conversation-list page, checking `meta.failedAccounts` and `meta.accountsSkipped` for every selected account;
  - one history page (note `sortOrderApplied`);
  - all webhook subscriptions.
  Record as blockers:
  - skipped messaging accounts;
  - other active subscriptions that receive `message.*` for the test profiles;
  - one social identity connected under several tenants;
  - selected channels that exist only on profiles outside the app's tenants.
- If the app has no authentication at all, say so in the progress record. Tenant ID checks then protect nothing on their own; the app stays on localhost until login and user→tenant authorization exist.

Checkpoint: implementation locations, capability matrix, documentation URLs/date and precise missing prerequisites are recorded. Keep unsupported, unverified and out-of-scope features distinct.

### 2. Connect — authorize the channels

- Map the authenticated user or tenant to its allowed Zernio profile and accounts on the server.
- Implement the documented connection flow for each selected channel. Do not assume SMS provisioning works like Instagram OAuth. Prefer hosted selection unless a custom selection UI is required. Bind callback completion to a server-side, expiring, single-use initiation record and the signed-in user; use a fixed app-controlled redirect destination. Do not invent a Zernio state parameter. For headless mode, implement the documented platform selection/token exchange, not just the first redirect.
- Display connected, action required, pending approval and disconnected states. Recheck the account after authorization before marking it ready.
- Make channel prerequisites explicit: Instagram account eligibility/permissions; WhatsApp Business onboarding and template/window rules; SMS enabled number, destination support and required registration.
- Existing connected test accounts may be used for the recording when they belong to one of the app's tenants. An account on a profile outside those tenants needs its owner's approval; the free WhatsApp sandbox is the alternative for WhatsApp. Never buy numbers, activate paid extras or message arbitrary contacts merely to finish setup.

Checkpoint: each selected account is mapped to the right tenant, its connection and health are checked, and the user sees any remaining activation work. A successful browser redirect alone is not proof that sending and receiving work. Provide reconnect guidance without automatically disconnecting or replacing accounts.

### 3. Integrate — add messaging and conversation functionality

- List authorized conversations and preserve accountId, platform and conversationId. Follow pagination rather than assuming one page is complete.
- Fetch selected conversation history. Preserve ordering and handle pagination and empty/error states.
- Send replies through the common documented endpoint with the correct account and conversation context. Disable accidental double submission. Use the documented idempotency mechanism and reconcile ambiguous delivery failures before retrying.
- When composing a new conversation is in scope, implement its distinct endpoint and recipient eligibility rules. Instagram and Messenger should not inherit the SMS new-recipient behavior. Respect the different WhatsApp template fields for starting a thread versus replying.
- Keep each channel's conversation distinct. Cross-channel identity linking is not part of this first build.
- Choose the simplest documented refresh method suitable for the demo. Label polling honestly. If using webhooks, verify signatures against the raw body using the current documented scheme, deduplicate events, handle out-of-order events and enforce account ownership. Do not invent webhook signatures or event payloads.
- Render incoming content as untrusted text. Show actionable permission/window/rate-limit errors without leaking credentials or private upstream details.
- Extend the verified baseline to the capability matrix: for example attachments, approved templates, read/delivery events, conversation status, reactions or typing indicators where selected and documented. Keep platform-specific fields explicit; do not fabricate a common implementation for unsupported operations.

Checkpoint: initial list/history load and subsequent updates both work. Handle partial account failures, duplicate events, pagination, explicit read actions and eventual delivery outcomes. A send acceptance is not a delivered/read receipt. Use the API-contract reference for exact pitfalls and the live docs for field shapes.

### 4. Verify — prove the complete loop

- Verify one channel end-to-end before adding the others.
- Use consenting test recipients and eligible open conversations. Where a channel requires the recipient to initiate, establish that conversation first. Use approved templates when required.
- Optional video example: SMS, WhatsApp and Instagram. Send the same short text through three permitted test conversations; capture it on each channel; reply from each recipient; show three distinct threads in the app's shared list; open one and answer from the app. These are demo choices, not limits on the skill's supported integration scope.
- Do not describe three sends as one broadcast API call. Show the reused endpoint or SDK method and the changing account/conversation values.
- Verify loading, disconnected account, rejected send, missing permissions and no-message states. For multi-user apps, test that user A cannot read or send into user B's conversations by changing an ID.
- Deliver a test report distinguishing live evidence from fixtures, setup instructions, limitations and dated links for pricing. Separate platform/account charges from number, carrier or Meta charges; do not hardcode a promise of free messaging.
- Follow [the testing handoff](claude-code-handoff.md). Before a requested deployment, configure the production secret environment, authorized callback origin and HTTPS webhook endpoint; test there separately. Reuse/update only the integration's own webhook subscription, preserve other subscriptions, and provide rollback instructions for the changes made. Do not deploy merely to mark the guide complete.

Checkpoint: the user can reproduce connection → inbound message → list → history → reply → recipient confirmation. Deliver actual commands, file locations, setup instructions and evidence, plus explicit blocked steps. Include account-health/reconnect guidance, webhook-log inspection and recovery from missed events so maintaining the integration is covered too.

## Follow-up prompts, one at a time

1. "Inspect my app and map the Zernio messaging capabilities we need. Show where each feature belongs in my current architecture, which channels support it, and any prerequisites."
2. "Add the documented connection flows for our selected channels. List the account requirements and show each connection's actual readiness."
3. "Integrate sending, receiving, conversation history and replies into my existing app. Get one live test conversation working, then extend to the selected channels and additional messaging capabilities."
4. "Verify the selected capabilities with our test accounts. Report what works, what is mocked, and what still needs setup. Include a short recording sequence if we are preparing a demo."

## Official documentation

Reference links checked September 25, 2026; recheck current schemas when implementing.

- Discovery: https://docs.zernio.com/llms.txt
- OAuth connection: https://docs.zernio.com/connect/get-connect-url
- Connected accounts: https://docs.zernio.com/accounts/list-accounts
- Conversation list: https://docs.zernio.com/messages/list-inbox-conversations
- Start a conversation: https://docs.zernio.com/messages/create-inbox-conversation
- Reply: https://docs.zernio.com/messages/send-inbox-message
- Inbox events: https://docs.zernio.com/webhooks/inbox
- Channel capabilities: https://docs.zernio.com/platforms
- Instagram: https://docs.zernio.com/platforms/instagram
- WhatsApp setup: https://docs.zernio.com/platforms/whatsapp/connection
- SMS: https://docs.zernio.com/platforms/sms
- Pricing: https://docs.zernio.com/pricing

The verified reply operation is POST /v1/inbox/conversations/{conversationId}/messages, with accountId and message in a basic text request. Resolve the current server base URL and additional fields from the official reference. Read and send schemas, connection rules and event support can evolve.
