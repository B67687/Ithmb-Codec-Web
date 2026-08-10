// Cloudflare Worker — Private format metadata collector with spam protection
// Deploy: `npx wrangler deploy`
// KV: FORMAT_TELEMETRY (stores submitted records + rate limit counters)

// Worker bindings. `FORMAT_TELEMETRY` is the KV namespace; `ADMIN_TOKEN`
// gates the dashboard; `IP_HMAC_SECRET` (optional) keys the IP pseudonym —
// without it the code falls back to ADMIN_TOKEN as the HMAC key.
interface Env {
  FORMAT_TELEMETRY: KVNamespace;
  ADMIN_TOKEN: string;
  IP_HMAC_SECRET?: string;
}

// Shape of a stored record (all fields optional: legacy records predate
// per-field validation, and batch records omit status/issue/extension).
interface StoredRecord {
  prefix?: number;
  width?: number | null;
  height?: number | null;
  fileSize?: number;
  header?: string;
  status?: string;
  issue?: string;
  issueDetail?: string;
  extension?: string;
  hasFullFile?: boolean;
  fullFile?: boolean;
  fp?: string;
  timestamp?: string;
}

// Shape of a POST body. All fields optional — the worker validates each one
// defensively before it is stored (single-record and batch paths).
interface TelemetryEntry {
  prefix?: number;
  status?: string;
  full_file?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  header?: string;
  issue?: string;
  issue_detail?: string;
  extension?: string;
}

interface TelemetryBatch {
  batch: boolean;
  entries: TelemetryEntry[];
}

type TelemetryBody = TelemetryEntry & Partial<TelemetryBatch>;

// 13 MB body cap: allows a full 8 MiB file (base64 ~10.67 MB) plus JSON
// wrapper. Free-plan CPU: JSON.parse of the largest body is ~5 ms (< 10 ms limit).
const MAX_BODY_BYTES = 13 * 1024 * 1024;
const MAX_RECORDS_PER_FP_PER_DAY = 50;
const RATE_LIMIT_PER_DAY = 100;
const MAX_RECORDS_PER_IP_PER_DAY = 250;
const RATE_LIMIT_PER_IP_PER_DAY = 500;
// base64 length of an 8 MiB file — mirrors client FULL_FILE_MAX_BYTES (app's
// own decode limit; files larger than 8 MB are rejected by the client anyway).
const FULL_FILE_B64_MAX = Math.ceil((8 * 1024 * 1024) / 3) * 4;
const VALID_STATUSES = new Set([
  "success",
  "known-failed",
  "unknown",
  "looks-good",
  "looks-wrong",
]);
const KNOWN_ISSUES = new Set([
  "color_space",
  "dimensions",
  "stride",
  "offset",
  "byte_order",
  "other",
]);

// Keyed pseudonym (HMAC-SHA256) for IP-derived identifiers. A plain SHA-256
// truncation is NOT a privacy pseudonym for IPv4: 2^32 space is trivially
// brute-forceable offline, so anyone with KV read access could recover every
// submitter's raw IP from the per-IP key names (CWE-359). Keying the hash
// with a server secret (IP_HMAC_SECRET, falling back to ADMIN_TOKEN) makes it
// cryptographically irreversible without the secret — a KV dump/backup/leak
// reveals nothing. 128-bit truncation also makes cross-IP collisions
// negligible (the old 64-bit truncation had ~40% collision over the full
// IPv4 space, contaminating rate-limit keys).
async function keyedPseudonym(env: Env, data: string): Promise<string> {
  const secret = env.IP_HMAC_SECRET || env.ADMIN_TOKEN || "unset";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(sig))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple fingerprint from IP + User-Agent hash. Keyed (see keyedPseudonym):
// the fingerprint in stored records must not be reversible to the raw IP.
async function fingerprint(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";
  return keyedPseudonym(env, `${ip}:${ua}`);
}

// Privacy (CWE-359): per-IP counter keys pseudonymize the IP alone (UA
// excluded so the counter is stable per IP) — the raw IP is never written to
// KV key names, and the keyed hash cannot be reversed offline. The old
// `records-ip:<ip>:<date>` / `ratelimit-ip:<ip>:<date>` keys stored every
// submitter's raw IP in operator-accessible KV for 48h.
function ipFingerprint(env: Env, ip: string): Promise<string> {
  return keyedPseudonym(env, `ip:${ip}`);
}

