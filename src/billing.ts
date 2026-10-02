/**
 * Pay-per-event (PPE) billing layer.
 *
 * Pricing (must stay in sync with .actor/pay_per_event.json and the
 * Apify Console → Monetization page):
 *   - tool-call  $0.005  every MCP tool call (check_email, verify_bulk,
 *                        check_mx, is_disposable)
 *
 * Discovery requests (initialize / tools/list) are never billed: if an agent
 * cannot even connect or enumerate tools, the user churns immediately.
 *
 * Charging happens BEFORE the tool executes. Upstream DNS work is dispatched
 * the moment the request arrives, so charging after execution would mean
 * absorbing the cost of every timeout.
 *
 * Outside the Apify platform (local dev / self-hosted / `npx`) this layer is
 * completely inert — zero side effects.
 */

import { Actor, log } from 'apify';

/** MCP tool name -> PPE event name */
export const TOOL_EVENT_MAP: Record<string, string> = {
  check_email: 'tool-call',
  verify_bulk: 'tool-call',
  check_mx: 'tool-call',
  is_disposable: 'tool-call',
};

/** Single price, mirrored in .actor/pay_per_event.json */
export const TOOL_CALL_PRICE_USD = 0.005;

export interface ChargeOutcome {
  /** Whether this tool is a billable tool */
  billable: boolean;
  /** Whether the charge actually landed */
  charged: boolean;
  /** The caller's spending cap for this run was hit; stop serving */
  limitReached: boolean;
}

/** Transparent, non-alarming message when the spending cap is reached. */
export const SPENDING_LIMIT_MESSAGE =
  'Spending limit reached for this Actor run. The MCP tool call was not executed. ' +
  'Raise the maximum cost per run (ACTOR_MAX_TOTAL_CHARGE_USD) in your Apify run options and retry. ' +
  `Pricing: $${TOOL_CALL_PRICE_USD} per tool call (initialize and tools/list are free).`;

/**
 * Charge one MCP tool call.
 * No-ops outside Apify so local `npx` usage stays free and side-effect free.
 */
export async function chargeToolCall(toolName: string): Promise<ChargeOutcome> {
  const eventName = TOOL_EVENT_MAP[toolName];
  if (!eventName) return { billable: false, charged: false, limitReached: false };

  if (!Actor.isAtHome()) {
    return { billable: true, charged: false, limitReached: false };
  }

  try {
    const result = await Actor.charge({ eventName });
    if (result?.eventChargeLimitReached) {
      log.warning(`[billing] spending limit reached while charging "${eventName}" (${toolName})`);
      return { billable: true, charged: true, limitReached: true };
    }
    return { billable: true, charged: true, limitReached: false };
  } catch (error) {
    // A billing failure must never break the MCP response: better to miss one
    // charge than to hand the user a 500.
    log.warning(
      `[billing] failed to charge "${eventName}" for ${toolName}: ${(error as Error)?.message ?? String(error)}`
    );
    return { billable: true, charged: false, limitReached: false };
  }
}
