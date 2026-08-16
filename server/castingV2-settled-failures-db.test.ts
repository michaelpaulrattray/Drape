/**
 * `listSettledRefineFailures` against a real database — Landing A's read
 * (`docs/specs/CASTING_V2_REFINE_DISPATCH_DESIGN.md`, ruled fable-836).
 *
 * This read exists because a refine is one long-held mutation: 1.7% of the
 * founder's production refines answered past the observed ~305 s gateway wall,
 * where the socket carrying the answer is gone before the answer exists. The
 * money is safe; the REASON is lost. It is lost twice over, because a terminal
 * failure is in neither of the sheet's two lists (`status = 'ready'` and
 * `status IN ('queued','dispatched')`), so it leaves the payload entirely.
 *
 * Four statements, and **none of them can be proved with a mock** — each is a
 * property of the SQL rather than of a decision above it:
 *
 *  1. a settled failure comes back carrying the OPERATION's sentence, which is
 *     the whole point: the sentence already survives the request on
 *     `generation_operations.publicMessage` and this is the second reader of
 *     that one source;
 *  2. **a stranger gets nothing** — the owner is in the statement (invariant 1)
 *     and the parent is re-anchored in the same one (invariant 2). Sabotaging
 *     those two `eq`s against the dev database returned another account's
 *     outcome sentence, so this arm is a leak test rather than a formality;
 *  3. the recency window really bounds it, so an old outcome is not announced
 *     at somebody tomorrow;
 *  4. a `ready` variant is never in this list — otherwise a delivered edit
 *     would be reported to its owner as a failure.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --suite
 * server/castingV2-settled-failures-db.test.ts`.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* The database is a hosted one across the network; 5s is a local-disk number. */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("settled refine failures (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let variants: typeof import("./db/castingV2Variants");

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`settled-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  async function newFace(userId: number): Promise<{
    sessionId: number;
    candidateId: number;
    candidatePublicId: string;
  }> {
    const [session] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_sessions (publicId, userId, status) VALUES (?, ?, 'open')",
      [randomUUID(), userId],
    );
    const [roll] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_rolls (publicId, sessionId, userId, rollIndex, briefText, status, operationId, priceCredits)"
        + " VALUES (?, ?, ?, 0, 'a wiry cyclist in her 20s', 'complete', ?, 640)",
      [randomUUID(), session.insertId, userId, randomUUID()],
    );
    const candidatePublicId = randomUUID();
    const [candidate] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey)"
        + " VALUES (?, ?, ?, ?, 0, 'ready', ?)",
      [candidatePublicId, roll.insertId, session.insertId, userId, `faces/${randomUUID()}.png`],
    );
    return { sessionId: session.insertId, candidateId: candidate.insertId, candidatePublicId };
  }

  /**
   * A refine that ended, with its operation — the two rows this read joins.
   *
   * The operation is written the way the production path leaves it: a terminal
   * `failed` with a non-empty `publicMessage`, which
   * `finalizeClaimedGenerationOperationFailure` enforces by throwing on an empty
   * one. The age is a parameter because statement 3 is entirely about it.
   *
   * # Why the age is MySQL arithmetic and not a JavaScript `Date`
   *
   * It was a `Date` first, and the window arm failed over a row it should have
   * excluded. The row came back stamped **ten hours in the future**: this
   * fixture's raw `mysql2` connection serialises a `Date` into the session's
   * LOCAL wall clock, while the pool under test compares against a UTC instant.
   * Same column, two clocks, and the offset is exactly this machine's.
   *
   * The read was innocent — driven against the dev database, where the rows were
   * written by the app itself, a 68-hour-old failure is correctly excluded from a
   * one-hour window. Had the fixture been believed, a correct bound would have
   * been "fixed" into a broken one. So the age is computed by the database about
   * its own clock, which is the only clock in this statement.
   */
  async function settledFailure(input: {
    userId: number;
    face: { sessionId: number; candidateId: number };
    message: string;
    requestText: string;
    settledMinutesAgo: number;
    variantStatus?: "failed" | "expired" | "ready";
  }): Promise<string> {
    const operationId = randomUUID();
    await connection.execute(
      "INSERT INTO generation_operations (id, userId, kind, status, clientRequestId, payloadHash, publicMessage,"
        + " errorCode, plannedCredits, chargedCredits, refundedCredits, completedAt)"
        + " VALUES (?, ?, 'castingV2.refine', 'failed', ?, ?, ?, 'PRECONDITION_FAILED', 25, 25, 25,"
        + " DATE_SUB(NOW(), INTERVAL ? MINUTE))",
      [
        operationId,
        input.userId,
        randomUUID(),
        /* NOT NULL and no default — the idempotency key of the request that
           claimed this operation. Any 64 hex characters will do here; nothing
           in this read looks at it. */
        randomUUID().replace(/-/g, "").padEnd(64, "0"),
        input.message,
        input.settledMinutesAgo,
      ],
    );
    const variantPublicId = randomUUID();
    await connection.execute(
      "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions,"
        + " requestText, operationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        variantPublicId,
        input.face.candidateId,
        input.face.sessionId,
        input.userId,
        input.variantStatus ?? "failed",
        JSON.stringify([input.requestText]),
        input.requestText,
        operationId,
      ],
    );
    return variantPublicId;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    owner = await newUser("Settled Owner");
    stranger = await newUser("Settled Stranger");
    variants = await import("./db/castingV2Variants");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_candidate_variants");
    await connection.query("DELETE FROM generation_operations WHERE kind = 'castingV2.refine'");
  });

  it("returns the outcome carrying the OPERATION's own sentence", async () => {
    const face = await newFace(owner);
    const variantPublicId = await settledFailure({
      userId: owner,
      face,
      message: "That one came back with the glasses still in the picture, so it wasn't delivered"
        + " and your credits have been returned. Try saying it a different way.",
      requestText: "take her glasses off",
      settledMinutesAgo: 1,
    });

    const settled = await variants.listSettledRefineFailures(owner, face.candidatePublicId);

    expect(settled).toHaveLength(1);
    expect(settled[0]!.publicId).toBe(variantPublicId);
    /* Her own words, so the outcome names the edit it belongs to (D-163). */
    expect(settled[0]!.requestText).toBe("take her glasses off");
    /* And the actionable half — the part the gateway wall was eating. */
    expect(settled[0]!.publicMessage).toContain("Try saying it a different way");
  });

  it("gives a stranger nothing, even naming the candidate exactly", async () => {
    const face = await newFace(owner);
    await settledFailure({
      userId: owner,
      face,
      message: "That refinement didn't run. You were not charged.",
      requestText: "colour her hair copper",
      settledMinutesAgo: 1,
    });

    /*
      The stranger is a real account with a face of their own, so this cannot
      pass merely because the user does not exist — a null result whose fixture
      could not have produced a row proves nothing (instrument doctrine 6).
    */
    await newFace(stranger);
    const leaked = await variants.listSettledRefineFailures(stranger, face.candidatePublicId);

    expect(leaked).toEqual([]);
  });

  it("bounds the list by the recency window", async () => {
    const face = await newFace(owner);
    await settledFailure({
      userId: owner,
      face,
      message: "That refinement didn't run. You were not charged.",
      requestText: "give her freckles",
      settledMinutesAgo: 180,
    });

    /* Outside the default hour. */
    const bounded = await variants.listSettledRefineFailures(owner, face.candidatePublicId);
    expect(bounded).toEqual([]);

    /* And the SAME row inside a wider one — so the empty above is the window
       doing its job rather than the fixture being unreadable. */
    const widened = await variants.listSettledRefineFailures(owner, face.candidatePublicId, {
      windowMs: 6 * 60 * 60 * 1000,
    });
    expect(widened).toHaveLength(1);
  });

  it("never reports a delivered version as a failure", async () => {
    const face = await newFace(owner);
    await settledFailure({
      userId: owner,
      face,
      message: "irrelevant — this row landed",
      requestText: "give her a blunt bob",
      settledMinutesAgo: 1,
      variantStatus: "ready",
    });

    const settled = await variants.listSettledRefineFailures(owner, face.candidatePublicId);

    expect(settled).toEqual([]);
  });
});
