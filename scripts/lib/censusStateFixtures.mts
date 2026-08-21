/**
 * THE CENSUS'S STATE FIXTURES — casts that already WEAR something (extension-1).
 *
 * The corpus's branch rows need a branch. Two fixtures, two provenances:
 *
 * BRANCH-WITH-INK is not manufactured at all. The words-road court (opus-960)
 * paid for two real renders on the outsider's standing cast — variant 502 wears
 * a chest swallow with a real delivery-crop row behind it. The census PINS that
 * cast's selection to the ink variant and ASSERTS the shape the corpus assumes
 * (exactly one delivered slot), every run — "which branch am I measuring" is
 * driven, never inherited. That cast is the same one whose surprise ink ruined
 * run 1; the lesson is not "avoid it", it is "know what it wears".
 *
 * BRANCH-WITH-ACCESSORY is manufactured: a tagged clone plus ONE variant row
 * whose deltas hold a stated accessory, shaped like the real variant rows
 * (501/502 were the template), priced at zero under its own settled operation.
 * Its image is the master's own picture — the census never renders, so no frame
 * exists that could show the glasses; said here so nobody reads the tile as a
 * defect. The variant is the SELECTED face, which is what makes it the branch.
 *
 * Dev only, idempotent, and everything either fixture writes lives under the
 * outsider account the toolshed already owns.
 */
import { randomUUID } from "node:crypto";

import { openDatabase } from "./dbConnection.mts";
import { DONOR_OPEN_ID } from "./outsider.mts";
import { ContaminatedFixtureError } from "./censusFixture.mts";

export type BranchFixture = {
  candidatePublicId: string;
  selectedVariant: string;
  candidateId: number;
  /** What `selectedVariantId` held before the census pinned it — restored after. */
  priorSelection: number | null;
};

/** Put a cast's selection back the way the census found it (drive teardown). */
export async function restoreSelection(fixture: BranchFixture): Promise<void> {
  refuseProduction();
  const conn = await openDatabase(process.env.DATABASE_URL!);
  try {
    await conn.execute(
      `UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?`,
      [fixture.priorSelection, fixture.candidateId],
    );
  } finally {
    await conn.end();
  }
}

const refuseProduction = () => {
  if (process.env.MYSQL_PUBLIC_URL || process.env.RAILWAY_ENVIRONMENT_NAME) {
    throw new Error("census state fixtures are written in DEV only");
  }
};

/**
 * THE FIXTURE IS THIS VARIANT, and it is named rather than searched for
 * (ruled fable-1329 §3, my hands on fable's module).
 *
 * It used to be "the newest ready variant on this account with a delivered
 * upper-chest crop" — a fixture defined by a QUERY, which is a fixture another
 * seat's work can redefine without touching a line of this file. The bare-skin
 * court needs to add a paid step to this very cast, and under newest-wins its
 * new variant would silently BECOME the census's branch: every branch row after
 * it would then measure a court's leftovers.
 *
 * That is the same shape as the defect this module was fixed for one message
 * earlier — a state established once and then decided by something else — so it
 * is closed the same way: by identity.
 */
const INK_BRANCH_VARIANT = "f33e485e-9dfa-4ea0-a7d0-25cfb851ff99"; /* v501, the
  LEFT UPPER ARM swallow — verified against the row and READ AT THE FRAME before
  it was written down. */

/**
 * ⚠ WHY IT IS NOT v502, WHICH THIS CONSTANT NAMED FOR ONE SHIFT (ordered
 * fable-1331 §2, from the bare-skin court's wreckage).
 *
 * v502's chest swallow is real in the picture and its delta says
 * `inkDelivered {"ink:upperChest": …}` — and **no such row was ever written to
 * `casting_ink_delivery_crops`**, because the mint is asked `upper chest` of a
 * chest under a crew tee and D-226 says you cannot segment what is hidden. So
 * the branch's RECORD claims a delivery its table does not hold, and the very
 * next unrelated edit erased the tattoo (measured, opus-976: a freckles ask
 * about his FACE, and the swallow was gone from the frame while the delta went
 * on claiming it).
 *
 * That is the record-versus-pixels shape stored durably, and it is not a
 * branch-with-ink. The corpus's branch rows mean *a cast already WEARING one
 * delivered tattoo*, and `ink.transform.has`'s whole road is *carry her own
 * delivered crop as the source* — which needs a crop that exists.
 *
 * v501 is that branch: one step, same cast, visible ink, and a live crop row
 * (`d27c9c99`, `ink:upperArm@left`, 224x348).
 */

