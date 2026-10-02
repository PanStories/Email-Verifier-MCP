# Changelog

All notable changes to `email-verifier-mcp` are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-10-02
### Added
- `check_email` tool: DNS-based single-email verification (RFC 5321 syntax, MX lookup, disposable + role-account detection). Optional opt-in SMTP handshake.
- `verify_bulk` tool: batch verification of up to 10 emails.
- `check_mx` tool: standalone MX-record lookup.
- `is_disposable` tool: disposable / throwaway domain blacklist check.
- `blacklist://stats` resource: loaded disposable-domain blacklist size + source.
- `verify_signup_email` prompt: reusable accept/reject decision template for signup flows.
- Hosted mode (`HOSTED_MODE=1`): Streamable HTTP transport with Bearer auth, per-key rate limiting, and DNS-rebinding protection (mitigates CVE-2025-66414).
- Smithery `smithery.yaml` for one-command discovery.
- Bilingual README (中文 / English).

### Compliance note
Default verification is **DNS-only** (no outbound SMTP). SMTP handshake is opt-in and documented as potentially subject to recipient-server anti-scanning policies; it must be enabled only from infrastructure the operator controls. This keeps the default distribution compliant.
