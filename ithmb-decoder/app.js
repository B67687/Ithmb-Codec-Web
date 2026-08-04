import init from "./ithmb_wasm.js";
import { S } from "./state.js";
import {
  openViewer,
  closeViewer,
  prevViewer,
  nextViewer,
  updateToolbar,
} from "./viewer.js";
import { processFiles } from "./ui.js";
import { downloadAll } from "./download.js";
import { formatLabels, showToast } from "./utils.js";
import { setupHoldRepeat } from "./input.js";
import { t } from "./i18n.js";
import { reRenderCards } from "./card-success-ui.js";

// DOM references
const dropzone = document.getElementById("dropzone");
const fileList = document.getElementById("file-list");
const overlay = document.getElementById("dropOverlay");

// Dropzone click
dropzone.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".ithmb,.ipm";
  input.onchange = () => {
    if (input.files) processFiles(Array.from(input.files));
  };
  input.click();
});

// Full-page drop overlay (lastTarget caching pattern from production apps)
document.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("Files")) e.preventDefault();
});
document.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer.types.includes("Files")) return;
  S.lastTarget = e.target;
  overlay.classList.add("active");
  dropzone.classList.add("drag-over");
  document.body.classList.add("drag-active");
});
document.addEventListener("dragleave", (e) => {
  if (e.target === S.lastTarget || e.target === document) {
    overlay.classList.remove("active");
    dropzone.classList.remove("drag-over");
    document.body.classList.remove("drag-active");
  }
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  overlay.classList.remove("active");
  dropzone.classList.remove("drag-over");
  document.body.classList.remove("drag-active");
  if (
    e.dataTransfer.files &&
    e.dataTransfer.files.length > 0 &&
    e.dataTransfer.types.includes("Files")
  ) {
    processFiles(Array.from(e.dataTransfer.files));
  }
});
document.addEventListener("dragend", () => {
  overlay.classList.remove("active");
  dropzone.classList.remove("drag-over");
  document.body.classList.remove("drag-active");
});

setupHoldRepeat("prevBtn", prevViewer);
setupHoldRepeat("nextBtn", nextViewer);
setupHoldRepeat("viewerArrowLeft", prevViewer);
setupHoldRepeat("viewerArrowRight", nextViewer);

document.getElementById("helpBtn").addEventListener("click", () => {
  showToast(t("app.shortcuts"));
});
document
  .getElementById("downloadAllBtn")
  .addEventListener("click", downloadAll);
document.getElementById("viewToggleBtn").addEventListener("click", () => {
  const container = document.getElementById("viewer-container");
  const btn = document.getElementById("viewToggleBtn");
  if (container && container.style.display !== "none") {
    closeViewer();
    if (btn) btn.textContent = t("app.gallery");
  } else {
    openViewer(S.viewerIndex >= 0 ? S.viewerIndex : 0);
    if (btn) btn.textContent = t("app.gridView");
  }
});

// Swipe navigation on mobile — works with the scroll container in viewer.js
// Simple swipe navigation on mobile
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener(
  "touchstart",
  (e) => {
    if (
      document.querySelectorAll(".file-card").length === 0 ||
      S.viewerIndex < 0
    )
      return;
    if (!e.target.closest("#viewer-stage")) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  },
  { passive: true },
);
document.addEventListener(
  "touchmove",
  (e) => {
    if (
      document.querySelectorAll(".file-card").length === 0 ||
      S.viewerIndex < 0
    )
      return;
    if (!e.target.closest("#viewer-stage")) return;
    const deltaX = Math.abs(e.changedTouches[0].screenX - touchStartX);
    const deltaY = Math.abs(e.changedTouches[0].screenY - touchStartY);
    if (deltaX > deltaY && deltaX > 10) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener(
  "touchend",
  (e) => {
    if (
      document.querySelectorAll(".file-card").length === 0 ||
      S.viewerIndex < 0
    )
      return;
    if (!e.target.closest("#viewer-stage")) return;
    const deltaX = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0) nextViewer();
      else prevViewer();
    }
  },
  { passive: true },
);
// Keyboard navigation in viewer mode
document.addEventListener("keydown", (e) => {
  if (document.querySelectorAll(".file-card").length === 0 || S.viewerIndex < 0)
    return;
  const cards = document.querySelectorAll(".file-card");
  if (cards.length === 0 || S.viewerIndex < 0) return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    nextViewer();
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    prevViewer();
  }
  if (e.key === "Escape") closeViewer();
  if (e.key === "g" || e.key === "G") {
    e.preventDefault();
    const container = document.getElementById("viewer-container");
    const btn = document.getElementById("viewToggleBtn");
    if (container && container.style.display !== "none") {
      closeViewer();
      if (btn) btn.textContent = t("app.gallery");
    } else {
      openViewer(S.viewerIndex >= 0 ? S.viewerIndex : 0);
      if (btn) btn.textContent = t("app.gridView");
    }
  }
});

