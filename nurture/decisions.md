# Email Verifier MCP — Nurture Decisions (Stage 4)

RICE = Reach × Impact × Confidence ÷ Effort (each 1–3; higher Effort = lower score).
Evidence marked 🟢 live / 🟡 official doc / 🔴 second-hand.

## Stage 1 — Market signals (12-route condensed)

| Signal | Evidence | Confidence |
|---|---|---|
| Every signup/CRM/agent flow needs email verification; ~10% of signups use disposable | trashbox.email / 15minutemail guides 2026 🟡 | 🟢 |
| Paid APIs charge $0.003–0.008/email; cheapest = MillionVerifier $0.0005, DeBounce ~$0.0009–0.002/1k | guideflow / growthhacksuite pricing 2026-06 🟡 | 🟢 |
| MCP-verifier competitors exist: AgentPay `email-verify-mcp` (wraps PAID API, key-held, Stripe, npm 29/wk, Smithery 11, $0 rev), Verifly (key + 100 free credits, SPF/DMARC domain-health, bulk async), BounceBuster ($19 one-time local) | dev.to / socket.dev / bouncebuster.app 2026 🟢 | 🟢 |
| **Our real differentiator = $0 marginal cost, no third-party API, DNS-only by default** — AgentPay depends on a paid upstream | README + dep audit 🟢 | 🟢 |
| Hosted price $0.005/lookup ($5/1k) is actually pricier than dedicated per-email verifiers → lead with FREE self-host, not "cheaper than paid API" | pricing comparison 🟢 | 🟢 |
| Open-source verifiers add `/llms.txt` + MCP tool discovery for agent discovery (throwaway/sslboard) | github sslboard/throwaway 🟢 | 🟢 |

## Stage 2 — Competitor teardown (must-run, not README)

| Competitor | Tools | Free? | Key needed | Wedge they have | Our counter-wedge |
|---|---|---|---|---|---|
| AgentPay `email-verify-mcp` | 1 (`verify_email`) | No (paid upstream) | Yes (server-held) | Stripe billing | **Free DNS, no key, no upstream cost** |
| Verifly | 8+ (verify/batch/clean/extract/domain-health/bulk) | 100 free credits | Yes (`vf_`) | SPF/DMARC domain health, list cleaning | Free self-host, DNS-only compliance, no account |
| BounceBuster | format+DNS+MX | $19 one-time | No | Local unlimited | **Our self-host is free (if npm published)** |
| throwaway (sslboard) | JSON API + MCP discovery | Yes (no-auth) | No | /llms.txt agent discovery | Match with our own /llms.txt |

## Stage 3 — Feedback mining

No user feedback exists (0 organic calls, 0 stars, 0 issues). The only pain is
**discoverability + the broken `npx` promise** (our own audit). No RICE item is
driven by ≥3 independent user complaints — all are proactive positioning.

## Stage 4 — Four-category decisions (RICE-ranked)

### A. Features / technical
| # | Action | RICE | Notes |
|---|---|---|---|
| A1 | **Publish `email-verifier-mcp` to npm** (fix broken `npx`) | **27** | Build ✅, tarball ✅, only blocked by npm auth. Unlocks core free wedge. |
| A2 | Add `check_domain_health` (SPF/DMARC via free DNS TXT) | 4 | Matches Verifly; still DNS-only, free. Medium effort. |
| A3 | Catch-all domain detection (MX heuristic) | 4 | Flags "valid but risky" domains. |
| A4 | Add `/llms.txt` to project + Sartbot for agent discovery | **12** | throwaway does this; cheap GEO win. |

### B. Monetization
| # | Action | RICE | Notes |
|---|---|---|---|
| B1 | Keep Apify PPE $0.005 (convenience premium) | — | Do NOT lower (near-zero volume; margin matters). |
| B2 | Fix pricing NARRATIVE → lead with free self-host | 8 | README/Store/Sartbot say "free self-host", not "cheaper than paid API". |
| B3 | Sartbot Spotlight $49 | 3 | Defer — no usage yet, low ROI. |

### C. Promotion
| # | Action | RICE | Notes |
|---|---|---|---|
| C1 | **Smithery submit** (currently 308, not listed) | **27** | Key MCP discovery channel. |
| C2 | **Glama verify/ensure listing** (301 seen) | 8 | Public repo → likely auto-index; confirm + claim. |
| C3 | dev.to + 中文 (掘金/V2EX) post: free DNS email MCP | 4 | "no API key, self-host free" angle. |
| C4 | X post | 4 | Low-med reach. |

### D. Pricing
| # | Action | RICE | Notes |
|---|---|---|---|
| D1 | No price change. Keep $0.005. | — | Boss 拍板 required for any price move; none proposed. |

## Top-4 for boss 拍板 (by RICE)

1. **A1 — npm publish** (unblocks the broken headline install + free wedge)
2. **C1 — Smithery submit** (get into the #1 MCP discovery directory)
3. **A4 — `/llms.txt`** (agent-discovery parity with throwaway)
4. **C2 — Glama listing** (confirm/claim the auto-indexed page)

Secondary: A2/A3 feature additions, C3/C4 posts, B2 narrative fix.

## 待老板拍板清单 (external actions need OK)

- [ ] **A1**: `npm login` / provide npm token → `npm publish` (needs your npm auth)
- [ ] **C1**: Smithery deploy (`smithery login` + `smithery deploy`, needs Smithery account)
- [ ] **A4 + C2**: add `/llms.txt`, verify Glama, then Sartbot redeploy (explicit `wrangler deploy`)
- [ ] **B2**: approve README/Store/Sartbot copy change (lead with free self-host)

## First-week actions (concrete)

```bash
# A1 (after npm auth)
cd email-verifier-mcp && npm run build && npm publish

# A4
# add llms.txt at repo root + Sartbot detail page

# C1 (after Smithery auth)
npm run smithery:login && npm run smithery:deploy

# C2
# open https://glama.ai/mcp/servers (claim if auto-indexed)

# Sync & verify (Sartbot has NO git auto-deploy)
python scripts/build-deploy-dir.py && wrangler deploy --config wrangler.worker.toml && python scripts/verify-live.py
```

## Cost disclosure (this nurture pass)

- Web searches: 3 (market/competitor/pricing) ≈ light
- Apify API calls: 3 (actor meta + runs list + 6 run details)
- File reads / builds: local, ~0 cloud cost
- Tokens: light (read + research + write). No paid Apify calls made (did not re-trigger billing).
- **Proposed external actions cost:** npm publish $0; Smithery $0; Glama $0; Sartbot redeploy $0.
  Only real money at risk = a few Apify PPE calls if we re-run a live billing test post-change (~$0.005 each).
