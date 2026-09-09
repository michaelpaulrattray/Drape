/**
 * INVOICE READS THAT SURVIVE THE DIALECT (#664 review finding 2 — and the
 * artifact settled it: the registered production endpoint speaks
 * `2026-01-28.clover`, read at `stripe.webhookEndpoints.list` on 2026-09-09).
 *
 * Stripe's Basil family (2025-03 onward) moved every field the webhook's
 * invoice handlers read:
 *
 *   pre-Basil                          Basil/clover
 *   ───────────────────────────────    ─────────────────────────────────────
 *   invoice.subscription               invoice.parent.subscription_details
 *                                        .subscription
 *   line.proration                     line.parent.subscription_item_details
 *                                        .proration
 *   line.price.recurring / line.plan   line.parent.type ===
 *                                        "subscription_item_details"
 *                                        (the price's interval is NOT inline)
 *
 * The handlers used to read only the left column — so on the payloads
 * production actually receives, `invoice.subscription` is absent and BOTH
 * invoice handlers exit at "Not a subscription invoice": the renewal credit
 * refresh and the final-failure auto-cancel were structurally unreachable.
 * Latent only because production holds zero subscriptions.
 *
 * These readers speak both dialects, and the INTERVAL is judged by the line's
 * own period span rather than any dialect's price shape — the one fact both
 * shapes state the same way, and the artifact the grant is actually about
 * (#664 decision 3: credits are granted by the period bought).
 */

type AnyRecord = Record<string, any>;

/** The subscription an invoice belongs to, whichever dialect delivered it. */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const inv = invoice as AnyRecord | null;
  const direct = inv?.subscription;
  if (typeof direct === "string" && direct) return direct;
  if (direct && typeof direct === "object" && typeof direct.id === "string") return direct.id;
  const parented = inv?.parent?.subscription_details?.subscription;
  if (typeof parented === "string" && parented) return parented;
  if (parented && typeof parented === "object" && typeof parented.id === "string") {
    return parented.id;
  }
  return null;
}

/** Is this line a proration adjustment (either dialect)? */
export function isProrationLine(line: unknown): boolean {
  const l = line as AnyRecord | null;
  if (typeof l?.proration === "boolean") return l.proration;
  const parented = l?.parent?.subscription_item_details?.proration;
  if (typeof parented === "boolean") return parented;
  return false;
}

/** Is this line a subscription (recurring) line at all (either dialect)? */
export function isSubscriptionLine(line: unknown): boolean {
  const l = line as AnyRecord | null;
  if (!l) return false;
  if (l.price?.recurring || l.plan) return true;
  if (l.parent?.type === "subscription_item_details") return true;
  if (l.parent?.subscription_item_details) return true;
  return false;
}

export type PeriodBought = {
  /** 12 for a yearly line, 1 for a monthly one. */
  monthsBought: 1 | 12;
  /** The span the line actually covers, for the log. */
  spanDays: number;
};

/**
 * The period an invoice BOUGHT: its first non-proration subscription line,
 * sized by that line's own period span. `null` = proration-only (a tier
 * change's adjustment invoice) — the caller decides whether that is fine
 * (subscription_update) or a loud failure (a renewal that granted nothing).
 *
 * The span decides the months because it is dialect-free AND artifact-true:
 * a full-period line spans what was bought, ~28–31 days for a month and
 * 365–366 for a year. The 300-day line cleanly separates the only two
 * periods this product sells; nothing between them exists to misread.
 */
export function periodBought(invoice: unknown): PeriodBought | null {
  const lines: unknown[] = (invoice as AnyRecord)?.lines?.data ?? [];
  for (const line of lines) {
    if (!isSubscriptionLine(line) || isProrationLine(line)) continue;
    const period = (line as AnyRecord)?.period;
    const startSec = typeof period?.start === "number" ? period.start : null;
    const endSec = typeof period?.end === "number" ? period.end : null;
    if (startSec === null || endSec === null || endSec <= startSec) {
      // A recurring line with no readable period: fall back to the classic
      // interval field when present; otherwise treat as a month — the
      // conservative grant (never twelve on a guess).
      const classicInterval =
        (line as AnyRecord)?.price?.recurring?.interval ?? (line as AnyRecord)?.plan?.interval;
      return { monthsBought: classicInterval === "year" ? 12 : 1, spanDays: 0 };
    }
    const spanDays = Math.round((endSec - startSec) / 86_400);
    return { monthsBought: spanDays >= 300 ? 12 : 1, spanDays };
  }
  return null;
}
