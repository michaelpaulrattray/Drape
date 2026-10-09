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
 * The mint runs once per Sign, so today there is nothing to overwrite. The
 * recovery sweep can re-enter a Sign whose process died, though, and a second
 * derivation landing on a line she had already rewritten would be this feature
 * deleting a customer's own words. The two `isNull(…EditedAt)` terms are that
 * guard and they are IN THE STATEMENT, not in a read before it: a check-then-
 * write here would leave exactly the race invariant 1 exists to refuse.
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
): { personality: string; personalityEditedAt: Date } | { voice: string; voiceEditedAt: Date } {
  return line === "personality"
    ? { personality: text, personalityEditedAt: now }
    : { voice: text, voiceEditedAt: now };
}
