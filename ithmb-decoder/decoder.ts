import { KNOWN_PREFIXES } from "./state.js";
import { escapeHtml } from "./utils.js";
import { updateToolbar } from "./viewer.js";
import { decode_ithmb, peek_prefix } from "./ithmb_wasm.js";
import { renderSuccessCard } from "./card-success-ui.js";
import { renderFailureCard, renderErrorCard } from "./card-failure-ui.js";
import { t } from "./i18n.js";

export async function decodeFile(file: File, cardId: string): Promise<void> {
  const card = document.getElementById(cardId)!;
  const statusEl = card.querySelector<HTMLElement>(".status")!;
  const previewEl = card.querySelector<HTMLElement>(".preview")!;
  let bytes: Uint8Array;
  let prefix: number;

  try {
    const buf = await file.arrayBuffer();
    bytes = new Uint8Array(buf);
    prefix = peek_prefix(bytes);
    const isKnown = KNOWN_PREFIXES.has(prefix);
    const result = decode_ithmb(bytes);

    if (result) {
      // Success!
      const width = new DataView(result.buffer).getUint32(0, true);
      const height = new DataView(result.buffer).getUint32(4, true);
      const pixels = result.slice(8);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      renderSuccessCard(cardId, file, canvas, prefix, width, height, bytes);
    } else {
      // Decode failed
      if (isKnown) {
        renderFailureCard(cardId, file, bytes, prefix, "known-failed");
      } else {
        renderFailureCard(cardId, file, bytes, prefix, "unknown");
      }
    }
  } catch (err) {
    const message = (err instanceof Error && err.message) || String(err);
    statusEl.className = "status err";
    statusEl.textContent = t("card.error");
    previewEl.style.display = "block";
    previewEl.innerHTML = `<div class="err-msg">${escapeHtml(message)}</div>`;
    // Error cards are NOT stored in the cards lists: they carry no shareable
    // bytes (the failure may have happened before bytes/prefix were set), so
    // a failed entry would break reRenderCards (createShareBox throws
    // on undefined bytes) and mislabel the card as an unknown format. The
    // viewer already treats error cards as entries without a failed entry.
    renderErrorCard(cardId, message);
  }
  updateToolbar();
}