// Race-free counter: count keys under a day-scoped prefix. KV has no atomic
// increment, so read-then-write counters drift under concurrency — lost
// updates made the old cap/rate counters permanently bypassable (CWE-362).
// Counting actual per-request/per-record keys self-corrects: the count is
// always derived from what is actually stored.
async function countKeys(env: Env, prefix: string, max: number): Promise<number> {
  let count = 0;
  let cursor: string | null | undefined;
  do {
    const res = await env.FORMAT_TELEMETRY.list({
      prefix,
      cursor,
      limit: 1000,
    });
    count += res.keys.length;
    if (count >= max) return count;
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return count;
}

// Validate a full_file base64 payload: correct alphabet, correct padding,
// and a decoded size within the 8 MiB app limit. A length-only check let
// arbitrary garbage be persisted (CWE-20) and fed storage-abuse.
function validBase64Payload(s: string): boolean {
  if (s.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return false;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  const decoded = (s.length / 4) * 3 - pad;
  return decoded <= 8 * 1024 * 1024;
}

// Constant-time token comparison (CWE-208): hash both sides to a fixed 32
// bytes first so an early length mismatch cannot leak via timing, then
// XOR-compare every byte.
async function tokensEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(a)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(b)),
  ]);
  const av = new Uint8Array(ha);
  const bv = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

