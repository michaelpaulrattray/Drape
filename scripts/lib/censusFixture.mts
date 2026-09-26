/**
 * THE CENSUS'S OWN FIXTURE — a PRISTINE cast that stays pristine.
 *
 * # Why the outsider's standing cast was the wrong subject (found 2026-08-21,
 * the census's first run)
 *
 * `ensureOutsider()` hands back the account's NEWEST ready cast. After the
 * words-road court (opus-960) that was the court's clone, wearing the two
 * tattoos the court had paid for. Every `state: "master"` row of the corpus was
 * therefore driven against a branch that wore a chest piece: six ink asks came
 * back with the chest sentence, a transform on "no ink" rendered, a removal
 * pruned to the original. All correct product behaviour — for a different
 * question than the corpus was asking. The census found it through its own
 * belief-mismatch findings, which is the instrument working; this module is
 * what stops it happening again.
 *
 * # What it does
 *
 * Clones the donor's cast the way `ensureOutsider` does — session, roll, a
 * settled zero-credit operation, one ready candidate pointing at the donor's
 * image and identity — under the outsider's account, tagged on its own
 * operation's `clientRequestId` so two runs produce one fixture. Then it ASSERTS the state the corpus assumes:
 * no variants, no selected face. The census never renders (the claim door is
 * shut), so nothing it does can add a variant; if one ever appears, somebody
 * else drove this cast, and the drive refuses rather than measuring a branch
 * as a master.
 *
 * Dev only, like its parent. Writes at most one session, one roll, one
 * operation and one candidate, once.
 */
import { randomUUID } from "node:crypto";

import { openDatabase } from "./dbConnection.mts";
import { DONOR_OPEN_ID } from "./outsider.mts";

/**
 * THE NAME THIS FIXTURE IS FOUND BY, and it lives on the fixture's own
 * operation row (#1364).
 *
 * It used to be written into the retired disposition column that migration
 * `0068` DROPPED (#1241) — so the lookup below could not execute at all: it died
 * on `Unknown column` the moment it touched a database. The tag now goes in
 * `generation_operations.clientRequestId`, and that column was already the right
 * home rather than the nearest one:
 *
 * - **the fixture writes that row itself**, at zero credits, and was spending
 *   the field on a `randomUUID()` nothing ever read back;
 * - **`UNIQUE(userId, clientRequestId)`** is exactly what a fixture tag means —
 *   one per account, found the second time instead of duplicated. The old
 *   SELECT-then-INSERT was a check-then-write with no constraint under it;
 * - it needs **no migration**, and #1241 had just removed one;
 * - it stays **readable** in dev data, which is a fixture's whole point.
 *
 * Declined, and named so the next reader does not re-open it: a dedicated column
 * (a migration for dev tooling); the roll's `briefText` (it carries the DONOR's
 * brief, which the census measures — overwriting it would change what the corpus
 * reads); `payloadHash` (varchar(64), and a sha256 of the tag would make the row
 * unreadable to a human poking at dev rows); a file beside the tree (the scratch
 * directory is shared between seats and a worktree can be fresh).
 *
 * ⚠ **≤ 36 characters.** `clientRequestId` is `varchar(36) NOT NULL`, and MySQL
 * refuses a longer value outright rather than truncating it — which is why this
 * is a comment and not a guard.
 */
export const CENSUS_FIXTURE_TAG = "census-fixture-pristine";

export type CensusFixture = {
  userId: number;
  candidateId: number;
  candidatePublicId: string;
};

/**
 * ⚠ THE COMPLAINT IS THE SENTENCE, not a frame around one (taken fable-1332 §3).
 *
 * It used to wrap every detail in *"the census fixture is not a bare master …
 * refusing to measure a branch as a master"*, which was true of the one case it
 * was written for and the OPPOSITE of the next one: a branch fixture whose
 * record claims a delivered tattoo its table does not hold got a sentence about
 * masters. An error class that explains a caller's complaint back to it in the
 * wrong words is a smaller version of the thing this whole file guards against.
 */
export class ContaminatedFixtureError extends Error {
  constructor(detail: string) {
    super(`the census fixture is not the state the corpus declares: ${detail} — see scripts/lib/censusFixture.mts`);
  }
}

