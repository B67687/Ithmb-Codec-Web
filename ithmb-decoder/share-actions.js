import { sharedSubmissionIds } from "./state.js";
import { findSuccess } from "./cards.js";
import { bytesToHex, bytesToBase64, showToast } from "./utils.js";
import { submitTelemetry } from "./telemetry.js";
import { t } from "./i18n.js";

// Full-file shares are capped at the app's own decode limit (ui.js
// MAX_FILE_SIZE: files > 8 MB are rejected before decoding, so any file you
// can decode you can share fully). Keep in sync with the worker's
// MAX_BODY_BYTES (13 MB) and FULL_FILE_B64_MAX (~10.7 MB base64).
export const FULL_FILE_MAX_BYTES = 8 * 1024 * 1024;

export const SHARED_TEXT = () => t("share.shared");

// Build the failure share box ("Share 16 bytes" / "Share full file").
// Used by the failure card AND the viewer stage so both surfaces share the
// exact same dedup keys and honest-failure semantics (one share per file;
// header share keeps full available; full share disables both).
export function createShareBox({ cardId, bytes, prefix, isKnown, fileSize }) {
  const box = document.createElement("div");
  box.className = "share-box";
  // Stable selector for re-finding the box after a re-render (the rollback
  // path re-queries via [data-card] because the captured buttons can go
  // stale when a language switch replaces the box mid-POST).
  box.dataset.card = cardId;
  const heading = t("share.helpImprove");
  const text = isKnown
    ? t("share.knownText")
    : t("share.unknownText");
  box.innerHTML = `
    <h4 class="share-heading">${heading}</h4>
    <p class="share-text">${text}</p>
    <div class="share-hexdump"><code>${bytesToHex(bytes.slice(0, 16))}</code></div>
    <div class="share-actions">
      <button class="btn btn-small btn-outline" data-share="header">${t("share.share16")}</button>
      <button class="btn btn-small btn-outline" data-share="full">${t("share.shareFull")}</button>
    </div>
  `;

  const headerBtn = box.querySelector('[data-share="header"]');
  const fullBtn = box.querySelector('[data-share="full"]');
  if (bytes.length > FULL_FILE_MAX_BYTES) fullBtn.style.display = "none";

  const setId = (isKnown ? "fail-" : "unknown-") + cardId;
  const headerKey = setId + "-h";
  const fullKey = setId + "-f";

  // Reflect a share already made from the other surface (card ↔ viewer).
  if (sharedSubmissionIds.has(fullKey)) {
    headerBtn.disabled = true;
    headerBtn.title = t("share.fullSharedTitle");
    fullBtn.textContent = SHARED_TEXT();
    fullBtn.disabled = true;
  } else if (sharedSubmissionIds.has(headerKey)) {
    headerBtn.textContent = SHARED_TEXT();
    headerBtn.disabled = true;
  }

  const share = async (fullFile) => {
    const key = fullFile ? fullKey : headerKey;
    if (sharedSubmissionIds.has(key)) return;
    // Mark synchronously so a fast second click cannot double-submit
    // while the POST is in flight.
    sharedSubmissionIds.add(key);
    const data = {
      prefix,
      fileSize,
      status: isKnown ? "known-failed" : "unknown",
      header: bytesToHex(bytes.slice(0, 16), ""),
    };
    if (fullFile) data.full_file = bytesToBase64(bytes);
    // Optimistic update: flip the buttons immediately, fire the POST in the
    // background. The worker round-trip (~600ms cold start) would otherwise
    // make the click feel unresponsive.
    if (fullFile) {
      headerBtn.disabled = true;
      headerBtn.title = t("share.fullSharedTitle");
      fullBtn.textContent = SHARED_TEXT();
      fullBtn.disabled = true;
    } else {
      headerBtn.textContent = SHARED_TEXT();
      headerBtn.disabled = true;
    }
    showToast(
      fullFile ? t("share.fullSharedToast") : t("share.headerSharedToast"),
    );
    submitTelemetry(data).then((ok) => {
      if (!ok) {
        // Server rejected the share — roll back so the user can retry, and
        // tell the truth instead of pretending it worked.
        sharedSubmissionIds.delete(key);
        // Re-query the buttons from the live DOM instead of mutating the
        // captured nodes: a language-switch re-render may have replaced this
        // share box while the POST was in flight, leaving the captured
        // buttons detached (a rollback on stale refs would strand the UI at
        // "Shared ✓" with no way to retry). Reset EVERY box carrying this
        // card's data-card — the card and the viewer stage render one share
        // box each for the same cardId (same pattern as the data-report
        // rollback). If no box exists, just release the dedup key — the
        // replacement box already reflects the unshared state.
        const liveBoxes = document.querySelectorAll(
          `.share-box[data-card="${cardId}"]`,
        );
        for (const liveBox of liveBoxes) {
          const liveHeader = liveBox.querySelector('[data-share="header"]');
          const liveFull = liveBox.querySelector('[data-share="full"]');
          if (fullFile) {
            if (liveHeader) {
              liveHeader.disabled = false;
              liveHeader.title = "";
            }
            if (liveFull) {
              liveFull.textContent = t("share.shareFull");
              liveFull.disabled = false;
            }
          } else if (liveHeader) {
            liveHeader.textContent = t("share.share16");
            liveHeader.disabled = false;
          }
        }
        showToast(t("share.failedToast"));
      }
    });
  };
  headerBtn.addEventListener("click", () => share(false));
  fullBtn.addEventListener("click", () => share(true));

  return box;
}

