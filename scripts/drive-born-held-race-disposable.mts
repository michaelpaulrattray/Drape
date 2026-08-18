/**
 * DRIVE THE RACE, both ways, on real SQL.
 *
 * The defect (shift 60, found by a paid five-ask walk rather than by a test):
 * three writers register a storage-cleanup manifest BEFORE writing the objects
 * it names, and each carries a SYNTHETIC operation id. The cleanup worker's
 * in-flight fence tests that id against a live operation row — a synthetic id
 * matches none, so the fence passes trivially and the manifest is claimable in
 * the window between the manifest and the row insert. On the walk it fired: a
 * sweep 11 seconds after the mint's manifest deleted the crop and its mask, the
 * mint's row insert then correctly refused to commit rows over bytes scheduled
 * for deletion, and the next render carried a superseded version of the hair.
 *
 * The fix is BORN HELD: the manifest is created `processing` with a lease
 * derived from the operation lease, and the discharge accepts a held batch the
 * worker has never touched.
 *
 * A predicate is not proved by being read, so this drives the real
 * `claimNextStorageCleanupBatch` and the real `recordDetectedSegments` against a
 * throwaway database built from the repo's own migrations. Five arms:
 *
 *   A  CONTROL −  an UNHELD manifest is claimed instantly     (the defect, live)
 *   B  THE FIX    a HELD manifest is not claimed in-window
 *   C  RECOVERY   a HELD manifest whose hold LAPSED is claimed (crash collects)
 *   D  DISCHARGE  a held, untouched manifest discharges
 *   E  SAFETY     a held manifest the worker CLAIMED refuses to discharge
 *
 * Arm A is the one that makes the rest evidence. Without it, arm B's "not
 * claimed" is indistinguishable from a driver that never claims anything.
 *
 * It never touches the database named in DATABASE_URL, and refuses if that URL
 * did not come from `.env` or looks like production.
 *
 *   npx tsx scripts/drive-born-held-race-disposable.mts
 */
import "dotenv/config";
/*
  IT DECLARES ITS WORLD, BECAUSE THE SUFFIX NO LONGER EXCUSES IT.
  `scriptWorldGuard` exempted every `-disposable.mts` file by SPELLING until
  2026-08-19; it now exempts by tracking status, and this file is in the
  repository. That is the right way round for this one in particular: it builds
  a THROWAWAY database from the active connection and drops it again, so a
  half-production process is not a wrong reading here — it is a wrong write.
*/
import { assertOneWorld } from "./lib/worldGuard.mts";
assertOneWorld(["DATABASE_URL"]);
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { openDatabase } from "./lib/dbConnection.mts";

const PREFIX = "drape_born_held_race_";

/* The walk's own §2 timeline, in milliseconds. */
const SWEEP_AFTER_MS = 11_000;   // manifest 13:27:49.570Z → sweep 13:28:00.399Z
const WORST_MINT_MS = 70_000;    // the slowest mint observed on a paid render

function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const active = process.env.DATABASE_URL!;
if (databaseUrlFromDotEnv() !== active) {
  throw new Error("Refusing: DATABASE_URL was overridden rather than read from .env. This script creates and drops a database.");
}
const url = new URL(active);
if (["prod", "production"].some((marker) => url.pathname.toLowerCase().includes(marker))) {
  throw new Error(`Refusing: database "${url.pathname}" looks like production`);
}

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) throw new Error("generated an unsafe database name");

/* The server itself, with no database selected — this script creates one. */
const serverUrl = new URL(active);
serverUrl.pathname = "/";
const server = await openDatabase({ uri: serverUrl.toString(), multipleStatements: false });

const throwawayUrl = new URL(active);
throwawayUrl.pathname = `/${databaseName}`;

