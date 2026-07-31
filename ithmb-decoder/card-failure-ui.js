import { failedDecodes, sharedFileIds } from "./state.js";
import { bytesToHex, bytesToBase64, escapeHtml, showToast } from "./utils.js";
import { submitTelemetry } from "./telemetry.js";
import { addFilmstripThumb, refreshViewerIfCurrent } from "./viewer.js";

// Full-file shares are capped at the app's own decode limit (ui.js
// MAX_FILE_SIZE: files > 8 MB are rejected before decoding, so any file you
// can decode you can share fully). Keep in sync with the worker's
// MAX_BODY_BYTES (13 MB) and FULL_FILE_B64_MAX (~10.7 MB base64).
export const FULL_FILE_MAX_BYTES = 8 * 1024 * 1024;

export const SHARED_TEXT = "Shared ✓";

export function renderFailureCard(cardId, file, bytes, prefix, mode) {
  // mode: "known-failed" | "unknown"
  const card = document.getElementById(cardId);
  const statusEl = card.querySelector(".status");
  const previewEl = card.querySelector(".preview");

  const isKnown = mode === "known-failed";
  const heading = "Help improve the decoder";
  const text = isKnown
    ? "This format is known but the decoder couldn't process it. Sharing its first 16 bytes helps fix support."
    : "This format isn't recognized yet. Sharing its first 16 bytes helps add support.";

  statusEl.className = "status " + (isKnown ? "err" : "unknown");
  statusEl.textContent = isKnown
    ? "Decode failed — corrupt or unsupported variant"
    : `Unknown format — prefix ${prefix}`;
  previewEl.style.display = "block";
  previewEl.innerHTML = `
    <div class="share-box">
      <h4 class="share-heading">${heading}</h4>
      <p class="share-text">${text}</p>
      <div class="share-hexdump"><code>${bytesToHex(bytes.slice(0, 16))}</code></div>
      <div class="share-actions">
        <button class="btn btn-small btn-outline" data-share="header">Share 16 bytes</button>
        <button class="btn btn-small btn-outline" data-share="full">Share full file</button>
      </div>
    </div>
  `;

  const headerBtn = previewEl.querySelector('[data-share="header"]');
  const fullBtn = previewEl.querySelector('[data-share="full"]');
  if (bytes.length > FULL_FILE_MAX_BYTES) fullBtn.style.display = "none";

  const setId = (isKnown ? "fail-" : "unknown-") + cardId;
  const headerKey = setId + "-h";
  const fullKey = setId + "-f";
  const share = async (fullFile) => {
    const key = fullFile ? fullKey : headerKey;
    if (sharedFileIds.has(key)) return;
    // Mark synchronously so a fast second click cannot double-submit
    // while the POST is in flight.
    sharedFileIds.add(key);
    const data = {
      prefix,
      fileSize: file.size,
      status: isKnown ? "known-failed" : "unknown",
      header: bytesToHex(bytes.slice(0, 16), ""),
    };
    if (fullFile) data.full_file = bytesToBase64(bytes);
    const ok = await submitTelemetry(data);
    if (!ok) {
      // Server rejected the share (e.g. no valid ithmb header — prefix out
      // of range). Roll back the guard so the user can retry, and tell the
      // truth instead of pretending it worked.
      sharedFileIds.delete(key);
      showToast("Share failed — the server rejected this file");
      return;
    }
    if (fullFile) {
      // Full file includes the header — header share becomes redundant.
      headerBtn.disabled = true;
      headerBtn.title = "Full file already shared — the 16 bytes are included";
      fullBtn.textContent = SHARED_TEXT;
      fullBtn.disabled = true;
    } else {
      // Header only — the full file is still valuable, keep it available.
      headerBtn.textContent = SHARED_TEXT;
      headerBtn.disabled = true;
    }
    showToast(
      fullFile ? "Full file shared — thank you!" : "16 bytes shared — thank you!",
    );
  };
  headerBtn.addEventListener("click", () => share(false));
  fullBtn.addEventListener("click", () => share(true));

  failedDecodes.push({
    cardId,
    bytes,
    prefix,
    fileName: file.name,
    fileSize: file.size,
  });

  // Filmstrip + viewer refresh
  addFilmstripThumb(cardId);
  refreshViewerIfCurrent(cardId);
}

export function renderErrorCard(cardId, errMsg) {
  const card = document.getElementById(cardId);
  const statusEl = card.querySelector(".status");
  const previewEl = card.querySelector(".preview");
  statusEl.className = "status err";
  statusEl.textContent = "Error";
  previewEl.style.display = "block";
  previewEl.innerHTML = `<div class="err-msg">${escapeHtml(errMsg)}</div>`;
  addFilmstripThumb(cardId);
  refreshViewerIfCurrent(cardId);
}
