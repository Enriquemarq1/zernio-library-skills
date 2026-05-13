# Zernio Upload API — Details & Gotchas

Called from `zernio-publish` Step 2. This reference covers presigned URL generation, upload commands, verification, and the mandatory external-storage fallback for files over 50 MB.

---

## Step 1A — Get Presigned URLs

Get presigned URLs for BOTH video and thumbnail:

```bash
# Video presign
curl -s -X POST "https://zernio.com/api/v1/media/presign" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename": "video-name.mp4", "contentType": "video/mp4"}'

# Thumbnail presign (JPEG only — PNGs cause 500 errors)
curl -s -X POST "https://zernio.com/api/v1/media/presign" \
  -H "Authorization: Bearer $ZERNIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename": "thumbnail.jpg", "contentType": "image/jpeg"}'
```

**Field name gotcha:** the REST API uses `filename` / `contentType` (lowercase). Some SDK docs show `fileName` / `fileType` (camelCase), but the REST endpoint REJECTS those with "Missing required fields."

The response contains `uploadUrl` (the presigned PUT target) and `publicUrl` (the URL you reference in the post body after upload).

---

## Step 1B — Upload Files

```bash
# Video upload — MUST use --tls-max 1.2 on macOS
curl -X PUT "$VIDEO_UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  -T "VIDEO_PATH" \
  --tls-max 1.2 \
  -s -o /dev/null -w "HTTP %{http_code}\n"

# Thumbnail upload
curl -X PUT "$THUMB_UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  -T "THUMBNAIL_PATH" \
  --tls-max 1.2 \
  -s -o /dev/null -w "HTTP %{http_code}\n"
```

### Critical upload notes

- **`--tls-max 1.2` is REQUIRED on macOS.** TLS 1.3 causes SSL `bad_record_mac` failures mid-upload.
- **`-T` streams the file; `--data-binary` loads it into memory** and will OOM on files over 500 MB.
- **Always verify with a HEAD request** — HTTP 100 + 404 means silent failure, re-upload needed.
- **Thumbnail MUST be JPEG.** PNGs cause Zernio API 500 errors. Convert first: `ffmpeg -i thumb.png -q:v 2 thumb.jpg`

---

## Step 1C — Verify Uploads (MANDATORY)

```bash
# Must return HTTP 200 — 404 means upload silently failed
curl -s -o /dev/null -w "%{http_code}" -I "$VIDEO_PUBLIC_URL"
curl -s -o /dev/null -w "%{http_code}" -I "$THUMB_PUBLIC_URL"
```

If either returns 404, the upload silently failed — re-upload before proceeding to the POST step.

---

## The Zernio CRC32 bug (files over 50 MB)

**Known bug:** Zernio presigned URLs contain a dummy CRC32 checksum (`x-amz-checksum-crc32=AAAAAA==`, all zeros). The underlying storage validates this mid-stream for files over ~50 MB and kills the connection. **No client-side fix exists.**

**Files over 50 MB MUST go through the external-storage fallback below.** This is the permanent workflow for long-form video until Zernio fixes the bug.

---

## External-storage fallback (files over 50 MB)

### Step 1 — Upload to any public-host storage

The requirement is a publicly-accessible HTTPS URL pointing at the video file. Common options:

**Google Drive (resumable upload):**

```bash
TOKEN="<oauth-token>"
curl -X POST "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "video-name.mp4", "mimeType": "video/mp4"}' \
  -D - 2>/dev/null | grep -i location
# Then PUT the file to the location URL returned in the Location header.
# Once uploaded, set sharing to "Anyone with the link" and grab the share URL.
```

**S3 / Cloudflare R2 / DigitalOcean Spaces / etc.:** Standard `aws s3 cp` or equivalent. Make sure the object is public-readable.

**Dropbox:** Shared link with `?dl=1` for direct download.

### Step 2 — POST to Zernio WITHOUT the video mediaItem

Create the post with all metadata (title, description, tags, timestamps, firstComment, thumbnail) but **omit the video `mediaItem`.** Set visibility to `unlisted`.

### Step 3 — Attach the video in the Zernio dashboard

Open the Zernio dashboard, find the just-created post, attach the video by pasting the public URL from Step 1, then change visibility to `public`.

### Step 4 — Log the workaround

Note in `./posts/YYYY-MM-DD-{slug}.json`:

- The external-storage URL (as `source_external_url`)
- That manual upload was required
- Which step the user needs to complete

---

This is the permanent workflow until Zernio fixes the CRC32 bug — don't treat it as a temporary hack. For short-form video (under 3 minutes, usually under 50 MB) the direct Zernio upload path works fine.
