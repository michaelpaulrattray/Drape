/**
 * WHY A CANDIDATE DIDN'T ARRIVE — in the customer's words (#122).
 *
 * The founder, watching roll 220 (verbatim): *"6/8 arrived other two were
 * probably NSWF and refused by the engine ( these cards need chips on them
 * which tell the user somthing like higgsfield"*. The row already carried
 * `failureClass: content_policy` and the tile said only "Didn't arrive ·
 * refunded" — the money was right and the customer had to GUESS.
 *
 * This module is the ONE place the engine's failure classes become a
 * customer-facing kind and a sentence, shared client/server so the sheet
 * cannot hold a private opinion about what a class means (working law 4).
 *
 * HONEST ABOUT WHAT WE KNOW. The transport can tell a content refusal from
 * every other 4xx (`falTransport.ts`, `isContentRefusal`) and nothing finer:
 * there is no copyright class on the wire today, so there is no copyright chip
 * — a "Refused: copyright" chip would be a guess wearing a fact's clothes. It
 * joins this list the day the transport can tell the two apart.
 *
 * The census that sized this (production, 2026-08-26): 12 failed candidates
 * ever, ALL `content_policy`. The other kinds exist because the roll road can
 * write them (`rollService.ts`, `rollRecovery.ts`), not because a customer has
 * met one.
 */

export const CANDIDATE_FAILURE_KINDS = [
  /** The engine's content filter refused the render. Nothing was painted. */
  "content_filter",
  /**
   * What came back was not a portrait of one person — a contact sheet, a torn
   * frame — and the product refused it rather than deliver it (D-236's class).
   */
  "render_fault",
  /**
   * The engine or the wire failed: transport, timeout, rate limit, the
   * provider's own account, an unrecognised 4xx, or a lost operation the
   * recovery sweep settled. Retrying the same words may well succeed.
   */
  "engine",
  /** The roll's charge never landed, so this slice never started — and was never charged. */
  "unpaid",
  /** The row says it failed and does not say why. Today's sentence, unchanged. */
  "unknown",
] as const;

export type CandidateFailureKind = (typeof CANDIDATE_FAILURE_KINDS)[number];

/**
 * THE KINDS A PLAIN RETRY SERVES (#122 shape 1) - the founder's own list,
 * verbatim: *"Retry on engine-error/didn't-arrive tiles - same prompt, one
 * slice, 20 credits, refunded again on failure"* - WIDENED BY HIS OWN WORD
 * to content-filter tiles (Crew reply #10, 2026-08-26 20:45Z, verbatim:
 * *"Flip it on for your account, AND widen it to content-filter tiles"*).
 *
 * The evidence that bought the widening is the #93 court
 * (`docs/specs/SOFTER_WORDING_COURT_2026-08-27.md`): the engine's filter is
 * a COIN PER PICTURE, not a verdict on the words - roll 222's text was
 * refused 5/8 live and passed 6/8 re-sent unchanged; the cyber-goth text
 * passed 3/8 unchanged against 4/8 softened and 4/8 in his own hand rewrite.
 * Re-sending the same words is worth as much as any rewording, so a plain
 * Retry on a content-filter tile is the button that actually rescues it, and
 * it is HONEST: it promises nothing about softer words. The "Retry with
 * softer wording" road (#93) is parked on those same numbers.
 *
 * Declared ONCE and read by BOTH the server's admission door
 * (`retryService.ts`) and the tile that draws the button, so the button can
 * never be drawn on a tile the door would refuse (working law 4).
 *
 * `render_fault` is deliberately absent: a contact sheet is the engine
 * misreading the prompt, and re-sending the same words is the same coin - his
 * sentence names engine errors and (now) the filter, and this list says what
 * his sentences say. `unpaid` is absent because there is nothing to retry:
 * that slice never ran and was never charged.
 */
export const RETRYABLE_FAILURE_KINDS = ["engine", "unknown", "content_filter"] as const satisfies readonly CandidateFailureKind[];

export function isRetryableFailure(kind: CandidateFailureKind): boolean {
  return (RETRYABLE_FAILURE_KINDS as readonly CandidateFailureKind[]).includes(kind);
}

/**
 * From the row's `failureClass` (the `ProviderFailureClass` union plus the
 * roll road's own `unpaid`, `unrecovered` and `provider_delivered_unlanded`)
 * to a kind. A string in, because the shared layer cannot import the server's
 * union — and an unrecognised class is `unknown` by construction rather than a
 * throw at projection time on a sheet a customer is looking at.
 */
export function candidateFailureKind(failureClass: string | null | undefined): CandidateFailureKind {
  switch (failureClass) {
    case "content_policy":
      return "content_filter";
    case "render_fault":
      return "render_fault";
    case "unpaid":
      return "unpaid";
    case "transport":
    case "rate_limit":
    case "timeout":
    case "capability":
    case "provider_account":
    case "unrecovered":
    /*
      `casting_candidates.failureClass` is varchar(24) and every writer slices
      to it (`claimCandidateForRecovery`, `failCandidate` in `db/castingV2.ts`),
      so the recovery sweep's `provider_delivered_unlanded` (27 chars) is
      STORED as its first 24. Both forms are matched: the stored one because
      that is what a row holds, the full one so a reader handed the class in
      memory agrees with a reader handed the row (review of #143, finding 1).
    */
    case "provider_delivered_unlanded":
    case "provider_delivered_unlan":
    case "unknown":
      return "engine";
    default:
      return "unknown";
  }
}

/** The word on the chip, on the tile itself — short, like a status. */
export const CANDIDATE_FAILURE_CHIPS: Readonly<Record<CandidateFailureKind, string>> = {
  content_filter: "Content filter",
  render_fault: "Not a portrait",
  engine: "Engine error",
  unpaid: "Not charged",
  unknown: "Didn't arrive",
};

/**
 * The line under the tile. "refunded" is the roll road's own promise on every
 * failed slice (`rollService.ts` refunds the slice at the moment it fails, and
 * the recovery sweep settles the rest); `unpaid` is the one kind that was
 * never charged, so it must not claim a refund it never made.
 */
export const CANDIDATE_FAILURE_LINES: Readonly<Record<CandidateFailureKind, string>> = {
  content_filter: "Refused by the engine's content filter · refunded",
  render_fault: "Came back as a contact sheet, not a portrait · refunded",
  engine: "Engine error · refunded",
  unpaid: "Didn't start · not charged",
  unknown: "Didn't arrive · refunded",
};
