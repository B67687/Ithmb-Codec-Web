import { TELEMETRY_URL } from "./state.js";

// The worker round-trip can HANG on a flaky connection (never settles).
// Without a timeout the optimistic UI would show "Shared ✓" forever even
// though the send never completed — an honest failure must eventually roll
// back. AbortController races the fetch; on timeout it rejects and
// submitTelemetry returns false (callers roll back + toast the failure).
const TIMEOUT_MS = 8000;

export async function submitTelemetry(data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(TELEMETRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
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
