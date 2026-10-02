# SPEC.md — email-verifier-mcp

> Single source of truth. All implementation follows this contract. Changes go in §13.

## 1. 产品定义 / Product Definition

- **一句话 / One-liner**: 纯 DNS 校验的邮件验证 MCP server（RFC 5321 语法 + MX + 一次性邮箱黑名单 + 角色账号识别），零第三方 API 费；SMTP 握手为可选合规增强项。
- **目标用户 / Target users**: 任何带注册/线索采集/通知流的 AI Agent 工作流（Cursor、Claude、Windsurf、Copilot），以及需要嵌入式邮箱校验的 SaaS 开发者。
- **核心问题 / Core problem**: 每个 SaaS 注册环节都需要校验邮箱，但 SendGrid/Hunter 等按量收费。本服务用免费 DNS 查询 + 开源黑名单替代，边际成本为零。

## 2. MVP 范围 / MVP Scope (RICE)

| 优先级 | 功能 | 验收摘要 | RICE |
|------|------|---------|------|
| P0 | `check_email` 工具（DNS-only） | 语法+MX+黑名单+角色；返回结构化 JSON + 文本 | 高 |
| P0 | `verify_bulk`（≤10） | 批量，返回汇总 | 高 |
| P0 | `check_mx` 工具 | 独立 MX 查询 | 中 |
| P0 | `is_disposable` 工具 | 160k 域名黑名单命中 | 高 |
| P0 | `blacklist://stats` 资源 | 黑名单规模与来源 | 低 |
| P1 | `verify_signup_email` prompt | accept/flag/reject 决策模板 | 中 |
| P1 | 可选 SMTP 握手（opt-in） | EHLO/MAIL/RCPT，不发送邮件 | 中 |
| P1 | npx 一键装（stdio） | `npx email-verifier-mcp` 可用 | 高 |
| P1 | Smithery 发布 | `smithery.yaml` 可部署 | 高 |
| P2 | Hosted 模式（HTTP + auth + 限流） | $19/mo 托管档后端 | 中 |

## 3. 明确不做 / Out-of-Scope

| 功能 | 原因 | 何时考虑 |
|------|------|---------|
| 发送测试邮件 | 改变"只读校验"性质，边际成本+合规风险 | 永不（保持零成本/合规） |
| 邮件内容/钓鱼检测 | 超出范围，需 LLM/外部服务 | v2 |
| 自建黑名单爬取 | 已有 `disposable-email-domain` 自动周更 | 永不 |
| 图形仪表盘 | Agent-native，无人类 UI 需求 | 永不 |
| 用户数据库/账户系统 | 由 Stripe 处理订阅，本服务只校验 API key | 托管档 v2 |

## 4. 技术架构 / Tech Stack (pinned)

| 层 | 技术 | 版本 | 锁定理由 |
|----|------|------|---------|
| 运行时 | Node.js | ≥18.17 (LTS 20/22 推荐) | `dns.promises` / `node:net` 内置，零外部依赖 |
| 语言 | TypeScript | ^5.6.3 | 类型安全，SDK 原生 |
| MCP SDK | @modelcontextprotocol/sdk | ^1.25.1 | ≥1.24.0 修复 CVE-2025-66414（DNS rebinding） |
| 校验 | zod | ^3.23.8 | 工具入参校验，SDK peer |
| 黑名单 | disposable-email-domain | ^1.0.79 | 160k 域名、MIT、周更、零依赖、零 API 费 |
| 测试 | vitest | ^2.1.4 | 单测 + 逻辑 |
| 开发运行 | tsx | ^4.19.2 | 免构建热跑 |
| HTTP（托管档） | node:http 内置 | — | 避免 Express 依赖，零外部依赖 |

## 5. API 端点清单 / MCP Surface

**Tools**
- `check_email(email: string, smtp?: boolean, checks?: CheckName[])` → `{valid, score, reason, checks_passed[], mx_records[], smtp_*, disposable, role_account, confidence_breakdown}`
- `verify_bulk(emails: string[], smtp?: boolean)` → `{total, valid, disposable, results[]}`
- `check_mx(domain: string)` → `{domain, has_mx, mx_records[]}`
- `is_disposable(input: string)` → `{input, disposable, role_account}`

