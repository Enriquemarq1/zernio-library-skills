# White-Label Automations: the stage prompts

Paste one at a time into Claude Code, inside the app that already has one Zernio profile per client (the white-label-blueprint app, or your own). Each stage is a visible win. The Zernio API key stays in `.env` and never goes on screen. Docs the session can read: https://docs.zernio.com (every page also reads as text at `<path>.mdx`); start with https://docs.zernio.com/guides/manychat-patterns.mdx.

---

## STAGE 0 · Read the app, add the Automations tab

```
This app is my agency's white-label social media portal on the Zernio API
(one Zernio profile per client). Read the codebase first and keep its
framework, routing, styles and data model. Don't add a database: Zernio
stores the automations.

Read https://docs.zernio.com/guides/manychat-patterns.mdx,
https://docs.zernio.com/comment-automations/create-comment-automation.mdx and
https://docs.zernio.com/workflows.mdx.

Add an "Automations" tab to each client's workspace at
/w/:profileId/automations. It shows:
- four numbers: live automations, DMs sent, link clicks, flows started;
- one row per automation: an icon for its type, its name, one plain sentence
  "When … → then …", the account, the repeat rule, its numbers and a
  live/paused switch;
- when there are none, five templates to start from: Comment → DM,
  Followers only, Story mention → DM, Link or QR → flow, Comment → ask first.

The workspace rule: list comment automations (GET /v1/comment-automations
?profileId=) and workflows (GET /v1/workflows?profileId=), and keep only the
ones whose accountId is in GET /v1/accounts?profileId= for this client.
Apply the same check before showing, editing, pausing or deleting one.
Only Instagram and Facebook accounts can be automated.
```

## STAGE 1 · Comment → DM, with a builder and a phone preview

```
Make the "Comment → DM" template work end to end.

The builder is a page with step cards joined by a dashed line, ManyChat
style but plainer:
1. WHEN: the account; the post ("Any post or reel", or one of the account's
   recent posts from GET /v1/inbox/comments?profileId=, with its
   thumbnail); keywords; match "as a word / anywhere / the whole comment";
   "catch small typos"; "also when they DM the keyword".
2. THEN: the DM text with insert chips for {{first_name}} and {{username}};
   up to 3 link buttons (label ≤20 characters, https link); an optional
   public reply under the comment; "like the comment too".
3. HOW OFTEN: once per person, or every time with an optional wait in hours.
On the right, a phone preview of the DM that updates as I type
({{first_name}} shows as "Sam").
"Save paused" and "Go live" at the bottom.

On save, POST /v1/comment-automations with profileId, accountId, name,
trigger "comment", keywords, matchMode, typoTolerance, dmMessage,
buttons as { type: "url", title, url }, commentReply,
publicReplyPolicy "after_dm", actions.likeComment, alsoMatchInDms,
repeatPolicy and isActive. Omit platformPostId for any post.
Validate before sending: the DM is ≤640 characters when it has buttons,
alsoMatchInDms needs a keyword. Show Zernio's own error text (with its
param) if it refuses, and keep what I typed in the form.

Then open the automation's page: its numbers, "How it works" as When /
Then / How often, "What they get" as chat bubbles, Edit, Pause, Delete.
```

## STAGE 2 · Followers only, with the one-tap check

```
Add the "Followers only" template: the same builder plus a CHECK card
between WHEN and THEN, explaining in one sentence that Instagram only says
who follows you once they've messaged you, so unknown commenters get a
one-tap check first. Fields: the check message, its button label ("I'm
following ✅") and the message for people who still don't follow.

Send the same POST with:
  audience: { followerStatus: "follower", whenUnknown: "verify" }
  followGate: { message, buttonLabel, notFollowingMessage }
  publicReplyPolicy: "always"
Instagram accounts only. The preview shows the check message with its
button, the tap, "Zernio checks the follow", then the reward.
On the automation's page, add "Unlocked by followers" (followGatePassed)
and the number of checks sent (followGateSent).
```

## STAGE 3 · Story mention → DM

```
Add the "Story mention → DM" template: trigger "story_mention",
keywords [], no post, a DM with optional buttons and a repeat rule (every
time, at most once per 24 hours by default). Instagram only. Explain in the
WHEN card that a mention carries no words and Meta doesn't say which story,
so every mention counts.
```

