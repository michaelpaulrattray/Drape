/**
 * THE REFERENCE-READ DEMAND RECORD — the writer (migration 0036, ruled
 * fable-941 §3a; discharging fable-937 §3's tally for the forms that keep
 * nothing).
 *
 * # What it is for
 *
 * One row is: somebody took a declared feature from a reference, and this is
 * how it went. The founder's condition on this whole road is that we can see
 * what customers actually ask for — *the intent field is the demand tally's
 * natural input* — and for tattoos that fact rides on the design row.
 *
 * Makeup has no row. The picture is read once and dropped (fable-941 §1), which
 * is the strongest form of the real-person fence in the product and also the
 * reason the demand would otherwise be invisible for every form except the one
 * that keeps bytes. This table is where the honest half of that trade lands.
 *
 * # THE COLUMN LIST IS THE PRIVACY BOUNDARY, and this file may not widen it
 *
 * `intent`, `outcome`, `createdAt`. Not the sentence, not the account, not the
 * cast, not the picture, not a key — **absent from the row rather than omitted
 * from a projection** (invariant 8).
 *
 * The sentence is the exclusion worth naming twice: a makeup note read off a
 * customer's reference is a description of a real person's face, produced from
 * a photograph she supplied. A staff member reading this table learns that nine
 * people took makeup from a reference and seven of those reads landed. They
 * learn nothing whatever about any one of them, or about any face.
 *
 * # IT MAY NEVER BLOCK A READ
 *
 * Telemetry riding a customer's path. It fails soft and LOUD — logged, never
 * thrown — for the same reason `castingV2OpenLaneDemand` does: nothing here may
 * take an answer away from somebody who asked for one. Every caller is
 * fire-and-forget by construction, because this function cannot reject.
 */
import { createModuleLogger } from "../logging/logger";
import { getDb } from "./connection";
import {
  castingReferenceReads,
  CASTING_REFERENCE_READ_OUTCOMES,
} from "../../drizzle/schema";
import type { ReferenceIntent } from "../../shared/referenceIntents";

const log = createModuleLogger("db/castingV2ReferenceReads");

export type ReferenceReadOutcome = (typeof CASTING_REFERENCE_READ_OUTCOMES)[number];

/**
 * Record one reference read and how it ended.
 *
 * Resolves `true` when a row was written and `false` when one was not, so a
 * test can tell a write from a swallowed failure — a helper that returns
 * nothing either way is one whose failures are indistinguishable from its
 * successes, which is a shape this campaign keeps paying for. **Callers are not
 * expected to read it**; nothing a customer receives may depend on it.
 */
export async function recordReferenceRead(
  intent: ReferenceIntent,
  outcome: ReferenceReadOutcome,
): Promise<boolean> {
  /*
    THE VALUE IS CHECKED HERE TOO, and it is not paranoia about our own callers.

    Both columns are MySQL enums, and MySQL's own failure mode for a value
    outside an enum is to write the EMPTY STRING rather than to refuse — a row
    that counts toward a tally and names nothing. A caller drifting ahead of a
    migration is exactly how that happens, so the value is proved against the
    column's own list before the insert rather than after the tally is wrong.
  */
  if (!(CASTING_REFERENCE_READ_OUTCOMES as readonly string[]).includes(outcome)) {
    log.warn({ outcome }, "[referenceReads] refusing an outcome the column does not hold — no row");
    return false;
  }
  try {
    const db = await getDb();
    /* No database is not an error worth a stack trace — it is a test process or
       a boot before the pool exists, and telemetry is the last thing that
       should notice. */
    if (!db) return false;
    await db.insert(castingReferenceReads).values({ intent, outcome });
    log.info({ intent, outcome }, "[referenceReads] recorded");
    return true;
  } catch (error) {
    /* Loud, and swallowed. A demand signal is worth a log line and is never
       worth a customer's answer. */
    log.warn({ err: error, intent, outcome }, "[referenceReads] the demand row did not write");
    return false;
  }
}

/**
 * The demand record's value for a finished read — DERIVED from the outcome
 * rather than mapped beside it (law 4).
 *
 * The refusal codes are camelCase because they are TypeScript; the column's
 * values are snake_case because it is SQL. That is a spelling difference and
 * nothing more, so it is spelled mechanically. A hand-written map of pairs is a
 * second list, and a second list shadowing a source of truth always drifts from
 * it — usually on the fifth entry, which nobody adds to both.
 *
 * **It takes the SHAPE rather than one reader's type**, and it lives here
 * rather than beside the makeup reader, because there are two readers now and a
 * second copy of a mechanical spelling rule is the very thing the paragraph
 * above refuses. What both outcomes have in common is exactly what this needs:
 * they either delivered or they carry a refusal with a code.
 */
export function referenceReadOutcomeFor(
  outcome: { ok: true } | { ok: false; refusal: { code: string } },
): string {
  if (outcome.ok) return "delivered";
  return outcome.refusal.code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