export async function ensureCensusFixture(input: { userId: number; donorOpenId?: string }): Promise<CensusFixture> {
  if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
    throw new Error("the census fixture is written in DEV only");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("no DATABASE_URL");
  const conn = await openDatabase(url);
  try {
    const [mine] = await conn.execute(
      `SELECT c.id, c.publicId FROM casting_candidates c
         JOIN casting_rolls r ON r.id = c.rollId
         JOIN generation_operations o ON o.id = r.operationId
        WHERE c.userId = ? AND o.clientRequestId = ? AND c.status = 'ready'
        ORDER BY c.id ASC LIMIT 1`,
      [input.userId, CENSUS_FIXTURE_TAG],
    );
    let found = (mine as Array<{ id: number; publicId: string }>)[0] ?? null;

    if (!found) {
      const [donors] = await conn.execute(
        `SELECT c.imageKey, c.thumbKey, c.internalPrompt, c.provider, c.providerModel, r.briefText
           FROM casting_candidates c
           JOIN casting_rolls r ON r.id = c.rollId
           JOIN users u ON u.id = c.userId
          WHERE u.openId = ? AND c.status = 'ready' AND c.imageKey IS NOT NULL AND c.internalPrompt IS NOT NULL
          ORDER BY c.id DESC LIMIT 1`,
        [input.donorOpenId ?? DONOR_OPEN_ID],
      );
      const donor = (donors as Array<{
        imageKey: string; thumbKey: string | null; internalPrompt: unknown;
        provider: string | null; providerModel: string | null; briefText: string;
      }>)[0];
      if (!donor) throw new Error("no donor cast to clone for the census fixture");

      const sessionPublicId = randomUUID();
      await conn.execute(
        `INSERT INTO casting_sessions (publicId, userId, originType, status) VALUES (?, ?, 'roster', 'open')`,
        [sessionPublicId, input.userId],
      );
      const [session] = await conn.execute(`SELECT id FROM casting_sessions WHERE publicId = ?`, [sessionPublicId]);
      const sessionId = (session as Array<{ id: number }>)[0]!.id;
      const operationId = randomUUID();
      await conn.execute(
        `INSERT INTO generation_operations
           (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits, chargedCredits)
         VALUES (?, ?, ?, 'casting.fixture', ?, 'succeeded', 0, 0)`,
        /* The tag rides `clientRequestId` — see {@link CENSUS_FIXTURE_TAG}. Its
           UNIQUE(userId, clientRequestId) is what makes a second fixture on one
           account impossible rather than merely unlikely. */
        [operationId, input.userId, CENSUS_FIXTURE_TAG, `census-fixture-${operationId}`],
      );
      const rollPublicId = randomUUID();
      await conn.execute(
        `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId, status, priceCredits)
         VALUES (?, ?, ?, 1, ?, ?, 'complete', 0)`,
        [rollPublicId, sessionId, input.userId, donor.briefText, operationId],
      );
      const [roll] = await conn.execute(`SELECT id FROM casting_rolls WHERE publicId = ?`, [rollPublicId]);
      const rollId = (roll as Array<{ id: number }>)[0]!.id;
      const candidatePublicId = randomUUID();
      await conn.execute(
        `INSERT INTO casting_candidates
           (publicId, rollId, sessionId, userId, position, status, pointsCost, imageKey, thumbKey,
            internalPrompt, provider, providerModel)
         VALUES (?, ?, ?, ?, 1, 'ready', 0, ?, ?, ?, ?, ?)`,
        [
          candidatePublicId, rollId, sessionId, input.userId, donor.imageKey, donor.thumbKey,
          typeof donor.internalPrompt === "string" ? donor.internalPrompt : JSON.stringify(donor.internalPrompt),
          donor.provider, donor.providerModel,
        ],
      );
      await conn.execute(`UPDATE casting_sessions SET activeRollId = ? WHERE id = ?`, [rollId, sessionId]);
      const [made] = await conn.execute(`SELECT id, publicId FROM casting_candidates WHERE publicId = ?`, [candidatePublicId]);
      found = (made as Array<{ id: number; publicId: string }>)[0]!;
      process.stderr.write(`[census-fixture] cloned a pristine cast ${found.publicId} for user ${input.userId}\n`);
    }

    /* THE ASSERTION THE CORPUS RESTS ON — driven every run, never assumed. */
    const [variants] = await conn.execute(
      `SELECT COUNT(*) AS n FROM casting_candidate_variants WHERE candidateId = ?`, [found.id],
    );
    const n = Number((variants as Array<{ n: number }>)[0]!.n);
    if (n !== 0) throw new ContaminatedFixtureError(`${n} variant(s) on candidate ${found.publicId}`);
    const [selected] = await conn.execute(
      `SELECT selectedVariantId FROM casting_candidates WHERE id = ?`, [found.id],
    );
    const sel = (selected as Array<{ selectedVariantId: number | null }>)[0]!.selectedVariantId;
    if (sel !== null) throw new ContaminatedFixtureError(`selectedVariantId = ${sel}`);

    return { userId: input.userId, candidateId: found.id, candidatePublicId: found.publicId };
  } finally {
    await conn.end();
  }
}
