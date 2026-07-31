import { S, successfulDecodes, failedDecodes, KNOWN_PREFIXES } from "./state.js";
import { escapeHtml } from "./utils.js";
import { createShareBox, createReportLink } from "./share-actions.js";

const fileList = document.getElementById("file-list");

export function closeViewer() {
  const container = document.getElementById("viewer-container");
  if (container) container.style.display = "none";
  // Show card list by removing viewer-mode
  fileList.classList.remove("viewer-mode");
  updateToolbar();
  // Hide viewer navigation when in grid mode
  const viewerNav = document.getElementById("viewerNav");
  if (viewerNav) viewerNav.style.display = "none";
}

export function openViewer(index) {
  const cards = fileList.querySelectorAll(".file-card");
  if (index < 0 || index >= cards.length) return;
  S.viewerIndex = index;

  // Show viewer, enable viewer-mode layout
  const container = document.getElementById("viewer-container");
  container.style.display = "";
  fileList.classList.add("viewer-mode");
  // Show viewer navigation
  const viewerNav = document.getElementById("viewerNav");
  if (viewerNav) viewerNav.style.display = "";

  // Clone canvas from the active card into the viewer stage
  const stage = document.getElementById("viewer-stage");
  const card = cards[index];
  // Populate header immediately with filename+size (dimensions update on decode)
  populateViewerHeader(card);
  const srcCanvas = card.querySelector(".preview canvas");

  // Simple canvas rendering — no scroll container. Wrap content in a
  // column so the contextual share/report UI (when present) sits BELOW
  // the image instead of beside it.
  stage.innerHTML = "";
  const stageContent = document.createElement("div");
  stageContent.className = "viewer-stage-content";
  if (srcCanvas) {
    const newCanvas = document.createElement("canvas");
    newCanvas.width = srcCanvas.width;
    newCanvas.height = srcCanvas.height;
    newCanvas.style.width = srcCanvas.style.width;
    newCanvas.style.height = srcCanvas.style.height;
    const newCtx = newCanvas.getContext("2d");
    newCtx.drawImage(srcCanvas, 0, 0);
    stageContent.appendChild(newCanvas);
  }
  // Look up the active card's failure/success entry up front so the failed
  // placeholder can embed the share box (one integrated card) and the
  // success path can attach the report link below the image.
  const viewerCardId = card.dataset.cardId;
  const failedEntry = failedDecodes.find((f) => f.cardId === viewerCardId);

  if (!srcCanvas) {
    const oldPlaceholder = stage.querySelector(".viewer-placeholder");
    if (oldPlaceholder) oldPlaceholder.remove();
    const status = card.querySelector(".status");
    const statusText = status ? status.textContent : "";
    if (statusText && !statusText.includes("Decoding...")) {
      // Failed — show placeholder. Embed the share box inside the same
      // visual card (when a failed-decode entry exists) so they read as
      // ONE integrated box rather than two stacked boxes. Error cards
      // (no failedEntry) show a bare placeholder with no share box.
      const placeholder = document.createElement("div");
      placeholder.className = "viewer-placeholder";
      placeholder.innerHTML = `
        <div class="placeholder-icon">⚠</div>
        <div class="placeholder-title">Decode Failed</div>
        <div class="placeholder-msg">${escapeHtml(statusText)}</div>
      `;
      if (failedEntry) {
        placeholder.appendChild(
          createShareBox({
            cardId: viewerCardId,
            bytes: failedEntry.bytes,
            prefix: failedEntry.prefix,
            isKnown: KNOWN_PREFIXES.has(failedEntry.prefix),
            fileSize: failedEntry.fileSize,
          }),
        );
      }
      stageContent.appendChild(placeholder);
    } else if (!statusText || statusText.includes("Decoding...")) {
      // Still decoding — show spinner
      stageContent.innerHTML =
        '<div class="viewer-placeholder"><div class="placeholder-spinner"></div><div class="placeholder-msg">Decoding...</div></div>';
    }
  }
  stage.appendChild(stageContent);

  // Success path: viewer mirrors the card's "Image looks wrong?" report link
  // (identical dedup key + honest feedback via share-actions). Failed cards
  // already got their share box embedded inside the placeholder above.
  if (!failedEntry) {
    const successEntry = successfulDecodes.find(
      (s) => s.cardId === viewerCardId,
    );
    if (successEntry) {
      stageContent.appendChild(
        createReportLink({
          cardId: viewerCardId,
          bytes: successEntry.bytes,
          prefix: successEntry.prefix,
          fileSize: successEntry.fileSize,
        }),
      );
    }
  }

  // Highlight active thumbnail, scroll into view
  const thumbs = document.querySelectorAll(".filmstrip-thumb");
  const currentCard = cards[index];
  const currentCardId = currentCard ? currentCard.dataset.cardId : null;
  thumbs.forEach((t) => {
    t.classList.toggle("active", t.dataset.filmstripCard === currentCardId);
    if (t.dataset.filmstripCard === currentCardId) {
      t.setAttribute("aria-current", "true");
    } else {
      t.removeAttribute("aria-current");
    }
  });
  const activeThumb = Array.from(thumbs).find(
    (t) => t.dataset.filmstripCard === currentCardId,
  );
  if (activeThumb) {
    const filmstripEl = document.getElementById("viewer-filmstrip");
    if (filmstripEl) {
      const scrollLeft =
        activeThumb.offsetLeft -
        filmstripEl.offsetWidth / 2 +
        activeThumb.offsetWidth / 2;
      filmstripEl.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }

  // Update toolbar
  updateToolbar();
}

export function populateViewerHeader(card) {
  const encEl = document.getElementById("vhEnc");
  const nameEl = document.getElementById("vhFile");
  const dimsEl = document.getElementById("vhDims");

  const metaName = card.querySelector(".meta .name");
  nameEl.textContent = metaName ? metaName.textContent : "";

  const metaSize = card.querySelector(".meta .size");
  const sizeText = metaSize ? metaSize.textContent : "";

  const info = card.querySelector(".preview .info");
  if (info) {
    const divs = info.children;
    const dimsText = divs[1]
      ? divs[1].textContent.replace("Dimensions: ", "")
      : "";
    const encText = divs[2]
      ? divs[2].textContent.replace("Encoding: ", "")
      : "";
    encEl.textContent = encText || "Unknown";
    if (sizeText && dimsText) {
      dimsEl.textContent = sizeText + " · " + dimsText;
    } else if (dimsText) {
      dimsEl.textContent = dimsText;
    } else {
      dimsEl.textContent = sizeText || "";
    }
  } else {
    encEl.textContent = "Unknown";
    if (sizeText) {
      dimsEl.textContent = sizeText + " · Unknown";
    } else {
      dimsEl.textContent = "Unknown";
    }
  }
}

export function prevViewer() {
  // Filmstrip thumbs are created in FILE order at card-creation time, so
  // filmstrip order === card order === viewer numbering. Simple cyclic step.
  const cards = fileList.querySelectorAll(".file-card");
  if (cards.length === 0) return;
  const next = (S.viewerIndex - 1 + cards.length) % cards.length;
  openViewer(next);
}

export function nextViewer() {
  const cards = fileList.querySelectorAll(".file-card");
  if (cards.length === 0) return;
  openViewer((S.viewerIndex + 1) % cards.length);
}

export function updateToolbar() {
  const toolbar = document.getElementById("toolbar");
  if (S.totalFiles > 0) toolbar.classList.add("visible");
  const toggleBtn = document.getElementById("viewToggleBtn");
  if (toggleBtn && S.totalFiles > 0) {
    toggleBtn.style.display = "";
  }
  const dlBtn = document.getElementById("downloadAllBtn");
  if (successfulDecodes.length >= 2) {
    dlBtn.style.display = "";
    dlBtn.textContent = "Download All";
    dlBtn.title = "Download " + successfulDecodes.length + " files as a ZIP archive";
  } else {
    dlBtn.style.display = "none";
  }
  const viewerNav = document.getElementById("viewerNav");
  const container = document.getElementById("viewer-container");
  viewerNav.style.display =
    container && container.style.display !== "none" ? "" : "none";
  const pos = document.getElementById("viewerPos");
  const idx = S.viewerIndex >= 0 ? S.viewerIndex + 1 : 1;
  pos.textContent = idx + " / " + S.cardCount;
  // Show/hide download format select
  const fmtSelect = document.getElementById("downloadFormatSelect");
  if (fmtSelect) fmtSelect.style.display = S.totalFiles > 0 ? "" : "none";
}
// Show/hide help button
const helpBtn = document.getElementById("helpBtn");
if (helpBtn) helpBtn.style.display = S.totalFiles > 0 ? "" : "none";

// ─── Filmstrip helpers (extracted from decoder.js) ───

// Create a placeholder thumb in FILE order when a card is created. The
// thumbnail image is filled in later by addFilmstripThumb() once decode
// completes. Keeping the thumbs in file order means the filmstrip, the
// arrow navigation, and the "N / M" viewer numbering all share ONE order.
export function createFilmstripThumb(cardId) {
  const filmstrip = document.getElementById("viewer-filmstrip");
  if (!filmstrip) return;
  if (filmstrip.querySelector(`[data-filmstrip-card="${cardId}"]`)) return;

  const thumb = document.createElement("div");
  thumb.className = "filmstrip-thumb pending";
  thumb.dataset.filmstripIndex = filmstrip.children.length;
  thumb.dataset.filmstripCard = cardId;

  thumb.addEventListener("click", () => {
    const allCards = document.querySelectorAll(".file-card");
    const target = Array.from(allCards).find(
      (c) => c.dataset.cardId === cardId,
    );
    const idx = target ? Array.from(allCards).indexOf(target) : 0;
    openViewer(idx);
  });

  filmstrip.appendChild(thumb);
}

// Fill an existing placeholder thumb with the decoded thumbnail (or the
// failure icon). Falls back to creating the thumb if no placeholder exists.
export function addFilmstripThumb(cardId, canvas) {
  const filmstrip = document.getElementById("viewer-filmstrip");
  if (!filmstrip) return;
  let thumb = filmstrip.querySelector(`[data-filmstrip-card="${cardId}"]`);
  if (!thumb) {
    createFilmstripThumb(cardId);
    thumb = filmstrip.querySelector(`[data-filmstrip-card="${cardId}"]`);
    if (!thumb) return;
  }

  thumb.classList.remove("pending");
  thumb.classList.toggle("failed", !canvas);
  thumb.innerHTML = "";

  if (canvas) {
    const isMobile = window.innerWidth <= 480;
    const thumbW = isMobile ? 48 : 80;
    const thumbH = isMobile ? 36 : 60;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const tc = thumbCanvas.getContext("2d");
    tc.drawImage(canvas, 0, 0, thumbW, thumbH);
    thumb.appendChild(thumbCanvas);
  } else {
    thumb.innerHTML =
      '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;opacity:0.4">⚠</div>';
  }

  // Ensure active thumb highlight if this thumb matches current viewer card
  if (S.viewerIndex >= 0) {
    const allCards = document.querySelectorAll(".file-card");
    const currentCard = allCards[S.viewerIndex];
    if (currentCard && thumb.dataset.filmstripCard === currentCard.dataset.cardId) {
      thumb.classList.add("active");
    }
  }
}

export function refreshViewerIfCurrent(cardId) {
  const fileList = document.getElementById("file-list");
  if (!fileList.classList.contains("viewer-mode") || S.viewerIndex < 0) return;
  const vCards = fileList.querySelectorAll(".file-card");
  if (vCards[S.viewerIndex]?.dataset.cardId === cardId) {
    openViewer(S.viewerIndex);
  }
}

export function populateViewerStageForCard(vCard) {
  const srcCanvas = vCard.querySelector(".preview canvas");
  if (!srcCanvas) return;
  const stage = document.getElementById("viewer-stage");
  if (
    stage.children.length === 0 ||
    stage.querySelector(".viewer-placeholder")
  ) {
    stage.innerHTML = "";
    const stageContent = document.createElement("div");
    stageContent.className = "viewer-stage-content";
    const newCanvas = document.createElement("canvas");
    newCanvas.width = srcCanvas.width;
    newCanvas.height = srcCanvas.height;
    newCanvas.style.width = srcCanvas.style.width;
    newCanvas.style.height = srcCanvas.style.height;
    const newCtx = newCanvas.getContext("2d");
    newCtx.drawImage(srcCanvas, 0, 0);
    stageContent.appendChild(newCanvas);

    // Mirror the success-card report link in the viewer stage.
    const viewerCardId = vCard.dataset.cardId;
    const successEntry = successfulDecodes.find(
      (s) => s.cardId === viewerCardId,
    );
    if (successEntry) {
      stageContent.appendChild(
        createReportLink({
          cardId: viewerCardId,
          bytes: successEntry.bytes,
          prefix: successEntry.prefix,
          fileSize: successEntry.fileSize,
        }),
      );
    }

    stage.appendChild(stageContent);
    populateViewerHeader(vCard);
  }
}
