# Email Verifier MCP

> **Verify email addresses without paying a per-lookup API fee.** RFC 5321 syntax, MX records, a 182,000-domain disposable blacklist and role-account detection — all from free DNS. SMTP handshake is opt-in and off by default.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-blue)
![Transport](https://img.shields.io/badge/Transport-stdio%20%2B%20HTTP-green)

🌐 **[English](#english)** · **[简体中文](#简体中文)** · **[繁體中文](#繁體中文)**

| It lives at | Link |
|---|---|
| MCP endpoint | `https://neeenja--email-verifier-mcp.apify.actor/mcp` |
| Apify Store | https://apify.com/neeenja/email-verifier-mcp |
| Source code | https://github.com/PanStories/Email-Verifier-MCP |
| One-line install | `npx -y email-verifier-mcp` |
| Featured on | [Sartbot Featured](https://sartbot.com/) |

---

<a id="english"></a>
# English

## What you get

Every product with a signup form needs to know whether an email is real. The usual answer is a paid API — SendGrid, Hunter, ZeroBounce — billed per lookup. This server does the checks that actually catch bad signups using **free DNS queries and an open-source blocklist**, so the marginal cost is zero.

It is built agent-native: one `npx` command and your agent can verify an address itself. No dashboard, no account, no API key.

| | |
|---|---|
| **Checks** | RFC 5321 syntax · MX record · 182,000+ disposable domains · role accounts · optional SMTP handshake |
| **Cost** | $0 per lookup. No third-party API, no key, no quota |
| **Compliance** | DNS-only by default — no outbound SMTP unless you opt in |
| **Transparency** | Every check scored separately, so you can see *why* an address passed |

## Tools

| Tool | What it does |
|---|---|
| `check_email` | Full check on one address: syntax + MX + disposable + role, optional SMTP. Returns a human summary **and** structured JSON. |
| `verify_bulk` | Same checks for up to 10 addresses at once, plus a summary line. |
| `check_mx` | Standalone MX lookup, sorted by priority. |
| `is_disposable` | Is this address or domain a throwaway provider? Accepts `user@mailinator.com` or `mailinator.com`. |

Also exposed: resource `blacklist://stats` (blocklist size and source) and prompt `verify_signup_email` (an accept / flag / reject decision template).

### Example

```jsonc
// request
{ "email": "someone@gmail.com" }

// response (structured)
{
  "email": "someone@gmail.com",
  "valid": true,
  "score": 80,
  "reason": "DNS checks passed",
  "checks_passed": ["syntax", "mx", "blacklist", "role"],
  "mx_records": [{ "priority": 10, "exchange": "gmail-smtp-in.l.google.com" }],
  "disposable": false,
  "role_account": false
}
```

### Confidence score

The score is additive and fully explainable — no black box.

| Check | Points | Note |
|---|---|---|
| Syntax | 20 | RFC 5321 / HTML5-flavoured pattern |
| MX record exists | 30 | Domain actually accepts mail |
| Not disposable | 20 | Against the 182k-domain list |
| Not a role account | 10 | `support@`, `noreply@`, … are flagged, not failed |
| SMTP reachable | 10 | Only when the handshake is enabled |
| SMTP confirms mailbox | 10 | Only when the handshake is enabled |

**80/100 means every DNS check passed.** The last 20 points require the optional SMTP handshake, which is off by default. `valid` is a separate boolean: it is true only when syntax passes, an MX record exists, and the domain is not disposable.

## Connect

**Option A — local, via `npx` (free, unlimited).** Runs as a stdio subprocess inside your own agent:

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "command": "npx",
      "args": ["-y", "email-verifier-mcp"]
    }
  }
}
```

**Option B — hosted endpoint on Apify.** Use it from anywhere, including agents that cannot spawn subprocesses:

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "type": "streamable-http",
      "url": "https://neeenja--email-verifier-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer <YOUR_APIFY_TOKEN>" }
    }
  }
}
```

