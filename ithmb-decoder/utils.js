export function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function showToast(msg) {
  const t = document.getElementById("toast");
  t.setAttribute("role", "status");
  t.setAttribute("aria-live", "polite");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

export function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export const formatLabels = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/bmp": "BMP",
  "image/webp": "WebP",
};

export const extMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/bmp": ".bmp",
  "image/webp": ".webp",
};

export function bytesToHex(bytes, separator = " ") {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(separator);
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000; // 32 KB slices avoids call-stack limits on large arrays
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