const results: Array<{ arm: string; expected: string; saw: string; pass: boolean }> = [];
function record(arm: string, expected: string, saw: string, pass: boolean) {
  results.push({ arm, expected, saw, pass });
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${arm}\n        expected ${expected}\n        saw      ${saw}`);
}

let exitCode = 1;
try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  await server.changeUser({ database: databaseName });

  const files = (await readdir("drizzle")).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await server.query(trimmed);
    }
  }
  console.log(`[race] ${databaseName}: ${files.length} migration(s) replayed\n`);

  /* The app's own pool, pointed at the throwaway. Set BEFORE the first import,
     because `getDb()` reads the variable once and caches the pool. */
  process.env.DATABASE_URL = throwawayUrl.toString();

  const { getDb, withTransaction } = await import("../server/db/connection");
  const cleanup = await import("../server/db/storageCleanup");
  const segments = await import("../server/db/castingV2Segments");
  const schema = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const db = (await getDb())!;
  if (!db) throw new Error("the throwaway database refused a connection");

  /* Proof the pool is on the throwaway and not on dev: a table that exists in
     both, counted here, must be empty. Dev has rows in it. */
  const preexisting = await db.select().from(schema.storageCleanupBatches);
  if (preexisting.length !== 0) {
    throw new Error(`Refusing: the connected database already holds ${preexisting.length} cleanup batches — it is not the throwaway`);
  }
  console.log(`[race] connected to ${new URL(process.env.DATABASE_URL!).pathname.slice(1)} · 0 pre-existing batches\n`);

  const userId = 1;
  await db.insert(schema.castingCandidates).values({
    publicId: randomUUID(),
    rollId: 1,
    sessionId: 1,
    userId,
    position: 0,
  });
  const [candidate] = await db.select().from(schema.castingCandidates).limit(1);

  const T0 = new Date("2026-08-13T13:27:49.570Z");
  const IN_WINDOW = new Date(T0.getTime() + SWEEP_AFTER_MS);
  const AFTER_HOLD = new Date(T0.getTime() + cleanup.STORAGE_CLEANUP_MANIFEST_HOLD_MS + 1_000);

  async function manifest(input: { heldUntil: Date | null }) {
    const id = randomUUID();
    await withTransaction((tx) => cleanup.createStorageCleanupManifestIn(tx, {
      id,
      userId,
      operationId: randomUUID(),   // synthetic — the whole reason the fence is inert
      kind: "casting_candidate_cleanup",
      storageItems: [
        { storageKey: `casting-v2/segments/${id}-mask.png`, storageBackend: "public_r2" as const },
        { storageKey: `casting-v2/segments/${id}-content.png`, storageBackend: "public_r2" as const },
      ],
      heldUntil: input.heldUntil,
    }));
    return id;
  }

  /*
    Each arm starts from an empty table.

    Found by the sabotage run rather than by design: with the discharge
    predicate broken, arm D left its batch behind, and arm C — which claims the
    OLDEST due batch — then took D's leftover instead of its own and reported a
    failure it had not earned. An arm whose verdict depends on a previous arm's
    success cannot be read on the day something is wrong, which is the only day
    it matters.
  */
  async function clear() {
    await db.delete(schema.storageCleanupItems);
    await db.delete(schema.storageCleanupBatches);
  }

  const sweep = (now: Date) => cleanup.claimNextStorageCleanupBatch({
    leaseToken: randomUUID().slice(0, 32),
    now,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    privateEvidenceAvailable: true,
  });

  const discharge = (cleanupBatchId: string, facet: string) => segments.recordDetectedSegments({
    userId,
    candidateId: candidate.id,
    detector: "born-held-race-driver",
    cleanupBatchId,
    detections: [{
      facet,
      region: "face skin",
      maskKey: `casting-v2/segments/${cleanupBatchId}-mask.png`,
      contentKey: `casting-v2/segments/${cleanupBatchId}-content.png`,
      geometry: { bbox: { x: 0, y: 0, width: 4, height: 4 }, frame: { width: 8, height: 8 } },
    }],
  });

  console.log(`── the walk's timeline: manifest at T0, sweep at T0+${SWEEP_AFTER_MS / 1000}s, worst mint ${WORST_MINT_MS / 1000}s\n`);

  /* ── A. CONTROL −. Today's shape, and the defect itself, still live. */
  const unheld = await manifest({ heldUntil: null });
  const claimedUnheld = await sweep(IN_WINDOW);
  record(
    "A  CONTROL −  an UNHELD manifest is claimed mid-write",
    "the sweep TAKES it (this is the defect, and it proves the driver can see it)",
    claimedUnheld?.batch.id === unheld ? "taken" : `not taken (${claimedUnheld?.batch.id ?? "null"})`,
    claimedUnheld?.batch.id === unheld,
  );
  await clear();

  /* ── B. THE FIX. The same sweep, at the same instant, on a held manifest. */
  const held = await manifest({ heldUntil: cleanup.storageCleanupManifestHeldUntil(T0) });
  const claimedHeld = await sweep(IN_WINDOW);
  record(
    "B  THE FIX    a HELD manifest is not claimed in-window",
    "the sweep takes NOTHING",
    claimedHeld === null ? "nothing taken" : `TOOK ${claimedHeld.batch.id}`,
    claimedHeld === null,
  );

  /* The same batch, a mint's worth of time later, is still held — the hold
     covers the whole write rather than merely the first instant of it. */
  const stillHeld = await sweep(new Date(T0.getTime() + WORST_MINT_MS));
  record(
    "B′ THE FIX    still held at the worst mint ever observed",
    `the sweep takes NOTHING at T0+${WORST_MINT_MS / 1000}s`,
    stillHeld === null ? "nothing taken" : `TOOK ${stillHeld.batch.id}`,
    stillHeld === null,
  );

  /* ── D. DISCHARGE. The held, untouched manifest commits its rows. */
  let dischargeSaw = "";
  let dischargePass = false;
  try {
    const recorded = await discharge(held, "marks");
    const batchGone = (await db.select().from(schema.storageCleanupBatches)
      .where(eq(schema.storageCleanupBatches.id, held))).length === 0;
    const itemsGone = (await db.select().from(schema.storageCleanupItems)
      .where(eq(schema.storageCleanupItems.batchId, held))).length === 0;
    dischargePass = recorded.length === 1 && batchGone && itemsGone;
    dischargeSaw = `${recorded.length} segment(s) filed · batch gone ${batchGone} · items gone ${itemsGone}`;
  } catch (error) {
    dischargeSaw = `threw ${(error as Error).message}`;
  }
  record(
    "D  DISCHARGE  a held, untouched manifest discharges",
    "1 segment filed and the manifest removed",
    dischargeSaw,
    dischargePass,
  );

  /* ── C. RECOVERY. A writer that died: the hold lapses, the worker collects. */
  await clear();
  const lapsed = await manifest({ heldUntil: cleanup.storageCleanupManifestHeldUntil(T0) });
  const claimedLapsed = await sweep(AFTER_HOLD);
  record(
    "C  RECOVERY   a HELD manifest whose hold LAPSED is claimed",
    "the sweep TAKES it (a crashed writer still collects itself)",
    claimedLapsed?.batch.id === lapsed ? "taken" : `not taken (${claimedLapsed?.batch.id ?? "null"})`,
    claimedLapsed?.batch.id === lapsed,
  );

  /* ── E. SAFETY. That same swept batch must NOT be dischargeable. */
  let safetySaw = "";
  let safetyPass = false;
  try {
    await discharge(lapsed, "freckles");
    safetySaw = "the discharge SUCCEEDED — rows committed over bytes being deleted";
  } catch (error) {
    const named = (error as Error).constructor.name;
    const noRow = (await db.select().from(schema.castingSegments)
      .where(eq(schema.castingSegments.facet, "freckles"))).length === 0;
    safetyPass = named === "SegmentOwnershipError" && noRow;
    safetySaw = `threw ${named} · no segment row left behind: ${noRow}`;
  }
  record(
    "E  SAFETY     a manifest the worker CLAIMED refuses to discharge",
    "SegmentOwnershipError, and no row filed",
    safetySaw,
    safetyPass,
  );

  const failed = results.filter((row) => !row.pass);
  console.log(`\n[race] ${results.length - failed.length}/${results.length} arms pass`);
  if (failed.length === 0) {
    console.log("[race] THE RACE IS DRIVEN, both ways, with the pre-fix control still red-hot.");
    exitCode = 0;
  } else {
    console.log(`[race] FAILED: ${failed.map((row) => row.arm).join(", ")}`);
  }

  await db.$client.end?.();
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[race] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
