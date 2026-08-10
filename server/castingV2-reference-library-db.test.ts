/**
 * The reference library against a real database (migration 0028).
 *
 * The unit tests prove the decisions — which rows are live, which shapes are
 * refused. This file proves the **statements**, and there are three of them
 * that cannot be proved any other way:
 *
 *  1. a stranger cannot file a reference against someone else's face, and the
 *     `candidateId` on a row is the one its parent carries rather than the one
 *     the caller sent;
 *  2. the lineage walk answers per BRANCH — a fork does not inherit its
 *     sibling's edits, and master-minted rows belong to every branch (that
 *     second half is a LEFT JOIN, and a plain join would silently drop her own
 *     eyes out of every library while every test that mocked it stayed green);
 *  3. the candidate sweep carries a library crop's key onto the same cleanup
 *     manifest as the candidate's own objects, in the same transaction, and
 *     deletes the words-only rows that hand it nothing.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --suite
 * server/castingV2-reference-library-db.test.ts`, which creates one, replays
 * the migrations into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* The database is a hosted one across the network; 5s is a local-disk number. */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("the reference library (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let library: typeof import("./db/castingV2ReferenceLibrary");
  let retention: typeof import("./castingV2/candidateRetention");

  const geometry = {
    bbox: { x: 10, y: 20, width: 120, height: 80 },
    frame: { width: 1024, height: 1536 },
  };
  const guard = { kind: "hair", coverage: 9460, spill: 120, threshold: 9460 };

  /** The production write, with its manifest — never a shortcut around it. */
  async function fileRows(input: {
    userId: number;
    variantId: number | null;
    candidateId?: number;
    rows: Parameters<typeof library.recordReferenceRows>[0]["rows"];
  }) {
    const keys = input.rows
      .flatMap((row) => [
        row.image?.storageKey,
        row.image?.maskKey,
        /* A refused crop's pair is objects too (migration 0029), and it goes on
           the same manifest by the same rule — the production write refuses
           without one. */
        row.refusal?.crop?.contentKey,
        row.refusal?.crop?.maskKey,
      ])
      .filter((key): key is string => Boolean(key));
    let cleanupBatchId: string | undefined;
    if (keys.length > 0) {
      cleanupBatchId = randomUUID();
      await connection.execute(
        "INSERT INTO storage_cleanup_batches (id, userId, operationId, kind, status, expectedCount, deletedCount, failedCount)"
          + " VALUES (?, ?, ?, 'casting_candidate_cleanup', 'pending', ?, 0, 0)",
        [cleanupBatchId, input.userId, randomUUID(), keys.length],
      );
      for (const storageKey of keys) {
        await connection.execute(
          "INSERT INTO storage_cleanup_items (batchId, storageKey, storageBackend, status, attempts) VALUES (?, ?, 'public_r2', 'pending', 0)",
          [cleanupBatchId, storageKey],
        );
      }
    }
    const recorded = await library.recordReferenceRows({
      userId: input.userId,
      variantId: input.variantId,
      candidateId: input.candidateId,
      rows: input.rows,
      cleanupBatchId,
    });
    return { recorded, cleanupBatchId };
  }

  function crop(slot: string, words: string[], storageKey: string) {
    return {
      role: "carry" as const,
      slot,
      tier: "anatomy" as const,
      noun: slot,
      words,
      image: {
        storageKey,
        maskKey: `${storageKey.replace(/\.png$/, "")}-mask.png`,
        digest: randomUUID().replace(/-/g, "").padEnd(64, "0"),
        geometry,
        guard,
      },
    };
  }

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`library-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  async function newFace(userId: number): Promise<{
    sessionId: number;
    candidateId: number;
    variantId: number;
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
    const [candidate] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidates (publicId, rollId, sessionId, userId, position, status, imageKey, thumbKey)"
        + " VALUES (?, ?, ?, ?, 0, 'ready', ?, ?)",
      [randomUUID(), roll.insertId, session.insertId, userId, `faces/${randomUUID()}.png`, `faces/${randomUUID()}-thumb.png`],
    );
    const variantId = await newVariant({
      userId,
      sessionId: session.insertId,
      candidateId: candidate.insertId,
      parentVariantId: null,
    });
    return { sessionId: session.insertId, candidateId: candidate.insertId, variantId };
  }

  async function newVariant(input: {
    userId: number;
    sessionId: number;
    candidateId: number;
    parentVariantId: number | null;
  }): Promise<number> {
    const [variant] = await connection.execute<ResultSetHeader>(
      "INSERT INTO casting_candidate_variants (publicId, candidateId, sessionId, userId, status, instructions, operationId, parentVariantId)"
        + " VALUES (?, ?, ?, ?, 'ready', ?, ?, ?)",
      [
        randomUUID(),
        input.candidateId,
        input.sessionId,
        input.userId,
        JSON.stringify(["give her a blunt bob"]),
        randomUUID(),
        input.parentVariantId,
      ],
    );
    return variant.insertId;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM casting_reference_library LIKE 'role'",
    );
    if (columns.length !== 1) {
      throw new Error("Disposable database must have the reference-library migration applied");
    }

    owner = await newUser("Library Owner");
    stranger = await newUser("Library Stranger");
    library = await import("./db/castingV2ReferenceLibrary");
    retention = await import("./castingV2/candidateRetention");
  });

  afterAll(async () => {
    await connection?.end();
  });

  beforeEach(async () => {
    await connection.query("DELETE FROM casting_reference_library");
  });

  it("anchors a row to the candidate its variant belongs to, and discharges the manifest", async () => {
    const face = await newFace(owner);
    const { recorded, cleanupBatchId } = await fileRows({
      userId: owner,
      variantId: face.variantId,
      rows: [crop("hair", ["a blunt shoulder-length bob"], `casting-v2/library/${randomUUID()}.png`)],
    });

    expect(recorded[0]!.candidateId).toBe(face.candidateId);
    expect(recorded[0]!.version).toBe(1);

    const [batches] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_batches WHERE id = ?",
      [cleanupBatchId],
    );
    expect(batches[0]!.n).toBe(0);

    const live = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
    });
    expect(live).toHaveLength(1);
    expect(live[0]!.slot).toBe("hair");
    expect(live[0]!.words).toEqual(["a blunt shoulder-length bob"]);
    expect(live[0]!.geometry).toEqual(geometry);
    expect(live[0]!.guard).toEqual(guard);
  });

  it("refuses a reference filed against someone else's variant, and writes nothing", async () => {
    const face = await newFace(owner);
    await expect(fileRows({
      userId: stranger,
      variantId: face.variantId,
      rows: [crop("hair", ["stolen"], "casting-v2/library/thief.png")],
    })).rejects.toThrow(/variant not available/);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_reference_library",
    );
    expect(rows[0]!.n).toBe(0);
  });

  it("refuses a master-minted row against someone else's candidate", async () => {
    const face = await newFace(owner);
    await expect(fileRows({
      userId: stranger,
      variantId: null,
      candidateId: face.candidateId,
      rows: [crop("lips", ["full"], "casting-v2/library/thief-lips.png")],
    })).rejects.toThrow(/candidate not available/);
  });

  it("counts versions per slot and role, past retired rows", async () => {
    const face = await newFace(owner);
    const base = { userId: owner, variantId: face.variantId };
    await fileRows({ ...base, rows: [crop("hair", ["a bob"], "casting-v2/library/1.png")] });
    await fileRows({ ...base, rows: [crop("hair", ["a bob", "shorter"], "casting-v2/library/2.png")] });

    const rows = await library.listReferenceHistory({ userId: owner, candidateId: face.candidateId });
    expect(rows.map((row) => row.version).sort()).toEqual([1, 2]);

    /* The branch's answer is the newest one, and the predecessor stays
       readable — it is evidence of a render that was delivered. */
    const live = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
    });
    const { liveReferences } = await import("./castingV2/referenceLibrary");
    expect(liveReferences(live).map((row) => row.storageKey)).toEqual(["casting-v2/library/2.png"]);
  });

  /*
    THE BRANCH QUESTION, and the reason the walk is a recursive CTE rather than
    a `WHERE candidateId = ?`. A fork sees its own ancestry and nothing else;
    a master-minted row has no ancestor to hang from and belongs to everyone.
  */
  it("gives each branch its own answer, and gives every branch the master's rows", async () => {
    const face = await newFace(owner);
    await fileRows({
      userId: owner,
      variantId: null,
      candidateId: face.candidateId,
      rows: [crop("eye@left", ["hazel"], "casting-v2/library/born-eye.png")],
    });
    await fileRows({
      userId: owner,
      variantId: face.variantId,
      rows: [crop("hair", ["a blunt bob"], "casting-v2/library/branch-a.png")],
    });

    const sibling = await newVariant({
      userId: owner,
      sessionId: face.sessionId,
      candidateId: face.candidateId,
      parentVariantId: null,
    });
    await fileRows({
      userId: owner,
      variantId: sibling,
      rows: [crop("hair", ["a long shag"], "casting-v2/library/branch-b.png")],
    });

    const onA = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
    });
    expect(onA.map((row) => row.storageKey).sort())
      .toEqual(["casting-v2/library/born-eye.png", "casting-v2/library/branch-a.png"]);

    const onB = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: sibling,
    });
    expect(onB.map((row) => row.storageKey).sort())
      .toEqual(["casting-v2/library/born-eye.png", "casting-v2/library/branch-b.png"]);

    /* A child of A inherits A and still never sees B. */
    const child = await newVariant({
      userId: owner,
      sessionId: face.sessionId,
      candidateId: face.candidateId,
      parentVariantId: face.variantId,
    });
    const onChild = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: child,
    });
    expect(onChild.map((row) => row.storageKey).sort())
      .toEqual(["casting-v2/library/born-eye.png", "casting-v2/library/branch-a.png"]);
  });

  it("takes an introduced thing off ONE branch and leaves the fork wearing it", async () => {
    const face = await newFace(owner);
    await fileRows({
      userId: owner,
      variantId: face.variantId,
      rows: [{
        role: "anchor",
        slot: "earring@left",
        tier: "item",
        noun: "left earring",
        words: ["a wide gold hoop"],
        image: { storageKey: "casting-v2/library/hoop.png", digest: "f".repeat(64) },
      }],
    });
    const fork = await newVariant({
      userId: owner,
      sessionId: face.sessionId,
      candidateId: face.candidateId,
      parentVariantId: face.variantId,
    });

    const retired = await library.retireReferenceSlot({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
      slot: "earring@left",
    });
    expect(retired).toBe(1);

    const { liveReferences } = await import("./castingV2/referenceLibrary");
    const onBranch = liveReferences(await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
    }));
    expect(onBranch).toEqual([]);

    /* The fork's own walk finds the same row, retired — she took it off before
       forking, so the fork does not put it back on. The branch-scoped case is
       the one the undo is about; this asserts the retire did not reach past it
       into a row it was never handed. */
    const rowsOnFork = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: fork,
    });
    expect(rowsOnFork).toHaveLength(1);
    expect(rowsOnFork[0]!.retiredAt).not.toBeNull();
  });

  /*
    THE FOUNDER'S CONDITION, at the row level: a crop of a person's face does
    not outlive the sheet it belonged to. Proved on the real sweep, because a
    purge is a claim until MySQL has deleted the row and the manifest actually
    holds the key.
  */
  it("purges a candidate's library with it — objects onto the manifest, rows gone", async () => {
    const face = await newFace(owner);
    const cropKey = `casting-v2/library/${randomUUID()}.png`;
    await fileRows({
      userId: owner,
      variantId: face.variantId,
      rows: [crop("hair", ["a blunt bob"], cropKey)],
    });
    /* A words-only row hands the worker nothing, and must still be deleted —
       an empty key list must not be read as "no rows". */
    await library.recordReferenceRows({
      userId: owner,
      variantId: face.variantId,
      rows: [{
        role: "carry",
        slot: "skin",
        tier: "surface",
        noun: "skin",
        words: ["a warm even tan"],
      }],
    });

    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    await retention.runCandidateRetentionSweep(new Date());

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_reference_library WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(rows[0]!.n).toBe(0);

    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM storage_cleanup_items WHERE storageKey = ?",
      [cropKey],
    );
    expect(items[0]!.n).toBe(1);
  });

  /*
    THE REFUSED CROP, END TO END (migration 0029).

    Two claims that only a real database can settle: the refusal group comes
    back off the row exactly as it went in — so the adoption sitting can open
    the picture FROM the row rather than from a log line — and the sweep carries
    its two keys onto the manifest. The second is the one that would rot
    quietly: the sweep's SELECT used to name two columns, and a purge that does
    not name a key leaves a piece of a person's face at a public URL forever
    while every count in the report reads correct.
  */
  it("keeps a noSpecimen refusal's picture on the row, and purges it with the face", async () => {
    const face = await newFace(owner);
    const refusedContentKey = `casting-v2/library/${randomUUID()}-refused.png`;
    const refusedMaskKey = `casting-v2/library/${randomUUID()}-refused-mask.png`;
    await fileRows({
      userId: owner,
      variantId: face.variantId,
      rows: [{
        role: "carry",
        slot: "earring@left",
        tier: "item",
        noun: "left earring",
        words: ["a thin gold hoop"],
        refusal: {
          reason: "noSpecimen",
          kind: "earring",
          coverage: 9560,
          crop: { contentKey: refusedContentKey, maskKey: refusedMaskKey },
        },
      }],
    });

    const [stored] = await library.listLineageReferences({
      userId: owner,
      candidateId: face.candidateId,
      anchorVariantId: face.variantId,
    });
    /* Not `storageKey`: the assembler builds its prompt from that column and
       must never be able to see this picture. */
    expect(stored!.storageKey).toBeNull();
    expect(stored!.maskKey).toBeNull();
    expect(stored!.refusal).toEqual({
      reason: "noSpecimen",
      kind: "earring",
      coverage: 9560,
      contentKey: refusedContentKey,
      maskKey: refusedMaskKey,
    });

    await connection.execute(
      "UPDATE casting_candidates SET status = 'expired', expiresAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = ?",
      [face.candidateId],
    );
    await retention.runCandidateRetentionSweep(new Date());

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM casting_reference_library WHERE candidateId = ?",
      [face.candidateId],
    );
    expect(rows[0]!.n).toBe(0);

    const [items] = await connection.query<RowDataPacket[]>(
      "SELECT storageKey FROM storage_cleanup_items WHERE storageKey IN (?, ?)",
      [refusedContentKey, refusedMaskKey],
    );
    expect(items.map((item) => item.storageKey).sort())
      .toEqual([refusedContentKey, refusedMaskKey].sort());
  });
});