// Escape every value that will be interpolated into dashboard HTML. The
// public POST endpoint accepts arbitrary header / issue_detail text, so any
// unescaped record field is a stored-XSS primitive against the admin
// dashboard (a crafted submission could read the ?token= URL). This is a
// worker, not a browser — plain string replacement, no DOM.
function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function buildDashboardHtml({
  total,
  uniquePrefixes,
  unknownFailed,
  fullFileCount,
  prefixEntries,
  recent50,
}: {
  total: number;
  uniquePrefixes: number;
  unknownFailed: number;
  fullFileCount: number;
  prefixEntries: [string, number][];
  recent50: StoredRecord[];
}): string {
  // ALL interpolated record fields are attacker-controlled (public POST,
  // only length/shape-checked). Escape every one — defense in depth even
  // for fields that are validated on ingest (legacy records may predate it).
  const esc = escapeHtml;

  const prefixRows = prefixEntries
    .map(
      ([prefix, count]) =>
        `<tr><td>${esc(prefix)}</td><td>${esc(count)}</td></tr>`,
    )
    .join("");

  const recentRows = recent50
    .map((r) => {
      const status = r.status || "unknown";
      const cls = status;
      const dims =
        r.width && r.height
          ? `${esc(r.width)} \u00d7 ${esc(r.height)}`
          : "\u2014";
      const fileSize =
        r.fileSize != null ? `${esc(r.fileSize)}` : "\u2014";
      const header = r.header
        ? r.header.length > 32
          ? esc(r.header.slice(0, 32)) + "..."
          : esc(r.header)
        : "\u2014";
      const fullFile = r.fullFile || r.hasFullFile ? "Yes" : "No";
      const time = r.timestamp
        ? esc(new Date(r.timestamp).toLocaleString())
        : "\u2014";
      const highlight =
        status === "unknown" || status === "known-failed"
          ? ' class="warn-row"'
          : "";
      const issueCell = r.issue
        ? `<span class="badge badge-${esc(r.issue)}">${esc(r.issue)}</span>`
        : "\u2014";
      const issueDetailCell = r.issueDetail
        ? r.issueDetail.length > 40
          ? esc(r.issueDetail.slice(0, 40)) + "..."
          : esc(r.issueDetail)
        : "\u2014";
      const extCell = r.extension ? esc(r.extension) : "\u2014";
      return `<tr${highlight}><td>${time}</td><td>${
        r.prefix != null ? esc(r.prefix) : "\u2014"
      }</td><td><span class="badge badge-${esc(cls)}">${esc(status)}</span></td><td>${dims}</td><td>${fileSize}</td><td>${header}</td><td>${fullFile}</td><td>${issueCell}</td><td>${issueDetailCell}</td><td>${extCell}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Format Telemetry Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f7;color:#1d1d1f;padding:40px 20px}
h1{font-size:28px;font-weight:600;margin-bottom:8px}
.subtitle{color:#6e6e73;margin-bottom:32px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:40px}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h3{font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;color:#6e6e73;margin-bottom:8px}
.card .value{font-size:32px;font-weight:700}
h2{font-size:20px;font-weight:600;margin:32px 0 12px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
th{background:#f5f5f7;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6e6e73;padding:12px 16px;text-align:left;border-bottom:1px solid #e8e8ed}
td{padding:10px 16px;border-bottom:1px solid #e8e8ed;font-size:14px}
tr:last-child td{border-bottom:none}
tr.warn-row{background:#fffde7}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:500}
.badge-success,.badge-looks-good{background:#e8f5e9;color:#2e7d32}
.badge-unknown,.badge-looks-wrong{background:#fff3e0;color:#e65100}
.badge-known-failed{background:#ffebee;color:#c62828}
</style>
</head>
<body>
<h1>Format Telemetry Dashboard</h1>
<p class="subtitle">Submission overview and recent activity</p>
<div class="stats">
<div class="card"><h3>Total Submissions</h3><div class="value">${total}</div></div>
<div class="card"><h3>Unique Prefixes</h3><div class="value">${uniquePrefixes}</div></div>
<div class="card"><h3>Unknown / Failed</h3><div class="value">${unknownFailed}</div></div>
<div class="card"><h3>Full File Uploads</h3><div class="value">${fullFileCount}</div></div>
</div>
<h2>Prefix Distribution</h2>
<table>
<thead><tr><th>Prefix</th><th>Count</th></tr></thead>
<tbody>${prefixRows}</tbody>
</table>
<h2>Recent Submissions (50)</h2>
<table>
<thead><tr><th>Time</th><th>Prefix</th><th>Status</th><th>Dimensions</th><th>File Size</th><th>Header</th><th>Full File</th><th>Issue</th><th>Issue Detail</th><th>Ext</th></tr></thead>
<tbody>${recentRows}</tbody>
</table>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS: echo the request origin back when it matches the allowlist
    // (production domain + any localhost/127.0.0.1 dev origin, any port).
    // Non-allowed origins get the production domain, so browsers block them
    // (anti-abuse: random sites can't POST from browsers; curl/server code
    // is unaffected by CORS anyway).
    const requestOrigin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin":
        requestOrigin === "https://ithmb-codec.dev" ||
        (requestOrigin &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin))
          ? requestOrigin
          : "https://ithmb-codec.dev",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method === "GET") {
      const url = new URL(request.url);
      // Dashboard auth: Authorization: Bearer <ADMIN_TOKEN> ONLY. The legacy
      // ?token=<ADMIN_TOKEN> query path is gone — a bearer credential must
      // never ride in URLs (browser history, access logs, Referer) (CWE-200).
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";
      if (token && (await tokensEqual(token, env.ADMIN_TOKEN))) {
        // ---- HTML dashboard ----
        const allRecords: StoredRecord[] = [];
        let cursor: string | null | undefined;
        let scanned = 0;
        // Bounded scan: at most 5000 records. Records are slim (full-file
        // payloads live under their own `fullfile_` key), so this is bounded
        // memory/CPU work no matter how large the store grows (CWE-400).
        const MAX_SCAN = 5000;
        do {
          const list = await env.FORMAT_TELEMETRY.list({
            prefix: "fmt_",
            cursor,
            limit: 1000,
          });
          for (const key of list.keys) {
            if (scanned >= MAX_SCAN) break;
            const value = await env.FORMAT_TELEMETRY.get(key.name);
            if (value) {
              try {
                const record = JSON.parse(value) as StoredRecord;
                allRecords.push(record);
              } catch {}
            }
            scanned++;
          }
          cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor && scanned < MAX_SCAN);

        // Compute stats
        const total = allRecords.length;
        const prefixCounts: Record<string, number> = {};
        const statuses: Record<string, number> = {};
        let fullFileCount = 0;
        for (const r of allRecords) {
          const p = String(r.prefix);
          prefixCounts[p] = (prefixCounts[p] || 0) + 1;
          const s = r.status || "unknown";
          statuses[s] = (statuses[s] || 0) + 1;
          if (r.fullFile || r.hasFullFile) fullFileCount++;
        }
        const uniquePrefixes = Object.keys(prefixCounts).length;
        const unknownFailed =
          (statuses["unknown"] || 0) + (statuses["known-failed"] || 0);

        // Sort prefix counts descending
        const prefixEntries = Object.entries(prefixCounts).sort(
          (a, b) => b[1] - a[1],
        );

        // Recent 50 sorted by timestamp descending
        const recent50 = allRecords
          .filter(
            (r): r is StoredRecord & { timestamp: string } =>
              Boolean(r.timestamp),
          )
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
          .slice(0, 50);

        const html = buildDashboardHtml({
          total,
          uniquePrefixes,
          unknownFailed,
          fullFileCount,
          prefixEntries,
          recent50,
        });

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            // Defense-in-depth for the stored-XSS fix: even if an unescaped
            // field ever slips through, no script can run and the admin
            // page cannot be framed (token exfiltration / clickjacking).
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
            // The token arrives via an Authorization header; these stop it
            // leaking through the browser cache or a Referer (CWE-200).
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            ...corsHeaders,
          },
        });
      }

      // /dashboard requires the admin token — never falls through to public JSON
      if (url.pathname === "/dashboard") {
        return new Response(
          JSON.stringify({ ok: false, error: "unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // CLI data dashboard — prefix counts derived from KEY NAMES ONLY (zero
      // value fetches). The prefix is the leading number of `fmt_<prefix>_<id>`
      // keys, so counting is metadata-only — the old code fetched and parsed
      // every record value (incl. multi-MB full_file payloads) just to tally
      // prefixes, making this unauthenticated endpoint a storage-egress/CPU
      // amplifier for anyone (CWE-400).
      // Usage: curl https://ithmb-telemetry.ithmb-codec.workers.dev
      const prefixCounts: Record<string, number> = {};
      let cursor: string | null | undefined;
      let scanned = 0;
      // Bounded scan, same as the dashboard: this unauthenticated endpoint
      // must not paginate the whole namespace as the store grows (CWE-400).
      // Counts reflect the first MAX_SCAN records.
      const MAX_SCAN = 5000;
      do {
        const list = await env.FORMAT_TELEMETRY.list({
          prefix: "fmt_",
          cursor,
          limit: 1000,
        });
        for (const key of list.keys) {
          if (scanned >= MAX_SCAN) break;
          const m = /^fmt_(\d+)_/.exec(key.name);
          if (m) {
            const p = m[1];
            prefixCounts[p] = (prefixCounts[p] || 0) + 1;
          }
          scanned++;
        }
        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor && scanned < MAX_SCAN);
      return new Response(
        JSON.stringify(
          {
            ok: true,
            prefixCounts,
            total: Object.values(prefixCounts).reduce((a, b) => a + b, 0),
          },
          null,
          2,
        ),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.startsWith("application/json")) {
        return new Response(
          JSON.stringify({ error: "expected application/json" }),
          {
            status: 415,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      const bodyText = await request.text();
      // Byte-accurate cap: bodyText.length counts UTF-16 units, so a
      // multi-byte (e.g. CJK) body could slip ~3× the intended limit past
      // JSON.parse (CWE-770). Measure true UTF-8 bytes instead.
      if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: "body too large" }), {
          status: 413,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const body = JSON.parse(bodyText) as TelemetryBody;
      const fp = await fingerprint(request, env);
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      // Per-IP keys use a hash of the IP alone — the raw IP is never stored.
      const ipHash = await ipFingerprint(env, ip);
      const today = new Date().toISOString().slice(0, 10);
      // Day-scoped marker prefixes, counted not incremented (race-free caps).
      const ratePrefix = `rate:${fp}:${today}:`;
      const ipRatePrefix = `rate-ip:${ipHash}:${today}:`;
      const recordPrefix = `records:${fp}:${today}:`;
      const ipRecordPrefix = `records-ip:${ipHash}:${today}:`;

      // ---- Rate limit check (per fp + per IP) — race-free list counts ----
      const [rateCount, ipRateCount] = await Promise.all([
        countKeys(env, ratePrefix, RATE_LIMIT_PER_DAY),
        countKeys(env, ipRatePrefix, RATE_LIMIT_PER_IP_PER_DAY),
      ]);
      if (rateCount >= RATE_LIMIT_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "rate limited" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
      if (ipRateCount >= RATE_LIMIT_PER_IP_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "rate limited" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
      // Rate markers are written for EVERY request that passes the rate
      // check — before dedup/validation early-returns — so an attacker can't
      // replay dedup'd or invalid POSTs forever without consuming the
      // 100/500-per-day budget (each such request still costs body read +
      // KV list scans + fingerprint).
      const rateUuid = crypto.randomUUID();
      await env.FORMAT_TELEMETRY.put(`${ratePrefix}${rateUuid}`, "1", {
        expirationTtl: 86400 * 2,
      });
      await env.FORMAT_TELEMETRY.put(`${ipRatePrefix}${rateUuid}`, "1", {
        expirationTtl: 86400 * 2,
      });
      // ---- Batch submission (Send All) ----
      if (body.batch === true && Array.isArray(body.entries)) {
        if (body.entries.length > 500) {
          return new Response(JSON.stringify({ error: "too many entries" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        // Enforce the per-fp/day + per-ip/day record caps for the whole batch
        // from list counts (race-free; KV has no atomic counters).
        const [baseStored, baseIpStored] = await Promise.all([
          countKeys(env, recordPrefix, MAX_RECORDS_PER_FP_PER_DAY),
          countKeys(env, ipRecordPrefix, MAX_RECORDS_PER_IP_PER_DAY),
        ]);
        let storedCount = baseStored;
        let ipStoredCount = baseIpStored;
        let stored = 0;
        for (const entry of body.entries) {
          const ePrefix = entry.prefix;
          if (typeof ePrefix !== "number" || ePrefix < 0 || ePrefix > 99999)
            continue;
          const eStatus = VALID_STATUSES.has(entry.status ?? "")
            ? entry.status
            : "success";
          const eDedupKey = `dedup:${fp}:${ePrefix}:${eStatus}:${entry.full_file ? "f" : "h"}`;
          const eExisting = await env.FORMAT_TELEMETRY.get(eDedupKey);
          if (eExisting) continue;
          if (storedCount >= MAX_RECORDS_PER_FP_PER_DAY) continue;
          if (ipStoredCount >= MAX_RECORDS_PER_IP_PER_DAY) continue;
          const eFullFile =
            typeof entry.full_file === "string" &&
            eStatus !== "success" &&
            entry.full_file.length <= FULL_FILE_B64_MAX &&
            validBase64Payload(entry.full_file)
              ? entry.full_file
              : null;
          const uuid = crypto.randomUUID();
          const eRecord = {
            prefix: ePrefix,
            width:
              typeof entry.width === "number" && entry.width > 0
                ? entry.width
                : null,
            height:
              typeof entry.height === "number" && entry.height > 0
                ? entry.height
                : null,
            fileSize:
              typeof entry.fileSize === "number" && entry.fileSize > 0
                ? entry.fileSize
                : null,
            header:
              typeof entry.header === "string" &&
              entry.header.length <= 200 &&
              /^[0-9a-fA-F]+$/.test(entry.header)
                ? entry.header
                : null,
            hasFullFile: eFullFile !== null,
            fp,
            timestamp: new Date().toISOString(),
          };
          await env.FORMAT_TELEMETRY.put(
            `fmt_${ePrefix}_${uuid}`,
            JSON.stringify(eRecord),
            { expirationTtl: 86400 * 365 },
          );
          if (eFullFile !== null) {
            await env.FORMAT_TELEMETRY.put(`fullfile_${uuid}`, eFullFile, {
              expirationTtl: 86400 * 365,
            });
          }
          await env.FORMAT_TELEMETRY.put(eDedupKey, "1", {
            expirationTtl: 86400,
          });
          // Per-record cap markers (day-scoped, 2-day TTL).
          await env.FORMAT_TELEMETRY.put(`${recordPrefix}${uuid}`, "1", {
            expirationTtl: 86400 * 2,
          });
          await env.FORMAT_TELEMETRY.put(`${ipRecordPrefix}${uuid}`, "1", {
            expirationTtl: 86400 * 2,
          });
          stored++;
          storedCount++;
          ipStoredCount++;
        }
        return new Response(JSON.stringify({ ok: true, stored }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ---- Validate ----
      const prefix = body.prefix;
      if (typeof prefix !== "number" || prefix < 0 || prefix > 99999) {
        return new Response(JSON.stringify({ error: "invalid prefix" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const status = VALID_STATUSES.has(body.status ?? "")
        ? body.status
        : "success";
      const issue =
        typeof body.issue === "string" &&
        body.issue.length <= 40 &&
        KNOWN_ISSUES.has(body.issue)
          ? body.issue
          : null;
      const issueDetail =
        typeof body.issue_detail === "string" && body.issue_detail.length <= 200
          ? body.issue_detail
          : null;
      const width =
        typeof body.width === "number" && body.width > 0 ? body.width : null;
      const height =
        typeof body.height === "number" && body.height > 0 ? body.height : null;
      // Header must be a hex signature (client sends bytesToHex(bytes, "")).
      // Non-hex values are rejected (stored as null) so a "<script>" payload
      // can never be persisted and later interpolated into the dashboard.
      const header =
        typeof body.header === "string" &&
        body.header.length <= 200 &&
        /^[0-9a-fA-F]+$/.test(body.header)
          ? body.header
          : null;
      const fullFile =
        typeof body.full_file === "string" &&
        body.full_file.length <= FULL_FILE_B64_MAX &&
        status !== "success" &&
        // non-success: known-failed (decoder bug) OR unknown (potential new
        // format) — the full file is where the research value is
        validBase64Payload(body.full_file)
          ? body.full_file
          : null;
      const extension =
        body.extension === "ipm" || body.extension === "ithmb"
          ? body.extension
          : null;

      // ---- Deduplication ----
      // Key includes whether a full file was attached so a header share can
      // be "upgraded" to a full-file share within the same 24h window.
      const dedupKey = `dedup:${fp}:${prefix}:${status}:${body.full_file ? "f" : "h"}`;
      const existing = await env.FORMAT_TELEMETRY.get(dedupKey);
      if (existing) {
        // Duplicate within 24h — silently accept but don't store
        return new Response(JSON.stringify({ ok: true, dedup: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ---- Record count cap (per fp + per IP per day) — list-based ----
      // KV has no atomic counters; read-then-write counters drifted under
      // concurrency (lost updates made the caps permanently bypassable).
      // Counting actual per-record keys self-corrects (CWE-362).
      const [storedCount, ipStoredCount] = await Promise.all([
        countKeys(env, recordPrefix, MAX_RECORDS_PER_FP_PER_DAY),
        countKeys(env, ipRecordPrefix, MAX_RECORDS_PER_IP_PER_DAY),
      ]);
      if (storedCount >= MAX_RECORDS_PER_FP_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "too many records" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }
      if (ipStoredCount >= MAX_RECORDS_PER_IP_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "too many records" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // ---- Store ----
      // Records are slim: the full-file payload (up to ~11 MB base64) lives
      // under its own `fullfile_<uuid>` key so dashboard/JSON renders never
      // pull multi-MB values (CWE-400). hasFullFile tracks presence.
      const uuid = crypto.randomUUID();
      const record = {
        prefix,
        width,
        height,
        status,
        issue,
        issueDetail,
        header,
        hasFullFile: fullFile !== null,
        extension,
        fp,
        timestamp: new Date().toISOString(),
      };
      const key = `fmt_${prefix}_${uuid}`;
      await env.FORMAT_TELEMETRY.put(key, JSON.stringify(record), {
        expirationTtl: 86400 * 365,
      });
      if (fullFile !== null) {
        await env.FORMAT_TELEMETRY.put(`fullfile_${uuid}`, fullFile, {
          expirationTtl: 86400 * 365,
        });
      }
      // Per-record cap markers (day-scoped, 2-day TTL).
      await env.FORMAT_TELEMETRY.put(`${recordPrefix}${uuid}`, "1", {
        expirationTtl: 86400 * 2,
      });
      await env.FORMAT_TELEMETRY.put(`${ipRecordPrefix}${uuid}`, "1", {
        expirationTtl: 86400 * 2,
      });
      // (Rate markers are written for every accepted request at the top of
      // the POST handler — before dedup/validation — so no path can replay
      // without consuming the per-day budget.)

      // ---- Set dedup marker (24h TTL) ----

      // ---- Set dedup marker (24h TTL) ----
      await env.FORMAT_TELEMETRY.put(dedupKey, "1", { expirationTtl: 86400 });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch {
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
