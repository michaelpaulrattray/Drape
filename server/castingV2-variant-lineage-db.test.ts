/**
 * THE LINEAGE COLUMN AND THE PARENT'S OWNER, against a real database.
 *
 * # Why this file exists, and it is the whole point of it
 *
 * Both arms below lived in `server/castingV2-segment-store-db.test.ts` until
 * #1160 slice 3 deleted that suite with the store it drove. **Neither of them
 * was ever about the segment store.** They are about `claimVariant` and about
 * `casting_candidate_variants.parentVariantId` — the lineage column the
 * REFERENCE LIBRARY's carry rests on, which is written on every claim, and which
 * has nothing to do with segments beyond having arrived in the same ceremony.
 *
 * ⚠ A SUITE'S NAME IS NOT ITS POPULATION, and this is the fourth time #1160 has
 * been handed that lesson: slice 2 rescued `maskFetchUrl` (the face panel's
 * stencil wire) out of `segmentsOnFace.ts`, slice 3 rescued
 * `resolveOwnedCandidateId` (the face panel's OWNERSHIP check) out of
 * `castingV2Segments.ts`, stamped the ceremony script rather than deleting it
 * because half of what it landed is this very column — and then found these two
 * arms. **It was `suitePointerDiscipline` that caught them**, not a reading: two
 * live modules cite the deleted suite BY NAME as the proof of the
 * migration-before-code rule, and a third mocks around it.
 *
 * # What each arm is for
 *
 *   the lineage column     The ordering rule's proof. `refineService.ts` and
 *                          `db/castingV2Variants.ts` both carry a paragraph
 *                          saying the obvious defence — omit the key so the
 *                          column is omitted — DOES NOT WORK, because Drizzle
 *                          names every column in the schema and passes `default`
 *                          for the ones a caller left out. That paragraph exists
 *                          because believing the opposite shipped an outage, and
 *                          it points HERE for its receipt. Proved by dropping
 *                          the column under a real claim, which is the one way it
 *                          cannot be proved by reading the library.
 *   the parent's owner     Invariant 2, driven: verifying the candidate does not
 *                          validate the parent id handed in beside it. A parent
 *                          on another face is refused inside the statement, not
 *                          by a check before it.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts`, which creates
 * one, replays the journal into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("a variant's lineage and its parent's owner (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let variants: typeof import("./db/castingV2Variants");
  let castingV2: typeof import("./db/castingV2");

  async function newUser(name: string): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, email, approved, emailVerified) VALUES (?, ?, ?, 1, 1)",
      [randomUUID(), name, `${randomUUID()}@example.test`],
    );
    return result.insertId;
  }

  /* The same fixture the deleted suite used, carried across unchanged so the
     arms are the same arms rather than a fresh approximation of them. */
  async function newFace(userId: number) {
    const candidatePublicId = randomUUID();
    const [session] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
      [randomUUID(), userId],
    );
    const [roll] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
        + " VALUES (?, ?, ?, 0, 'a wiry cyclist in her 20s', 'complete', ?, 640)",
      [randomUUID(), session.insertId, userId, randomUUID()],
    );
    const [candidate] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
        + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
      [candidatePublicId, roll.insertId, session.insertId, userId, `faces/${randomUUID()}.png`, `faces/${randomUUID()}-thumb.png`],
    );
    const [variant] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId)"
        + " VALUES (?, ?, ?, ?, 'ready', ?, ?)",
      [randomUUID(), candidate.insertId, session.insertId, userId, JSON.stringify(["give her freckles"]), randomUUID()],
    );
    return { candidateId: candidate.insertId, candidatePublicId, variantId: variant.insertId };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    /* The prerequisite this file actually needs, asserted rather than assumed —
       and it is the LINEAGE column now, not the segment store's table. */
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_candidate_variants LIKE 'parentVariantId'",
    );
    if (columns.length !== 1) {
      throw new Error("Disposable database must have the lineage-column migration (0026) applied");
    }
    owner = await newUser("Lineage Owner");
    variants = await import("./db/castingV2Variants");
    castingV2 = await import("./db/castingV2");
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("a variant cannot be claimed at all until the lineage column exists", async () => {
    const face = await newFace(owner);
    await connection.query("ALTER TABLE casting_candidate_variants DROP COLUMN parentVariantId");
    try {
      await expect(variants.claimVariant({
        userId: owner,
        candidatePublicId: face.candidatePublicId,
        operationId: randomUUID(),
        pointsCost: 25,
        /* No parent at all — and it STILL cannot run, which is the whole finding:
           Drizzle names the column whether or not the caller supplies it. */
        instructions: ["no parent at all"],
        deltas: null,
        stepDeltas: null,
      })).rejects.toThrow(/parentVariantId/);
    } finally {
      await connection.query("ALTER TABLE casting_candidate_variants ADD COLUMN parentVariantId int");
    }
  });

  /*
    THE FACE PANEL'S OWNERSHIP CHECK, AS BEHAVIOUR — #1181 option A.

    `resolveOwnedCandidateId` arrived in this file's own neighbourhood with slice
    3 and was never driven anywhere: sabotage deleted the owner from its WHERE
    and the entire suite stayed green but for the atlas fingerprint's reds. The
    static half of the repair is <server/facePanelOwnership.test.ts>, which
    proves the LINE on every PR; this proves the BEHAVIOUR, against real SQL,
    and it is the arm that could not exist until this harness did.

    ⚠ ITS LIMIT IS THE ONE THAT MATTERS AND IT IS NOT HIDDEN: it skips without
    TEST_DATABASE_URL, so it does not run on the gate. Coverage that reports
    green by not running is why the static half is not optional.
  */
  it("refuses a candidate that belongs to another account (the face panel's ownership check)", async () => {
    const stranger = await newUser("Ownership Stranger");
    const theirs = await newFace(stranger);
    /* POSITIVE CONTROL FIRST: the id is a real, resolvable one for its owner, so
       a refusal below is about the OWNER and not about a fixture that never
       existed — an arm that passes because nothing is there is the accept-arm
       class this repository has been bitten by. */
    await expect(castingV2.resolveOwnedCandidateId({
      userId: stranger, candidatePublicId: theirs.candidatePublicId,
    })).resolves.toBe(theirs.candidateId);
    await expect(castingV2.resolveOwnedCandidateId({
      userId: owner, candidatePublicId: theirs.candidatePublicId,
    })).rejects.toThrow(/candidate not found/i);
  });

  it("refuses a parent variant that belongs to another face", async () => {
    const mine = await newFace(owner);
    const other = await newFace(owner);
    const theirs = await variants.claimVariant({
      userId: owner, candidatePublicId: other.candidatePublicId, operationId: randomUUID(),
      pointsCost: 25, instructions: ["x"], deltas: null, stepDeltas: null,
    });
    await expect(variants.claimVariant({
      userId: owner, candidatePublicId: mine.candidatePublicId, operationId: randomUUID(),
      pointsCost: 25, instructions: ["y"], deltas: null, stepDeltas: null,
      parentVariantPublicId: theirs.publicId,
    })).rejects.toThrow(/variant not available/);
  });
});
