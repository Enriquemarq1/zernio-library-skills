---
name: white-label-automations
description: "Add your own ManyChat to your white-label social media app on the Zernio API: comment-to-DM with buttons, follower-only rewards with a one-tap confirm, story-mention replies, ref links and QR codes that start a flow, repeat rules and a live activity log, for every client workspace, and the same actions as tools for your AI agent. Part 3 of white-label-blueprint; works on any app with one Zernio profile per client. Triggers: 'manychat alternative', 'comment to dm', 'instagram dm automation', 'follower only reward', 'story mention reply', 'ref link', 'qr code to instagram dm', 'automations tab', 'own my manychat'."
---

# White-Label Automations: your own ManyChat, for every client

Comment a keyword, get a DM. That's where most DM tools stop. Zernio gives you the rest from the same API that already posts, reports and answers the inbox for your clients: story mentions, ref links, repeat rules, and rewards only followers can unlock. This skill puts all of it in one Automations tab inside your own app, under your brand.

```
YOUR APP → [1 COMMENT → DM] → [2 FOLLOWERS ONLY] → [3 STORY MENTION] → [4 LINK OR QR] → [5 REPEAT RULES] → [6 EVERY CLIENT]
            keyword, button,   one-tap “I'm        thank-you DM        ig.me link starts    once per person,   same tab, that
            public reply       following” check                        a flow, tags them    logged when skipped client's own
```

**The law: every automation lives in Zernio, and your app only ever shows a client its own.** Zernio is the system of record (no copy in your database); your server checks that the automation's account belongs to the client's profile before it shows, edits or deletes anything.

| # | Check | What proves it |
|---|---|---|
| 1 | Comment → DM | Comment the keyword from another account: the DM with the button arrives, the public reply appears, the log row says "DM sent" |
| 2 | Followers only | A commenter Instagram doesn't know gets the "I'm following" button; after the tap the reward arrives on its own |
| 3 | Story mention | Mention the account in a story: the thank-you DM arrives |
| 4 | Link or QR | Open `ig.me/m/<username>?ref=<name>` (or scan its QR): the flow starts, the run shows, the contact is tagged |
| 5 | Repeat rules | Comment the keyword again: the log shows "Skipped" with the reason |
| 6 | Every client | Switch workspace: same tab, only that client's automations |

**Fastest: clone the finished app.** [`apps/white-label-app/`](../../../apps/white-label-app/) already has the Automations tab, its JSON API and the MCP server built in (`npm run demo:automations` to see it without an account). **Starting from the blueprint app?** Paste `reference/stage-prompts.md` into Claude Code inside that app, one stage at a time. **Starting from your own app?** Stage 0 reads your code first and keeps your framework, design and data model.

## The two Zernio primitives

