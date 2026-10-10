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
function isProrationLine(line: unknown): boolean {
  const l = line as AnyRecord | null;
  if (typeof l?.proration === "boolean") return l.proration;
  const parented = l?.parent?.subscription_item_details?.proration;
  if (typeof parented === "boolean") return parented;
  return false;
}

/** Is this line a subscription (recurring) line at all (either dialect)? */
function isSubscriptionLine(line: unknown): boolean {
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
  /**
   * When the bought period STARTS, in Stripe's epoch seconds — or `null` when
   * the line carried no readable period and the months came off the classic
   * interval field instead (#1937).
   *
   * It is read here rather than by a second walker over the same lines,
   * because the line this answers about must be the very line the months came
   * from: two readers choosing "the first non-proration subscription line"
   * independently is the drift working law 4 is about, and here they would
   * disagree silently on a multi-line invoice.
   *
   * ⚠ `null` is a real answer and its caller must have a road for it. It means
   * *this invoice cannot say when its period began*, which is not the same as
   * *the period began at zero* — a caller that treats it as an epoch would put
   * every event in the product's history inside the window.
   */
  startSec: number | null;
  /**
   * When the bought period ENDS, read off the same line as `startSec`, and
   * `null` exactly when that is. A yearly plan's credits arrive month by month
   * across this span (#2152), so the paid year has to be stated by the
   * artifact that bought it.
   */
  endSec: number | null;
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
      return { monthsBought: classicInterval === "year" ? 12 : 1, spanDays: 0, startSec: null, endSec: null };
    }
    const spanDays = Math.round((endSec - startSec) / 86_400);
    return { monthsBought: spanDays >= 300 ? 12 : 1, spanDays, startSec, endSec };
  }
  return null;
}

/**
 * A non-proration subscription line's PRICE IDENTITY and QUANTITY — the two
 * facts the credit grant needs and the two the dialects disagree about.
 *
 * `lookupKey` is `null` on the dialect production actually speaks. Read at the
 * SDK's own types (`stripe@20.3.0`, `InvoiceLineItems.d.ts`): a clover line
 * carries `pricing.price_details.price`, a price **id** string, and no
 * `lookup_key` anywhere — where a pre-Basil line carries the whole `price`
 * object with its key inline. So a caller that can only match on keys can
 * identify nothing on the payloads this product receives, and the price-id
 * road is not a nicety.
 */
export type SubscriptionLineIdentity = {
  /** The price's lookup key when the dialect carries one inline, else null. */
  lookupKey: string | null;
  /** The price id, whichever dialect delivered it, else null. */
  priceId: string | null;
  /** The quantity billed on this line — the dial's STEPS, on the dial's line. */
  quantity: number | null;
};

function priceIdOf(line: AnyRecord | null): string | null {
  const classic = line?.price;
  if (typeof classic === "string" && classic) return classic;
  if (classic && typeof classic === "object" && typeof classic.id === "string") return classic.id;
  const basil = line?.pricing?.price_details?.price;
  if (typeof basil === "string" && basil) return basil;
  if (basil && typeof basil === "object" && typeof basil.id === "string") return basil.id;
  return null;
}

function lookupKeyOf(line: AnyRecord | null): string | null {
  const classic = line?.price;
  if (classic && typeof classic === "object" && typeof classic.lookup_key === "string") {
    return classic.lookup_key;
  }
  /* Only when the price was EXPANDED into the clover line — normally absent,
     which is the whole reason `priceId` exists beside this. */
  const basil = line?.pricing?.price_details?.price;
  if (basil && typeof basil === "object" && typeof basil.lookup_key === "string") {
    return basil.lookup_key;
  }
  return null;
}

/**
 * Every non-proration subscription line on an invoice, in the order Stripe
 * sent them — the base plan's line and, when the dial is up, the add-on's.
 *
 * Deliberately NOT "find me the add-on": this module knows dialects and
 * nothing about what a plan-credits price is called, which is a catalogue
 * question one module over. The caller decides identity; this says what is
 * readable. An EMPTY array therefore means proration-only or unreadable, and
 * the caller must not read it as *no add-on*.
 */
