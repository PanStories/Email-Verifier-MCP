# Privacy Policy

**Product:** Email Verifier MCP (MCP server)
**Operator:** PanStories
**Repository:** https://github.com/PanStories/Email-Verifier-MCP
**Last updated:** 2026-10-09
**Effective date:** 2026-10-09

This policy explains what data Email Verifier MCP ("the Service", "we") processes when
you connect to it as a Model Context Protocol (MCP) server — via the hosted endpoint or
a self-hosted build — and what we deliberately do **not** collect.

> **Note:** This tool validates email addresses. If the addresses you submit belong to
> other people, **you** are responsible for having a lawful basis to process them. Only
> submit addresses you are permitted to verify.

---

## 1. Summary (TL;DR)

- The Service is a **read-only** MCP server. It performs DNS/format checks and, when you
  explicitly enable it, an SMTP handshake. It never sends email and never modifies
  anything.
- **No accounts, no sign-up, no cookies, no advertising or analytics trackers.**
- We do **not** sell, rent, or share your data with advertisers or data brokers.
- The inputs you submit — **email addresses and domains** — are processed **in memory,
  per request, and are not stored**. We do not persist your lists.
- The optional **SMTP handshake** connects to the recipient's mail server; that server
  will see the IP address of the host running the check (see Section 4).
- Hosting is provided by **Apify**; platform-level processing is governed by Apify's own
  privacy policy.

---

## 2. Data we process

| Data | Source | Why we process it | Retention |
|---|---|---|---|
| Email address(es) to verify | You | Syntax check, MX lookup, disposable/role detection, optional SMTP handshake | In memory for the duration of the request only — **not stored** |
| Domain / input string | You | MX and domain-level checks | Request duration only |
| IP address + User-Agent | Your request | Transient rate-limiting only | In-memory window; not persisted, not logged to disk |
| Apify API token | Apify gateway | Authenticates the caller at the platform edge | Not seen or stored by the Service |

We do **not** write submitted addresses to any dataset, database, or log.

## 3. What we do NOT collect

- No names, phone numbers, or other personal identifiers beyond the address you submit.
- No accounts, passwords, or credentials.
- No persistent store of submitted email lists or verification results.
- No cookies, analytics, pixels, or advertising trackers.

## 4. Third parties / data recipients — important

To validate an address, some checks necessarily involve third parties:

| Recipient | Purpose | What they see | Notes |
|---|---|---|---|
| **Public DNS resolvers** | Look up MX records for the domain | The domain being queried | Standard DNS resolution |
| **The recipient's mail server (SMTP handshake)** | Opt-in reachability probe (`EHLO → MAIL FROM → RCPT TO`) on port 25. **No email is sent.** | The **IP address** of the host performing the check | This check is **off by default**. It can reveal that a verification is taking place to the mail-server operator. |
| **Apify** (hosting) | Runs the Standby container and meters usage | Request metadata | Subject to Apify's privacy policy |

One-time-email / disposable-domain detection uses a **locally bundled** blacklist; no
address is sent to any blacklist provider. We do not disclose your inputs to any other
third party.

## 5. Hosting and infrastructure

The hosted Service runs on Apify's Standby infrastructure. Apify may process operational
metadata (timestamps, IP, billing records) as an independent controller. See
<https://apify.com/privacy-policy>. The Service runs no database and keeps no persistent
store of user data.

## 6. Self-hosted / open-source builds

This repository is open source (MIT). When you self-host, **you** are the data controller
for anything your deployment processes — including the IP address disclosed by the SMTP
handshake, which will be your host's IP. The code ships with no telemetry that reports
back to us.

## 7. Security

Transport is encrypted (TLS) at the Apify edge. All requests require the Apify gateway
bearer token. See [`SECURITY.md`](./SECURITY.md) for the threat model and vulnerability
reporting.

## 8. Children's privacy

The Service is a developer tool not directed at children, and we do not knowingly process
data from children under 16.

## 9. Your rights

Because we do not store submitted addresses or maintain user profiles, there is generally
no personal data to access, correct, or erase. If you believe we hold data about you,
contact us (Section 11) and we will respond within 30 days.

## 10. Changes to this policy

We may update this policy as the Service evolves. Material changes will be reflected in
the "Last updated" date and, where appropriate, in the repository changelog.

## 11. Contact

Privacy questions or requests:
**Open an issue** at <https://github.com/PanStories/Email-Verifier-MCP/issues>.
For security matters, see [`SECURITY.md`](./SECURITY.md).

---

## 简体中文

**产品：** Email Verifier MCP — 基于 DNS 的邮箱校验 MCP server
**运营方：** PanStories
**最后更新：** 2026-10-09

> **提示：** 本工具用于校验邮箱地址。若你提交的是他人邮箱，**你**须自行确保具备合法处理依据；
> 请仅提交你有权校验的地址。

### 概要

- 本服务是**只读** MCP server，执行语法/DNS 校验，并可在你显式开启时执行 SMTP 握手；
  从不发信，也不修改任何东西。
- **无账号、无注册、无 Cookie、无广告或分析追踪。**
- 我们**不会**向广告商或数据经纪商出售、出租或共享你的数据。
- 你提交的输入——**邮箱地址与域名**——**仅在内存中按请求处理，不予存储**，不会持久化你的名单。
- 可选的 **SMTP 握手**会连接收件方邮件服务器；该服务器将看到执行校验主机的 IP（见下文）。

### 我们处理的数据

| 数据 | 来源 | 用途 | 保留 |
|---|---|---|---|
| 待校验邮箱地址 | 调用方 | 语法校验、MX 查询、一次性/角色邮箱识别、可选 SMTP 握手 | 仅请求期间驻留内存——**不存储** |
| 域名 / 输入串 | 调用方 | MX 与域名级校验 | 仅请求期间 |
| IP + User-Agent | 请求 | 仅用于限流 | 内存窗口，不落盘 |

### 第三方（重要）

- **公共 DNS 解析器**：查询域名 MX 记录，只看到被查询的域名。
- **收件方邮件服务器（SMTP 握手）**：可选的端口 25 探测（`EHLO → MAIL FROM → RCPT TO`），
  **不发送任何邮件**；对方将看到校验主机的 **IP 地址**。该检查**默认关闭**。
- **Apify**（托管）：运行 Standby 容器并计量。

一次性邮箱识别使用**本地内置**黑名单，不向任何黑名单服务发送地址。

### 自托管

本仓库为开源（MIT）。自托管时**你**即数据处理的控制者——包括 SMTP 握手所暴露的 IP
（将是你主机的 IP）。代码不含任何回传遥测。

### 联系方式

在 <https://github.com/PanStories/Email-Verifier-MCP/issues> 提交 issue。
安全事项见 [`SECURITY.md`](./SECURITY.md)。
