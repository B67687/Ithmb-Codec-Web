import { TELEMETRY_URL } from "./state.js";

export async function submitTelemetry(data) {
  try {
    await fetch(TELEMETRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {}
}
