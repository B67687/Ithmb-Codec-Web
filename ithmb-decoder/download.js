import { S, successfulDecodes } from "./state.js";
import { formatLabels, extMap, showToast } from "./utils.js";
import { t } from "./i18n.js";

export async function downloadAll() {
  if (typeof JSZip === "undefined") {
    showToast(t("download.jszipNotLoaded"));
    return;
  }
  const zip = new JSZip();
  for (const { canvas, fileName } of successfulDecodes) {
    const ext = extMap[S.downloadFormat] || ".jpg";
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, S.downloadFormat, 0.92),
    );
    if (blob) {
      const name = fileName.replace(/\.(ithmb|ipm)$/i, ext) || "decoded" + ext;
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
