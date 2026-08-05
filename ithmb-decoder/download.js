import { S } from "./state.js";
import { successCards } from "./cards.js";
import { formatLabels, extMap, showToast } from "./utils.js";
import { t } from "./i18n.js";

export async function downloadAll() {
  if (typeof JSZip === "undefined") {
    showToast(t("download.jszipNotLoaded"));
    return;
  }
  const zip = new JSZip();
  for (const { canvas, fileName } of successCards()) {
    const ext = extMap[S.downloadFormat] || ".jpg";
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, S.downloadFormat, 0.92),
    );
    if (blob) {
      const base = fileName.replace(/\.(ithmb|ipm)$/i, "") || "decoded";
      // Sanitize the entry name: strip path separators and leading dots so a
      // hostile filename can never produce a zip-slip-style entry (CWE-22),
      // even though browsers hand us bare basenames today.
      let name = base.replace(/[\\/]/g, "_").replace(/^\.+/, "");
      if (!name) name = "decoded";
      name += ext;
      // Dedupe: JSZip silently overwrites duplicate names — suffix so every
      // image survives the archive.
      if (zip.files[name]) {
        const dot = name.lastIndexOf(".");
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const suffix = dot > 0 ? name.slice(dot) : "";
        let i = 2;
        while (zip.files[stem + "-" + i + suffix]) i++;
        name = stem + "-" + i + suffix;
      }
      zip.file(name, blob);
    }
  }
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ithmb-pictures-converted-to-${(formatLabels[S.downloadFormat] || "JPEG").toLowerCase()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
