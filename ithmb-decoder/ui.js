import {
  S,
  processedFileIds,
  successfulDecodes,
  failedDecodes,
} from "./state.js";
import { bytesToHex, escapeHtml, formatSize, showToast } from "./utils.js";
import { decodeFile } from "./decoder.js";
import { openViewer, createFilmstripThumb, updateToolbar } from "./viewer.js";
import { t } from "./i18n.js";

const fileList = document.getElementById("file-list");

async function fileFingerprint(file) {
  const blob = file.slice(0, 256);
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return bytesToHex(new Uint8Array(hash), "");
}

export function addFileCard(file) {
  S.cardCount++;
  const cardId = "card-" + ++S.globalCardIdCounter;
  const card = document.createElement("div");
  card.className = "file-card";
  card.dataset.cardId = cardId;
  fileList.classList.add("viewer-mode");
  card.id = cardId;
  card.innerHTML = `
        <div class="meta">
          <span class="name">${escapeHtml(file.name)}</span>
          <span class="size">${formatSize(file.size)}</span>
        </div>
        <div class="status loading"><span class="spinner"></span> ${t("viewer.decoding")}</div>
        <div class="preview" style="display:none"></div>
      `;
  fileList.appendChild(card);
  createFilmstripThumb(cardId);
  return cardId;
}

export async function processFiles(files) {
  const isFirstBatch = fileList.children.length === 0;

  if (isFirstBatch) {
    // Full reset for first batch
    fileList.innerHTML = "";
    S.cardCount = 0;
    S.globalCardIdCounter = 0;
    S.totalFiles = 0;
    successfulDecodes.length = 0;
    failedDecodes.length = 0;
    failedDecodes.length = 0;
    processedFileIds.clear();
    const filmstrip = document.getElementById("viewer-filmstrip");
    if (filmstrip) filmstrip.innerHTML = "";
    const container = document.getElementById("viewer-container");
    if (container) container.style.display = "none";
  }

  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB

  // Dedup by content hash + filename (same name + same content = duplicate)
  const valid = [];
  let nonIthmb = 0;
  let tooLarge = 0;
  for (const f of files) {
    const n = f.name.toLowerCase();
    const isIthmb = n.endsWith(".ithmb") || n.endsWith(".ipm");
    if (!isIthmb) {
      nonIthmb++;
      continue;
    }
    if (f.size > MAX_FILE_SIZE) {
      tooLarge++;
      continue;
    }
    const fingerprint = await fileFingerprint(f);
    const key = n + "::" + fingerprint;
    if (processedFileIds.has(key)) continue;
    processedFileIds.add(key);
    valid.push(f);
  }

  if (nonIthmb > 0)
    showToast(t("ui.skipped", { n: nonIthmb }));
  if (tooLarge > 0) showToast(t("ui.tooLarge", { n: tooLarge }));

  S.totalFiles += valid.length;
  const cardCountBefore = [...fileList.querySelectorAll(".file-card")].length;
  for (const file of valid) {
    const cardId = addFileCard(file);
    decodeFile(file, cardId);
  }
  const cardCountAfter = [...fileList.querySelectorAll(".file-card")].length;
  const newlyAdded = cardCountAfter - cardCountBefore;

  updateToolbar();
  if (isFirstBatch && valid.length > 0) {
    openViewer(0);
  } else if (!isFirstBatch && newlyAdded > 0) {
    // Focus on the first newly added file
    openViewer(cardCountBefore);
  }
}
