/**
 * THE PRODUCT EVENT CATALOGUE — every event this product may send, and every
 * property each one may carry (#509 part 2).
 *
 * The founder's card: *"nothing records what people do"*, and N7's fourteen-day
 * observation window *"would be a watch with no eyes"*. This file is the
 * CONTROL half of those eyes. `server/monitoring/productEvents.ts` is the
 * transport and decides only whether to send at all; what a payload may contain
 * is decided here, and only here.
 *
 * # WHY THIS IS AN ALLOWLIST AND NOT A SCRUB
 *
 * `shared/errorEventScrub.ts` — part 1's control — has a harder job: a crash
 * report is composed by an SDK out of whatever the process was holding, so it
 * must rebuild an event it did not author, and it must allow free text because
 * an exception message IS free text.
 *
 * ⚠ **AN ANALYTICS EVENT HAS NO SUCH EXCUSE: WE COMPOSE EVERY BYTE OF IT.** So
 * the line here is drawn one notch tighter than anywhere else in the product,
 * and it is the strongest promise this file can make: **no property may be free
 * text at all.** Every declared property is a NUMBER, a BOOLEAN, or a string
 * drawn from a vocabulary written out in this file. A `masterPrompt`, a brief,
 * a refusal's `publicMessage`, an image URL, an email — none of them can be
 * attached to an event by a caller who means well, because there is no property
 * shape that would accept one. That is invariant 8's *"by construction, not by
 * callers remembering"*, and it is the whole reason this file exists separately
 * from the wire.
 *
 * ⚠ **THE PROVIDER'S REFUSAL SENTENCE IS THE SPECIMEN, AND IT IS DELIBERATELY
 * ABSENT.** A failed generation carries a `publicMessage` written for the
 * customer, and on the refusal road it can quote the engine quoting HER BRIEF.
 * It is the single most tempting property to attach — it is the one a dashboard
 * would most like to group by — and it is exactly the field the metadata-only
 * boundary forbids leaving the building. What travels instead is `errorCode`,
 * which is tRPC's own fixed vocabulary and says the same thing to a dashboard
 * without carrying a word anybody wrote.
 *
 * # WHY THE SHAPE IS THREE EVENTS AND A PRODUCT NOUN, NOT THIRTY
 *
 * The card names the product events one by one — *"roll started / delivered /
 * refused, refine, sign …"*. Read at the code, all of them are one lifecycle:
 * `server/casting/directOperation.ts` claims, finishes or fails EVERY
 * generation this product performs, and the operation's own `kind` says which
 * product action it was. So the stream is DERIVED from that lifecycle rather
 * than mirrored by a `capture()` call hand-placed in each service (working law
 * 4) — three event names, with the product noun as a property.
 *
 * `PRODUCT_NOUN` is the exhaustive map from an operation kind to the word the
 * founder would use, and its exhaustiveness is the guard: a new operation kind
 * does not compile until somebody has said what it is called in English. That
 * is the house pattern `operationContract.ts` already names — *"Every kind must
 * also be given an entry in each exhaustive Record in operationRecovery.ts …
 * which is why adding one here fails the build until the adjudicator knows
 * about it."*
 *
 * ⚠ **AND IT IS THE DISAPPEARING-TECHNOLOGY LAW APPLIED TO A STAFF SURFACE.**
 * An event property reading `castingV2.roll` is a pipeline term on a dashboard
 * the founder reads; `roll` is the word he uses. His own ruling is the
 * precedent — *"tools should just refer to was an image generated?"*
 *
 * # WHAT IS NOT HERE, SAID OUT LOUD RATHER THAN LEFT TO BE NOTICED
 *
 * - **No duration.** The seam does not know when an operation started — the
 *   completion functions take no start time — and the honest ways to get one
 *   (thread it through every caller, or hold a map of operation ids in memory
 *   that a mid-roll deploy loses) are both changes to the money path for a
 *   number nobody has asked for yet. An invented duration would be worse than
 *   no duration. It is absent, and this is the note saying so.
 * - **No per-slice refusal event.** A roll is eight independently refundable
 *   slices; this seam sees the operation, not the slice, so it can say *"a roll
 *   delivered partly, and this many credits went back"* and it cannot honestly
 *   say *"the engine refused slice 3 for content"*. `outcome: "partial"` with
 *   `creditsRefunded` is the true statement available here. A real per-slice
 *   refusal stream is its own card.
 * - **No person properties.** Nothing is ever `$set` on a person, so a PostHog
 *   person profile is an account id and nothing else.
 */
