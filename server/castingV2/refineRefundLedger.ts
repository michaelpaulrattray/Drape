/**
 * WHAT A REFUNDED PAID EDIT SAYS ON THE MONEY LEDGER — and how to read it back
 * (#111 item 1, Machinist patrol #1's worst number).
 *
 * # The finding this module exists for
 *
 * One paid edit in seven does not arrive: 33 failed `castingV2.refine`
 * operations in 90 days, 800 credits charged and 800 refunded. The card's
 * premise was that the failure's CLASS is not durably recorded — that
 * `failureClassFor(error)` writes it only to `casting_candidate_variants`,
 * which is swept with its candidate.
 *
 * **Half of that is true and the important half is not.** Measured at the rows
 * on 2026-08-29:
 *
 *   - The variant half holds exactly as described, and worse than described:
 *     `casting_candidate_variants.failureClass` is non-null on **0 of 33**
 *     failed refines on production, and on **zero rows of that table, all
 *     time**. The write is not inert — dev, whose candidates are not swept on
 *     production's clock, has 7 of 31 still readable (`recovered`,
 *     `cannot_say`, `unknown`) — so the class LANDS and is then deleted with
 *     its candidate. Nothing on the durable receipt records it:
 *     `generation_operations.errorCode` is `INTERNAL_SERVER_ERROR` on every
 *     one but the `CONFLICT`, and `publicMessage` resolves a class on 14 of
 *     33, because 19 carry the generic *"That refinement didn't come
 *     through."*
 *
 *   - **But the refund itself already writes the class down, in prose, on a
 *     row nothing purges.** `recordRefund(..., refundDescriptionFor(error),
 *     operationChargeReference(operationId))` puts a per-class sentence on
 *     `point_transactions`, keyed `refund:op:<operationId>:charge` — a money
 *     ledger, kept forever. Read back, those sentences resolve a single class
 *     on **21 of the 32** refunded failures (65.6%) against `publicMessage`'s
 *     14 of 33 (42.4%).
 *
 * So the class was **collected and never asserted**, which is a different
 * defect from the one filed, and it wants a READER rather than a column, a
 * migration and a production ceremony. (Declaring a column on
 * `generation_operations` is not a small act: 20+ bare `.select()` sites name
 * every declared column, and the deploy rite's own schema conformance refuses
 * a declared-but-absent column outright — *"a column on a written table is in
 * every INSERT"*. That road stays open for the residual below, and it is now a
 * much smaller case than "no class at all".)
 *
 * # The residual, stated rather than implied
 *
 * Seven classes share ONE sentence — *"the generation failed"* is the
 * fallback for `transport`, `rate_limit`, `timeout`, `content_policy`,
 * `capability`, `provider_account` and `unknown`. The ledger therefore cannot
 * tell them apart, and 11 of 32 production failures sit in that family. This
 * module does NOT guess between them: {@link classifyRefineRefundDescription}
 * answers `family` and names all seven, so a reader that wants one of them
 * knows it is asking for something the record does not hold.
 *
 * # Why the vocabulary lives here and not at the two throw sites
 *
 * Working law 4. The family had TWO authors — seven sentences composed inline
 * in `refineService.ts` and an eighth in `refineRecovery.ts` — so nothing
 * could read them back without re-typing them, which is the second list this
 * law forbids. The table below is the single author, both writers compose
 * through it, and the classifier INVERTS THE SAME TABLE rather than carrying
 * its own copy of the prose. A class added without copy is a compile error.
 *
 * **The bytes do not move.** Every sentence here is what production already
 * holds, character for character, and `refineRefundLedger.test.ts` pins each
 * one against the literal it replaced — a refund description is on a receipt
 * a customer and support can both read, and rewriting one would rewrite
 * history.
 */
import type { ProviderFailureClass } from "../providers/types";

/**
 * Every reason a refine refund is written for.
 *
 * `ProviderFailureClass` plus one: `recovered` is the sweep's word for an
 * operation whose process died mid-render (`refineRecovery.ts`), and it is not
 * a provider failure at all — nothing asked a provider anything. It is here
 * because it authors a sentence in this family, and a vocabulary that omitted
 * it would classify its six production rows as unclassified.
 */
export type RefineRefundReason = ProviderFailureClass | "recovered";

/**
 * A sentence with no room for detail.
 */
type ExactSentence = { readonly kind: "exact"; readonly text: string };