Works with Claude Desktop, Cursor, Windsurf, GitHub Copilot, and any other MCP client.

## Compliance

Default verification is **DNS-only** — it never opens an outbound SMTP connection, so it cannot be mistaken for port-25 scanning.

The SMTP handshake is **opt-in** (`smtp: true`) and should only be enabled from infrastructure you control. Some mail providers treat unsolicited SMTP probes as abuse, and many return `250` to every `RCPT TO` specifically to defeat probing — so `smtp_likely_valid` is reported honestly as `null` when the answer is inconclusive rather than guessed.

## Pricing

| | |
|---|---|
| `initialize` / `tools/list` | Free — agents can always connect and discover |
| Any tool call | **$0.005** on the hosted Apify endpoint |
| Self-hosted via `npx` | Free and unlimited — the source is MIT |

The hosted endpoint is pay-per-event: no subscription, no minimum. Running it locally with `npx` costs nothing.

## Development

```bash
npm install
npm run build        # tsc -> dist/
npm test             # unit tests
npm run e2e          # stdio end-to-end (initialize -> tools/list -> tools/call)
npm run e2e:http     # HTTP end-to-end (readiness probe + full protocol)
npm run showcase     # real-DNS demo -> verify-showcase.html
```

## License

MIT. The disposable-domain list comes from [`disposable-email-domain`](https://www.npmjs.com/package/disposable-email-domain) (MIT, refreshed weekly).

---

<a id="简体中文"></a>
# 简体中文

## 你能得到什么

任何带注册环节的产品都要判断邮箱是不是真的。常见方案是付费 API —— SendGrid、Hunter、ZeroBounce 按次计费。本服务用**免费 DNS 查询 + 开源黑名单**完成真正有效的检查，边际成本为零。

它面向 Agent 设计：一条 `npx` 命令，Agent 就能自己校验邮箱。不需要仪表盘、不需要账号、不需要 API key。

| | |
|---|---|
| **检查项** | RFC 5321 语法 · MX 记录 · 18.2 万个一次性域名 · 角色账号 · 可选 SMTP 握手 |
| **成本** | 每次查询 $0。无第三方 API、无密钥、无配额 |
| **合规** | 默认仅 DNS —— 不主动发起出站 SMTP，除非你显式开启 |
| **可解释** | 每项检查单独计分，能看清地址为什么通过 |

## 工具

| 工具 | 作用 |
|---|---|
| `check_email` | 单个地址全量校验：语法 + MX + 一次性域名 + 角色账号，可选 SMTP。同时返回人类可读摘要与结构化 JSON。 |
| `verify_bulk` | 最多 10 个地址批量校验，并给出汇总。 |
| `check_mx` | 独立 MX 查询，按优先级排序。 |
| `is_disposable` | 判断地址或域名是否为临时邮箱。支持 `user@mailinator.com` 或 `mailinator.com`。 |

另外还提供资源 `blacklist://stats`（黑名单规模与来源）与提示词 `verify_signup_email`（接受 / 标记 / 拒绝的决策模板）。

### 示例

```jsonc
// 请求
{ "email": "someone@gmail.com" }

// 响应（结构化）
{
  "email": "someone@gmail.com",
  "valid": true,
  "score": 80,
  "reason": "DNS checks passed",
  "checks_passed": ["syntax", "mx", "blacklist", "role"],
  "mx_records": [{ "priority": 10, "exchange": "gmail-smtp-in.l.google.com" }],
  "disposable": false,
  "role_account": false
}
```

### 置信度评分

评分是累加式的，完全可解释，不是黑盒。

| 检查项 | 分值 | 说明 |
|---|---|---|
| 语法 | 20 | RFC 5321 / HTML5 风格匹配 |
| MX 记录存在 | 30 | 域名确实能收信 |
| 非一次性域名 | 20 | 基于 18.2 万域名黑名单 |
| 非角色账号 | 10 | `support@`、`noreply@` 等只标记，不判失败 |
| SMTP 可达 | 10 | 仅当开启握手 |
| SMTP 确认邮箱存在 | 10 | 仅当开启握手 |

**80/100 代表所有 DNS 检查全部通过。** 最后 20 分需要可选的 SMTP 握手，而它默认是关闭的。`valid` 是独立的布尔值：只有语法通过、MX 存在、且非一次性域名时才为 true。

## 连接方式

**方式 A —— 本地 `npx`（免费、无限次）**。在你的 Agent 进程内以 stdio 子进程运行：

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "command": "npx",
      "args": ["-y", "email-verifier-mcp"]
    }
  }
}
```

**方式 B —— Apify 托管端点**。任何地方都能调用，包括无法启动子进程的 Agent：

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "type": "streamable-http",
      "url": "https://neeenja--email-verifier-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer <YOUR_APIFY_TOKEN>" }
    }
  }
}
```