/*
  The bug-report categories are IMPORTED rather than restated. That file is
  already the source of truth for the column, the admin procedure and the inbox
  page, and its own header says why: *"a hand-copied second list is a control
  that lies."* A fourth copy here would be the drift this file's own
  `PRODUCT_EVENT_ERROR_CODES` docblock was written about.
*/
import { BUG_REPORT_CATEGORIES } from "./bugReportVocabulary";

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * THE EVENT NAMES. Three, in the product's own words, past tense — PostHog's
 * own naming convention and, more to the point, readable by somebody who has
 * never seen this file.
 */
export const GENERATION_EVENTS = [
  "generation started",
  "generation delivered",
  "generation failed",
] as const;

/**
 * THE MONEY AND PRODUCT EDGES — the second lifecycle, and this card's own
 * remainder (#509 part 2, money edges).
 *
 * The card names four: *"plan changed, credits bought, refund asked, bug report
 * sent"*. Read at the code, three have a road and the fourth does not, and the
 * mapping is recorded here rather than in a commit message:
 *
 * - **credits bought** → `invoice.payment_succeeded`, where a period is bought
 *   and credits are granted (`webhooks.ts`'s `periodBought`).
 * - **plan changed** → `customer.subscription.updated`.
 * - **bug report sent** → `bugReports.submit`.
 * - ⚠ **refund asked** → **NO CUSTOMER ROAD EXISTS.** Every refund in this
 *   product is automatic (per-slice on a failed generation — already carried by
 *   `creditsRefunded` above) or admin-issued (`stripe_refund` /
 *   `refund_credits` change requests). `requestRefund|refundRequest|askRefund`
 *   over `server/`, `client/src/` and `shared/` returns one hit and it is a
 *   local variable inside a test. The nearest thing a customer actually does is
 *   open a **dispute** with their bank — `charge.dispute.created`, named
 *   `payment disputed` below. An *"ask us for a refund"* surface would be new
 *   customer-facing capability, and it is not invented here.
 *
 * # ⚠ WHY THE NAMES SAY WHAT STRIPE MEANS, NOT WHAT THE CARD HOPED
 *
 * The obvious reading is to call `customer.subscription.updated` *"plan
 * changed"*. **It would be a lie most of the time.** That type fires for a
 * renewal, a payment-method change, a cancel-at-period-end flag or a metadata
 * edit, and `handleSubscriptionUpdated` has several paths that apply NOTHING (a
 * subscription `canceled` at Stripe, a stale older subscription, one Stripe does
 * not know). Nothing at that seam classifies *"the tier this customer pays for
 * changed"*. So the event is `subscription updated` — true of every delivery —
 * and a real plan change reads on the dashboard as the tier moving between two
 * of them. The other naming would have produced a chart the founder could not
 * trust, which is worse than no chart.
 *
 * For the same reason `invoice.payment_succeeded` is `payment made` and not the
 * card's *"credits bought"*: a **proration-only invoice grants no credits and
 * returns early**, so a name promising credits would be false exactly when a
 * customer changes plan mid-cycle. What was actually granted travels beside it
 * as `creditsGranted`, which is `0` on that invoice and says so.
 *
 * # WHY EVERY HANDLED TYPE IS HERE — MEASURED, NOT PREFERRED
 *
 * Part 2 named all 29 operation kinds on the stated ground that a map covering
 * only the V2 ones would have read `unnamed action` on 129 of 712 rows. The same
 * question was put to the rows here
 * (`scripts/_509money-volume-disposable.mts`, production, 2026-09-27):
 *
 *     stripe_webhook_events, all time  6 rows — and only TWO types have EVER arrived
 *       invoice.payment_succeeded      4   (2026-07-09 → 2026-09-08)
 *       checkout.session.completed     2   (2026-07-09 → 2026-08-16)
 *     accounts by plan tier            4, ALL free
 *     bug_reports                      0 rows, all time
 *
 * **No plan change, cancellation, failed payment or dispute has ever reached
 * production.** So there is no volume argument for trimming this map — the
 * stream is near-silent either way — and the first cancellation and the first
 * failed payment are exactly the two the founder said he wants to catch before a
 * customer tells him (#1419). A map naming only the card's four would go blind
 * on the rest at the moment they first matter.
 */
