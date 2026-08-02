# Telemetry Worker — Private Format Data Collection

Deploys a Cloudflare Worker that stores format metadata submissions from the WASM decoder into KV. No public exposure. No email required.

## Deployment

1. Install [Node.js](https://nodejs.org/) (if not already)
2. `npm install -g wrangler`
3. `wrangler login`
4. Create the KV namespace:
   ```bash
   wrangler kv:namespace create FORMAT_TELEMETRY
   ```
   Copy the returned ID into `wrangler.toml`
5. Deploy:
   ```bash
   wrangler deploy
   ```
6. The worker URL will be `https://ithmb-telemetry.YOUR_ACCOUNT.workers.dev`
7. Add `ADMIN_TOKEN` in the Cloudflare dashboard (Workers & Pages → ithmb-telemetry → Settings → Variables) — gates the dashboard below

## API

### POST /

```json
{
  "prefix": 1067,
  "width": 720,
  "height": 480,
  "fileSize": 691200,
  "status": "success",
  "header": null
}
```

### Status values

| status | Meaning |
|--------|---------|
| `success` | File decoded successfully — prefix + dimensions sent |
| `known-failed` | Known prefix but decode failed — 16-byte header sent |
| `unknown` | Unknown prefix — 16-byte header sent |

### Optional fields

| field | Meaning | Cap |
|-------|---------|-----|
| `full_file` | Base64 of the complete file (checkbox "Upload full file") | 11,184,812 chars ≈ 8 MB raw |
| `issue` | One of: `color_space`, `dimensions`, `stride`, `offset`, `byte_order`, `other` | ≤ 40 chars |
| `issue_detail` | Free-text explanation | ≤ 200 chars |
| `extension` | `ipm` or `ithmb` | — |

## Limits (anti-abuse)

- **Request body:** ≤ 13 MB (`MAX_BODY_BYTES`); larger → `413 body too large`
- **Rate limit:** 100 POSTs / day / fingerprint (IP + User-Agent hash)
- **Records:** max 50 stored / day / fingerprint; dedup per `prefix+status` for 24 h
- **Batch:** ≤ 500 entries per POST; client chunks sends to stay ≤ 12 MB body. Entries may carry `full_file` (same 11,184,812-char cap) — the batch record cap (50 / fp / day) applies to stored records
- **Batch endpoint**: no longer used by the client — the single-record path (`POST /`) is the live one.
- **Retention:** records expire after 365 days; rate/dedup counters after 1-2 days
- **Keep `FULL_FILE_MAX_BYTES` in `ithmb-decoder/card-failure-ui.js` in sync**: the client disables full-file upload above 8 MB raw (the app's own decode limit), matching the worker's 11,184,812-char field cap
## Reading Data

```bash
# List all keys
wrangler kv:key list --binding=FORMAT_TELEMETRY

# Get a specific record
wrangler kv:key get --binding=FORMAT_TELEMETRY <key>

# Bulk export
wrangler kv:key list --binding=FORMAT_TELEMETRY > keys.json
```

## Dashboard

The worker serves a read-only admin dashboard at `GET /dashboard`:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://ithmb-telemetry.ithmb-codec.workers.dev/dashboard
```

- **Auth:** the `Authorization: Bearer <ADMIN_TOKEN>` header must match the worker's `ADMIN_TOKEN` env var; without it the request is rejected (401)
- Shows: total submissions, unique prefixes, unknown vs known-failed counts, full-file count, prefix distribution, recent 50 records
- `GET /` (no token) is the public JSON endpoint used by the app's share buttons
