import { failedDecodes } from "./state.js";
import { escapeHtml } from "./utils.js";
import { addFilmstripThumb, refreshViewerIfCurrent } from "./viewer.js";
import { createShareBox } from "./share-actions.js";

export { FULL_FILE_MAX_BYTES, SHARED_TEXT } from "./share-actions.js";

export function renderFailureCard(cardId, file, bytes, prefix, mode) {
  // mode: "known-failed" | "unknown"
  const card = document.getElementById(cardId);
  const statusEl = card.querySelector(".status");
  const previewEl = card.querySelector(".preview");

  const isKnown = mode === "known-failed";

  statusEl.className = "status " + (isKnown ? "err" : "unknown");
  statusEl.textContent = isKnown
    ? "Decode failed — corrupt or unsupported variant"
    : `Unknown format — prefix ${prefix}`;
  previewEl.style.display = "block";
  previewEl.innerHTML = "";
  previewEl.appendChild(
    createShareBox({
      cardId,
      bytes,
      prefix,
      isKnown,
      fileSize: file.size,
    }),
  );

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
