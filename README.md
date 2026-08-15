<div align="center">

<img src="docs/logo.svg" alt="ITHMB Codec Web" width="96" height="96">

# ITHMB Codec Web

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654FF0?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thumbnami)

Free, private, browser-based .ithmb file decoder.

[**Try it live → ithmb-codec.dev**](https://ithmb-codec.dev/ithmb-decoder/)  |  [How to open .ithmb files (guide)](https://ithmb-codec.dev/guide/how-to-open-ithmb-files)

![ITHMB Decoder screenshot](thumb-decoder-preview.png)

<sub>Built with AI assistance — see <a href="./docs/CREDITS.md">CREDITS.md</a></sub>
<br>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec@main/docs/badges/deepseek.svg" alt="DeepSeek"></a>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec@main/docs/badges/opencode.svg" alt="OpenCode"></a>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec@main/docs/badges/omo.svg" alt="Oh My OpenAgent"></a>

<br>
</div>

ITHMB files are Apple iThumbnail images found in iPod Classic, iPod Nano, and other legacy Apple devices. They store thumbnail-sized album art, photos, and menu graphics that the iPod's UI reads directly from its disk. The format is undocumented and varies across devices and firmware versions. This project decodes them.

## Features

- **Free.** No cost, no signup, no account needed.
- **Private.** Everything runs in your browser via WebAssembly. Your files never leave
  your machine unless you explicitly opt in to contribute anonymous format data.
- **Batch decode.** Decode multiple .ithmb files at once.
- **Open source.** MIT licensed. Fork it, audit it, improve it.


## How to use

Go to [https://ithmb-codec.dev/ithmb-decoder/](https://ithmb-codec.dev/ithmb-decoder/) and drag your .ithmb files
onto the page. They decode instantly — no upload, no waiting. Download individual
images or grab them all as a ZIP archive.

## Support

Found an .ithmb file that doesn't decode? [Open an issue on the codec repo](https://github.com/B67687/Ithmb-Codec/issues).

Using ImageGlass? The [native .ithmb plugin](https://github.com/B67687/ImageGlass-Ithmb-Plugin) decodes files in-viewer without a browser.

Enjoying the tool? [Buy me a coffee](https://buymeacoffee.com/thumbnami).

## Built with

Rust, WebAssembly, and TypeScript.
