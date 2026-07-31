(function () {
  var path = window.location.pathname;

  // Determine active link
  var active = "home";
  if (
    path.indexOf("/ithmb-decoder/") === 0 ||
    path === "/ithmb-decoder" ||
    path === "/ithmb-decoder/index.html"
  )
    active = "decoder";
  else if (
    path.indexOf("/guide/") === 0 ||
    path === "/guide" ||
    path === "/guide/how-to-open-ithmb-files.html"
  )
    active = "guide";
  else if (
    path.indexOf("/enterprise/") === 0 ||
    path === "/enterprise" ||
    path === "/enterprise/index.html"
  )
    active = "enterprise";

  var links = [
    { id: "home", href: "/", text: "Home" },
    { id: "decoder", href: "/ithmb-decoder/", text: "Decoder" },
    { id: "guide", href: "/guide/how-to-open-ithmb-files", text: "Guide" },
  ];

  function linkHTML(item) {
    var isActive = item.id === active;
    var cls = "top-nav-link" + (isActive ? " active" : "");
    var html = '<a href="' + item.href + '" class="' + cls + '">';
    html += item.text + "</a>";
    return html;
  }

  var ghSvg =
    '<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style="vertical-align:middle;display:inline-block">' +
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>' +
    "</svg>";

  var navHtml =
    '<nav class="top-nav">' +
    '<a href="/" class="top-nav-brand"><svg viewBox="0 0 64 64" width="18" height="18" style="vertical-align:middle;margin-right:6px;display:inline-block"><rect width="64" height="64" rx="12" fill="#007AFF"/><text x="32" y="42" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="28" fill="#fff">iT</text></svg>ITHMB Codec</a>' +
    '<div class="top-nav-links">' +
    links.map(linkHTML).join("") +
    "</div>" +
    '<div class="top-nav-icons">' +
    '<a href="https://buymeacoffee.com/ThumbNami" class="bmc-corner" aria-label="Buy me a coffee" target="_blank" rel="noopener">' +
    '<img src="/bmc-icon.svg" alt="" width="22" height="31" style="vertical-align:middle;display:inline-block">' +
    "</a>" +
    '<a href="https://github.com/B67687/Ithmb-Codec" class="github-corner" aria-label="View source on GitHub">' +
    ghSvg +
    "</a>" +
    "</div>" +
    "</nav>";

  document.body.insertAdjacentHTML("afterbegin", navHtml);
})();
