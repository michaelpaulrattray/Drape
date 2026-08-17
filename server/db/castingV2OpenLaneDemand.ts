/**
 * THE OPEN LANE'S DEMAND RECORD — the writer (OPEN_LANE_DESIGN_NOTE §7, §8 step
 * 6; ordered fable-874 §3b to land with the acceptance path rather than behind
 * it).
 *
 * # What it is for
 *
 * One row is: somebody asked for a thing the catalogue does not own, and this
 * is how it went. It is the instrument the promotion decision reads — *eleven
 * people asked for horns and seven got them* — and per ruling 5 that decision
 * stays a human one reading this table.
 *
 * The founder's own condition on shipping the lane is what makes it part of the
 * same promise rather than a follower: *"so these things dont exist so they
 * will be a little unreliable at first but we can track and make them more
 * reliable right"*. The tracking he conditioned on has to be real on the day
 * the first open ask sells.
 *
 * # THE COLUMN LIST IS THE PRIVACY BOUNDARY, and this file may not widen it
 *
 * `kind`, `outcome`, `createdAt`. Not the sentence, not the account, not the
 * cast, not an image key — **absent from the row rather than omitted from a
 * projection** (invariant 8, and ruling 4's own instruction). A staff member
 * reading this learns that eleven people asked for horns; they learn nothing
 * whatever about any one of them. `kind` is the NORMALIZED key the code minted,
 * never the customer's words.
 *
 * # IT MAY NEVER BLOCK A RENDER
 *
 * This is telemetry riding a paid path. It fails soft and LOUD — logged, never
 * thrown — for the same reason the mint does: nothing here may take a picture
 * back from somebody who paid for it. Every caller is fire-and-forget by
 * construction, because this function cannot reject.
 */
import { createModuleLogger } from "../logging/logger";
import { getDb } from "./connection";
import { castingOpenLaneDemand, CASTING_OPEN_LANE_OUTCOMES } from "../../drizzle/schema";

const log = createModuleLogger("db/castingV2OpenLaneDemand");

export type OpenLaneDemandOutcome = (typeof CASTING_OPEN_LANE_OUTCOMES)[number];

/**
 * Record one open-lane ask and how it went.
 *
 * Resolves to `true` when a row was written and `false` when one was not, so a
 * test can tell a write from a swallowed failure — a helper that returns
 * nothing either way is one whose failures are indistinguishable from its
 * successes, which is the shape this campaign keeps paying for. **Callers are
 * not expected to read it**; nothing about a render may depend on it.
 */
export async function recordOpenLaneDemand(
  kind: string,
  outcome: OpenLaneDemandOutcome,
): Promise<boolean> {
  /*
    THE KEY IS CHECKED HERE TOO, and it is not paranoia about our own callers.

    `kind` is a varchar(64) and the one thing that must never reach this column
    is a customer's sentence wearing a key's clothes. The normalizer's grammar
    is a single lowercase token; anything else is a bug upstream, and writing it
    would put words in the one table built to hold none.
  */
  if (!/^[a-z][a-z'-]*$/.test(kind) || kind.length > 64) {
    log.warn({ length: kind.length }, "[openLaneDemand] refusing a key that is not the normalizer's — no row");
    return false;
  }
  try {
    const db = await getDb();
    /* No database is not an error worth a stack trace — it is a test process or
       a boot before the pool exists, and telemetry is the last thing that
       should notice. */
    if (!db) return false;
    await db.insert(castingOpenLaneDemand).values({ kind, outcome });
    log.info({ kind, outcome }, "[openLaneDemand] recorded");
    return true;
  } catch (error) {
    /* Loud, and swallowed. A promotion signal is worth a log line and is never
       worth a customer's picture. */
    log.warn({ err: error, kind, outcome }, "[openLaneDemand] the demand row did not write");
    return false;
  }
}
