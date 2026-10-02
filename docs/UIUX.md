# UIUX.md — email-verifier-mcp

## 1. 表面说明 / Surface
本产品无图形界面（Agent-native）。唯一"界面"是 **Agent 可消费的 tool I/O**：
- 结构化：`structuredContent`（机器 JSON，字段稳定）
- 人类可读：`content[].text`（简短多行摘要）

## 2. Design tokens（输出契约）
- 字段命名：`snake_case` 稳定键（`valid`, `score`, `mx_records`, `disposable`…）。
- 错误：返回可读英文短句，**绝不进程崩溃**（AC-08）。
- 合规提示：SMTP 默认关闭，tool 描述明确标注"opt-in / 合规"。

## 3. 组件规格（tool 契约）
- `check_email`：入参 `email` 必填；`smtp`/`checks` 可选。返回 13 字段。
- `verify_bulk`：入参 `emails[]`（1–10）；返回汇总 + 数组。
- `check_mx` / `is_disposable`：单一职责，最小入参。
- `blacklist://stats`：只读资源，JSON。
- `verify_signup_email`：prompt 模板，引导 accept/flag/reject。

## 4. P0 红线清单
- ❌ 不暴露未文档化字段；❌ 不在请求时修改黑名单（human-in-the-loop 只在包更新时）；
- ❌ 默认不连 SMTP；❌ 不返回非 JSON 错误对象。