// In viewer mode, clicking a card opens it
fileList.addEventListener("click", (e) => {
  if (fileList.classList.contains("viewer-mode")) {
    const card = e.target.closest(".file-card");
    if (card) {
      if (e.target.closest("[data-save]")) return;
      const cards = [...fileList.querySelectorAll(".file-card")];
      const idx = cards.indexOf(card);
      if (idx >= 0) {
        openViewer(idx);
      }
    }
  }
});

// Scroll-aware back-to-top + back-to-position
let savedScrollY = 0;
const backToTop = document.getElementById("backToTop");
const backToPos = document.getElementById("backToPosition");
const backToTopLink = document.getElementById("backToTopLink");
const backToPosLink = document.getElementById("backToPositionLink");

// Show/hide back-to-top based on scroll
document.addEventListener(
  "scroll",
  () => {
    if (document.querySelectorAll(".file-card").length === 0) return;
    const viewer = document.getElementById("viewer-container");
    const fileListEl = document.getElementById("file-list");
    const viewerH = viewer ? viewer.offsetHeight : 600;
    const fileListTop = fileListEl ? fileListEl.offsetTop : 0;
    const threshold = Math.max(fileListTop + viewerH * 3, 1000);
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const absThreshold = Math.min(threshold, maxScroll * 0.8);
    backToTop.style.display = window.scrollY > absThreshold ? "" : "none";
    // Hide back-to-position if user scrolls manually
    if (window.scrollY > 50) backToPos.style.display = "none";
  },
  { passive: true },
);

backToTopLink.addEventListener("click", (e) => {
  e.preventDefault();
  savedScrollY = window.scrollY;
  window.scrollTo({ top: 0, behavior: "instant" });
  // Show back-to-position button
  backToPos.style.display = "";
  // Auto-hide after 8 seconds
  setTimeout(() => {
    backToPos.style.display = "none";
  }, 8000);
});

backToPosLink.addEventListener("click", (e) => {
  e.preventDefault();
  window.scrollTo({ top: savedScrollY, behavior: "instant" });
  backToPos.style.display = "none";
});

// Prevent any element from being dragged (stops accidental file-drop triggers)
document.addEventListener("dragstart", (e) => e.preventDefault());

// Download format dropdown
document
  .getElementById("downloadFormatSelect")
  .addEventListener("change", function () {
    S.downloadFormat = this.value;
    // Global selector only affects the Download All ZIP — per-card formats
    // stay independent (S.cardFormats).
    const btn = document.getElementById("downloadAllBtn");
    if (btn) {
      btn.textContent = t("app.downloadAll");
      btn.title = t("app.zipTitle", {
        fmt: formatLabels[S.downloadFormat] || "JPEG",
      });
    }
  });
// Init
try {
  await init();
} catch (e) {
  document
    .querySelector(".container")
    .insertAdjacentHTML(
      "beforeend",
      '<div style="text-align:center;padding:20px;color:#ff453a"><strong>' +
        t("app.loadFailedTitle") +
        "</strong> " +
        t("app.loadFailedMsg") +
        "</div>",
    );
  // Also disable the dropzone so users know something is broken
  dropzone.style.pointerEvents = "none";
  dropzone.style.opacity = "0.5";
}

// Re-render result cards when the language changes (fired by i18n.js setLang).
// Keeps i18n.js dependency-free — the event is the decoupling point.
window.addEventListener("languagechange", () => {
  reRenderCards();
  // If the viewer is open, rebuild its stage + toolbar so the report link,
  // share box, header, and download button re-translate immediately (not
  // just on the next image navigation).
  if (S.viewerIndex >= 0 && document.getElementById("viewer-container")?.style.display !== "none") {
    openViewer(S.viewerIndex);
    updateToolbar();
  }
});
