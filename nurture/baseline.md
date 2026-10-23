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
## 2026-10-09 weekly refresh (auto-nurture)
- Apify totalRuns: **17**（基线 13，Δ+4）；isPublic=true；taggedBuilds 含 latest ✅；lastRun 2026-10-09
- 有机 tool-call 仍 ≈ 0；收入 ≈ $0（与基线一致，run 多为 standby 自检）
- GitHub stars 0；issues/PR 近 7d = 0
- M8ven: Emerging；**Claim 待老板点击**；README 斜杠 badge → tokenized 验证行已自治修复并 push (commit 01f458b)
- 待办：npm publish 清 npx 404（需 npm token）。

## 2026-10-17 monthly deep refresh (auto-nurture)
- Apify totalRuns 仍为 **17**（与 10-09 一致，无新增有机 run）；lastRun 2026-10-09（standby 自检）；totalUsers=1、7d/30d users=**0**、reviews=**0**、publicActorChargedEventCounts=**None** → **仍零有机使用 / 零收入**。核心矛盾 = 发现度 + npx 断头路，非功能缺陷。
- isPublic=true ✅；taggedBuilds=['latest'] ✅。
- M8ven：**Verified Publisher · Grade B · 89/100**（scored 2026-10-15）。README tokenized 验证行 live ✅（无需修）；trust_audit **FAIL 0 / WARN 1 / PASS 16**（唯一 WARN = 缺可选 `.well-known/m8ven-publisher.txt`，非阻塞）。
- 目录在架：Glama ✅ `PanStories/Email-Verifier-MCP`（4 工具 v1.0.0，被动收录）；Smithery ❌ 404；mcpservers.org ❌ 404；PulseMCP ❌ 404；mcp.so（中文）未收录。
- 竞品盘货：GitHub 专属 email-verification MCP 多为 **API-key 付费 wrapper**（AbstractAPI / MailboxValidator / Byteplant / NoBounce / Truelist / UChecker，stars 普遍 <10）；商业托管竞品 Verifox / Verifly / BillionVerify / verify-email.app / emailverify.io / MailValid 多有免费档但需注册/key。中文市场 email-verification MCP 几乎全是付费 API wrapper → 我方「$0 / 无 key / DNS-only」楔子在中文市场相对独特。
- 决策结论（详见 nurture 报告）：**发现度是头号杠杆**；Top-4 RICE = Smithery 上架 / npm publish（清 npx 404）/ mcpservers.org 提交 / mcp.so 提交；均受外部凭据或「首次对外发帖」约束 → 列待老板拍板。自治修复本轮无必需改动（M8ven badge 行已正确、README npx 已标 🚧 pending）。


## 2026-10-21 B4 refresh (Apify API now available)

> B4 was previously blocked: APIFY_TOKEN empty in automation sandbox. The token now
> resolves via `~/.apify/auth.json` (Apify `/users/me` → HTTP 200), so KPIs re-verified.

- **Actor:** `LhK9VskPkgkSWCPDy` · **Apify totalRuns (live):** **17** (re-verified via `GET /v2/acts/LhK9VskPkgkSWCPDy`)
- **Pricing (live pricingInfos):** PAY_PER_EVENT · tool-call $0.005 (DNS-only, zero upstream cost).
- **M8ven:** README badge tokenized (panstories-email-verifier-mcp-10jylm?variant=verified&v=...) ✅ verified.
- GA4 / npm / mcpservers.org / Smithery remain boss-gated (B3/B5/B6) — see fix-attempt report.


## 2026-10-23 (Fri) weekly-light refresh
- **KPI (Apify totalRuns, live):** **17** (Δ 0 vs 2026-10-21). Flat.
- **GitHub:** 0 stars / 0 open issues / 0 open PRs (public). Flat.
- **M8ven:** README badge tokenized (panstories-email-verifier-mcp-10jylm?variant=verified&v=...) ✅ verified via live raw README curl.
- **Pricing:** no change (tool-call $0.005). Iron Law #4 honored.
- GA4 (B5) / npm-publish (B3, npx still 404) / dirs (B6) remain boss-gated. B2 (Ethics token) now RESOLVED.
