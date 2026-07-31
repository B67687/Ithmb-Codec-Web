import { S, successfulDecodes } from "./state.js";
import { escapeHtml } from "./utils.js";

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

  // Simple canvas rendering — no scroll container
  stage.innerHTML = "";
  if (srcCanvas) {
    const newCanvas = document.createElement("canvas");
    newCanvas.width = srcCanvas.width;
    newCanvas.height = srcCanvas.height;
    newCanvas.style.width = srcCanvas.style.width;
    newCanvas.style.height = srcCanvas.style.height;
    const newCtx = newCanvas.getContext("2d");
    newCtx.drawImage(srcCanvas, 0, 0);
    stage.appendChild(newCanvas);
  }
  if (!srcCanvas) {
    const oldPlaceholder = stage.querySelector(".viewer-placeholder");
    if (oldPlaceholder) oldPlaceholder.remove();
    const status = card.querySelector(".status");
    const statusText = status ? status.textContent : "";
    if (statusText && !statusText.includes("Decoding...")) {
      // Failed — show placeholder
      const placeholder = document.createElement("div");
      placeholder.className = "viewer-placeholder";
      placeholder.innerHTML = `
        <div class="placeholder-icon">⚠</div>
        <div class="placeholder-title">Decode Failed</div>
        <div class="placeholder-msg">${escapeHtml(statusText)}</div>
      `;
      stage.appendChild(placeholder);
    } else if (!statusText || statusText.includes("Decoding...")) {
      // Still decoding — show spinner
      stage.innerHTML =
        '<div class="viewer-placeholder"><div class="placeholder-spinner"></div><div class="placeholder-msg">Decoding...</div></div>';
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
  // Navigate in filmstrip VISUAL order (thumbs append in decode-completion
  // order, which can differ from card/file order when decodes finish out of
  // sequence). Stepping by card index would "jump" past non-adjacent thumbs.
  const thumbs = document.querySelectorAll(".filmstrip-thumb");
  if (thumbs.length === 0) return;
  const cards = fileList.querySelectorAll(".file-card");
  const currentCard = cards[S.viewerIndex];
  if (!currentCard) {
    openViewer(0);
    return;
  }
  const currentThumb = Array.from(thumbs).find(
    (t) => t.dataset.filmstripCard === currentCard.dataset.cardId,
  );
  const currIdx = currentThumb ? Array.from(thumbs).indexOf(currentThumb) : 0;
  const prevThumb = thumbs[(currIdx - 1 + thumbs.length) % thumbs.length];
  const target = Array.from(cards).find(
    (c) => c.dataset.cardId === prevThumb.dataset.filmstripCard,
  );
  openViewer(target ? Array.from(cards).indexOf(target) : 0);
}

export function nextViewer() {
  const thumbs = document.querySelectorAll(".filmstrip-thumb");
  if (thumbs.length === 0) return;
  const cards = fileList.querySelectorAll(".file-card");
  const currentCard = cards[S.viewerIndex];
  if (!currentCard) {
    openViewer(0);
    return;
  }
  const currentThumb = Array.from(thumbs).find(
    (t) => t.dataset.filmstripCard === currentCard.dataset.cardId,
  );
  const currIdx = currentThumb ? Array.from(thumbs).indexOf(currentThumb) : 0;
  const nextThumb = thumbs[(currIdx + 1) % thumbs.length];
  const target = Array.from(cards).find(
    (c) => c.dataset.cardId === nextThumb.dataset.filmstripCard,
  );
  openViewer(target ? Array.from(cards).indexOf(target) : 0);
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

export function addFilmstripThumb(cardId, canvas) {
  const filmstrip = document.getElementById("viewer-filmstrip");
  if (
    !filmstrip ||
    filmstrip.querySelector(`[data-filmstrip-card="${cardId}"]`)
  )
    return;

  const thumb = document.createElement("div");
  thumb.className = "filmstrip-thumb" + (canvas ? "" : " failed");
  thumb.dataset.filmstripIndex = filmstrip.children.length;
  thumb.dataset.filmstripCard = cardId;

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
      '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;opacity:0.4">\u26a0</div>';
  }

  thumb.addEventListener("click", () => {
    const allCards = document.querySelectorAll(".file-card");
    const target = Array.from(allCards).find(
      (c) => c.dataset.cardId === cardId,
    );
    const idx = target ? Array.from(allCards).indexOf(target) : 0;
    openViewer(idx);
  });

  filmstrip.appendChild(thumb);

  // First thumb opens viewer automatically
  if (filmstrip.children.length === 1) {
    const fileList = document.getElementById("file-list");
    if (fileList.classList.contains("viewer-mode")) {
      openViewer(0);
    }
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
    const newCanvas = document.createElement("canvas");
    newCanvas.width = srcCanvas.width;
    newCanvas.height = srcCanvas.height;
    newCanvas.style.width = srcCanvas.style.width;
    newCanvas.style.height = srcCanvas.style.height;
    const newCtx = newCanvas.getContext("2d");
    newCtx.drawImage(srcCanvas, 0, 0);
    stage.appendChild(newCanvas);
    populateViewerHeader(vCard);
  }
}
