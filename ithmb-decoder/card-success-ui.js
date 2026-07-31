import { S, successfulDecodes, sharedFileIds } from "./state.js";
import { formatLabels, extMap, formatSize, bytesToHex, showToast } from "./utils.js";
import { addFilmstripThumb, populateViewerStageForCard } from "./viewer.js";
import { get_encoding_name } from "./ithmb_wasm.js";
import { submitTelemetry } from "./telemetry.js";

export function renderSuccessCard(
  cardId,
  file,
  canvas,
  prefix,
  width,
  height,
  bytes,
) {
  const card = document.getElementById(cardId);
  const statusEl = card.querySelector(".status");
  const previewEl = card.querySelector(".preview");

  statusEl.className = "status ok";
  statusEl.textContent = `Decoded — ${width}×${height}`;
  previewEl.style.display = "flex";

  // Constrain display size
  const maxW = 600,
    maxH = 400;
  let dispW = width,
    dispH = height;
  if (dispW > maxW) {
    dispH = (dispH * maxW) / dispW;
    dispW = maxW;
  }
  if (dispH > maxH) {
    dispW = (dispW * maxH) / dispH;
    dispH = maxH;
  }

  canvas.style.width = Math.round(dispW) + "px";
  canvas.style.height = Math.round(dispH) + "px";
  if (dispW > 350) previewEl.classList.add("stack-below");

  // Build info panel
  const infoDiv = document.createElement("div");
  infoDiv.className = "info";
  infoDiv.innerHTML = `
    <div>Format prefix: <span class="prefix-badge">${prefix}</span></div>
    <div>Dimensions: ${width}×${height} px</div>
    <div>Encoding: ${get_encoding_name(prefix)}</div>
    <div>File size: ${formatSize(file.size)}</div>
    <div class="actions" style="display:flex;align-items:center;gap:4px">
      <button class="btn btn-primary btn-small" data-save>Save ${formatLabels[S.downloadFormat] || "JPEG"}</button>
      <select class="fmt-select card-format-select" data-card="${cardId}" style="height:28px;font-size:0.75rem;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text)">
        <option value="image/jpeg">JPEG</option>
        <option value="image/png">PNG</option>
        <option value="image/bmp">BMP</option>
        <option value="image/webp">WebP</option>
      </select>
    </div>
    <div class="success-report"><a href="#" data-report="${cardId}">Image looks wrong? Share the first 16 bytes</a></div>
  `;

  previewEl.innerHTML = "";
  previewEl.appendChild(canvas);
  previewEl.appendChild(infoDiv);

  // Format selector
  const fmtSelect = infoDiv.querySelector(".fmt-select");
  if (fmtSelect) {
    fmtSelect.value = S.cardFormats[cardId] || S.downloadFormat;
    fmtSelect.addEventListener("change", function () {
      S.cardFormats[cardId] = this.value;
      const saveBtn = this.parentElement.querySelector("[data-save]");
      if (saveBtn)
        saveBtn.textContent = "Save " + (formatLabels[this.value] || "JPEG");
    });
  }

  // Track successful decode
  successfulDecodes.push({
    cardId,
    canvas,
    fileName: file.name,
    bytes,
    prefix,
    fileSize: file.size,
  });

  // Filmstrip
  const fileList = document.getElementById("file-list");
  if (fileList.classList.contains("viewer-mode")) {
    addFilmstripThumb(cardId, canvas);
    const vCards = fileList.querySelectorAll(".file-card");
    const vCard = vCards[S.viewerIndex];
    if (vCard) populateViewerStageForCard(vCard);
  }

  // Save button
  infoDiv.querySelector("[data-save]").addEventListener("click", () => {
    const link = document.createElement("a");
    const cardFormat = S.cardFormats[cardId] || S.downloadFormat;
    const ext = extMap[cardFormat] || ".jpg";
    canvas.toBlob(
      (blob) => {
        link.href = URL.createObjectURL(blob);
        link.download = file.name.replace(/\.ithmb$/i, "") + ext;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      cardFormat,
      0.95,
    );
  });

  // 'Image looks wrong?' — shares the first 16 bytes, one per file per session
  const reportLink = infoDiv.querySelector("[data-report]");
  if (reportLink) {
    const fbKey = "fb-" + cardId;
    reportLink.addEventListener("click", async (e) => {
      e.preventDefault();
      if (sharedFileIds.has(fbKey)) return;
      // Mark synchronously so a fast second click cannot double-submit
      // while the POST is in flight.
      sharedFileIds.add(fbKey);
      const ok = await submitTelemetry({
        prefix,
        fileSize: file.size,
        status: "success",
        header: bytesToHex(bytes.slice(0, 16), ""),
      });
      if (!ok) {
        // Roll back the guard so the user can retry, and tell the truth.
        sharedFileIds.delete(fbKey);
        showToast("Share failed — the server rejected this file");
        return;
      }
      reportLink.textContent = "Thanks — shared ✓";
      reportLink.style.pointerEvents = "none";
      showToast("16 bytes shared — thank you!");
    });
  }
}