兼容 Claude Desktop、Cursor、Windsurf、GitHub Copilot 及任何其他 MCP 客户端。

## 合规说明

默认校验**仅使用 DNS** —— 不建立任何出站 SMTP 连接，因此不会被误判为 25 端口扫描。

SMTP 握手是**可选开启**的（`smtp: true`），只应在你能掌控的基础设施上启用。部分邮件服务商会把未经请求的 SMTP 探测视为滥用，且很多服务会对所有 `RCPT TO` 一律返回 `250` 来反探测 —— 因此当结论不明确时，`smtp_likely_valid` 会诚实地返回 `null`，而不是猜一个结果。

## 定价

| | |
|---|---|
| `initialize` / `tools/list` | 免费 —— Agent 永远能连上并发现工具 |
| 任意工具调用 | 托管 Apify 端点 **$0.005** |
| `npx` 自托管 | 免费且无限次 —— 源码为 MIT 许可 |

托管端点按次计费：无订阅、无最低消费。本地用 `npx` 运行不产生任何费用。

## 本地开发

```bash
npm install
npm run build        # tsc -> dist/
npm test             # 单元测试
npm run e2e          # stdio 端到端（initialize -> tools/list -> tools/call）
npm run e2e:http     # HTTP 端到端（就绪探针 + 完整协议）
npm run showcase     # 真实 DNS 演示 -> verify-showcase.html
```

## 许可

