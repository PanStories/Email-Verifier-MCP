# PRD.md — email-verifier-mcp

## 1. 用户画像 / Personas
- **Indie SaaS 开发者**：需要注册环节校验，不愿付 SendGrid/Hunter 按量费。
- **AI Agent 工作流构建者**：在 Cursor/Claude 中嵌入邮箱校验（注册、线索富集、通知）。

## 2. 竞品情报（已联网核实）
- **rumblingb/email-verify-mcp**（@rumblingb）：真实存在，92 npm 周下载，Smithery 上架，Stripe `$19/mo`（Free 50/天 → Pro $19 → Unlimited $99）。功能=语法+MX+SMTP+**仅 27 个 disposable 域名**+角色账号。
  - 差距即机会：① 我们默认 **DNS-only（合规）**，SMTP 改为 opt-in；② 我们用电邮 **160k 域名**黑名单（rumblingb 仅 27）；③ 我们提供 0–100 置信度拆解。
- 结论：**分发杠杆（npm+Smithery）真实有效；产品壁垒在"合规默认 + 更大黑名单 + 置信度"**。

## 3. MVP 范围（RICE，见 SPEC §2）

## 4. 商业化模型
- **OSS + Hosted Convenience**：`npx` 免费、本地无限 DNS 校验。
- **$19/mo 托管档**： warmed/rotating IP 跑 SMTP 握手 + 集中刷新黑名单 + HTTP 端点 + 限流。每订阅即纯毛利（边际成本≈0）。
- 分发：npm（`npx`）→ Smithery（发现）→ Stripe（收款）。

## 5. 决策记录
- **D-A 数据源**: 实时 DNS（Node 内置）+ `disposable-email-domain`（npm 依赖，非付费 API）+ 可选 SMTP 握手。**零第三方 API 费。**
- **D-B 分发托管**: npm 一键装 + Smithery；Hosted 档自建（非 Apify——照搬 rumblingb 流水线）。
- **D-C MVP 范围**: MCP server + 双语 README + smithery.yaml + Stripe 链接。
- **D-D 商业化**: OSS 免费 + $19/mo Hosted Convenience（Stripe 付款链接）。
- **合规默认**: 默认 **DNS-only**；SMTP 握手 opt-in，避免被认定为"扫描"。
