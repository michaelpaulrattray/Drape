/**
 * THE SLICE BETWEEN TWO ANCHORS — so a source arm cannot be satisfied by a
 * SIBLING (#1845).
 *
 * # The defect this exists to make expressible
 *
 * `AddCreditsModal.tsx` draws three different surfaces from one module: the
 * plan step-up a free account gets, the credit packs a plan holder gets, and
 * the unread shell between them. His rule of 2026-10-02 (#1773) applies to
 * exactly one of the three — *"on the free card remove the free CREDITS PER $1
 * line thats stupid"*, the rate belongs on Add credits and not on a plan
 * surface — so a guard reading the FILE cannot state the rule at all: the pane
 * that must not print a rate and the pane that must are the same bytes to it.
 *
 * `card390-guard.test.ts` was that file-level reader, and it passed the defect
 * for the day it was live: its rate population counted two calls on the module
 * and both were real, one of them on the plan pane. Sliced, the same arm says
 * which pane each one is on.
 *
 * # Why it lives here rather than as a sixth private copy
 *
 * ⚠ **FIVE PRIVATE COPIES OF THIS FUNCTION ALREADY EXIST**, all five under
 * `client/src/features/billing/` — `burnCycle1739`, `creditPacks1606`,
 * `freeAddCredits1836`, `monthlyDelta1761` and `workDivisor1758`, four of them
 * byte-identical and the fifth differing only in its failure wording. That is
 * working law 4 in the one shape this repository has paid most for, and
 * `withoutComments.ts`'s own header is the precedent: #1623 found four
 * implementations of ONE idea that *"did not agree about string literals"*, and
 * re-measured the real population was 35.
 *
 * So nothing here is new behaviour. This is the reader of record; the two
 * suites #1845 touches resolve to it, and the remaining three copies were a
 * declared remainder with a card of their own rather than a silent one,
 * because a promotion across five guards is its own pass under the standing
 * orders' §2c and not a passenger on a copy fix.
 *
 * ✅ **THAT REMAINDER IS CLOSED — #1848, 2026-10-03.** `burnCycle1739`,
 * `creditPacks1606` and `workDivisor1758` call this reader directly at all 21
 * of their call sites, each passing the `label` the private copies could not
 * carry, and `grep -rn "function band(" client/src` returns nothing. **No
 * arm's subject or message moved** — the three suites ran green on the same
 * anchors before and after, which is the whole test of a promotion pass.
 *
 * ⚠ **One thing is deliberately NOT promoted, named here rather than left for
 * a later grep to misread as half a job: `freeAddCredits1836` and
 * `monthlyDelta1761` each keep a one-line forwarder** (`const band = (source,
 * from, to) => sourceBand(source, from, to)`), which #1845 wrote so that a
 * suite it was already editing did not have to move every call site. A
 * forwarder is a call-site convenience and not a second implementation, so it
 * is not the thing law 4 is about; what it does cost is the `label`, which
 * defaults to `band` through it. Those two files were outside #1848's stated
 * scope.
 *
 * # Deliberately dependency-free, and it THROWS
 *
 * It takes no `expect`, for `withoutComments.ts`'s stated reason: a suite
 * anywhere in the tree reaches it without pulling a test framework into its
 * module graph. A missing anchor throws, which fails the calling arm exactly
 * as an assertion would and additionally makes the reader usable from a
 * script.
 *
 * ⚠ **A MISSING ANCHOR IS A REFUSAL, NEVER AN EMPTY STRING.** That is the whole
 * safety property: a band reader that answered `""` when its opening anchor had
 * been renamed would turn every negative arm over it green — a subject that has
 * left the file passes `not.toContain` for the wrong reason, which is working
 * law 2's own failure and the thing `freeAddCredits1836-guard.test.ts`'s
 * stripper control was written about an hour after it shipped.
 */

/**
 * The source between `from` and the next `to` after it, `from` included and
 * `to` excluded.
 *
 * @param label what the band is, for the refusal message — a reader who sees
 *   `band start not found` with no subject has to go and find out which of a
 *   suite's six bands moved.
 */
export function sourceBand(
  source: string,
  from: string,
  to: string,
  label = "band",
): string {
  const start = source.indexOf(from);
  if (start < 0) {
    throw new Error(
      `${label}: the opening anchor is gone from the surface: ${JSON.stringify(from)}`,
    );
  }
  const end = source.indexOf(to, start + from.length);
  if (end < 0) {
    throw new Error(
      `${label}: the closing anchor is gone from the surface: ${JSON.stringify(to)}`,
    );
  }
  return source.slice(start, end);
}

/**
 * From an anchor to the end of the file — for the LAST block in a module, where
 * there is no closing anchor to name.
 */
export function sourceTail(source: string, from: string, label = "tail"): string {
  const start = source.indexOf(from);
  if (start < 0) {
    throw new Error(
      `${label}: the opening anchor is gone from the surface: ${JSON.stringify(from)}`,
    );
  }
  return source.slice(start);
}
