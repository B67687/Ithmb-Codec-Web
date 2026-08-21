# ADR-0006: Opt-In Zero-Trust Telemetry for WASM Decoder

**Status:** Superseded (2026-07-31) — superseded by the quiet-by-default
contribution flow. See note below.
## Context

The ITHMB decoder at `docs/ithmb-decoder/` allows users to decode .ithmb files entirely in the browser. To improve format coverage and detect unknown profiles, we need a mechanism to collect format usage data without compromising user privacy or trust.

> **Superseded by**: the quiet-by-default refactor (commit 9374c97, 2026-07-31).
> The telemetry channel changed from pre-filled GitHub issues to a
> Cloudflare Worker endpoint (`workers/telemetry/`) with an HTML dashboard.
> Privacy model kept: zero automatic uploads; failure cards expose one-click
> "Share 16 bytes" / "Share full file" buttons; success cards expose a
> small "Image looks wrong? Share the first 16 bytes" link. All data is
> opt-in, header-only by default (full file only via explicit full-file
> share, capped at 8 MB), rate-limited per fingerprint, stored in KV for
> 365 days, and viewable only via the dashboard gated by ADMIN_TOKEN.
> The rest of this ADR's rationale (zero-trust, opt-in, metadata-only)
> remains valid.
>
> **Amendment (2026-08-14, commit 4ac172a)**: the earlier design briefly
> exposed a public `GET /` JSON endpoint returning aggregate prefix counts
> (format ID → count, derived from KV key names with zero value fetches,
> bounded scan). The app never consumed it (the only app call is `POST /`
> from `submitTelemetry`). It was removed entirely — the whole GET surface
> is now token-gated (`Authorization: Bearer <ADMIN_TOKEN>`, constant-time
> compare; legacy `?token=` removed). Post-lock, any unauthenticated GET
> returns 401. This keeps telemetry data fully private: the dashboard
> (authenticated) is the only way to view what formats are being seen.

## Decision

Use an **opt-in, zero-trust telemetry model**:

1. All file processing stays 100% local (WASM in the browser — no uploads)
2. For **unknown formats**: an opt-in button shares only the first 16 bytes (format header, never image content) via a pre-filled GitHub issue
3. For **successful decodes**: a checkbox + button shares only format metadata (prefix, dimensions, file size) via a pre-filled GitHub issue
4. No automatic telemetry — every share requires explicit user action
5. The WASM decoder is served as static files from GitHub Pages (no backend, no logging)

This follows the pattern established by Squoosh (Google Chrome Labs) — the canonical example of a privacy-preserving WASM tool that collects format conversion metadata without ever seeing file content.

## Research Sources

### 1. Squoosh by Google Chrome Labs

Squoosh's README states: "Squoosh does not send your image to a server. All image compression processes locally." However, it uses Google Analytics to collect format conversion metadata (before/after sizes, codec chosen) — never the pixel content. This demonstrates that format metadata collection is compatible with zero-trust when done transparently.

### 2. ffmpeg.wasm

Explicitly states: "ffmpeg.wasm runs only inside your browser, data security is guaranteed as no data is sent to remote server." Zero telemetry — funded through sponsorships and community feedback. Represents the strictest privacy posture.

### 3. exif.tools

Runs ExifTool 13.42 via WASM (Zeroperl TS runtime). Site states: "Your file is not uploaded to our server. Metadata is analyzed locally in your browser." No Google Analytics, no tracking scripts. Pure zero-telemetry model.

### 4. VS Code Telemetry System

Microsoft's telemetry architecture defines three user-selectable levels (all, error, crash, off). All outgoing events are viewable in real-time via Developer: Show Telemetry command. Enterprise policies can enforce telemetry levels. Represents the gold standard for transparent, user-controlled telemetry.

### 5. Squoosh Privacy Pattern

The key pattern: collect _format conversion metadata_ (input size, output size, codec chosen) without seeing pixel content. The image data never leaves the browser — only anonymous aggregate metrics do. This is the exact model our WASM decoder follows.

## Alternatives Considered

- **Zero telemetry** (ffmpeg.wasm model): Purest privacy but no data to improve format coverage. Rejected because unknown profile detection is a concrete need for expanding the format database.
- **Automatic telemetry with opt-out**: Higher data volume but damages trust. Rejected because forensics/data recovery users are privacy-sensitive and opt-out doesn't meet GDPR standards for non-essential data.
- **Backend proxy** (upload to server): Rejected by design — the entire point of the WASM decoder is zero-trust processing.

## Consequences

Positive:

- Users verify zero-trust by inspecting DevTools Network tab — no data leaves without consent
- Format coverage data arrives as GitHub issues with clear provenance
- GDPR-compliant: opt-in, minimal data, specific purpose
- Trust-building for enterprise buyers evaluating the codec

Negative:

- Low opt-in adoption rate (research shows 5-30% for opt-in models vs 90%+ for opt-out)
- GitHub issue as data channel is manual (no automated dashboard)
- No way to collect data from silent failures

## Y-Statement

> In the context of a WASM-based browser decoder that must never see user file content,
> facing the tradeoff between zero telemetry (pure privacy, no format data) and automatic collection (data volume, trust erosion),
> we decided for **opt-in, metadata-only telemetry via GitHub issues**,
> to achieve format coverage improvement without compromising zero-trust,
> accepting that data volume will be limited by opt-in adoption rates.
