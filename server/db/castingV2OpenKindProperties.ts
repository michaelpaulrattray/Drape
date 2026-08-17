/**
 * THE KIND-PROPERTY STORE — the two facts the catalogue would have held about a
 * kind nobody catalogued (`OPEN_KIND_PROPERTIES_DESIGN.md` §5, migration 0033).
 *
 * # What one row is
 *
 * `paired` — does this noun denote a matched SET? `extendsOutOfFrame` — anchored
 * outside this product's framing, does the thing present inside it? Both are
 * facts about the WORD, answered once per noun ever, and neither is a fact about
 * a picture or a person. `wings are a pair` is not a fact about whoever asked
 * for wings, which is why this table has no owner column to leave out.
 *
 * # THE THIRD STATE IS THE ABSENCE OF A ROW, and every caller must honour it
 *
 * A reader that declined produced no fact, so nothing is written. There is no
 * row holding nulls, and there is no row holding a guess. `null` out of
 * {@link readOpenKindProperties} therefore means *nobody has answered this*, and
 * the only safe reading of it at the mint gate is the conservative one — a kind
 * whose pairing is unknown carries no crop, because a gate treating unknown as
 * *not paired* files one wing under the name of two (fable-872 §2).
 *
 * # `extendsOutOfFrame` IS STORED AND NOT YET READ, AND ITS HEIR IS NAMED
 *
 * P1 (`paired`) has a consumer in this build: the mint gate. P2
 * (`extendsOutOfFrame`) does not — **its consumer is the out-of-frame build**,
 * the one that decides whether an ask whose region is not visible in the current
 * frame is accepted free (fable-869 §2 and fable-876 §1) or dispatched, which is
 * fable-868's class (b) versus class (c). It is written here because one text
 * call answers both properties and asking twice would buy the same question at
 * per-ask frequency (`OPEN_KIND_PROPERTIES_DESIGN.md` §2).
 *
 * **The condition under which storing it becomes a defect is exact**: the
 * out-of-frame build shipping while still deciding class (b) from anything other
 * than this column. A fact collected and never asserted is the `about`-column
 * incident — months of a stored answer nobody summed — and the way that is not
 * repeated is that the heir is named here, in the store, rather than assumed.
 *
 * # THE READ FAILS SOFT AND THE WRITE FAILS SOFT, in opposite directions
 *
 * The read returns `null` on any failure, which lands on the conservative side
 * by construction: no answer, no crop, words carry the ask exactly as they do
 * today. The write returns whether a row landed, so a test can tell a write from
 * a swallowed failure — and no caller may depend on it, because a property this
 * program failed to remember must never cost somebody the render they paid for.
 */
import { eq } from "drizzle-orm";

import { createModuleLogger } from "../logging/logger";
import { getDb } from "./connection";
import { castingOpenKindProperties } from "../../drizzle/schema";

const log = createModuleLogger("db/castingV2OpenKindProperties");

/** What a kind's row says — the two properties, with the provenance of both. */
export type OpenKindPropertiesRow = {
  readonly paired: boolean;
  readonly extendsOutOfFrame: boolean;
  readonly model: string;
  readonly promptVersion: string;
};

/**
 * The normalizer's own grammar, checked at this door too.
 *
 * Not paranoia about our own callers: `kind` is a `varchar(64)` and the one
 * thing that must never reach it is a customer's sentence wearing a key's
 * clothes. It is the same test the demand writer runs, for the same reason.
 */
function isKey(kind: string): boolean {
  return /^[a-z][a-z'-]*$/.test(kind) && kind.length <= 64;
}

/**
 * What is known about this kind, or `null` when nothing is.
 *
 * `null` covers every way of not knowing — no row, no database, a failed query —
 * because at the gate they are one state and the difference between them is a
 * log line rather than a decision. What is NOT folded into it is a row that
 * exists: the properties are `NOT NULL` in the schema, so a row is always two
 * real answers.
 */
export async function readOpenKindProperties(kind: string): Promise<OpenKindPropertiesRow | null> {
  if (!isKey(kind)) {
    log.warn({ length: kind.length }, "[openKindProperties] refusing to look up a key that is not the normalizer's");
    return null;
  }
  try {
    const db = await getDb();
    /* No database is a test process or a boot before the pool exists. It is the
       unknown state, and the caller already treats unknown conservatively. */
    if (!db) return null;
    const [row] = await db
      .select({
        paired: castingOpenKindProperties.paired,
        extendsOutOfFrame: castingOpenKindProperties.extendsOutOfFrame,
        model: castingOpenKindProperties.model,
        promptVersion: castingOpenKindProperties.promptVersion,
      })
      .from(castingOpenKindProperties)
      .where(eq(castingOpenKindProperties.kind, kind))
      .limit(1);
    return row ?? null;
  } catch (error) {
    log.warn({ err: error, kind }, "[openKindProperties] the lookup failed — reading it as unknown");
    return null;
  }
}

/**
 * Write what a kind IS, the first time anybody asked.
 *
 * **First writer wins.** Two asks for a brand-new noun arriving together is an
 * ordinary race and both readers answer the same question, so the second write
 * is a duplicate rather than a correction — and a correction is not this
 * function's job. A re-ask under a better prompt is a deliberate build that
 * updates the row, which is why `promptVersion` is on it.
 *
 * Returns whether a row landed. `false` is not an error a caller may act on: the
 * cost of a lost write is one repeated text call on the next ask.
 */
export async function writeOpenKindProperties(input: {
  kind: string;
  paired: boolean;
  extendsOutOfFrame: boolean;
  model: string;
  promptVersion: string;
}): Promise<boolean> {
  if (!isKey(input.kind)) {
    log.warn({ length: input.kind.length }, "[openKindProperties] refusing a key that is not the normalizer's — no row");
    return false;
  }
  try {
    const db = await getDb();
    if (!db) return false;
    /*
      THE DUPLICATE IS A NO-OP RATHER THAN AN UPDATE, and the difference matters:
      `set` on the properties would let the LAST reader of a racing pair rewrite
      the first one's answer, so a kind's property could differ between two
      renders that happened to interleave. That is the per-ask wobble the design
      note rejected the interpreter's own reply for. `kind` is set to itself
      because MySQL wants an assignment and this is the one that changes nothing.
    */
    await db.insert(castingOpenKindProperties).values({
      kind: input.kind,
      paired: input.paired,
      extendsOutOfFrame: input.extendsOutOfFrame,
      model: input.model,
      promptVersion: input.promptVersion,
    }).onDuplicateKeyUpdate({ set: { kind: input.kind } });
    log.info(
      { kind: input.kind, paired: input.paired, extendsOutOfFrame: input.extendsOutOfFrame },
      "[openKindProperties] recorded what this kind is",
    );
    return true;
  } catch (error) {
    log.warn({ err: error, kind: input.kind }, "[openKindProperties] the property row did not write");
    return false;
  }
}