// Build the success "Image looks wrong?" report link. Clicking it opens the
// SHARED report modal (one container in the HTML, populated per-click) — the
// original contribute-workflow UX: centered dialog over a dimmed + blurred
// backdrop. The same link/entry is used by the success card AND the viewer
// stage (same fb-<cardId> dedup key, honest feedback).
export function createReportLink({ cardId, bytes, prefix, fileSize }) {
  const wrap = document.createElement("div");
  wrap.className = "success-report";
  const link = document.createElement("a");
  link.href = "#";
  link.setAttribute("data-report", cardId);
  link.textContent = t("share.imageLooksWrong");
  wrap.appendChild(link);

  const fbKey = "fb-" + cardId;

  // Reflect a report already made from the other surface (card ↔ viewer).
  if (sharedSubmissionIds.has(fbKey)) {
    link.textContent = t("share.thanksShared");
    link.style.pointerEvents = "none";
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (sharedSubmissionIds.has(fbKey)) return;
    openReportModal(cardId, bytes, prefix, fileSize);
  });

  return wrap;
}

const ISSUES = [
  ["color_space", "share.issueColorSpace"],
  ["dimensions", "share.issueDimensions"],
  ["stride", "share.issueStride"],
  ["offset", "share.issueOffset"],
  ["byte_order", "share.issueByteOrder"],
  ["other", "share.issueOther"],
];
// Close the shared report modal (idempotent).
function closeReportModal() {
  const overlay = document.getElementById("reportModal");
  if (!overlay) return;
  overlay.classList.remove("active");
  overlay.setAttribute("aria-hidden", "true");
}

// Backdrop click closes the modal. Bound ONCE at module scope — the old
// per-open addEventListener accumulated a listener on every report click.
const reportModalOverlay = document.getElementById("reportModal");
if (reportModalOverlay) {
  reportModalOverlay.addEventListener("click", (e) => {
    if (e.target === reportModalOverlay) closeReportModal();
  });
}

// Open the shared report modal, populated for this card's file.
function openReportModal(cardId, bytes, prefix, fileSize) {
  const overlay = document.getElementById("reportModal");
  const content = document.getElementById("reportModalContent");
  if (!overlay || !content) return;

  const fbKey = "fb-" + cardId;

  // Thumbnail of the decoded image at the top of the modal (like the
  // original contribute modal) — the user sees WHAT looks wrong while
  // picking an issue.
  const thumb = document.createElement("img");
  thumb.className = "report-thumb";
  thumb.alt = "";
  const entry = findSuccess(cardId);
  if (entry && entry.canvas) {
    try {
      thumb.src = entry.canvas.toDataURL("image/jpeg", 0.7);
    } catch (e) {
      thumb.style.display = "none";
    }
  } else {
    thumb.style.display = "none";
  }

  const form = document.createElement("div");
  form.className = "report-form";
  const grid = document.createElement("div");
  grid.className = "report-issues";
  const group = "report-issue-" + cardId;
  for (const [value, key] of ISSUES) {
    const label = t(key);
    const labelEl = document.createElement("label");
    labelEl.className = "report-issue";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = group;
    input.value = value;
    labelEl.appendChild(input);
    labelEl.appendChild(document.createTextNode(label));
    grid.appendChild(labelEl);
  }
  const detail = document.createElement("input");
  detail.type = "text";
  detail.className = "report-detail";
  detail.maxLength = 200;
  detail.placeholder = t("share.whatLooksWrong");
  const actions = document.createElement("div");
  actions.className = "report-form-actions";
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn btn-small btn-primary";
  submitBtn.textContent = t("share.submit");
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-small btn-outline";
  cancelBtn.textContent = t("share.cancel");
  // Right-aligned actions: Cancel on the left, Submit (primary) on the
  // far right — the standard modal convention (Material/Windows).
  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);
  form.appendChild(thumb);
  form.appendChild(grid);
  form.appendChild(detail);
  form.appendChild(actions);
  content.innerHTML = "";
  content.appendChild(form);

  const close = closeReportModal;
  cancelBtn.addEventListener("click", close);
  submitBtn.addEventListener("click", async () => {
    if (sharedSubmissionIds.has(fbKey)) return;
    const checked = grid.querySelector("input:checked");
    if (!checked) {
      showToast(t("share.selectIssue"));
      return;
    }
    const issueDetail = detail.value.trim();
    // Mark synchronously so a fast second submit cannot double-post.
    sharedSubmissionIds.add(fbKey);
    // Optimistic update: close + show success immediately, fire the POST in
    // the background.
    close();
    // Update BOTH surfaces' links (card + viewer stage share the dedup key).
    const links = document.querySelectorAll(`[data-report="${cardId}"]`);
    for (const l of links) {
      l.textContent = t("share.thanksShared");
      l.style.pointerEvents = "none";
    }
    showToast(t("share.reportSharedToast"));
    submitTelemetry({
      prefix,
      fileSize,
      status: "success",
      header: bytesToHex(bytes.slice(0, 16), ""),
      issue: checked.value,
      issue_detail: issueDetail || null,
    }).then((ok) => {
      if (!ok) {
        // Server rejected — roll back so the user can retry, and tell the truth.
        sharedSubmissionIds.delete(fbKey);
        const links2 = document.querySelectorAll(`[data-report="${cardId}"]`);
        for (const l of links2) {
          l.textContent = t("share.imageLooksWrong");
          l.style.pointerEvents = "";
        }
        showToast(t("share.failedToast"));
      }
    });
  });

  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
}
