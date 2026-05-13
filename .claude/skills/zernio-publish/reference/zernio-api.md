# Zernio API — Master Reference

**Base URL:** `https://zernio.com/api/v1`
**Auth:** `Authorization: Bearer $ZERNIO_API_KEY`
**Docs:** https://docs.zernio.com/

This is the master index. Each section points at a detail file under `reference/` — don't duplicate their contents here, just summarize and link.

---

## Endpoint overview

| Endpoint | Method | Purpose | Detail reference |
|----------|--------|---------|------------------|
| `/media/presign` | POST | Get signed upload URL for video/thumbnail/image | `reference/zernio-upload.md` |
| `/posts` | POST | Create/schedule a post on one or many platforms | `reference/zernio-post.md` |
| `/posts` | GET | List posts (`?status=published&limit=N`) | below |
| `/posts/{id}` | GET | Get specific post (fields, status, URLs) | below |
| `/posts/{id}` | DELETE | Delete post | — |
| `/posts/{id}/retry` | POST | Retry a failed post | — |
| `/accounts` | GET | List connected accounts per platform | below |
| `/profiles` | GET | List Zernio profiles (pre-POST check) | below |
| `/connect/{platform}` | GET | Get OAuth connection URL | — |
| `/analytics` | GET | Post-level performance metrics | — |
| `/analytics/daily-metrics` | GET | Daily rollup per account | — |
| `/analytics/best-time-to-post` | GET | Optimal send window per account | — |

---

## Authentication

Get an API key from your Zernio dashboard → API Keys. Export it in your environment:

```bash
export ZERNIO_API_KEY="zk_xxx"
```

Every request to the API needs `Authorization: Bearer $ZERNIO_API_KEY`. The skill assumes this is set; if it isn't, Step 1 fails with a clear message.

---

## Account model

Every post needs an `accountId` per platform you're publishing to. Resolve them at runtime — no local config needed:

```bash
curl -s "https://zernio.com/api/v1/accounts" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```

Response shape (abbreviated):

```json
[
  { "id": "acc_abc", "platform": "youtube",   "username": "@handle" },
  { "id": "acc_def", "platform": "instagram", "username": "@handle" },
  { "id": "acc_ghi", "platform": "linkedin",  "username": "handle" }
]
```

Map `platform` → `id` for every platform named in your manifest. If a platform isn't in the response, it isn't connected — connect it in the Zernio dashboard first.

---

## Media upload flow

See `reference/zernio-upload.md` for the full flow: presign (video + thumbnail), PUT upload with `--tls-max 1.2`, HEAD verification, the CRC32 bug, and the mandatory external-storage fallback for files over 50 MB.

---

## Create post flow

See `reference/zernio-post.md` for the full POST body, field placement rules, the 10 critical mistakes to avoid, per-platform `platformSpecificData` shapes, scheduling rules, and YouTube-specific fields (category IDs, Shorts length routing).

---

## Per-platform capabilities

See `reference/platforms.md` for the full capability matrix (video / image / carousel / text-only, thumbnail support, first-comment support, scheduled publish, caption limits) and per-platform media specs (aspect ratios, max duration).

---

## Posting principles

See `reference/principles.md` for pre-post checklist, the approval gate, verification protocol, and anti-patterns (`publishNow: true` for multi-platform, copy-paste captions, skipping tag validation, etc.).

---

## CLI (optional, prefer raw API)

If the `zernio` CLI is installed:

```bash
zernio media:upload <file>
zernio posts:create --text "..." --accounts "id1,id2" --scheduledAt "ISO8601"
zernio posts:list
zernio posts:get <id>
zernio posts:delete <id>
zernio posts:retry <id>
zernio analytics:posts
zernio accounts:list
```

This skill defaults to the raw REST API — the CLI changes faster than the REST endpoints and has its own quirks. Use the CLI only if you specifically prefer it.

---

## Listing / querying posts

```bash
# Recent published posts
curl -s "https://zernio.com/api/v1/posts?status=published&limit=10" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"

# Specific post by ID
curl -s "https://zernio.com/api/v1/posts/{postId}" \
  -H "Authorization: Bearer $ZERNIO_API_KEY"
```

The skill uses `GET /posts/{postId}` at Step 6 to verify a post landed.

---

## Canonical spec

`reference/zernio-openapi.yaml` is the version-controlled OpenAPI spec (17K lines). It's the source of truth for every field name, type, and platform schema. The markdown files in this folder are friendly guides; when in doubt, grep the YAML.