/**
 * A sentence that NAMES what went wrong, composed from a prefix the classifier
 * can also match on.
 *
 * `detailJoin` is the word the writer puts between the prefix and the detail —
 * empty for `facts_missing` (*"came back without fox eyes"*) and `"the "` for
 * `removal_not_delivered` (*"still showed the glasses"*). It is a field rather
 * than a rule because the two sentences genuinely differ and a rule inferring
 * it would be a guess about grammar.
 */
type DetailedSentence = {
  readonly kind: "detailed";
  readonly prefix: string;
  readonly detailJoin: string;
  /** What is said when the throw carried no detail. */
  readonly withoutDetail: string;
};

type RefundSentence = ExactSentence | DetailedSentence;

const OPENER = "Refine refunded — ";

/**
 * THE FALLBACK'S FAMILY, named rather than left as "everything else".
 *
 * These seven classes all write *"the generation failed"*, so the sentence is
 * many-to-one and its inverse is a SET. Deriving this list by subtraction
 * would make it silently correct forever — including on the day someone gives
 * `content_policy` its own line and forgets this one — so it is declared, and
 * an arm asserts it is exactly the members with no sentence of their own.
 */
export const REFINE_REFUND_GENERIC_FAMILY: readonly RefineRefundReason[] = [
  "transport",
  "rate_limit",
  "timeout",
  "content_policy",
  "capability",
  "provider_account",
  "unknown",
] as const;

const GENERIC: ExactSentence = { kind: "exact", text: `${OPENER}the generation failed` };

/**
 * THE VOCABULARY — one author for every sentence a refine refund writes.
 *
 * Total rather than partial (`Record<RefineRefundReason, …>`) so a new failure
 * class cannot reach the ledger without someone choosing its words: the
 * compiler refuses the file until it has a line here.
 */
export const REFINE_REFUND_COPY: Readonly<Record<RefineRefundReason, RefundSentence>> = {
  render_fault: { kind: "exact", text: `${OPENER}the image came back damaged` },
  /* OURS, and the receipt says so — the provider's frame was fine and our
     compositor cut it. A ledger line blaming the vendor is a support
     conversation nobody can resolve. */
  composite_fault: { kind: "exact", text: `${OPENER}we could not assemble the picture cleanly` },
  /* ALSO OURS, and a different ours: the picture was never attempted, because
     the record of what she already has could not be read. */
  segment_store: {
    kind: "exact",
    text: `${OPENER}we could not read this face's kept edits, so nothing was rendered`,
  },
  /* NAMES WHAT WAS MISSING. "came back" rather than "was missing", because a
     removal's shortfall is not an absence — see the sibling below. */
  facts_missing: {
    kind: "detailed",
    prefix: `${OPENER}the render came back `,
    detailJoin: "",
    withoutDetail: "without what you asked for",
  },
  /* THE REMOVAL'S OWN LINE. Without it this fell through to "the generation
     failed", which is the misdescribing receipt the splits above exist to
     stop: the generation did not fail, it came back with the thing she was
     paying to take off. Second person, like its sibling. */
  removal_not_delivered: {
    kind: "detailed",
    prefix: `${OPENER}the render still showed `,
    detailJoin: "the ",
    withoutDetail: "what you asked to remove",
  },
  /* NOT A FAILURE AT ALL: nothing was rendered and no provider was contacted —
     the road refused before the call because the recipe has no way to state
     the ask. "The generation failed" would send support hunting an outage that
     never happened. */
  cannot_say: {
    kind: "exact",
    text: `${OPENER}we cannot yet place what this asked for, so nothing was rendered`,
  },
  /* THE SWEEP'S WORD, not a provider's. The process holding the render died —
     a deploy landing mid-roll is the designed collision — so nothing failed
     and nothing succeeded; it stopped. */
  recovered: { kind: "exact", text: `${OPENER}the generation was interrupted` },
  transport: GENERIC,
  rate_limit: GENERIC,
  timeout: GENERIC,
  content_policy: GENERIC,
  capability: GENERIC,
  provider_account: GENERIC,
  unknown: GENERIC,
};

/**
 * The sentence a refund of this class writes on the ledger.
 *
 * `detail` is the throw's own message, already trimmed by the caller. An empty
 * or absent detail takes the sentence's `withoutDetail` half, which is what the
 * inline chain did.
 */
