// Cloudflare Worker — Private format metadata collector with spam protection
// Deploy: `npx wrangler deploy`
// KV: FORMAT_TELEMETRY (stores submitted records + rate limit counters)

// 13 MB body cap: allows a full 8 MiB file (base64 ~10.67 MB) plus JSON
// wrapper. Free-plan CPU: JSON.parse of the largest body is ~5 ms (< 10 ms limit).
const MAX_BODY_BYTES = 13 * 1024 * 1024;
const MAX_RECORDS_PER_FP_PER_DAY = 50;
const RATE_LIMIT_PER_DAY = 100;
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

// Simple fingerprint from IP + User-Agent hash (no raw IP stored)
async function fingerprint(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";
  const data = `${ip}:${ua}`;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  const hash = Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash;
}

function buildDashboardHtml({
  total,
  uniquePrefixes,
  unknownFailed,
  fullFileCount,
  prefixEntries,
  recent50,
}) {
  const prefixRows = prefixEntries
    .map(
      ([prefix, count]) =>
        `<tr><td>${prefix}</td><td>${count}</td></tr>`,
    )
    .join("");

  const recentRows = recent50
    .map((r) => {
      const status = r.status || "unknown";
      const cls = status;
      const dims =
        r.width && r.height
          ? `${r.width} \u00d7 ${r.height}`
          : "\u2014";
      const fileSize =
        r.fileSize != null ? `${r.fileSize}` : "\u2014";
      const header = r.header
        ? r.header.length > 32
          ? r.header.slice(0, 32) + "..."
          : r.header
        : "\u2014";
      const fullFile = r.fullFile ? "Yes" : "No";
      const time = r.timestamp
        ? new Date(r.timestamp).toLocaleString()
        : "\u2014";
      const highlight =
        status === "unknown" || status === "known-failed"
          ? ' class="warn-row"'
          : "";
      return `<tr${highlight}><td>${time}</td><td>${
        r.prefix ?? "\u2014"
      }</td><td><span class="badge badge-${cls}">${status}</span></td><td>${dims}</td><td>${fileSize}</td><td>${header}</td><td>${fullFile}</td></tr>`;
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
<thead><tr><th>Time</th><th>Prefix</th><th>Status</th><th>Dimensions</th><th>File Size</th><th>Header</th><th>Full File</th></tr></thead>
<tbody>${recentRows}</tbody>
</table>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    // CORS: echo the request origin back when it matches the allowlist
    // (production domain + any localhost/127.0.0.1 dev origin, any port).
    // Non-allowed origins get the production domain, so browsers block them
    // (anti-abuse: random sites can't POST from browsers; curl/server code
    // is unaffected by CORS anyway).
    const requestOrigin = request.headers.get("Origin");
    const isAllowedOrigin =
      requestOrigin === "https://ithmb-codec.dev" ||
      (requestOrigin &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin));
    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowedOrigin
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
      // Dashboard auth: Authorization: Bearer <ADMIN_TOKEN> header OR
      // ?token=<ADMIN_TOKEN> query param (both accepted; query makes it
      // easy to open in a plain browser tab).
      const authHeader = request.headers.get("Authorization") || "";
      const queryToken = url.searchParams.get("token");
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : queryToken;
      if (token === env.ADMIN_TOKEN) {
        // ---- HTML dashboard ----
        const allRecords = [];
        let cursor;
        do {
          const list = await env.FORMAT_TELEMETRY.list({
            prefix: "fmt_",
            cursor,
            limit: 1000,
          });
          for (const key of list.keys) {
            const value = await env.FORMAT_TELEMETRY.get(key.name);
            if (value) {
              try {
                const record = JSON.parse(value);
                allRecords.push(record);
              } catch (e) {}
            }
          }
          cursor = list.cursor;
        } while (cursor);

        // Compute stats
        const total = allRecords.length;
        const prefixCounts = {};
        const statuses = {};
        let fullFileCount = 0;
        for (const r of allRecords) {
          const p = r.prefix;
          prefixCounts[p] = (prefixCounts[p] || 0) + 1;
          const s = r.status || "unknown";
          statuses[s] = (statuses[s] || 0) + 1;
          if (r.fullFile) fullFileCount++;
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
          .filter((r) => r.timestamp)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
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

      // CLI data dashboard — prefix counts
      // Usage: curl https://ithmb-telemetry.ithmb-codec.workers.dev
      const prefixCounts = {};
      let cursor;
      do {
        const list = await env.FORMAT_TELEMETRY.list({
          prefix: "fmt_",
          cursor,
          limit: 1000,
        });
        for (const key of list.keys) {
          const value = await env.FORMAT_TELEMETRY.get(key.name);
          if (value) {
            try {
              const record = JSON.parse(value);
              const p = record.prefix;
              prefixCounts[p] = (prefixCounts[p] || 0) + 1;
            } catch (e) {}
          }
        }
        cursor = list.cursor;
      } while (cursor);
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
      if (bodyText.length > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: "body too large" }), {
          status: 413,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const body = JSON.parse(bodyText);
      const fp = await fingerprint(request);
      const today = new Date().toISOString().slice(0, 10);
      const rateKey = `ratelimit:${fp}:${today}`;

      // ---- Rate limit check ----
      const count = parseInt(
        (await env.FORMAT_TELEMETRY.get(rateKey)) || "0",
        10,
      );
      if (count >= RATE_LIMIT_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "rate limited" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // ---- Batch submission (Send All) ----
      if (body.batch === true && Array.isArray(body.entries)) {
        if (body.entries.length > 500) {
          return new Response(JSON.stringify({ error: "too many entries" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        // Batch can store up to 500 records per POST — enforce the same
        // per-fp/day record cap as the single path (full files ride along).
        const batchRecordCountKey = `records:${fp}:${today}`;
        let storedCount = parseInt(
          (await env.FORMAT_TELEMETRY.get(batchRecordCountKey)) || "0",
          10,
        );
        let stored = 0;
        for (const entry of body.entries) {
          const ePrefix = entry.prefix;
          if (typeof ePrefix !== "number" || ePrefix < 0 || ePrefix > 99999)
            continue;
          const eStatus = VALID_STATUSES.has(entry.status)
            ? entry.status
            : "success";
          const eDedupKey = `dedup:${fp}:${ePrefix}:${eStatus}`;
          const eExisting = await env.FORMAT_TELEMETRY.get(eDedupKey);
          if (eExisting) continue;
          if (storedCount >= MAX_RECORDS_PER_FP_PER_DAY) continue;
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
              typeof entry.header === "string" && entry.header.length <= 200
                ? entry.header
                : null,
            fullFile:
              entry.full_file.length <= FULL_FILE_B64_MAX
                ? entry.full_file
                : null,
            fp,
            timestamp: new Date().toISOString(),
          };
          await env.FORMAT_TELEMETRY.put(
            `fmt_${ePrefix}_${Date.now()}_${stored}`,
            JSON.stringify(eRecord),
            { expirationTtl: 86400 * 365 },
          );
          await env.FORMAT_TELEMETRY.put(eDedupKey, "1", {
            expirationTtl: 86400,
          });
          stored++;
          storedCount++;
        }
        if (stored > 0) {
          await env.FORMAT_TELEMETRY.put(
            batchRecordCountKey,
            String(storedCount),
            { expirationTtl: 86400 * 2 },
          );
        }
        await env.FORMAT_TELEMETRY.put(rateKey, String(count + 1), {
          expirationTtl: 86400 * 2,
        });
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

      const status = VALID_STATUSES.has(body.status) ? body.status : "success";
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
      const fileSize =
        typeof body.fileSize === "number" && body.fileSize > 0
          ? body.fileSize
          : null;
      const width =
        typeof body.width === "number" && body.width > 0 ? body.width : null;
      const height =
        typeof body.height === "number" && body.height > 0 ? body.height : null;
      const header =
        typeof body.header === "string" && body.header.length <= 200
          ? body.header
          : null;
      const fullFile =
        typeof body.full_file === "string" && body.full_file.length <= FULL_FILE_B64_MAX
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

      // ---- Record count cap (per fingerprint per day) ----
      const recordCountKey = `records:${fp}:${today}`;
      const storedCount = parseInt(
        (await env.FORMAT_TELEMETRY.get(recordCountKey)) || "0",
        10,
      );
      if (storedCount >= MAX_RECORDS_PER_FP_PER_DAY) {
        return new Response(
          JSON.stringify({ ok: false, error: "too many records" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      // ---- Store ----
      const record = {
        prefix,
        width,
        height,
        status,
        issue,
        issueDetail,
        header,
        fullFile,
        extension,
        fp,
        timestamp: new Date().toISOString(),
      };
      const key = `fmt_${prefix}_${Date.now()}`;
      await env.FORMAT_TELEMETRY.put(key, JSON.stringify(record), {
        expirationTtl: 86400 * 365,
      });
      await env.FORMAT_TELEMETRY.put(recordCountKey, String(storedCount + 1), {
        expirationTtl: 86400 * 2,
      });

      // ---- Update rate limit counter ----
      await env.FORMAT_TELEMETRY.put(rateKey, String(count + 1), {
        expirationTtl: 86400 * 2,
      });

      // ---- Set dedup marker (24h TTL) ----
      await env.FORMAT_TELEMETRY.put(dedupKey, "1", { expirationTtl: 86400 });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
