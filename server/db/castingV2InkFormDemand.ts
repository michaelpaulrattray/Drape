/**
 * THE MISSING-FORM DEMAND RECORD — the writer (migration 0041; ordered
 * fable-1025 §3 as rider two of the refusal that made it necessary).
 *
 * # What it is for
 *
 * One row is: somebody attached a tattoo design to a Cast whose build has no
 * torso blank in the set, and was told the mannequin has not been drawn yet.
 * It is the instrument the *"draw a third form"* decision reads — **eleven
 * people wanted a neck piece we have no form for** — and that decision stays a
 * human one reading these rows.
 *
 * A refusal nobody counts is a demand signal thrown away. That is the whole
 * argument, and it is the same one the open lane's demand table was built on.
 *
 * # THE COLUMN LIST IS THE PRIVACY BOUNDARY, and this file may not widen it
 *
 * `kind`, `placement`, `outcome`, `pathAtRefusal`, `createdAt`. Not the
 * account, not the cast, not the design, not an image key — **absent from the
 * row rather than omitted from a projection** (invariant 8).
 *
 * ⚠ **`pathAtRefusal` JOINED THAT LIST AND HAD TO BE ARGUED, NOT ASSUMED**
 * (migration 0052, design §9). It is a fifth column on a table whose whole
 * defence is the shortness of its column list, so the question is whether it
 * narrows anybody: it does not. It carries one of two words that a customer
 * CHOSE BEFORE THE ROLL and that thousands of casts share, it names no roll, no
 * cast and no account, and a row saying *somebody on the Wardrobe path was
 * refused an upper chest* is not traceable to a person by anything in it or
 * beside it. It is here because the two paths' demand signals are different
 * product decisions — a covered chest on Wardrobe argues for a wardrobe edit,
 * the same refusal on Basics argues for something else entirely — and a tally
 * that cannot tell them apart answers neither question.
 *
 * That is why this is not `castingV2/refusalCounter.ts`, which would otherwise
 * be the obvious home and needs no migration at all: every row it writes
 * carries a `userId` and a candidate id, and this refusal is ABOUT A BUILD. An
 * attributed row saying *"no torso form for this Cast"* hands one bit of that
 * Cast's `technicalSchema` to every staff member who can read audit logs, and
 * `technicalSchema` is a third of the recipe for reproducing a Cast. The
 * refusal has to be counted somewhere it cannot be traced back.
 *
 * # IT MAY NEVER BLOCK THE ANSWER
 *
 * This is telemetry riding a customer's request. It fails soft and LOUD —
 * logged, never thrown — for the same reason the open lane's does: nothing here
 * may take an answer away from somebody waiting for one. Every caller is
 * fire-and-forget by construction, because this function cannot reject.
 *
 * It also returns `false` rather than nothing when no row was written, so a
 * test can tell a write from a swallowed failure. A helper that returned
 * nothing either way would be one whose failures are indistinguishable from its
 * successes, which is the shape this campaign keeps paying for.
 */
import type { CastingPath } from "../../shared/castingPaths";
import type { InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkFormDemandKind, InkFormDemandOutcome } from "../../shared/inkFormDemand";
import { createModuleLogger } from "../logging/logger";
import { castingInkFormDemand } from "../../drizzle/schema";
import { getDb } from "./connection";

const log = createModuleLogger("db/castingV2InkFormDemand");

export async function recordInkFormDemand(input: {
  kind: InkFormDemandKind;
  placement: InkPlacement;
  outcome: InkFormDemandOutcome;
  /**
   * WHICH PATH THE CAST WAS BORN ON, for the coverage kinds (migration 0052).
   *
   * ⚠ **ABSENT IS NOT A DEFAULT AND IS NOT A CLAIM.** The torso-form writer has
   * no path to give — its refusal is about a BUILD and predates the paths — so
   * it omits this and the column stays NULL, which is exactly what every row
   * already in the table means. A coverage refusal always has one, because the
   * writer does not fire for `unpathed` at all; the column's own docblock is
   * where that argument lives.
   *
   * Not narrowed per `kind` in the type. A discriminated union here would make
   * the *shape* of the call carry a rule about which refusals count, and that
   * rule belongs at the refusal — where the branch's resolution is in hand and
   * `unpathed` can be told from a path. A telemetry helper that can refuse a
   * caller is a telemetry helper that can cost somebody a sentence.
   */
  pathAtRefusal?: CastingPath | null;
}): Promise<boolean> {
  try {
    const db = await getDb();
    /* No database is not an error worth a stack trace — it is a test process or
       a boot before the pool exists, and telemetry is the last thing that
       should notice. */
    if (!db) return false;
    await db.insert(castingInkFormDemand).values({
      kind: input.kind,
      placement: input.placement,
      outcome: input.outcome,
      /* `null` rather than `undefined`, so the column is written explicitly as
         the absence it is rather than left to whatever the driver does with a
         missing key. It is the same value either way today; it stops being the
         same value the day somebody gives this column a default. */
      pathAtRefusal: input.pathAtRefusal ?? null,
    });
    log.info(input, "[inkFormDemand] recorded");
    return true;
  } catch (error) {
    /*
      Loud, and swallowed — and this catch is doing real work rather than
      guarding against the improbable. The table lands in production by a
      founder ceremony, and until that ceremony runs this INSERT fails on every
      call. The refusal it counts is unaffected: the customer still gets her
      sentence, the design is still attached, and the only thing lost is the
      tally. That is the honest cost of shipping the refusal ahead of its count,
      and it is stated here rather than discovered.
    */
    log.warn(
      { err: String(error).slice(0, 160), ...input },
      "[inkFormDemand] the demand row did not write — the refusal itself is unaffected",
    );
    return false;
  }
}