/** The REAL ink branch: pin the outsider's court cast to its chest variant. */
export async function ensureInkBranchFixture(input: { userId: number }): Promise<BranchFixture> {
  refuseProduction();
  const conn = await openDatabase(process.env.DATABASE_URL!);
  try {
    const [rows] = await conn.execute(
      `SELECT v.id, v.publicId, v.candidateId, c.publicId AS candidatePublicId
         FROM casting_candidate_variants v
         JOIN casting_candidates c ON c.id = v.candidateId
        WHERE v.publicId = ? AND c.userId = ? AND v.status = 'ready'`,
      [INK_BRANCH_VARIANT, input.userId],
    );
    const found = (rows as Array<{ id: number; publicId: string; candidateId: number; candidatePublicId: string }>)[0];
    /* The constant is NAMED in the failure, so the next court knows exactly
       what died rather than being told a population is empty. */
    if (!found) {
      throw new Error(`the census's ink branch is variant ${INK_BRANCH_VARIANT} `
        + "(opus-960's chest swallow) and it is not on this account, ready — the court's render is gone");
    }
    const [prior] = await conn.execute(
      `SELECT selectedVariantId FROM casting_candidates WHERE id = ?`, [found.candidateId],
    );
    const priorSelection = (prior as Array<{ selectedVariantId: number | null }>)[0]!.selectedVariantId;
    await conn.execute(`UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?`, [found.id, found.candidateId]);
    const [check] = await conn.execute(
      `SELECT JSON_LENGTH(JSON_EXTRACT(deltas, '$.inkDelivered')) AS slots FROM casting_candidate_variants WHERE id = ?`,
      [found.id],
    );
    const slots = Number((check as Array<{ slots: number }>)[0]!.slots);
    if (slots !== 1) throw new ContaminatedFixtureError(`ink branch wears ${slots} delivered slots, corpus assumes 1`);
    /*
      ⚠ AND THE NAME THE DELTA CARRIES MUST BE A ROW — the assertion's second
      half (ordered fable-1331 §2a).
      
      `JSON_LENGTH(inkDelivered) === 1` reads the RECORD, and a dangling pointer
      passes it perfectly: v502 claimed a delivered chest piece for a crop the
      mint never wrote, and every branch row would have inherited a fixture
      whose record and picture disagree. The corpus means a cast that is WEARING
      one, and only the row can say so.
    */
    const [named] = await conn.execute(
      `SELECT JSON_EXTRACT(deltas, '$.inkDelivered') AS delivered
         FROM casting_candidate_variants WHERE id = ?`,
      [found.id],
    );
    const raw = (named as Array<{ delivered: unknown }>)[0]?.delivered ?? null;
    /* The column comes back as a string on some drivers and an object on
       others — read both rather than trusting one. */
    const delivered = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, string> | null;
    const cropId = delivered === null ? null : Object.values(delivered)[0] ?? null;
    if (cropId === null || cropId === undefined) {
      throw new ContaminatedFixtureError("ink branch names no delivered crop id at all");
    }
    const [row] = await conn.execute(
      `SELECT id FROM casting_ink_delivery_crops WHERE publicId = ?`, [cropId],
    );
    if ((row as Array<unknown>).length === 0) {
      throw new ContaminatedFixtureError(
        `ink branch's delta names delivered crop ${cropId} and no such row exists — `
        + "a record claiming a delivery whose row was never written is not a branch-with-ink",
      );
    }
    return { candidatePublicId: found.candidatePublicId, selectedVariant: found.publicId, candidateId: found.candidateId, priorSelection };
  } finally {
    await conn.end();
  }
}

export const ACCESSORY_FIXTURE_TAG = "capability-census fixture B — branch with accessory, never render";

/** The MANUFACTURED accessory branch: a tagged clone wearing stated glasses. */
export async function ensureAccessoryBranchFixture(input: { userId: number }): Promise<BranchFixture> {
  refuseProduction();
  const conn = await openDatabase(process.env.DATABASE_URL!);
  try {
    const [mine] = await conn.execute(
      `SELECT c.id, c.publicId FROM casting_candidates c
        WHERE c.userId = ? AND c.personaLine = ? AND c.status = 'ready' ORDER BY c.id ASC LIMIT 1`,
      [input.userId, ACCESSORY_FIXTURE_TAG],
    );
    let cand = (mine as Array<{ id: number; publicId: string }>)[0] ?? null;
    if (!cand) cand = await cloneTaggedCast(conn, input.userId, ACCESSORY_FIXTURE_TAG);

    const [existing] = await conn.execute(
      `SELECT id, publicId FROM casting_candidate_variants WHERE candidateId = ? ORDER BY id ASC LIMIT 1`, [cand.id],
    );
    let variant = (existing as Array<{ id: number; publicId: string }>)[0] ?? null;
    if (!variant) {
      const [candRow] = await conn.execute(
        `SELECT sessionId, imageKey, thumbKey, internalPrompt FROM casting_candidates WHERE id = ?`, [cand.id],
      );
      const row = (candRow as Array<{ sessionId: number; imageKey: string; thumbKey: string | null; internalPrompt: unknown }>)[0]!;
      const operationId = randomUUID();
      await conn.execute(
        `INSERT INTO generation_operations (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits, chargedCredits)
         VALUES (?, ?, ?, 'casting.fixture', ?, 'succeeded', 0, 0)`,
        [operationId, input.userId, randomUUID(), `census-accessory-${operationId}`],
      );
      const publicId = randomUUID();
      const deltas = { statedAccessories: ["thin gold-rimmed glasses"] };
      await conn.execute(
        `INSERT INTO casting_candidate_variants
           (publicId, candidateId, sessionId, userId, status, instructions, deltas, stepDeltas, internalPrompt,
            imageKey, thumbKey, pointsCost, operationId, parentVariantId)
         VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, 0, ?, NULL)`,
        [
          publicId, cand.id, row.sessionId, input.userId,
          JSON.stringify(["give her thin gold-rimmed glasses"]),
          JSON.stringify(deltas), JSON.stringify([deltas]),
          typeof row.internalPrompt === "string" ? row.internalPrompt : JSON.stringify(row.internalPrompt),
          row.imageKey, row.thumbKey, operationId,
        ],
      );
      const [made] = await conn.execute(`SELECT id, publicId FROM casting_candidate_variants WHERE publicId = ?`, [publicId]);
      variant = (made as Array<{ id: number; publicId: string }>)[0]!;
      process.stderr.write(`[census-fixture] manufactured accessory branch ${variant.publicId}\n`);
    }
    const [prior] = await conn.execute(
      `SELECT selectedVariantId FROM casting_candidates WHERE id = ?`, [cand.id],
    );
    const priorSelection = (prior as Array<{ selectedVariantId: number | null }>)[0]!.selectedVariantId;
    await conn.execute(`UPDATE casting_candidates SET selectedVariantId = ? WHERE id = ?`, [variant.id, cand.id]);
    return { candidatePublicId: cand.publicId, selectedVariant: variant.publicId, candidateId: cand.id, priorSelection };
  } finally {
    await conn.end();
  }
}

