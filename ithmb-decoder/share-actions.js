import { sharedFileIds } from "./state.js";
import { bytesToHex, bytesToBase64, showToast } from "./utils.js";
import { submitTelemetry } from "./telemetry.js";

// Full-file shares are capped at the app's own decode limit (ui.js
// MAX_FILE_SIZE: files > 8 MB are rejected before decoding, so any file you
// can decode you can share fully). Keep in sync with the worker's
// MAX_BODY_BYTES (13 MB) and FULL_FILE_B64_MAX (~10.7 MB base64).
export const FULL_FILE_MAX_BYTES = 8 * 1024 * 1024;

export const SHARED_TEXT = "Shared ✓";

// Build the failure share box ("Share 16 bytes" / "Share full file").
// Used by the failure card AND the viewer stage so both surfaces share the
// exact same dedup keys and honest-failure semantics (one share per file;
// header share keeps full available; full share disables both).
export function createShareBox({ cardId, bytes, prefix, isKnown, fileSize }) {
  const box = document.createElement("div");
  box.className = "share-box";
  const heading = "Help improve the decoder";
  const text = isKnown
    ? "This format is known but the decoder couldn't process it. Sharing its first 16 bytes helps fix support."
    : "This format isn't recognized yet. Sharing its first 16 bytes helps add support.";
  box.innerHTML = `
    <h4 class="share-heading">${heading}</h4>
    <p class="share-text">${text}</p>
    <div class="share-hexdump"><code>${bytesToHex(bytes.slice(0, 16))}</code></div>
    <div class="share-actions">
      <button class="btn btn-small btn-outline" data-share="header">Share 16 bytes</button>
      <button class="btn btn-small btn-outline" data-share="full">Share full file</button>
    </div>
  `;

  const headerBtn = box.querySelector('[data-share="header"]');
  const fullBtn = box.querySelector('[data-share="full"]');
  if (bytes.length > FULL_FILE_MAX_BYTES) fullBtn.style.display = "none";

  const setId = (isKnown ? "fail-" : "unknown-") + cardId;
  const headerKey = setId + "-h";
  const fullKey = setId + "-f";

  // Reflect a share already made from the other surface (card ↔ viewer).
  if (sharedFileIds.has(fullKey)) {
    headerBtn.disabled = true;
    headerBtn.title = "Full file already shared — the 16 bytes are included";
    fullBtn.textContent = SHARED_TEXT;
    fullBtn.disabled = true;
  } else if (sharedFileIds.has(headerKey)) {
    headerBtn.textContent = SHARED_TEXT;
    headerBtn.disabled = true;
  }

  const share = async (fullFile) => {
    const key = fullFile ? fullKey : headerKey;
    if (sharedFileIds.has(key)) return;
    // Mark synchronously so a fast second click cannot double-submit
    // while the POST is in flight.
    sharedFileIds.add(key);
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
      headerBtn.title = "Full file already shared — the 16 bytes are included";
      fullBtn.textContent = SHARED_TEXT;
      fullBtn.disabled = true;
    } else {
      headerBtn.textContent = SHARED_TEXT;
      headerBtn.disabled = true;
    }
    showToast(
      fullFile ? "Full file shared — thank you!" : "16 bytes shared — thank you!",
    );
    submitTelemetry(data).then((ok) => {
      if (!ok) {
        // Server rejected the share — roll back so the user can retry, and
        // tell the truth instead of pretending it worked.
        sharedFileIds.delete(key);
        if (fullFile) {
          headerBtn.disabled = false;
          headerBtn.title = "";
          fullBtn.textContent = "Share full file";
          fullBtn.disabled = false;
        } else {
          headerBtn.textContent = "Share 16 bytes";
          headerBtn.disabled = false;
        }
        showToast("Share failed — the server rejected this file");
      }
    });
  };
  headerBtn.addEventListener("click", () => share(false));
  fullBtn.addEventListener("click", () => share(true));

  return box;
}

// Build the success "Image looks wrong?" report link. Used by the success
// card AND the viewer stage (same fb-<cardId> dedup key, honest feedback).
// Clicking the link expands an inline MCQ form — a decoded-but-wrong file
// has a VALID header, so the 16 bytes alone are useless; what the visitor
// says is wrong (issue + optional detail) is the valuable part.
export function createReportLink({ cardId, bytes, prefix, fileSize }) {
  const wrap = document.createElement("div");
  wrap.className = "success-report";
  const link = document.createElement("a");
  link.href = "#";
  link.setAttribute("data-report", cardId);
  link.textContent = "Image looks wrong? Share the first 16 bytes";
  wrap.appendChild(link);

  const fbKey = "fb-" + cardId;

  // Reflect a report already made from the other surface (card ↔ viewer).
  if (sharedFileIds.has(fbKey)) {
    link.textContent = "Thanks — shared ✓";
    link.style.pointerEvents = "none";
  }

  const ISSUES = [
    ["color_space", "Color space"],
    ["dimensions", "Dimensions"],
    ["stride", "Stride / padding"],
    ["offset", "Offset"],
    ["byte_order", "Byte order"],
    ["other", "Other"],
  ];

  // The inline form (hidden until the link is clicked).
  const form = document.createElement("div");
  form.className = "report-form";
  form.hidden = true;
  const grid = document.createElement("div");
  grid.className = "report-issues";
  const group = "report-issue-" + cardId;
  for (const [value, label] of ISSUES) {
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
  detail.placeholder = "What looks wrong? (optional)";
  const actions = document.createElement("div");
  actions.className = "report-form-actions";
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn btn-small btn-primary";
  submitBtn.textContent = "Submit";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-small btn-outline";
  cancelBtn.textContent = "Cancel";
  actions.appendChild(submitBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(grid);
  form.appendChild(detail);
  form.appendChild(actions);
  wrap.appendChild(form);

  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (sharedFileIds.has(fbKey)) return;
    form.hidden = false;
  });
  cancelBtn.addEventListener("click", () => {
    form.hidden = true;
  });
  submitBtn.addEventListener("click", async () => {
    if (sharedFileIds.has(fbKey)) return;
    const checked = grid.querySelector("input:checked");
    if (!checked) {
      showToast("Please select what looks wrong");
      return;
    }
    const issueDetail = detail.value.trim();
    // Mark synchronously so a fast second submit cannot double-post.
    sharedFileIds.add(fbKey);
    // Optimistic update: show success immediately, fire the POST in the
    // background. The worker round-trip (~600ms cold start) would otherwise
    // freeze the UI waiting for the response.
    form.hidden = true;
    link.textContent = "Thanks — shared ✓";
    link.style.pointerEvents = "none";
    showToast("Report shared — thank you!");
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
        sharedFileIds.delete(fbKey);
        link.textContent = "Image looks wrong? Share the first 16 bytes";
        link.style.pointerEvents = "";
        showToast("Share failed — the server rejected this file");
      }
    });
  });

  return wrap;
}
