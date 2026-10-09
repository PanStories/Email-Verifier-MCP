# Changelog

All notable changes to `email-verifier-mcp` are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-10-09
### Fixed
- **vitest CVE 清零**：devDependency `vitest` 由 `^2.0.5`(2.1.9) 升级至 `^4.1.11`(4.1.11)，
  修复 `GHSA-5xrq-8626-4rwp`(critical, 需 ≥3.2.6) 与 `GHSA-82fw-gwwq-j7x9`(low, 需 ≥4.1.11)。
  仅测试工具链受影响，运行时不加载 vitest，`npm audit`(含 dev) 现为 0 vulnerabilities。
- **Docker 云构建修复**：`Dockerfile` build stage 固定 `npm@11`，规避 npm 10.x arborist
  `#loadPeerSet` 在 vitest 4 peer deps 上导致的 `npm ci` 退出码 1（本地 Node 24 npm 11.9 正常）。

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