export const MONEY_EVENTS = [
  "checkout completed",
  "subscription started",
  "subscription updated",
  "subscription ended",
  "payment made",
  "payment failed",
  "payment disputed",
  "dispute closed",
  "refund failed",
] as const;

export type MoneyEventName = (typeof MONEY_EVENTS)[number];

/** The one edge that is not a Stripe delivery. */
export const BUG_REPORT_EVENTS = ["bug report sent"] as const;

/**
 * EVERY EVENT THIS PRODUCT MAY SEND — derived from the three families above
 * rather than restated as a fourth flat list, because a second list shadowing
 * these would drift from them (working law 4).
 */
export const PRODUCT_EVENTS = [
  ...GENERATION_EVENTS,
  ...MONEY_EVENTS,
  ...BUG_REPORT_EVENTS,
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

/**
 * THE STRIPE TYPE → PRODUCT EVENT MAP, and it is the whole reason this is ONE
 * statement at the dispatcher rather than nine `capture()` calls in nine
 * handlers.
 *
 * ⚠ **THE PLACEMENT IS A CORRECTNESS FACT, NOT A TIDINESS ONE.** The replay
 * guard in `handleStripeWebhook` claims an event id before the work and
 * **RELEASES that claim when a handler fails**, so Stripe redelivers and the
 * handler runs again. An event captured inside a handler, before something later
 * in the same handler failed, would therefore be **counted twice**. Captured
 * once at the dispatcher tail — after the last thing that can fail, and only
 * when `result.success` — it is exactly-once per Stripe event id, arbitrated by
 * the unique index that guard already relies on.
 *
 * Keys are the `case` literals of that switch. `server/moneyEventCatalogue.test.ts`
 * reads them out of `server/stripe/webhooks.ts` and holds them equal to this map
 * in both directions, so a newly handled Stripe type cannot ship without a
 * product word, and a word left behind by a removed case reddens too. That is a
 * second reader which does not share the first one's resolver — part 2's guard
 * for the operation kinds, pointed at a `switch` instead of a `Record`.
 */
export const MONEY_EVENT_FOR_STRIPE_TYPE: Record<string, MoneyEventName> = {
  "checkout.session.completed": "checkout completed",
  "customer.subscription.created": "subscription started",
  "customer.subscription.updated": "subscription updated",
  "customer.subscription.deleted": "subscription ended",
  "invoice.payment_succeeded": "payment made",
  "invoice.payment_failed": "payment failed",
  "charge.dispute.created": "payment disputed",
  "charge.dispute.closed": "dispute closed",
  "refund.failed": "refund failed",
};

/**
 * THE PRODUCT NOUN FOR EVERY GENERATION OPERATION KIND.
 *
 * Keyed by the literal kind strings of `server/casting/operationContract.ts`.
 * ⚠ It is NOT typed as `Record<GenerationOperationKind, string>` here because
 * this file is `shared/` and must stay importable by the client, which does not
 * see the server's operation contract. The exhaustiveness is proven instead by
 * `server/productEventCatalogue.test.ts`, which imports BOTH and holds the two
 * key sets equal in both directions — so a kind added without a noun, and a
 * noun left behind by a kind that was removed, each redden. That is the same
 * fact the type system would give, read by a second reader that does not share
 * the first one's resolver.
 */
export const PRODUCT_NOUN: Record<string, string> = {
  /* Casting V2 — the studio the customer is in today. */
  "castingV2.roll": "roll",
  "castingV2.sign": "sign",
  "castingV2.refine": "refine",
  "castingV2.retry": "retry",
  "castingV2.viewRetry": "view retry",

  /* The legacy studio. Still reachable, so still counted — and named in the
     same English, because a dashboard that speaks two vocabularies makes its
     reader learn which is which.

     ⚠ THIS IS NOT A COURTESY TO DEAD CODE, AND IT WAS MEASURED BEFORE IT WAS
     WRITTEN. Production's 712 operations all time break down as roll 306,
     refine 225, **`model.delete` 60, `casting.restore_state` 10 and the
     `evidence_*` family 69** — so a map naming only the V2 kinds would have
     reported `unnamed action` on 129 of 712, a fifth of everything the founder
     would look at, with nothing saying why. Read at the rows,
     `scripts/_509p2-volume-read-disposable.mts`, 2026-09-26. */
  "model.create": "cast",
  "model.delete": "cast deleted",
  "casting.headshot": "headshot",
  "casting.iterate": "iterate",
  "casting.mint": "mint",
  "casting.add_views": "add views",
  "casting.refresh": "refresh",
  "casting.restore": "restore",
  "casting.restore_state": "restore",
  "casting.pin": "pin",
  "casting.compact": "compact",

  /* The canvas. */
  "canvas.cast": "canvas cast",
  "canvas.recast": "canvas recast",
  "canvas.fork": "canvas fork",
  "canvas.variations": "canvas variations",

  /* R7 evidence. Parked machinery (PROGRAM.md's parked list), and present here
     for the same reason the legacy rows are: it can still run, and an event
     stream with a hole in it is worse than one with a row nobody reads. */
  evidence_plate_ingest: "evidence plate",
  evidence_plate_discard: "evidence plate discarded",
  evidence_intent_begin: "evidence intent",
  evidence_intent_reference: "evidence reference",
  evidence_candidate_generate: "evidence candidate",
  evidence_candidate_retry: "evidence candidate retry",
  evidence_candidate_accept: "evidence candidate accepted",
  evidence_candidate_cancel: "evidence candidate cancelled",
  evidence_fork_copy: "evidence fork",
  evidence_package_sync: "evidence package",
  evidence_mint: "evidence mint",
};

/**
 * HOW A GENERATION ENDED, in two words a reader does not have to interpret.
 *
 * `partial` is the roll's own terminal status — *"a roll that delivered some of
 * its eight is a `partial`, not a success with a footnote"* (`directOperation.ts`).
 * Keeping it distinct from `complete` is the difference between a dashboard that
 * can see a degrading engine and one that cannot.
 */
export const GENERATION_OUTCOMES = ["complete", "partial"] as const;
export type GenerationOutcome = (typeof GENERATION_OUTCOMES)[number];

/**
 * THE ERROR CODES A FAILURE MAY CARRY — tRPC's ENTIRE vocabulary, written out
 * as a closed list precisely so it is a vocabulary and not a free string.
 *
 * ⚠ **THE FIRST DRAFT OF THIS LIST HELD FOURTEEN AND IT WAS THE WRONG
 * FOURTEEN.** It was copied from `PUBLIC_TRPC_CODES` in `directOperation.ts`,
 * which is the list of codes that file will pass THROUGH to a customer — a
 * different question from which codes can reach a failure event. A `TRPCError`
 * carries any of tRPC's twenty-one, and the seven the copy dropped included
 * **`SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT` and `BAD_GATEWAY`** — precisely
 * what a failing image provider returns, and therefore precisely the failures
 * worth reading about. Every one of them would have arrived as `UNRECOGNISED`.
 *
 * That is working law 4's exact shape: a second list shadowing a source of
 * truth drifts from it. So the list below is DERIVED-AND-CHECKED rather than
 * copied — `server/productEventCatalogue.test.ts` reads tRPC's own
 * `TRPC_ERROR_CODES_BY_KEY` and holds this equal to it in both directions, so a
 * tRPC upgrade that adds a code reddens rather than quietly widening the
 * `UNRECOGNISED` bucket. It is written out here rather than imported because
 * this file is `shared/` and must not pull a server package into a bundle.
 */
export const PRODUCT_EVENT_ERROR_CODES = [
  "PARSE_ERROR",
  "BAD_REQUEST",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
] as const;

/** What an unknown code becomes, so a new tRPC code is visible rather than free text. */
export const UNRECOGNISED = "UNRECOGNISED";

/** What an operation kind with no noun becomes, for the same reason. */
export const UNNAMED_ACTION = "unnamed action";

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A PROPERTY'S DECLARED SHAPE. Three kinds and no fourth: a whole non-negative
 * count, a boolean, or a string from a named vocabulary. There is deliberately
 * no `text` shape — see the header.
 */
export type PropertyShape =
  | { type: "count" }
  | { type: "boolean" }
  | { type: "vocabulary"; allowed: readonly string[] };

/** The two properties every event carries, so a reader can always tell which build and which world. */
const ALWAYS: Record<string, PropertyShape> = {
  /* `local`, `node:production`, `railway:<name>` — `deploymentTag()`'s own
     closed set, except that the Railway environment's NAME is not knowable
     here. Held as a vocabulary of PREFIXES by `isWorld` below rather than as a
     literal list, which is the one place a string is checked by shape rather
     than by membership, and it is checked. */
  world: { type: "vocabulary", allowed: [] },
  /* A commit sha, or absent. Checked as forty hex characters — see `isRelease`. */
  release: { type: "vocabulary", allowed: [] },
};

/**
 * EVERY EVENT AND EVERY PROPERTY IT MAY CARRY.
 *
 * A property absent from its event's row is DROPPED and counted; a property
 * present with the wrong shape REFUSES the whole event, because a wrong shape
 * means our own code put something unexpected in a payload and that is a defect
 * to read about rather than an event to quietly trim. The two are different
 * failures and are deliberately reported differently.
 */
export const PRODUCT_EVENT_PROPERTIES: Record<ProductEventName, Record<string, PropertyShape>> = {
  "generation started": {
    ...ALWAYS,
    /* `roll`, `sign`, `refine`, … — `PRODUCT_NOUN`'s values. */
    action: { type: "vocabulary", allowed: Object.values(PRODUCT_NOUN).concat(UNNAMED_ACTION) },
  },
  "generation delivered": {
    ...ALWAYS,
    action: { type: "vocabulary", allowed: Object.values(PRODUCT_NOUN).concat(UNNAMED_ACTION) },
    outcome: { type: "vocabulary", allowed: GENERATION_OUTCOMES },
    creditsCharged: { type: "count" },
    creditsRefunded: { type: "count" },
  },
  "generation failed": {
    ...ALWAYS,
    action: { type: "vocabulary", allowed: Object.values(PRODUCT_NOUN).concat(UNNAMED_ACTION) },
    errorCode: {
      type: "vocabulary",
      allowed: [...PRODUCT_EVENT_ERROR_CODES, UNRECOGNISED],
    },
    creditsCharged: { type: "count" },
    creditsRefunded: { type: "count" },
  },

  /* ── THE MONEY EDGES ──────────────────────────────────────────────────────
     Eight of the nine declare nothing but the two facts every event carries,
     and that is the honest shape rather than a thin one. The dispatcher knows
     WHICH money thing happened and WHOSE account it happened on, and at that
     seam it knows nothing else it could attach without reading Stripe again —
     so nothing else is attached. The amount of money is deliberately absent
     from all nine: a Stripe charge is a currency and minor units, the product
     bills in credits, and an event carrying `1900` with no currency is the
     uninterpretable number the DT law's clause 6 forbids. What a customer got
     for their money travels as `creditsGranted` on the one event that grants
     any. */
  "checkout completed": { ...ALWAYS },
  "subscription started": { ...ALWAYS },
  "subscription updated": { ...ALWAYS },
  "subscription ended": { ...ALWAYS },
  "payment made": {
    ...ALWAYS,
    /* The card's *"credits bought"*, and the reason the event is not named that:
       a proration-only invoice buys no period and grants nothing, so this is `0`
       on exactly the delivery a customer's plan change produces. */
    creditsGranted: { type: "count" },
  },
  "payment failed": { ...ALWAYS },
  "payment disputed": { ...ALWAYS },
  "dispute closed": { ...ALWAYS },
  "refund failed": { ...ALWAYS },

  /* ── THE ONE PRODUCT EDGE THAT IS NOT A STRIPE DELIVERY ───────────────────
     ⚠ `description` is the whole content of a bug report and it is the single
     most tempting property on this page — it is what a reader would most like
     to see — and it is a customer's own prose, which the metadata-only boundary
     forbids leaving the building. There is no property shape here that would
     accept it. What travels is the CATEGORY she chose, which is a closed
     vocabulary somebody already wrote down. */
  "bug report sent": {
    ...ALWAYS,
    category: { type: "vocabulary", allowed: BUG_REPORT_CATEGORIES },
  },
};

/* ────────────────────────────────────────────────────────────────────────── */

/** `local`, `node:production`, or `railway:<anything>` — `deploymentTag()`'s three shapes. */
function isWorld(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return value === "local" || value === "node:production" || /^railway:[\w.-]{1,64}$/.test(value);
}

/** A git commit sha and nothing else. */
function isRelease(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/.test(value);
}

/** A whole, finite, non-negative number. Credits are never fractional here. */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function shapeAccepts(key: string, shape: PropertyShape, value: unknown): boolean {
  if (key === "world") return isWorld(value);
  if (key === "release") return isRelease(value);
  switch (shape.type) {
    case "count":
      return isCount(value);
    case "boolean":
      return typeof value === "boolean";
    case "vocabulary":
      return typeof value === "string" && shape.allowed.includes(value);
  }
}

export type ProductEventVerdict =
  | {
      verdict: "send";
      /** Rebuilt from the allowlist — never the caller's object. */
      properties: Record<string, number | boolean | string>;
      /** Keys the caller passed that this event does not declare. */
      dropped: readonly string[];
    }
  | { verdict: "refuse"; key: string; reason: "unknown event" | "wrong shape" };

/**
 * THE GATE. Rebuild an event's properties from the allowlist, or refuse it.
 *
 * ⚠ **THIS IS THE LAST GATE AND THERE IS NO SECOND ONE, WHICH IS A FACT ABOUT
 * THE SDK RATHER THAN A CHOICE.** Part 1 could hang its scrub on Sentry's own
 * `beforeSend` hook, so even an event the SDK composed by itself passed through
 * it. `posthog-node` has no such hook: read at the installed package,
 * `PostHogOptions` is `Omit<PostHogCoreOptions, 'before_send' | …>` — the core
 * option exists and the node client deliberately removes it. So the promise
 * here cannot be *"everything that leaves passes this"* on the SDK's authority;
 * it is *"this composes everything that leaves"* on OURS, which is why
 * `captureProductEvent` is the only function in the product that may call
 * `capture`, and why `server/productEventWire.test.ts` proves the claim on the
 * outgoing BYTES rather than on this function's return value (invariant 5).
 */
export function projectProductEvent(
  name: string,
  properties: Readonly<Record<string, unknown>>,
): ProductEventVerdict {
  if (!(PRODUCT_EVENTS as readonly string[]).includes(name)) {
    return { verdict: "refuse", key: name, reason: "unknown event" };
  }
  const declared = PRODUCT_EVENT_PROPERTIES[name as ProductEventName];
  const projected: Record<string, number | boolean | string> = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(properties)) {
    const shape = declared[key];
    if (!shape) {
      dropped.push(key);
      continue;
    }
    /* An absent optional property is absent, not a refusal — `release` is null
       on every laptop and in every test. A key PRESENT with a bad value is the
       defect this refuses. */
    if (value === undefined || value === null) continue;
    if (!shapeAccepts(key, shape, value)) {
      return { verdict: "refuse", key, reason: "wrong shape" };
    }
    projected[key] = value as number | boolean | string;
  }

  return { verdict: "send", properties: projected, dropped };
}

/** The product's word for an operation kind, or the named fallback. */
export function productNoun(kind: string): string {
  return PRODUCT_NOUN[kind] ?? UNNAMED_ACTION;
}

/** A tRPC code from the closed list, or the named fallback. */
export function productErrorCode(code: string): string {
  return (PRODUCT_EVENT_ERROR_CODES as readonly string[]).includes(code) ? code : UNRECOGNISED;
}
