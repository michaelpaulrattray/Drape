/**
 * WHICH ROWS N2b's TWO WRITES CAN REACH — the predicates, factored out (#1242).
 *
 * `writeCastPersonaDraft` and `editCastPersonaField` in `castingV2Sign.ts` are
 * the two statements that touch a Cast's personality and voice. Their contract
 * is *which rows can this statement reach*, and invariant 5 says that is proven
 * on the statement rather than on a constant near it — so the predicates and
 * the edit's column patch live here, exported, and
 * `castPersonaWrite.test.ts` renders them against a pool that never connects.
 *
 * ⚠ **A ROW-LEVEL SUITE WOULD HAVE SKIPPED IN CI AND READ GREEN.**
 * `vitest.setup.ts` strips `DATABASE_URL` on purpose, so a suite that needs a
 * disposable database proves nothing on the gate (working law 2). The question
 * *can this reach another customer's Cast* is answered honestly by showing the
 * owner is in the predicate; the shape is `castingV2PurgeScope.ts`'s and
 * `viewRetryBusy.test.ts`'s, already in the tree.
 *
 * Nothing here opens a connection or reads a row. It builds predicates.
 */
import { and, eq, isNull } from "drizzle-orm";

import { models } from "../../drizzle/schema";
import type { CastPersonaField } from "./castPersonaField";

/**
 * THE REDRAFT'S REACH — one Cast, its owner, alive, and NEITHER LINE EDITED.
 *
 * ⚠ **THERE IS NO REDRAFT ROAD TODAY, AND THIS DOCBLOCK CLAIMED THERE WAS**
 * (the relay's finding 5 on PR #2114). It read *"the recovery sweep can re-enter
 * a Sign whose process died"*, and nothing does: `writeCastPersonaDraft` has
 * exactly one non-test caller, `signService.ts`'s `writePersonaDraft`, reached
 * only from `completeSignPackage`, which is itself called once — on the live
 * Sign. The recovery road is `signRecovery.ts`'s `recoverCastingV2SignOperation`
 * and it does not enter that function. **So the limit, declared rather than
 * implied (the fidelity law): a Sign whose process dies between the seal and
 * this write never gets its two lines, the cards simply show nothing, and no
 * sweep comes back for them.** That is accepted — the Cast, the pictures and the
 * money are all finished and correct by that point.
 *
 * The two `isNull(…EditedAt)` terms stay, and they are worth their two lines for
 * a reason that does not depend on a sweep existing: they make *the customer's
 * words win*
 * a property of the STATEMENT rather than of the call graph. Whoever does build
 * a redraft — the sweep, a repair ceremony, a re-Sign — inherits a write that
 * cannot land on a line the customer has rewritten, instead of having to know that it
 * must not. They are in the statement and not in a read before it, because a
 * check-then-write here would leave exactly the race invariant 1 refuses.
 */
export function castPersonaRedraftWhere(scope: { userId: number; modelId: number }) {
  return and(
    eq(models.id, scope.modelId),
    eq(models.userId, scope.userId),
    isNull(models.deletedAt),
    /* Her words win. A redraft never lands on a line she has rewritten. */
    isNull(models.personalityEditedAt),
    isNull(models.voiceEditedAt),
  );
}

/**
 * HER EDIT'S REACH — one Cast, its owner, alive.
 *
 * No `…EditedAt` term, and that is the point: she may rewrite a line she has
 * already rewritten, as many times as she likes. What she may not reach is
 * somebody else's Cast or a deleted one.
 */
export function castPersonaEditWhere(scope: { userId: number; modelId: number }) {
  return and(
    eq(models.id, scope.modelId),
    eq(models.userId, scope.userId),
    isNull(models.deletedAt),
  );
}

/**
 * WHAT HER EDIT SETS — one line's text and one line's stamp, and nothing else.
 *
 * ⚠ **THE BADGE CLEARS BY ARITHMETIC, NOT BY A SECOND WRITE.** Stamping
 * `…EditedAt` IS "clears the badge", because the badge is derived as *drafted
 * and not since edited*. Nothing has to remember to unset a flag, which is the
 * failure working law 4 names — the flag that outlives the edit.
 *
 * ⚠ **THE OTHER LINE IS NOT IN THE PATCH.** The two lines are two cards on her
 * page: rewriting who she is must not quietly un-badge how she sounds. That is
 * a product fact, so it is driven directly rather than left to a reader of the
 * ternary below.
 */
export function castPersonaEditPatch(
  line: CastPersonaField,
  text: string,
  now: Date,
  ownWords?: string,
):
  | { personality: string; personalityEditedAt: Date; personalityOwnWords: string | null }
  | { voice: string; voiceEditedAt: Date; voiceOwnWords: string | null } {
  /*
    THE CUSTOMER'S OWN SENTENCE RIDES THE SAME STATEMENT — "say it your way"
    (#2197 / #2205). Keep this stores the line and the sentence that produced
    it together, so the two can never disagree about which keep they came from.

    ⚠ **ABSENT MEANS "NOT KEPT FROM A SENTENCE", AND THE COLUMN IS CLEARED**
    (the relay's finding 1 on PR #2217). A plain in-place edit carries no
    sentence, and the line it writes is no longer the one the sentence
    produced — so leaving the old sentence beside it would present the
    customer's words as "behind" a line they did not make, and would leave
    the customer no way to remove their own words short of deleting the cast.
    So a plain edit writes NULL into this line's sentence column in the same
    owner-scoped statement: the sentence always describes the line beside it.
    Only this line's column is named — the other card's sentence is as
    untouched as its line.
  */
  if (line === "personality") {
    return {
      personality: text,
      personalityEditedAt: now,
      personalityOwnWords: ownWords ?? null,
    };
  }
  return {
    voice: text,
    voiceEditedAt: now,
    voiceOwnWords: ownWords ?? null,
  };
}
