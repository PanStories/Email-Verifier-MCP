# ARCHITECTURE.md — email-verifier-mcp

## 1. 技术选型矩阵（打分制）

| 选项 | 评分 | 理由 |
|------|------|------|
| Node + 内置 dns/net | 10 | 零依赖、零费、跨平台 |
| Python + socket | 7 | 可行但 Agent 生态偏 TS MCP |
| 外部验证 API（Hunter/SendGrid） | 2 | 违反"零边际成本"核心 |
| disposable-email-domain 包 | 10 | 160k 域名、MIT、周更、零 API 费 |

## 2. 部署模型
- **stdio（默认）**: `npx email-verifier-mcp` → 子进程，Agent 直连，零配置。Smithery 通过 `commandFunction` 跑 `npx -y email-verifier-mcp`。
- **Hosted HTTP（P2）**: `HOSTED_MODE=1` 起 `node:http` + StreamableHTTPServerTransport（stateless），Bearer 鉴权 + 每 key 限流 + DNS-rebinding 保护。部署到任意 Node 主机（Railway/Fly/自托管 VPS）。Stripe 订阅 → 发放 API key。

## 3. 成本测算
- 运行成本 ≈ $0（DNS 查询免费；Hosted 档吃 Node 主机低配即可，可用 Cloudflare Workers 免费层/自托管）。
- 收入：Free 无限（本地）/ $19·mo（托管档）。每订阅即纯毛利。

## 4. 数据层设计（ADR-003）
- 黑名单随 npm 包加载入内存（~160k 字符串，数 MB），进程级只读。
- Hosted 限流：`Map<token,{count,resetAt}>`，每小时窗口；生产换 Redis。

## 5. 已知坑 C1–C4（见 SPEC §11）
- C1 DNS rebinding（CVE-2025-66414）→ HTTP 模式强制开启保护。
- C2 SMTP 超时 → 分步超时 + 销毁。
- C3 黑名单包模块格式 → 防御性 import。
- C4 ESM `.js` 扩展名 → NodeNext。
