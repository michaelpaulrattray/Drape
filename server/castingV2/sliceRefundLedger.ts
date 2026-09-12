/**
 * WHAT A REFUNDED CASTING SLICE SAYS ON THE MONEY LEDGER — the single author
 * of the four sentences, and the enumerated list a reader matches on (#536).
 *
 * # The finding this module exists for
 *
 * `scripts/machinist-ledger-read.mts` cross-checks the Machinist's count of
 * undelivered candidates against the credit refunds on `point_transactions`,
 * and it matches those refunds **by their exact wording**. Until this module
 * existed, all four sentences were inline string literals at their writers and
 * the reader **typed them out a second time**. Nothing exported them, nothing
 * pinned them, and a perfectly ordinary copy change at any one writer would
 * have stopped the reader counting that refund — while the ledger went on
 * printing `AGREES` until that particular failure happened again, which could
 * be months.
 *
 * **Working law 4: a second list shadowing a source of truth always drifts
 * from it.** The refine half of the same script already does this correctly —
 * it imports {@link ../castingV2/refineRefundLedger} rather than restating it —
 * and this is that shape applied to the slice half.
 *
 * # Why the enumeration is derived and not written out again
 *
 * ⚠ **Counting a SUBSET of these is not a smaller reading, it is a WRONG one:
 * it manufactures a disagreement out of a healthy window.** Two drafts of the
 * reader's list did exactly that (PR #533's two review rounds — the
 * render-fault sentence was missing, and then the whole retry road was). So
 * {@link SLICE_REFUND_DESCRIPTIONS} is `Object.values` of the record below
 * rather than a second literal list: a sentence added to the record enters
 * every reader in the same commit, with nobody remembering to.
 *
 * # Why drift here is silent rather than loud
 *
 * PR #533's three review rounds each found a missing sentence, and every one
 * of them had survived every driven control **for one reason: the population
 * had never occurred.** The render-fault sentence has not fired in 60 days.
 * No `castingV2.retry` operation has ever run on production, all time. A
 * mirrored list is loud when its drifted population is live and completely
 * silent when it is not — which is why this is a module and not a comment
 * asking the next author to remember.
 */

/**
 * The four sentences, each keyed by the event it describes, each quoted by
 * exactly one writer.
 *
 * The writer of each is named here rather than at the reader, because this is
 * the file someone opens when they want to reword one:
 *
 *   `candidateAbsent`    `rollService.ts` (the shared roll/retry dispatch)
 *                        and `rollRecovery.ts`
 *   `renderFault`        `rollService.ts`, the `render_fault` exit; and
 *                        `rollRecovery.ts` paying a torn `render_fault` row (#868)
 *   `retryLandedNowhere` `retryService.ts`, the landed-nowhere exit
 *   `retryRecovered`     `retryRecovery.ts`
 *
 * ⚠ These sentences are what a customer and support read on the credit ledger
 * when they wonder where the credits went, and they are also the only durable
 * record of WHY a slice was refunded — the variant row that carries the
 * machine-readable class is swept with its candidate (zero survive on
 * production, all time). Rewording one is a product act, not a tidy-up.
 */
export const SLICE_REFUND_DESCRIPTION = {
  candidateAbsent: "Casting candidate did not arrive",
  /*
    A render fault DID arrive — that is the whole point of it. Telling the
    customer their candidate "did not arrive" would be the ledger describing
    the wrong event, on the one line they read when they wonder where their
    credits went.
  */
  renderFault: "This tile came back as a contact sheet rather than a portrait",
  retryLandedNowhere: "Casting retry landed nowhere",
  retryRecovered: "Casting retry did not arrive (recovered)",
} as const;

export type SliceRefundReason = keyof typeof SLICE_REFUND_DESCRIPTION;

/**
 * EVERY slice-refund sentence, derived from the record above.
 *
 * This is what a reader matches on. It is `Object.values` and never a second
 * literal list — see the header: a subset is a wrong reading, not a smaller
 * one.
 */
export const SLICE_REFUND_DESCRIPTIONS: readonly string[] =
  Object.values(SLICE_REFUND_DESCRIPTION);

/**
 * The roll's fork, which is the only one of the four that is a choice rather
 * than a constant. `rollService.ts` had it inline; both callers of that
 * decision now compose it here so the two cannot disagree about which event a
 * `render_fault` is.
 */
export function rollSliceRefundDescription(failureClass: string | null | undefined): string {
  return failureClass === "render_fault"
    ? SLICE_REFUND_DESCRIPTION.renderFault
    : SLICE_REFUND_DESCRIPTION.candidateAbsent;
}