/*
  ⚠ TOTAL OVER THE TYPE, NOT OVER RUNTIME STRINGS — the one behaviour this move
  does change, recorded here rather than left to be discovered (gate review of
  PR #215, observation 2).

  The inline chain fell through to *"the generation failed"* for ANY unmatched
  value; this indexes the table and would throw on a `failureClass` outside the
  union. Verified unreachable today — every `ProviderError` construction in the
  product passes a typed literal or a value from a function typed to the closed
  union — and it is left that way ON PURPOSE: a silent fallback is how a class
  nobody declared reaches a customer's receipt wearing another class's words,
  which is the whole defect this module exists to end. If it ever did fire, the
  throw lands in `refineService`'s own catch, the operation stays leased and
  the recovery sweep refunds it: money conserved, at the cost of the ~6-minute
  wait the deploy-collision class already carries.
*/
export function refineRefundDescription(reason: RefineRefundReason, detail?: string): string {
  const sentence = REFINE_REFUND_COPY[reason];
  if (sentence.kind === "exact") return sentence.text;
  const named = detail?.trim();
  return named
    ? `${sentence.prefix}${sentence.detailJoin}${named}`
    : `${sentence.prefix}${sentence.withoutDetail}`;
}

/**
 * WORDINGS PRODUCTION STILL HOLDS THAT NOTHING WRITES ANY MORE.
 *
 * A ledger row is written once and read for years, so a classifier built from
 * today's vocabulary alone silently drops every row written before the last
 * rewording — and it drops them into `unclassified`, which reads as "we never
 * knew" rather than "we changed our minds about the words".
 *
 * ⚠ **This list is DERIVED FROM THE ROWS, not remembered.** Every entry was
 * measured by reading every distinct `'Refine refunded…'` description in both
 * databases, all time, on 2026-08-29
 * (`scripts/_shift86-all-refine-refunds-disposable.mts`): nine distinct
 * sentences on production, nine on dev, and exactly one wording among them
 * that no current writer produces. Adding an entry from memory rather than
 * from a query is how a guess becomes a statistic.
 */
const HISTORICAL_SENTENCES: ReadonlyArray<{
  readonly prefix: string;
  readonly reason: RefineRefundReason;
  readonly retiredNote: string;
}> = [
  {
    /* The `facts_missing` sentence before the "came back" rewrite. Live on
       production rows dated to 2026-08-08 (n=3 across both databases). */
    prefix: `${OPENER}the render was missing `,
    reason: "facts_missing",
    retiredNote: "pre-'came back' wording; a removal's shortfall is not an absence",
  },
];

/**
 * What a ledger sentence says about WHY a paid edit was refunded.
 *
 * Three answers, and the middle one is the point:
 *
 *   - `class` — the sentence belongs to exactly one reason.
 *   - `family` — the sentence is the shared fallback, so the record genuinely
 *     does not distinguish these seven. A reader that folds this into
 *     `unknown` is reporting a precision the ledger does not have.
 *   - `unclassified` — no sentence in the vocabulary, current or historical,
 *     matches. Never bucketed anywhere: an unrecognised sentence is a finding
 *     about this table, not a data point.
 */
export type RefineRefundReading =
  | { readonly kind: "class"; readonly reason: RefineRefundReason }
  | { readonly kind: "family"; readonly reasons: readonly RefineRefundReason[] }
  | { readonly kind: "unclassified" };

/**
 * Read a class back off a refund description.
 *
 * Detailed sentences are matched on their PREFIX, because their tail is the
 * throw's own message and is unbounded — *"came back without gold hoop
 * earrings, dangly cross earrings, one on each ear, a matching pair"* is one
 * real production row.
 */
export function classifyRefineRefundDescription(description: string): RefineRefundReading {
  const text = description.trim();
  if (text === GENERIC.text) return { kind: "family", reasons: REFINE_REFUND_GENERIC_FAMILY };
  for (const [reason, sentence] of Object.entries(REFINE_REFUND_COPY) as Array<
    [RefineRefundReason, RefundSentence]
  >) {
    if (sentence === GENERIC) continue;
    if (sentence.kind === "exact") {
      if (text === sentence.text) return { kind: "class", reason };
    } else if (text.startsWith(sentence.prefix)) {
      return { kind: "class", reason };
    }
  }
  for (const entry of HISTORICAL_SENTENCES) {
    if (text.startsWith(entry.prefix)) return { kind: "class", reason: entry.reason };
  }
  return { kind: "unclassified" };
}

/** A label for a reading, for a report that prints one line per refund. */
export function refineRefundReadingLabel(reading: RefineRefundReading): string {
  if (reading.kind === "class") return reading.reason;
  if (reading.kind === "family") return `one of: ${reading.reasons.join("/")}`;
  return "unclassified";
}