/** The clone step `censusFixture` uses, reusable under any tag. */
async function cloneTaggedCast(
  conn: Awaited<ReturnType<typeof openDatabase>>,
  userId: number,
  tag: string,
): Promise<{ id: number; publicId: string }> {
  const [donors] = await conn.execute(
    `SELECT c.imageKey, c.thumbKey, c.internalPrompt, c.provider, c.providerModel, r.briefText
       FROM casting_candidates c
       JOIN casting_rolls r ON r.id = c.rollId
       JOIN users u ON u.id = c.userId
      WHERE u.openId = ? AND c.status = 'ready' AND c.imageKey IS NOT NULL AND c.internalPrompt IS NOT NULL
      ORDER BY c.id DESC LIMIT 1`,
    [DONOR_OPEN_ID],
  );
  const donor = (donors as Array<{
    imageKey: string; thumbKey: string | null; internalPrompt: unknown;
    provider: string | null; providerModel: string | null; briefText: string;
  }>)[0];
  if (!donor) throw new Error("no donor cast to clone");
  const sessionPublicId = randomUUID();
  await conn.execute(
    `INSERT INTO casting_sessions (publicId, userId, originType, status) VALUES (?, ?, 'roster', 'open')`,
    [sessionPublicId, userId],
  );
  const [session] = await conn.execute(`SELECT id FROM casting_sessions WHERE publicId = ?`, [sessionPublicId]);
  const sessionId = (session as Array<{ id: number }>)[0]!.id;
  const operationId = randomUUID();
  await conn.execute(
    `INSERT INTO generation_operations (id, userId, clientRequestId, kind, payloadHash, status, plannedCredits, chargedCredits)
     VALUES (?, ?, ?, 'casting.fixture', ?, 'succeeded', 0, 0)`,
    [operationId, userId, randomUUID(), `census-clone-${operationId}`],
  );
  const rollPublicId = randomUUID();
  await conn.execute(
    `INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, operationId, status, priceCredits)
     VALUES (?, ?, ?, 1, ?, ?, 'complete', 0)`,
    [rollPublicId, sessionId, userId, donor.briefText, operationId],
  );
  const [roll] = await conn.execute(`SELECT id FROM casting_rolls WHERE publicId = ?`, [rollPublicId]);
  const rollId = (roll as Array<{ id: number }>)[0]!.id;
  const candidatePublicId = randomUUID();
  await conn.execute(
    `INSERT INTO casting_candidates
       (publicId, rollId, sessionId, userId, position, status, pointsCost, imageKey, thumbKey,
        personaLine, internalPrompt, provider, providerModel)
     VALUES (?, ?, ?, ?, 1, 'ready', 0, ?, ?, ?, ?, ?, ?)`,
    [
      candidatePublicId, rollId, sessionId, userId, donor.imageKey, donor.thumbKey, tag,
      typeof donor.internalPrompt === "string" ? donor.internalPrompt : JSON.stringify(donor.internalPrompt),
      donor.provider, donor.providerModel,
    ],
  );
  await conn.execute(`UPDATE casting_sessions SET activeRollId = ? WHERE id = ?`, [rollId, sessionId]);
  const [made] = await conn.execute(`SELECT id, publicId FROM casting_candidates WHERE publicId = ?`, [candidatePublicId]);
  return (made as Array<{ id: number; publicId: string }>)[0]!;
}
