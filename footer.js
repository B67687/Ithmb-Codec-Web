(function () {
  // Footer text is i18n-aware: "Powered by" and "Buy me a coffee" come from
  // the locale tables. footer.js is a classic script (not a module), so it
  // can't import i18n.js — it reads the window-level hook (i18n.js sets
  // window.t). i18n.js may load AFTER this script (home page: footer at
  // line ~344, i18n injected by nav.js as a deferred module), so wait for
  // window.t to appear before rendering; the languagechange event then
  // keeps it in sync.
  function currentT() {
    return (typeof window.t === "function" && window.t) || ((k) => k);
  }
  function renderFooter() {
    // Don't render until i18n is ready: showing the raw-key fallback would
    // flash "footer.poweredBy" text. The setInterval below re-renders once
    // window.t appears.
    if (typeof window.t !== "function") return;
    // Use a FRESH t() each render — window.t may appear after this classic
    // script loads (module scripts are deferred), so never cache the fallback.
    const t = currentT();
    var footerHtml =
      "<footer>" +
      "<div>" +
      '<a href="https://github.com/B67687/Ithmb-Codec" target="_blank" rel="noopener" aria-label="GitHub">' +
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle;display:inline-block">' +
      '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>' +
      "</svg>" +
      "</a>" +
      t("footer.poweredBy") +
      ' <a href="https://github.com/B67687/Ithmb-Codec">Ithmb-Codec</a>' +
      t("footer.poweredBySuffix") +
      " \u00B7 " +
      '<a href="/enterprise/" rel="noopener">' + t("home.enterprise") + "</a>" +
      " \u00B7 " +
      '<a href="https://buymeacoffee.com/ThumbNami" target="_blank" rel="noopener">' +
      '<img src="/bmc-icon.svg" alt="" width="14" height="20" style="vertical-align:middle;display:inline-block">' +
      " " + t("footer.buyCoffee") +
      "</a>" +
      "</div>" +
      "</footer>";
    var old = document.querySelector("footer");
    if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", footerHtml);
  }
renderFooter();
  window.addEventListener("languagechange", renderFooter);
  // If i18n.js hasn't loaded yet (it's a deferred module on some pages),
  // re-render once it exposes window.t so the footer doesn't show raw keys.
  if (typeof window.t !== "function") {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (typeof window.t === "function" || tries > 50) {
        clearInterval(timer);
        renderFooter();
      }
    }, 100);
  }
})();
