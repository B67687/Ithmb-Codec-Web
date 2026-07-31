import { TELEMETRY_URL } from "./state.js";

export async function submitTelemetry(data) {
  try {
    const resp = await fetch(TELEMETRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return resp.ok;
  } catch (e) {
    return false;
  }
}
