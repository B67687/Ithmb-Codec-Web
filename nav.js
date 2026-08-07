(function () {
  var path = window.location.pathname;

  // Server-rendered /zh/ tree: pages under /zh/ are the canonical Chinese
  // versions. Navigation links and the language switcher stay within the
  // locale tree — the switcher is a plain link between pre-translated
  // pages (no client-side text swap, no ?lang= URLs).
  var isZh = path.indexOf("/zh/") === 0 || path === "/zh";

  // EN page path -> canonical zh page path (and vice versa).
  var zhPages = {
    "/": "/zh/",
    "/ithmb-decoder": "/zh/ithmb-decoder/",
    "/ithmb-decoder/": "/zh/ithmb-decoder/",
    "/ithmb-decoder/index.html": "/zh/ithmb-decoder/",
    "/guide": "/zh/guide/how-to-open-ithmb-files",
    "/guide/": "/zh/guide/how-to-open-ithmb-files",
    "/guide/how-to-open-ithmb-files": "/zh/guide/how-to-open-ithmb-files",
    "/guide/how-to-open-ithmb-files.html": "/zh/guide/how-to-open-ithmb-files",
    "/enterprise": "/zh/enterprise/",
    "/enterprise/": "/zh/enterprise/",
    "/enterprise/index.html": "/zh/enterprise/",
  };
  var enPages = {};
  for (var en in zhPages) enPages[zhPages[en]] = en;

  // The page this path translates to in the OTHER locale. Falls back to the
  // other locale's home for paths outside the map (e.g. /404.html).
  function counterpart(path) {
    if (isZh) return enPages[path] || "/";
    return zhPages[path] !== undefined ? zhPages[path] : "/zh/";
  }

  // Determine active link (strip the /zh prefix so the same rules apply).
  var activePath = isZh ? path.replace(/^\/zh/, "") : path;
  var active = "home";
  if (
    activePath.indexOf("/ithmb-decoder/") === 0 ||
    activePath === "/ithmb-decoder" ||
    activePath === "/ithmb-decoder/index.html"
  )
    active = "decoder";
  else if (
    activePath.indexOf("/guide/") === 0 ||
    activePath === "/guide" ||
    activePath === "/guide/how-to-open-ithmb-files.html"
  )
    active = "guide";
  else if (
    activePath.indexOf("/enterprise/") === 0 ||
    activePath === "/enterprise" ||
    activePath === "/enterprise/index.html"
  )
    active = "enterprise";

  var links = [
    { id: "home", href: "/", text: "Home", zhText: "首页", i18n: "nav.home" },
    { id: "decoder", href: "/ithmb-decoder/", text: "Decoder", zhText: "解码器", i18n: "nav.decoder" },
    { id: "guide", href: "/guide/how-to-open-ithmb-files", text: "Guide", zhText: "指南", i18n: "nav.guide" },
  ];

  function linkHTML(item) {
    var isActive = item.id === active;
    var cls = "top-nav-link" + (isActive ? " active" : "");
    var href = isZh && zhPages[item.href] ? zhPages[item.href] : item.href;
    // On /zh/ pages the nav is injected BEFORE i18n.js runs, so the visible
    // labels are the static Chinese strings (matching zh.json's nav.* keys);
    // data-i18n stays so i18n re-applies the authoritative text on activation.
    var text = isZh ? item.zhText : item.text;
    var html =
      '<a href="' + href + '" class="' + cls + '" data-i18n="' + item.i18n + '">';
    html += text + "</a>";
    return html;
  }

  var ghSvg =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style="vertical-align:middle;display:inline-block">' +
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>' +
    "</svg>";

  // EN / 中 language switcher — a plain navigation link to the counterpart
  // page in the other locale (server-rendered, indexable). i18n.js (loaded
  // below) highlights the active option via updateLangToggle(). On /zh/
  // pages the static Chinese label is emitted inline (nav.js runs before
  // i18n); data-i18n-aria-label/title stay for the authoritative strings.
  var toggleLabel = isZh ? "切换语言" : "Switch language";
  var langToggle =
    '<a href="' + counterpart(path) + '" id="langToggle" class="lang-toggle" ' +
    'data-i18n-aria-label="nav.toggleLabel" data-i18n-title="nav.toggleLabel" ' +
    'aria-label="' + toggleLabel + '" title="' + toggleLabel + '" ' +
    'style="background:transparent;border:1px solid var(--border,#d2d2d7);border-radius:999px;color:var(--text,#1d1d1f);font-size:0.75rem;line-height:1;padding:3px 8px;display:inline-flex;align-items:center;gap:5px;vertical-align:middle;font-family:inherit;margin-right:8px;text-decoration:none;cursor:pointer">' +
    '<span class="lang-opt" data-lang="en">EN</span>' +
    '<span style="color:var(--muted,#86868b)">/</span>' +
    '<span class="lang-opt" data-lang="zh">中</span>' +
    "</a>";

  var navHtml =
    '<nav class="top-nav">' +
    '<a href="' + (isZh ? "/zh/" : "/") + '" class="top-nav-brand"><svg viewBox="0 0 64 64" width="18" height="18" style="vertical-align:middle;margin-right:6px;display:inline-block"><rect width="64" height="64" rx="12" fill="#007AFF"/><text x="32" y="42" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="28" fill="#fff">iT</text></svg>ITHMB Codec</a>' +
    '<div class="top-nav-links">' +
    links.map(linkHTML).join("") +
    "</div>" +
    '<div class="top-nav-icons">' +
    langToggle +
    '<a href="https://buymeacoffee.com/ThumbNami" class="bmc-corner" aria-label="Buy me a coffee" data-i18n-aria-label="nav.buyMeCoffee" target="_blank" rel="noopener">' +
    '<img src="/bmc-icon.svg" alt="" width="22" height="31" style="vertical-align:middle;display:inline-block">' +
    "</a>" +
    '<a href="https://github.com/B67687/Ithmb-Codec" class="github-corner" aria-label="View source on GitHub" data-i18n-aria-label="nav.viewSource">' +
    ghSvg +
    "</a>" +
    "</div>" +
    "</nav>";

  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Persist the language preference when the switcher is clicked, BEFORE
  // the plain-link navigation happens — lang-redirect.js reads it on the
  // next page load. Only the switcher writes the preference; nav links
  // just navigate (the redirect script handles the rest).
  var toggle = document.getElementById("langToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      try {
        localStorage.setItem("ithmbLang", isZh ? "en" : "zh");
      } catch (e) {
        // Storage blocked — navigation still proceeds.
      }
    });
  }
  // Load the i18n module on pages that don't include it directly
  // (decoder page adds its own <script type="module" src="i18n.js">). The
  // browser dedupes by URL, so this is harmless when both are present.
  if (!document.getElementById("i18n-module")) {
    var i18nScript = document.createElement("script");
    i18nScript.id = "i18n-module";
    i18nScript.type = "module";
    i18nScript.src = "/ithmb-decoder/i18n.js";
    (document.head || document.documentElement).appendChild(i18nScript);
  }
})();
