/**
 * blacklist.ts — disposable-domain detection + role-account flagging.
 *
 * The disposable-domain list is provided by the npm package
 * `disposable-email-domain` (MIT, ~160k domains, auto-refreshed weekly).
 * It is a *dependency*, not a paid API — zero marginal cost per check.
 */

// Defensive import: the package is modern (ESM) but we guard against a
// CJS interop shape so the build never breaks on module format.
import * as deMod from "disposable-email-domain";

const de: any = deMod as any;
const isDisposableFn: (input: string) => boolean =
  de.isDisposable ?? de.default?.isDisposable ?? (() => false);
const allDomains: string[] = de.domains ?? de.default?.domains ?? [];

// Role / functional accounts. Not "invalid", but often not a real human
// you can market to or recover a password for.
const ROLE_ACCOUNTS = new Set([
  "admin",
  "noreply",
  "no-reply",
  "no_reply",
  "support",
  "info",
  "sales",
  "contact",
  "hello",
  "postmaster",
  "abuse",
  "billing",
  "help",
  "mail",
  "office",
  "team",
  "newsletter",
  "notification",
  "do-not-reply",
]);

export function isDisposable(input: string): boolean {
  if (!input) return false;
  return isDisposableFn(input);
}

export function isRoleAccount(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase().trim() ?? "";
  return ROLE_ACCOUNTS.has(local);
}

export function blacklistStats(): {
  disposable_domains: number;
  source: string;
  role_account_tokens: number;
} {
  return {
    disposable_domains: allDomains.length,
    source: "disposable-email-domain (MIT, auto-refreshed weekly)",
    role_account_tokens: ROLE_ACCOUNTS.size,
  };
}
