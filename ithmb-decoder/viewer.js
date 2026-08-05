import { S, successfulDecodes, failedDecodes, KNOWN_PREFIXES } from "./state.js";
import { escapeHtml } from "./utils.js";
import { createShareBox, createReportLink } from "./share-actions.js";
import { t } from "./i18n.js";

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
  // The report form lives in the SHARED modal (fixed overlay, independent
  // of stage re-renders) — nothing to preserve here.
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
    const status = card.querySelector(".status");
    const statusText = status ? status.textContent : "";
    if (statusText && statusText !== t("viewer.decoding")) {
      // Failed — show placeholder. Embed the share box inside the same
      // visual card (when a failed-decode entry exists) so they read as
      // ONE integrated box rather than two stacked boxes. Error cards
      // (no failedEntry) show a bare placeholder with no share box.
      const placeholder = document.createElement("div");
      placeholder.className = "viewer-placeholder failed";
      placeholder.innerHTML = `
        <div class="placeholder-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill-rule="evenodd"/></svg></div>
        <div class="placeholder-title">${t("viewer.decodeFailed")}</div>
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
    } else if (!statusText || statusText === t("viewer.decoding")) {
      // Still decoding — show spinner
      stageContent.innerHTML =
        '<div class="viewer-placeholder"><div class="placeholder-spinner"></div><div class="placeholder-msg">' +
        t("viewer.decoding") +
        "</div></div>";
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
      const report = createReportLink({
        cardId: viewerCardId,
        bytes: successEntry.bytes,
        prefix: successEntry.prefix,
        fileSize: successEntry.fileSize,
      });
      stageContent.appendChild(report);
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
    const dimsEl2 = info.querySelector('[data-info="dims"] .info-value');
    const encEl2 = info.querySelector('[data-info="enc"] .info-value');
    const dimsText = dimsEl2 ? dimsEl2.textContent : "";
    const encText = encEl2 ? encEl2.textContent : "";
    encEl.textContent = encText || t("viewer.unknown");
    if (sizeText && dimsText) {
      dimsEl.textContent = sizeText + " · " + dimsText;
    } else if (dimsText) {
      dimsEl.textContent = dimsText;
    } else {
      dimsEl.textContent = sizeText || "";
    }
  } else {
    encEl.textContent = t("viewer.unknown");
    if (sizeText) {
      dimsEl.textContent = sizeText + " · " + t("viewer.unknown");
    } else {
      dimsEl.textContent = t("viewer.unknown");
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
  const viewerContainer = document.getElementById("viewer-container");
  if (toggleBtn && S.totalFiles > 0) {
    toggleBtn.style.display = "";
    // The toggle label names the view you'll switch TO and is viewer-state-
    // dependent (deliberately NO data-i18n). Derive it HERE from state so it
    // is correct on initial render in any language: updateToolbar runs on
    // every state change, whereas the languagechange event cannot cover the
    // module-load race (i18n.js activates before app.js registers its
    // listener), which left the static English text in non-English defaults.
    toggleBtn.textContent =
      viewerContainer && viewerContainer.style.display !== "none"
        ? t("app.gridView")
        : t("app.gallery");
  }
  const dlBtn = document.getElementById("downloadAllBtn");
  if (successfulDecodes.length >= 2) {
    dlBtn.style.display = "";
    dlBtn.textContent = t("app.downloadAll");
    dlBtn.title = t("viewer.zipTitle", { count: successfulDecodes.length });
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
      '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.4"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill-rule="evenodd"/></svg></div>';
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


