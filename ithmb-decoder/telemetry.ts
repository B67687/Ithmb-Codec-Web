import { TELEMETRY_URL } from "./state.js";

// The worker round-trip can HANG on a flaky connection (never settles).
// Without a timeout the optimistic UI would show "Shared ✓" forever even
// though the send never completed — an honest failure must eventually roll
// back. AbortController races the fetch; on timeout it rejects and
// submitTelemetry returns false (callers roll back + toast the failure).
// Timeout is payload-aware: see submitTelemetry.
const BASE_TIMEOUT_MS = 8000;
const PER_MB_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;

export interface TelemetryPayload {
  prefix: number;
  fileSize: number;
  status: string;
  header: string;
  full_file?: string;
  issue?: string;
  issue_detail?: string | null;
}

export async function submitTelemetry(data: TelemetryPayload): Promise<boolean> {
  const body = JSON.stringify(data);
  const bodyBytes = new TextEncoder().encode(body).byteLength;
  // The old fixed 8s budget was payload-blind: an 8 MB full-file upload over
  // a slow connection always timed out even when the send would have
  // succeeded, and the client then reported failure while the server may
  // still have stored it. Scale the budget with the payload (8s base + 1s
  // per MiB, capped at 30s).
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    BASE_TIMEOUT_MS + Math.ceil(bodyBytes / (1024 * 1024)) * PER_MB_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(TELEMETRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    return resp.ok;
  } catch (e) {
    // Network error OR timeout (AbortError) — treat both as "did not send".
    return false;
  } finally {
    clearTimeout(timer);
  }
}