export function nonProrationSubscriptionLines(invoice: unknown): SubscriptionLineIdentity[] {
  const lines: unknown[] = (invoice as AnyRecord)?.lines?.data ?? [];
  const out: SubscriptionLineIdentity[] = [];
  for (const line of lines) {
    if (!isSubscriptionLine(line) || isProrationLine(line)) continue;
    const l = line as AnyRecord;
    out.push({
      lookupKey: lookupKeyOf(l),
      priceId: priceIdOf(l),
      quantity: typeof l?.quantity === "number" ? l.quantity : null,
    });
  }
  return out;
}

/**
 * THE SUBSCRIPTION METADATA AN INVOICE WAS FINALIZED WITH — the artifact that
 * says which plan a paid period bought (#1930).
 *
 * Stripe's own contract, read at the SDK types rather than assumed
 * (`stripe@20.3.0`, `Invoices.d.ts` — `Invoice.Parent.SubscriptionDetails`):
 *
 *   > Set of key-value pairs defined as subscription metadata when an invoice
 *   > is created. **Becomes an immutable snapshot of the subscription metadata
 *   > at the time of invoice finalization.**
 *
 * ⚠ **THAT WORD `immutable` IS THE WHOLE REASON THIS READER EXISTS.** The live
 * subscription answers *which plan is this account on now*; this answers
 * *which plan was this invoice billed for*, and the two come apart for up to
 * ~3 days because `subscription.updated` and `invoice.payment_succeeded` are
 * separate events with no ordering between them and Stripe redelivers an
 * unprocessed invoice event for that long. A plan change landing in the gap
 * cannot move this field, by Stripe's definition of it.
 *
 * ⚠ **IT IS DELIBERATELY DIALECT-POSITIVE AND NEVER A GUESS.** The
 * `parent.subscription_details` position is the one this product actually
 * receives (`2026-01-28.clover`) and is the one read at the types above; the
 * top-level position is where the same object sat before the Basil rename and
 * is read beside it. A dialect that put the snapshot somewhere neither reader
 * looks answers `null`, which every caller must treat as *unknown* rather than
 * as *no plan* — so being wrong about a dialect this product does not receive
 * costs the existing fall-back road and can never mis-size a grant.
 *
 * Knows nothing about what a plan is called: like every other reader here it
 * speaks dialects and leaves the product question to its caller.
 */
export function invoiceSubscriptionMetadata(invoice: unknown): Record<string, unknown> | null {
  const inv = invoice as AnyRecord | null;
  const classic = inv?.subscription_details?.metadata;
  if (classic && typeof classic === "object") return classic as Record<string, unknown>;
  const parented = inv?.parent?.subscription_details?.metadata;
  if (parented && typeof parented === "object") return parented as Record<string, unknown>;
  return null;
}

/**
 * Every subscription line that CHARGES something (amount above zero), with the
 * price and quantity it charges for — proration lines included (#2190).
 *
 * A plan change's invoice is mostly proration: measured in test mode on the
 * pinned clover, a same-interval upgrade bills *"Unused time on Klieg
 * Starter"* (negative) and *"Remaining time on Klieg Pro"* (positive, the
 * TARGET price at quantity 1), and a dial move bills the add-on's price at the
 * NEW quantity. So the positive lines name what the change was buying, which
 * is what tells a change Stripe applied (those lines match the subscription's
 * items) from one it held (they do not). Like every reader here it speaks
 * dialects and nothing else: a line whose price cannot be read is left out,
 * and an empty answer means "cannot say".
 */
export function chargedSubscriptionLines(
  invoice: unknown,
): Array<{ priceId: string; quantity: number | null; amount: number }> {
  const lines: unknown[] = (invoice as AnyRecord)?.lines?.data ?? [];
  const out: Array<{ priceId: string; quantity: number | null; amount: number }> = [];
  for (const line of lines) {
    if (!isSubscriptionLine(line)) continue;
    const l = line as AnyRecord;
    const amount = typeof l?.amount === "number" ? l.amount : null;
    const priceId = priceIdOf(l);
    if (amount === null || amount <= 0 || !priceId) continue;
    out.push({ priceId, quantity: typeof l?.quantity === "number" ? l.quantity : null, amount });
  }
  return out;
}