MIT。一次性域名列表来自 [`disposable-email-domain`](https://www.npmjs.com/package/disposable-email-domain)（MIT，每周更新）。

---

<a id="繁體中文"></a>
# 繁體中文

## 你能得到什麼

任何帶註冊環節的產品都要判斷信箱是不是真的。常見做法是付費 API —— SendGrid、Hunter、ZeroBounce 按次計費。本服務用**免費 DNS 查詢 + 開源黑名單**完成真正有效的檢查，邊際成本為零。

它為 Agent 而生：一條 `npx` 指令，Agent 就能自己驗證信箱。不需要儀表板、不需要帳號、不需要 API key。

| | |
|---|---|
| **檢查項目** | RFC 5321 語法 · MX 紀錄 · 18.2 萬個一次性網域 · 角色帳號 · 可選 SMTP 握手 |
| **成本** | 每次查詢 $0。無第三方 API、無金鑰、無配額 |
| **合規** | 預設僅 DNS —— 不主動發起出站 SMTP，除非你明確開啟 |
| **可解釋** | 每個檢查項目單獨計分，能看清地址為什麼通過 |

## 工具

| 工具 | 作用 |
|---|---|
| `check_email` | 單一地址完整驗證：語法 + MX + 一次性網域 + 角色帳號，可選 SMTP。同時回傳人類可讀摘要與結構化 JSON。 |
| `verify_bulk` | 最多 10 個地址批次驗證，並提供彙整。 |
| `check_mx` | 獨立 MX 查詢，依優先級排序。 |
| `is_disposable` | 判斷地址或網域是否為拋棄式信箱。支援 `user@mailinator.com` 或 `mailinator.com`。 |

另外提供資源 `blacklist://stats`（黑名單規模與來源）與提示詞 `verify_signup_email`（接受 / 標記 / 拒絕的決策範本）。

### 範例

```jsonc
// 請求
{ "email": "someone@gmail.com" }

// 回應（結構化）
{
  "email": "someone@gmail.com",
  "valid": true,
  "score": 80,
  "reason": "DNS checks passed",
  "checks_passed": ["syntax", "mx", "blacklist", "role"],
  "mx_records": [{ "priority": 10, "exchange": "gmail-smtp-in.l.google.com" }],
  "disposable": false,
  "role_account": false
}
```

### 信心分數

分數採累加式，完全可解釋，不是黑盒子。

| 檢查項目 | 分數 | 說明 |
|---|---|---|
| 語法 | 20 | RFC 5321 / HTML5 風格比對 |
| MX 紀錄存在 | 30 | 網域確實能收信 |
| 非一次性網域 | 20 | 依 18.2 萬網域黑名單 |
| 非角色帳號 | 10 | `support@`、`noreply@` 等僅標記，不判失敗 |
| SMTP 可連線 | 10 | 僅在開啟握手時 |
| SMTP 確認信箱存在 | 10 | 僅在開啟握手時 |

**80/100 代表所有 DNS 檢查全數通過。** 最後 20 分需要可選的 SMTP 握手，而它預設關閉。`valid` 是獨立的布林值：只有語法通過、MX 存在、且非一次性網域時才為 true。

## 連線方式

**方式 A —— 本機 `npx`（免費、無限量）**。在你的 Agent 行程內以 stdio 子行程執行：

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "command": "npx",
      "args": ["-y", "email-verifier-mcp"]
    }
  }
}
```

**方式 B —— Apify 託管端點**。任何地方都能呼叫，包含無法啟動子行程的 Agent：

```json
{
  "mcpServers": {
    "email-verifier-mcp": {
      "type": "streamable-http",
      "url": "https://neeenja--email-verifier-mcp.apify.actor/mcp",
      "headers": { "Authorization": "Bearer <YOUR_APIFY_TOKEN>" }
    }
  }
}
```

相容 Claude Desktop、Cursor、Windsurf、GitHub Copilot 以及任何其他 MCP 用戶端。

## 合規說明

預設驗證**僅使用 DNS** —— 不建立任何出站 SMTP 連線，因此不會被誤判為 25 埠掃描。

SMTP 握手是**可選開啟**的（`smtp: true`），只應在你能掌控的基礎設施上啟用。部分郵件服務商會把未經請求的 SMTP 探測視為濫用，且許多服務會對所有 `RCPT TO` 一律回應 `250` 來反制探測 —— 因此當結論不明確時，`smtp_likely_valid` 會誠實回傳 `null`，而不是猜測結果。

## 定價

| | |
|---|---|
| `initialize` / `tools/list` | 免費 —— Agent 永遠能連上並探索工具 |
| 任何工具呼叫 | 託管 Apify 端點 **$0.005** |
| `npx` 自託管 | 免費且無限量 —— 原始碼採 MIT 授權 |

託管端點按次計費：無訂閱、無最低消費。本機以 `npx` 執行不會產生任何費用。

## 本機開發

```bash
npm install
npm run build        # tsc -> dist/
npm test             # 單元測試
npm run e2e          # stdio 端到端（initialize -> tools/list -> tools/call）
npm run e2e:http     # HTTP 端到端（就緒探針 + 完整協定）
npm run showcase     # 真實 DNS 展示 -> verify-showcase.html
```

## 授權

MIT。一次性網域清單來自 [`disposable-email-domain`](https://www.npmjs.com/package/disposable-email-domain)（MIT，每週更新）。