**Resources**
- `blacklist://stats` → 黑名单规模 + 来源 JSON

**Prompts**
- `verify_signup_email(email: string)` → accept/flag/reject 决策模板

## 6. 数据库/存储

无持久化。黑名单随 npm 包加载进内存（~160k 字符串，约数 MB）。Hosted 档限流计数用内存 Map（MVP；生产换 Redis）。

## 7. 页面清单

无页面（Agent-native）。仅 README（双语）作为分发落地页。

## 8. Design tokens 摘要

无 GUI。Agent-facing 输出约定：tool 返回 `content`（人类可读文本）+ `structuredContent`（机器 JSON）。错误以可读英文短句返回，绝不 crash server。

## 9. 验收标准 / Acceptance (EARS)

- **AC-01 (P0)**: 当 `check_email` 收到非法语法，则 `valid=false` 且 `reason` 含 "syntax"。
- **AC-02 (P0)**: 当域名有 MX，则 `mx_records` 非空且按优先级排序。
- **AC-03 (P0)**: 当输入 `*.@mailinator.com`，则 `disposable=true`。
- **AC-04 (P0)**: 默认（不传 `smtp`）不得发起任何出站 SMTP 连接（合规）。
- **AC-05 (P1)**: 当 `smtp=true` 且 MX 可达，则 `smtp_reachable=true` 并返回响应码。
- **AC-06 (P1)**: 当 `npx email-verifier-mcp` 以 stdio 启动，则 MCP `initialize` 成功列出 4 工具 + 1 资源 + 1 prompt。
- **AC-07 (P2)**: 当 Hosted 模式收到无 Bearer token 请求，则 401；超额则 429。
- **AC-08 (P0)**: 任何工具异常必须返回错误文本而非进程退出。

## 10. 边界与约束

- DNS 查询受本地 resolver / 网络影响；失败按"无 MX"处理，不抛。
- SMTP 握手可能被判为 scanning；仅 opt-in，且 Hosted 档用托管方受控 IP。
- 部分邮件服务器对 RCPT TO 一律返回 250（防探测）→ `smtp_likely_valid` 可能为空，需诚实呈现。

## 11. 内嵌已知坑 / Pitfalls

- **C1 — DNS rebinding (CVE-2025-66414)**: HTTP 模式必须 `enableDnsRebindingProtection:true` + `allowedHosts`/`allowedOrigins`。SDK <1.24.0 默认关闭。
- **C2 — SMTP 超时卡死**: 每个步骤独立超时（连 7s / 步 5s），`finally` 中 `socket.destroy()`，失败降级为 `reachable=false`。
- **C3 — 黑名单包模块格式**: `disposable-email-domain` 导入做防御性兜底（`isDisposable ?? default?.isDisposable`）。
- **C4 — ESM `.js` 扩展名**: `tsconfig` 用 `NodeNext`，所有相对 import 必须带 `.js`。

## 12. 端到端验证 / E2E

```bash
# 0) 安装依赖 + 构建
npm install
npm run build

# 1) 单元/逻辑测试（含纯函数 + 离线安全项）
npm test

# 2) 真实 DNS 演示（无需 install，仅 Node 内置）
npm run showcase          # 生成 verify-showcase.html（真实 MX 负载）

# 3) stdio 自检：用 MCP  inspector 起服务
npx @modelcontextprotocol/inspector node dist/index.js

# 4) 一次真实调用（通过 inspector 或客户端）期望：
#    check_email("alice@gmail.com") -> valid=true, score>0, mx_records 非空
#    check_email("x@mailinator.com") -> disposable=true, valid=false
#    check_email("bad@@")            -> valid=false, reason 含 syntax
```

## 13. 变更记录 / Changelog

| 日期 | 变更 | 决策人 |
|------|------|--------|
| 2026-10-02 | v1.0.0 初版：4 工具 + 1 资源 + 1 prompt，DNS-only 默认，SMTP opt-in，npx + Smithery + Hosted 模式 | 老板 / Wiwi |