Every ManyChat pattern is built from two things ([ManyChat-style automations](https://docs.zernio.com/guides/manychat-patterns.mdx)):

- **Comment automations** (`/v1/comment-automations`): a keyword rule that answers a comment, a story reply or a story mention with a DM. Buttons, a public reply, follower rules, repeat rules, link tracking and a log of every trigger are built in. Use them for checks 1, 2, 3 and 5.
- **Workflows** (`/v1/workflows`): a graph of steps (send, wait for reply, condition, tag, webhook, AI, handoff) on one messaging account, started by a trigger. Use them for check 4 (`referral` trigger) and for the ask-first flow.

When both match the same comment, the comment automation answers.

## The endpoints that carry each check

All on `https://zernio.com/api/v1`, bearer key server-side only. Checked against docs.zernio.com on October 24, 2026.

1. **COMMENT → DM:** `POST /comment-automations` with `profileId`, `accountId`, `name`, `trigger: "comment"`, `keywords`, `matchMode` (`word` | `contains` | `exact`), `dmMessage`, `buttons` (1 to 3 `{ type: "url", title ≤20, url }`; the text is then ≤640 characters), `commentReply`, `publicReplyPolicy` (`after_dm` | `always`), `alsoMatchInDms`. Omit `platformPostId` for any post; set it to bind one post (only one active per post, else 409). `{{first_name}}`, `{{name}}`, `{{username}}` personalise the DM and the reply.
2. **FOLLOWERS ONLY:** the same body plus `audience: { followerStatus: "follower", whenUnknown: "verify" }` and `followGate: { message, buttonLabel, notFollowingMessage }`. Instagram only reveals who follows you once they've messaged you; `verify` sends the one-tap check, the tap is a message, Zernio re-checks and delivers. Instagram only.
3. **STORY MENTION:** `trigger: "story_mention"`, `keywords: []`, no post. Instagram only.
4. **LINK OR QR:** `POST /workflows` with a `trigger` node `{ triggerType: "referral", referral: { ref, matchType: "exact" }, cooldownHours }`, then `send_message`, `add_tag`, `end`, linked by `edges`; then `POST /workflows/{id}/activate` (a new workflow is a draft). The link is `https://ig.me/m/<username>?ref=<ref>` (Facebook: `https://m.me/<page>?ref=<ref>`). It also fires on click-to-message ads. **In practice Instagram doesn't always pass the ref along** (a first chat only carries it on the person's first message, and existing chats often don't send it at all), so for a printed QR code the dependable version is a card that says "scan, then send MENU" plus a comment automation with `alsoMatchInDms: true` and the keyword MENU, which answers every DM that says MENU.
5. **REPEAT RULES:** `repeatPolicy: { mode: "once" }` (default: one DM per person, ever) or `{ mode: "every_comment", cooldownHours }`. Suppressions are logged: `GET /comment-automations/{id}/logs` returns each trigger with `status` (`sent`, `gated`, `skipped`, `failed`, `pending`), the reason in `error`, `audienceOutcome`, `commentReplyStatus`, `clickCount`, plus `misses` (comments that matched no keyword).
6. **EVERY CLIENT:** list with `GET /comment-automations?profileId=…` and `GET /workflows?profileId=…`, and keep only rows whose `accountId` is in `GET /accounts?profileId=…`. Re-check on every read, edit and delete.

Changes: `PATCH /comment-automations/{id}` (send `buttons: []` to clear; `platformPostId`, `postTitle`, `postId` move as a unit, all `null` for any post), `PATCH /workflows/{id}` (name, nodes, edges; allowed while active), `POST /workflows/{id}/pause`, `DELETE` on either. Runs: `GET /workflows/{id}/executions`.

## Honest limits to say out loud

- Instagram can refuse buttons in the first DM to someone who doesn't follow the account, and a refused reply still spends the comment's one private reply. For cold audiences, open with plain text and send the button after they answer (the ask-first flow in stage 6).
- Liking the comment works on Instagram only for accounts connected through Facebook Login; otherwise the log says it was skipped.
- On TikTok, Threads, LinkedIn and YouTube a comment automation can only post the public reply (no private DM on those platforms).
- Comments arrive by webhook, and Zernio re-reads the latest comments every 10 minutes, so a missed webhook still gets answered once.
- Pricing (docs.zernio.com/pricing, October 24, 2026): every DM an automation sends is an outbound message; the first 10,000 a month are free, then $1 per 10,000. Accounts: two free, then $6, $3 and $1 per connected account a month, every feature included.

## For your AI agent

Everything the tab does is also a tool. Stage 7 adds a small JSON API (`/api/w/:profileId/automations…`, local only, with an optional token) and an MCP server that calls it, so Claude Code can list, create, edit, pause, delete and read the activity per client in plain words. The agent goes through your app, so the Zernio key and the workspace rule apply to it too.

## Files

- `reference/stage-prompts.md`: one prompt per stage, paste-ready.
- The design system and polish loop from white-label-client-report and white-label-blueprint finish the look.
