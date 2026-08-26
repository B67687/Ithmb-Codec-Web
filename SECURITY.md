# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.4.x   | :white_check_mark: |
| < 1.4   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue** for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix or mitigation**: Depends on severity, typically within 2 weeks for critical issues

## Security Considerations

This project processes user-uploaded `.ithmb` files entirely in-browser using WebAssembly. Key security properties:

- **No server-side processing**: All decoding happens client-side in the browser
- **No data transmission**: File contents never leave the user's machine (unless the user explicitly opts into the telemetry share)
- **WASM sandbox**: The decoder runs in a WebAssembly sandbox with no access to the filesystem or network
- **Input validation**: The decoder validates file headers and bounds before processing

### Telemetry Worker

The optional telemetry worker (`workers/telemetry/`) collects anonymous usage statistics:

- Raw IP addresses are never stored (HMAC-SHA256 pseudonymization)
- Rate-limited to prevent abuse
- Bearer token authentication on all endpoints
- No personally identifiable information is collected

## Scope

This security policy covers:
- The web application at ithmb-codec.dev
- The WASM decoder module
- The telemetry worker

This policy does NOT cover:
- Third-party dependencies (report upstream)
- The Ithmb-Codec Rust library (separate project)
