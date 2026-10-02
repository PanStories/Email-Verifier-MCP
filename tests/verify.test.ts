import { describe, it, expect } from "vitest";
import {
  validateSyntax,
  checkEmail,
  verifyBulk,
  resolveMx,
  type VerifyResult,
} from "../src/verify.js";
import { isRoleAccount, isDisposable, blacklistStats } from "../src/blacklist.js";

describe("validateSyntax", () => {
  it("accepts a normal address", () => {
    expect(validateSyntax("user@example.com").ok).toBe(true);
  });
  it("rejects missing @", () => {
    expect(validateSyntax("userexample.com").ok).toBe(false);
  });
  it("rejects a domain without a dot", () => {
    expect(validateSyntax("user@localhost").ok).toBe(false);
  });
  it("rejects over-long input", () => {
    expect(validateSyntax("a@" + "b".repeat(300) + ".com").ok).toBe(false);
  });
});

describe("role / disposable", () => {
  it("flags role accounts", () => {
    expect(isRoleAccount("support@example.com")).toBe(true);
    expect(isRoleAccount("alice@example.com")).toBe(false);
  });
  it("detects disposable domains via the bundled 160k list", () => {
    expect(isDisposable("someone@mailinator.com")).toBe(true);
    expect(isDisposable("alice@gmail.com")).toBe(false);
  });
  it("exposes blacklist stats", () => {
    const s = blacklistStats();
    expect(s.disposable_domains).toBeGreaterThan(1000);
  });
});

describe("checkEmail orchestration (no network)", () => {
  it("fails fast on bad syntax", async () => {
    const r: VerifyResult = await checkEmail("not-an-email", { checks: ["syntax"] });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/syntax/i);
  });

  it("returns an array for mx even when offline", async () => {
    const mx = await resolveMx("gmail.com");
    expect(Array.isArray(mx)).toBe(true);
  });

  it("scores a DNS-only pass without network for mx-less check", async () => {
    const r = await checkEmail("alice@example.com", {
      checks: ["syntax", "blacklist", "role"],
    });
    expect(r.checks_passed).toContain("syntax");
    expect(r.score).toBeGreaterThan(0);
  });
});

describe("verifyBulk", () => {
  it("caps at 10 and returns a summary", async () => {
    const emails = Array.from({ length: 12 }, (_, i) => `u${i}@example.com`);
    const bulk = await verifyBulk(emails, { checks: ["syntax", "blacklist", "role"] });
    expect(bulk.total).toBe(12);
    expect(bulk.results.length).toBe(10);
  });
});