## STAGE 4 · Link or QR → flow

Note before you paste: Instagram doesn't always pass a ref link's ref to the API. Keep the ref flow, and also make the QR card say "scan, then send MENU" with a comment automation (keyword MENU, alsoMatchInDms) that answers it, so a scan always gets a reply.

```
Add the "Link or QR → flow" template as a Zernio workflow. Fields: the link
name (letters, numbers, - and _), the DM with buttons ({{contact.name}}
works here), a tag for the contact, and the hours before the same person
can start it again.

POST /v1/workflows with profileId, accountId, platform, name and:
  nodes: trigger { triggerType: "referral", referral: { ref, matchType:
         "exact" }, cooldownHours } → send_message { messageType: "text",
         text, buttons } → add_tag { tag } → end
  edges linking them in that order
then POST /v1/workflows/{id}/activate unless I saved it paused (a new
workflow is a draft).

On its page show the link https://ig.me/m/<username>?ref=<ref>
(Facebook: https://m.me/<page id>?ref=<ref>) with a Copy button, its QR
code as an inline SVG (the qrcode package), and "Download QR (PNG)".
Read the settings back from the workflow's nodes when editing; edits are a
PATCH /v1/workflows/{id} with the new nodes and edges.
```

## STAGE 5 · Repeat rules and live activity

```
On each automation's page add "Live activity", refreshed every 4 seconds
from Zernio while the page is open:
- comment automations: GET /v1/comment-automations/{id}/logs, one row per
  trigger: when, who (@username), from (comment, DM, story mention), what
  happened in plain words (DM sent · Unlocked after the tap · Waiting for
  the "I'm following" tap · Skipped: <reason> · Failed: <reason>), follows
  you (yes / no / unknown), public reply (posted / failed), clicks;
- below it, "Matched no keyword" from the response's misses;
- workflows: GET /v1/workflows/{id}/executions, one row per run with where
  it is (running, waiting for their reply, finished, ended early, failed).
The repeat rule is repeatPolicy { mode: "once" } or { mode: "every_comment",
cooldownHours }; a second comment from the same person shows as Skipped with
Zernio's reason.
```

## STAGE 6 · Comment → ask first (for people who don't follow yet)

```
Instagram can refuse buttons in the first DM to someone who doesn't follow
the account. Add the "Comment → ask first" template as a workflow:
  trigger { triggerType: "comment", comment: { keywords, matchType,
  platformPostId } } → send_message (plain text, no buttons: it goes out as
  the private reply) → wait_for_reply { timeoutMinutes: 1440 }
  → on "reply": send_message with the buttons → add_tag → end
  → on "timeout": end
Explain the reason in one sentence on the card.
```

## STAGE 7 · The same tab for my AI agent

```
Give my AI agent the same actions as the tab, through this app (never
directly to Zernio, so the key and the workspace rule apply):
1. A JSON API under /api, local only, refusing cross-site browser requests,
   and requiring Authorization: Bearer $PORTAL_AGENT_TOKEN when that is set:
   GET /api/workspaces, GET /api/recipes (every template, its fields and an
   example), GET/POST /api/w/:profileId/automations, GET/PATCH/DELETE
   /api/w/:profileId/automations/:kind/:id (kind = comment | flow),
   POST …/activate and …/pause, GET …/activity (handles and outcomes, never
   what people wrote), GET /api/w/:profileId/posts.
   Use the same code as the tab for every action.
2. An MCP server mcp/automations-mcp.mjs (stdio, JSON-RPC 2.0, no
   dependencies) with the tools list_workspaces, get_recipes,
   list_automations, list_posts, get_automation, create_automation,
   update_automation, set_automation_live, delete_automation, get_activity,
   each calling that API. A .mcp.json in the repo so Claude Code picks it up.
3. A small "Run this tab from your AI agent" card on the tab with the
   config and one example request in plain words.
Test it: start the MCP server, list the tools, create a paused automation
through it, and read it back.
```

## POLISH

Run the polish loop from white-label-blueprint on the new pages (the list, the template picker, each builder, an automation's page with activity), at 1440 and 768, with real data on a test account.
