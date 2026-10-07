# Email Verifier MCP — KPI Baseline (2026-10-07)

> Baseline captured before any nurture action. Without this, Stage 4 decisions
> cannot be proven effective later. All numbers pulled live from Apify API +
> channel HTTP checks on 2026-10-07.

## Usage (the uncomfortable truth)

| Metric | Value | Source / confidence |
|---|---|---|
| Lifetime since launch | 2026-10-02 (~5 days) | Apify actor createdAt |
| Total runs ever | 13 | Apify runs API 🟢 |
| Runs in last 7-day retention window | 13 (all from 2026-10-04) | Apify runs API 🟢 |
| Run status distribution | 13 × SUCCEEDED | Apify runs API 🟢 |
| **Organic (user) tool calls** | **0** | all 13 runs are standby warm-up (`chargedEventCounts: {"tool-call":0}`) 🟢 |
| Owner's own paid test calls | 1 (`tool-call:1`) on 2026-10-03 | prior audit; **now purged** by 7-day retention 🟡 |
| PPE revenue to date | ≈ $0.005 (1 call), effectively $0 | derived 🟡 |
| GitHub stars / issues | 0 / 0 | github API 🟢 |

**Conclusion:** This is a textbook "不温不火 / not yet discovered" nurture target.
There is no usage problem to fix — there is a **discovery + broken-install-promise**
problem. The only signal we have is our own audit, not user feedback.

## Channel health (all live)

| Channel | Status | Check |
|---|---|---|
| Apify Store | ✅ 200, isPublic=true | curl 2026-10-07 🟢 |
| Sartbot detail | ✅ 200, featured | curl 2026-10-07 🟢 |
| MCP endpoint (no token) | ✅ 401 (alive) | curl POST 2026-10-07 🟢 |
| npm `email-verifier-mcp` | 🔴 404 — never published | registry.npmjs.org 2026-10-07 🟢 |
| Smithery | 🔴 308 (not listed) | curl 2026-10-07 🟢 |
| Glama | 🟡 301 (unconfirmed) | curl 2026-10-07 🟢 |

## Technical integrity (passed)

| Check | Result |
|---|---|
| Build (`npm run build`) | ✅ exit 0, 11 files in dist/ |
| npm tarball (`npm pack --dry-run`) | ✅ 18.5 kB, 11 files |
| README trilingual (EN→简→繁, `<a id="english">`) | ✅ |
| Blocklist claim "182,000" | ✅ verified = 182,216 domains |
| Repo visibility | ✅ public (GitHub link in README is valid, not a dead link) |
| Standby config | ✅ SINGLE_TENANT / 120s / 512MB / maxReq 4 (consistent w/ siblings) |
| PPE billing | ✅ confirmed working in prior audit |

## One broken promise (highest-priority fix)

README line 16 advertises `npx -y email-verifier-mcp` as the one-line install,
but the npm package does not exist (404). This:
1. Breaks the core "free, unlimited self-host" wedge that differentiates us from
   paid-API competitors (AgentPay's `email-verify-mcp` wraps a paid upstream).
2. Is a credibility hit — anyone who copies the headline install gets a 404.

`npm publish` is blocked only by missing npm auth (`npm whoami` → ENEEDAUTH).
