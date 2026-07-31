/**
 * Casting V2 roll domain against a real database (plan §F, §G, M4).
 *
 * The unit tests prove the *decisions*. This file proves the **statements** —
 * that the SQL those decisions compile to actually races correctly, refuses
 * correctly, and leaves a victim's rows untouched. Nothing here is mocked;
 * every assertion is against MySQL doing what the schema and the CAS
 * predicates say it does.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-roll-domain-disposable.mts`, which creates
 * one, replays the journal into it, runs this file, and drops it again.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
  The disposable database is a hosted one reached over a public proxy, so every
  statement carries real network latency and these cases run dozens of them —
  including deliberate lock contention. The default 5s timeout measures the
  proxy, not the code.
*/
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("Casting V2 roll domain (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let db: typeof import("./db/castingV2");

  const seed = (count = 8) =>
    Array.from({ length: count }, (_, index) => ({
      publicId: randomUUID(),
      position: index,
      personaLine: `axis ${index}`,
      internalPrompt: { prompt: `prompt ${index}` },
    }));

  async function newSession(userId: number) {
    return db.createCastingSession({ userId });
  }

  async function newRoll(userId: number, sessionPublicId: string, overrides: Record<string, unknown> = {}) {
    return db.createRollWithCandidates({
      userId,
      sessionPublicId,
      operationId: randomUUID(),
      briefText: "a wiry cyclist in her 20s",
      candidates: seed(),
      ...overrides,
    } as never);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_candidates LIKE 'signedCastId'",
    );
    if (columns.length !== 1) throw new Error("Disposable database must have migration 0017 applied");

    const [first] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Roll Owner', 1, 1)",
      [`castingv2-owner-${randomUUID()}`],
    );
    owner = first.insertId;
    const [second] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, 'Stranger', 1, 1)",
      [`castingv2-stranger-${randomUUID()}`],
    );
    stranger = second.insertId;
    db = await import("./db/castingV2");
  });

  beforeEach(async () => {
    await connection.execute("DELETE FROM casting_candidates WHERE userId IN (?, ?)", [owner, stranger]);
    await connection.execute("DELETE FROM casting_rolls WHERE userId IN (?, ?)", [owner, stranger]);
    await connection.execute("DELETE FROM casting_sessions WHERE userId IN (?, ?)", [owner, stranger]);
    await connection.execute("DELETE FROM boards WHERE userId IN (?, ?)", [owner, stranger]);
  });

  afterAll(async () => {
    await connection?.end();
  });

  describe("roll index allocation", () => {
    it("gives two tabs sequential indexes instead of a duplicate-key failure", async () => {
      const session = await newSession(owner);
      // Both start before either commits — the exact two-tab race. Without the
      // FOR UPDATE on the session row these collide on
      // unique(sessionId, rollIndex), and in production that collision would
      // land AFTER the charge.
      const [first, second] = await Promise.all([
        newRoll(owner, session.publicId),
        newRoll(owner, session.publicId),
      ]);
      expect([first.roll.rollIndex, second.roll.rollIndex].sort()).toEqual([1, 2]);

      const [rolls] = await connection.query<RowDataPacket[]>(
        "SELECT rollIndex FROM casting_rolls WHERE sessionId = ? ORDER BY rollIndex",
        [first.roll.sessionId],
      );
      expect(rolls.map((row) => row.rollIndex)).toEqual([1, 2]);
    });

    it("creates exactly eight candidates, one per position", async () => {
      const session = await newSession(owner);
      const { roll } = await newRoll(owner, session.publicId);
      const [candidates] = await connection.query<RowDataPacket[]>(
        "SELECT position, status, pointsCost FROM casting_candidates WHERE rollId = ? ORDER BY position",
        [roll.id],
      );
      expect(candidates.map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(candidates.every((row) => row.status === "queued")).toBe(true);
      // The refundable unit, persisted per row rather than divided later.
      expect(candidates.every((row) => row.pointsCost === 20)).toBe(true);
    });
  });

  describe("cross-user refusal leaves the victim untouched", () => {
    it("refuses a stranger's roll into an owned session", async () => {
      const session = await newSession(owner);
      await expect(newRoll(stranger, session.publicId)).rejects.toThrow(/session not found/i);

      // The unchanged-victim assertion: a refusal must not have side effects
      // on the owner's data.
      const [rolls] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM casting_rolls WHERE sessionId = ?",
        [session.id],
      );
      expect(rolls).toHaveLength(0);
    });

    it("refuses a follow that points at someone else's candidate", async () => {
      const session = await newSession(owner);
      const { candidates } = await newRoll(owner, session.publicId);
      const victim = candidates[0];
      await connection.execute(
        "UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE id = ?",
        [victim.id],
      );

      const strangerSession = await newSession(stranger);
      await expect(
        newRoll(stranger, strangerSession.publicId, { parentCandidatePublicId: victim.publicId }),
      ).rejects.toThrow(/candidate not found/i);

      const [after] = await connection.query<RowDataPacket[]>(
        "SELECT status, keptAt FROM casting_candidates WHERE id = ?",
        [victim.id],
      );
      expect(after[0].status).toBe("ready");
      expect(after[0].keptAt).toBeNull();
    });

    it("refuses a session whose origin board belongs to someone else", async () => {
      const [board] = await connection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name) VALUES (?, 'Stranger board')",
        [stranger],
      );
      await expect(
        db.createCastingSession({ userId: owner, originBoardId: board.insertId, originType: "canvas" }),
      ).rejects.toThrow(/board not found/i);

      const [sessions] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM casting_sessions WHERE userId = ?",
        [owner],
      );
      expect(sessions).toHaveLength(0);
    });

    it("refuses an origin item that is not on the named board", async () => {
      const [ownerBoard] = await connection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name) VALUES (?, 'Owner board')",
        [owner],
      );
      const [strangerBoard] = await connection.execute<ResultSetHeader>(
        "INSERT INTO boards (userId, name) VALUES (?, 'Stranger board')",
        [stranger],
      );
      const [item] = await connection.execute<ResultSetHeader>(
        "INSERT INTO board_items (boardId, type, positionX, positionY) VALUES (?, 'model', 0, 0)",
        [strangerBoard.insertId],
      );
      // Invariant 2: proving the board says nothing about the item id sent
      // alongside it. The item is re-anchored to the owned board or refused.
      await expect(
        db.createCastingSession({
          userId: owner,
          originBoardId: ownerBoard.insertId,
          originItemId: item.insertId,
          originType: "canvas",
        }),
      ).rejects.toThrow(/board item not found/i);
    });
  });

  describe("candidate CAS under concurrency", () => {
    async function readyCandidate() {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute(
        "UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE rollId = ?",
        [roll.id],
      );
      return { session, roll, candidate: candidates[0] };
    }

    it("keeps once when two tabs keep at the same moment", async () => {
      const { candidate } = await readyCandidate();
      const results = await Promise.all([
        db.setCandidateKept({ userId: owner, candidatePublicId: candidate.publicId, kept: true }),
        db.setCandidateKept({ userId: owner, candidatePublicId: candidate.publicId, kept: true }),
      ]);
      // Desired-state CAS: one write wins, the other is an idempotent no-op —
      // never a keep followed by an unkeep.
      expect(results.filter((result) => result.changed)).toHaveLength(1);
      expect(results.every((result) => result.found)).toBe(true);
    });

    it("discards once under a double-click, and clears kept", async () => {
      const { candidate } = await readyCandidate();
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidate.publicId, kept: true });
      const results = await Promise.all([
        db.discardCandidate({ userId: owner, candidatePublicId: candidate.publicId }),
        db.discardCandidate({ userId: owner, candidatePublicId: candidate.publicId }),
      ]);
      expect(results.filter((result) => result.changed)).toHaveLength(1);

      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT status, keptAt, expiresAt FROM casting_candidates WHERE id = ?",
        [candidate.id],
      );
      expect(rows[0].status).toBe("discarded");
      // A card cannot be both discarded and shortlisted (§F).
      expect(rows[0].keptAt).toBeNull();
      // Expiry is stamped at discard, not at insert — it is unknowable before.
      expect(rows[0].expiresAt).not.toBeNull();
    });

    it("restores a discard unkept, and only on the active roll", async () => {
      const { session, candidate } = await readyCandidate();
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidate.publicId, kept: true });
      await db.discardCandidate({ userId: owner, candidatePublicId: candidate.publicId });

      expect(await db.undoDiscardCandidate({ userId: owner, candidatePublicId: candidate.publicId })).toBe(true);
      const [restored] = await connection.query<RowDataPacket[]>(
        "SELECT status, keptAt FROM casting_candidates WHERE id = ?",
        [candidate.id],
      );
      expect(restored[0].status).toBe("ready");
      // Kept state is deliberately NOT restored — the dogfood note in §F.
      expect(restored[0].keptAt).toBeNull();

      // Now roll again: the undo stack clears server-side, because the CAS is
      // anchored to the session's active roll.
      await db.discardCandidate({ userId: owner, candidatePublicId: candidate.publicId });
      await newRoll(owner, session.publicId);
      expect(await db.undoDiscardCandidate({ userId: owner, candidatePublicId: candidate.publicId })).toBe(false);
    });

    it("lets exactly one of cancel and dispatch win a queued candidate", async () => {
      const session = await newSession(owner);
      const { candidates } = await newRoll(owner, session.publicId);
      const candidate = candidates[0];

      const [cancelled, dispatched] = await Promise.all([
        db.cancelQueuedCandidate({ userId: owner, candidateId: candidate.id }),
        db.markCandidateDispatched({
          userId: owner,
          candidateId: candidate.id,
          provider: "fal",
          providerModel: "openai/gpt-image-2",
        }),
      ]);
      // This is what makes "never both refunded and delivered" structural.
      expect([cancelled, dispatched].filter(Boolean)).toHaveLength(1);
    });

    it("lands into a cancelled roll as expired, not ready", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      const candidate = candidates[0];
      await db.markCandidateDispatched({
        userId: owner,
        candidateId: candidate.id,
        provider: "fal",
        providerModel: "openai/gpt-image-2",
      });
      await db.setRollStatus({ userId: owner, rollId: roll.id, status: "cancelled" });

      const landing = await db.landCandidate({
        userId: owner,
        candidateId: candidate.id,
        imageKey: "casting-v2/candidates/late.png",
        provider: "fal",
        providerModel: "openai/gpt-image-2",
      });
      // The roll's status is read in the same statement that lands the image.
      expect(landing).toBe("expired");
    });

    it("lets recovery claim only unfinished work, and never a delivered candidate", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute(
        "UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE id IN (?, ?)",
        [candidates[0].id, candidates[1].id],
      );
      // The torn write: `ready` is only written after bytes land, so a ready
      // row without a key means the user cannot see the image.
      await connection.execute(
        "UPDATE casting_candidates SET status = 'ready', imageKey = NULL WHERE id = ?",
        [candidates[1].id],
      );
      await connection.execute("UPDATE casting_candidates SET status = 'discarded' WHERE id = ?", [
        candidates[2].id,
      ]);

      const claim = (id: number) =>
        db.claimCandidateForRecovery({ userId: owner, candidateId: id, failureClass: "unrecovered" });

      // Delivered, and delivered-then-discarded: both refuse. This is the CAS
      // that stops the sweep refunding work the user actually received.
      expect(await claim(candidates[0].id)).toBe(false);
      expect(await claim(candidates[2].id)).toBe(false);
      // Genuinely unfinished, and the torn write: both claimable.
      expect(await claim(candidates[3].id)).toBe(true);
      expect(await claim(candidates[1].id)).toBe(true);
      // And a second sweep cannot claim what the first already settled.
      expect(await claim(candidates[3].id)).toBe(false);
    });

    it("refuses a stranger's keep, discard and undo without touching the row", async () => {
      const { candidate } = await readyCandidate();
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidate.publicId, kept: true });

      expect(
        await db.setCandidateKept({ userId: stranger, candidatePublicId: candidate.publicId, kept: false }),
      ).toMatchObject({ found: false });
      expect(
        await db.discardCandidate({ userId: stranger, candidatePublicId: candidate.publicId }),
      ).toMatchObject({ found: false });
      expect(
        await db.undoDiscardCandidate({ userId: stranger, candidatePublicId: candidate.publicId }),
      ).toBe(false);

      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT status, keptAt FROM casting_candidates WHERE id = ?",
        [candidate.id],
      );
      expect(rows[0].status).toBe("ready");
      expect(rows[0].keptAt).not.toBeNull();
    });
  });

  describe("a session with no rolls is not a sheet yet", () => {
    /*
      Founder bug, 2026-08-01: "if you produce a sheet with 0 rolls — for
      example you write a prompt for a cast and it errors — it should not
      produce a blank unsigned sheet".

      The client creates the session in its own mutation before the brief is
      compiled, so every refused brief (anime, a named person, a sentence with
      no subject in it) left an empty row behind. The card had no brief text —
      that is read from the latest roll — no images and no rolls: debris from an
      error the user was already told about.
    */
    it("keeps a zero-roll session out of the lobby", async () => {
      await newSession(owner);
      expect(await db.listOpenCastingSessions(owner)).toEqual([]);
    });

    it("lists it the moment a roll commits", async () => {
      const session = await newSession(owner);
      expect(await db.listOpenCastingSessions(owner)).toEqual([]);
      await newRoll(owner, session.publicId);
      const listed = await db.listOpenCastingSessions(owner);
      expect(listed.map((entry) => entry.publicId)).toEqual([session.publicId]);
    });

    it("still lists a sheet whose candidates have all failed", async () => {
      /*
        Deliberately NOT hidden. That sheet has a brief, a roll and a charge
        with its refund against it — a workspace to retry in rather than
        debris, and the sheet page's composer is the retry surface.
      */
      const session = await newSession(owner);
      const roll = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'failed' WHERE rollId = ?", [
        roll.roll.id,
      ]);
      await connection.execute("UPDATE casting_rolls SET status = 'failed' WHERE id = ?", [roll.roll.id]);
      const listed = await db.listOpenCastingSessions(owner);
      expect(listed.map((entry) => entry.publicId)).toEqual([session.publicId]);
    });

    it("still lists a sheet that is mid-generation with nothing ready yet", async () => {
      /*
        The reason the filter keys on ROLLS and not on landed candidates. Rows
        commit before dispatch and a sheet takes 66–82s to generate, so a
        "has a ready candidate" filter would hide a sheet for the whole time it
        is being made — which is exactly the sheet someone reopening the lobby
        is looking for.
      */
      const session = await newSession(owner);
      const roll = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'dispatched' WHERE rollId = ?", [
        roll.roll.id,
      ]);
      const listed = await db.listOpenCastingSessions(owner);
      expect(listed.map((entry) => entry.publicId)).toEqual([session.publicId]);
    });

    it("leaves the hidden row for the retention sweep rather than deleting it", async () => {
      /*
        A read filter, not a new disposal path. The row still carries its
        seven-day `expiresAt` from creation and a refusal throws before
        anything touches it, so the existing sweep collects it on schedule.
      */
      const session = await newSession(owner);
      /*
        UTC_TIMESTAMP, not a JS Date through this raw connection. Drizzle
        serializes timestamps as UTC while mysql2's default is the client's
        local zone, so passing a Date here writes a value ten hours away from
        what the query compares against and the test fails for a reason that
        has nothing to do with the code under test.
      */
      await connection.execute(
        "UPDATE casting_sessions SET expiresAt = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE publicId = ?",
        [session.publicId],
      );
      const expired = await db.listExpiredSessions({ limit: 50 });
      expect(expired.some((entry) => entry.id === session.id)).toBe(true);
    });

    it("never leaks another user's sheet through the new predicate", async () => {
      // The EXISTS subquery joins on sessionId; ownership still comes from the
      // session row, and a subquery is a good place to lose a WHERE by accident.
      const mine = await newSession(owner);
      await newRoll(owner, mine.publicId);
      const theirs = await newSession(stranger);
      await newRoll(stranger, theirs.publicId);

      const listed = await db.listOpenCastingSessions(owner);
      expect(listed.map((entry) => entry.publicId)).toEqual([mine.publicId]);
    });
  });

  describe("retention selection", () => {
    it("never offers a kept or signed candidate for purge", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE rollId = ?", [roll.id]);
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidates[0].publicId, kept: true });
      await connection.execute("UPDATE casting_candidates SET status = 'expired' WHERE id IN (?, ?)", [
        candidates[1].id,
        candidates[2].id,
      ]);
      // A kept candidate that was somehow also expired must still be safe.
      await connection.execute("UPDATE casting_candidates SET status = 'expired' WHERE id = ?", [candidates[0].id]);

      const purgeable = await db.listPurgeableCandidates({});
      const ids = purgeable.map((row) => row.id);
      expect(ids).toContain(candidates[1].id);
      expect(ids).toContain(candidates[2].id);
      expect(ids).not.toContain(candidates[0].id);
    });

    it("keeps cancelled candidates until their session goes", async () => {
      const session = await newSession(owner);
      const { candidates } = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'cancelled' WHERE id = ?", [
        candidates[0].id,
      ]);
      // They hold no storage object, so purging frees nothing — and they carry
      // the refund story a cancelled roll shows. Deleting them within the hour
      // would let that history quietly rewrite itself.
      expect((await db.listPurgeableCandidates({})).map((row) => row.id)).not.toContain(candidates[0].id);
    });

    it("keeps a discard purgeable only once it is past retention and no longer undoable", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE rollId = ?", [roll.id]);
      await db.discardCandidate({ userId: owner, candidatePublicId: candidates[0].publicId });

      // Still the active roll and still inside the 24h floor: not purgeable.
      expect((await db.listPurgeableCandidates({})).map((row) => row.id)).not.toContain(candidates[0].id);

      // Age it past the floor — still the active roll, so still undoable.
      await connection.execute(
        "UPDATE casting_candidates SET expiresAt = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?",
        [candidates[0].id],
      );
      expect((await db.listPurgeableCandidates({})).map((row) => row.id)).not.toContain(candidates[0].id);

      // A new roll ends the undo window; now both conditions hold.
      await newRoll(owner, session.publicId);
      expect((await db.listPurgeableCandidates({})).map((row) => row.id)).toContain(candidates[0].id);
    });

    it("spares the kept siblings of a signed candidate when the session expires", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE rollId = ?", [roll.id]);
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidates[1].publicId, kept: true });
      // Stand-in for the Sign CAS (M7): one candidate becomes a Cast.
      await connection.execute(
        "UPDATE casting_candidates SET status = 'signed', signedCastId = 999999 WHERE id = ?",
        [candidates[0].id],
      );

      await db.expireSessionCandidates({ sessionId: session.id, userId: owner });

      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id, status FROM casting_candidates WHERE rollId = ? ORDER BY position",
        [roll.id],
      );
      const byId = new Map(rows.map((row) => [row.id, row.status]));
      // Cast lineage survives, and so does the Siblings card's material.
      expect(byId.get(candidates[0].id)).toBe("signed");
      expect(byId.get(candidates[1].id)).toBe("ready");
      // Everything unused goes with the sheet.
      expect(byId.get(candidates[2].id)).toBe("expired");
    });

    it("expires the kept candidates of a session that never signed anything", async () => {
      const session = await newSession(owner);
      const { roll, candidates } = await newRoll(owner, session.publicId);
      await connection.execute("UPDATE casting_candidates SET status = 'ready', imageKey = 'k' WHERE rollId = ?", [roll.id]);
      await db.setCandidateKept({ userId: owner, candidatePublicId: candidates[0].publicId, kept: true });

      await db.expireSessionCandidates({ sessionId: session.id, userId: owner });

      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT status FROM casting_candidates WHERE id = ?",
        [candidates[0].id],
      );
      // §G.6: a session that never signed protects nothing. Kept-but-unsigned
      // candidates purge with their sheet.
      expect(rows[0].status).toBe("expired");
    });
  });
});
