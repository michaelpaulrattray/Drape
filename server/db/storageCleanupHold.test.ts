import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  STORAGE_CLEANUP_MANIFEST_HOLD_MS,
  storageCleanupManifestHeldUntil,
} from "./storageCleanup";
import { DEFAULT_GENERATION_OPERATION_LEASE_MS } from "./generationOperations";

/**
 * BORN HELD — the hold a manifest keeps over its own bytes while its writer
 * writes them.
 *
 * The defect this is the answer to: three writers register a cleanup manifest
 * BEFORE the objects it names exist, and each carries a SYNTHETIC operation id
 * because the column is unique and the real operation already owns a batch. The
 * cleanup worker's in-flight fence tests that id against a live operation row —
 * a synthetic id matches none, so the fence passes trivially and the batch is
 * claimable in the window between the manifest and the row insert. It fired: a
 * sweep took a delivered feature's crop mid-mint, and the render's rows were
 * then correctly refused because their bytes were being deleted.
 *
 * This file proves the two halves that live here — the grace is DERIVED, and
 * the discharge's new state is exactly "the worker has never touched it". The
 * race itself is driven against real SQL by
 * `scripts/drive-born-held-race-disposable.mts`; a predicate is not proved by
 * reading it.
 */

const source = (file: string) =>
  readFile(new URL(file, import.meta.url), "utf8");

describe("the grace is derived, not invented", () => {
  it("is the operation lease itself — one constant, one meaning", () => {
    expect(STORAGE_CLEANUP_MANIFEST_HOLD_MS).toBe(DEFAULT_GENERATION_OPERATION_LEASE_MS);
  });

  it("holds from now until now plus that lease", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(storageCleanupManifestHeldUntil(now).getTime())
      .toBe(now.getTime() + DEFAULT_GENERATION_OPERATION_LEASE_MS);
  });

  /*
    The margin, stated as a number rather than a hope. The worst mint observed
    on a paid render was ~70 seconds. A hold that a real writer ever consumes is
    a LATENCY finding — the writer has become slower than an entire generation
    operation is allowed to be — and the answer to it is not a longer hold.
  */
  it("clears the worst observed mint several times over", () => {
    const WORST_OBSERVED_MINT_MS = 70_000;
    expect(STORAGE_CLEANUP_MANIFEST_HOLD_MS).toBeGreaterThan(WORST_OBSERVED_MINT_MS * 4);
  });
});

describe("the discharge accepts a held manifest, and only an untouched one", () => {
  /*
    The predicate rests on one fact about the worker: a claim stamps
    `attemptedAt`, and nothing ever clears it. If that stops being true, a
    swept batch becomes indistinguishable from a born-held one and the discharge
    starts committing rows over bytes being deleted — so it is pinned here
    beside the predicate that depends on it, not left as a comment.
  */
  it("rests on the claim stamping attemptedAt, and nothing clearing it", async () => {
    const cleanup = await source("./storageCleanup.ts");

    const claim = cleanup.slice(cleanup.indexOf("export async function claimNextStorageCleanupBatch"));
    expect(claim.slice(0, claim.indexOf("export async function renewStorageCleanupLease")))
      .toContain("attemptedAt: input.now");

    /* Nowhere does any statement set it back to null. */
    expect(cleanup).not.toMatch(/attemptedAt:\s*null/);

    /* And `finalize` really does leave `processing` with a null token — which is
       why a null token alone would NOT have been a safe discriminator. */
    const finalize = cleanup.slice(cleanup.indexOf("export async function finalizeStorageCleanupBatch"));
    expect(finalize).toContain("leaseToken: null");

    const predicate = cleanup.slice(
      cleanup.indexOf("export function undischargedStorageCleanupBatchWhere"),
    );
    const body = predicate.slice(0, predicate.indexOf("export async function"));
    expect(body).toContain('eq(storageCleanupBatches.status, "pending")');
    expect(body).toContain('eq(storageCleanupBatches.status, "processing")');
    expect(body).toContain("isNull(storageCleanupBatches.leaseToken)");
    expect(body).toContain("isNull(storageCleanupBatches.attemptedAt)");
  });

  /*
    A PIN, not a proof — it stops the three writers drifting apart, because a
    writer that registers before the bytes and does NOT hold has the whole
    defect back. The proof that each one holds correctly is the driven race.
  */
  it("pins every register-before-the-bytes writer as born held", async () => {
    for (const file of [
      "../castingV2/referenceMint.ts",
      "../castingV2/segmentPersistence.ts",
      "../castingV2/bornWornCatalogue.ts",
    ]) {
      const writer = await source(file);
      expect(writer, file).toContain("heldUntil: storageCleanupManifestHeldUntil()");
    }

    /*
      And the fourth caller of the same shape is deliberately NOT one of them:
      in the retention sweep the manifest IS the deletion order — the objects
      already exist and are meant to die — so holding it would delay the very
      purge it was written to perform.
    */
    const retention = await source("../castingV2/candidateRetention.ts");
    expect(retention).toContain("createStorageCleanupManifestIn(tx");
    expect(retention).not.toContain("heldUntil");
  });

  it("pins every discharge of a held manifest to the shared predicate", async () => {
    for (const file of ["./castingV2ReferenceLibrary.ts", "./castingV2Segments.ts"]) {
      const discharge = await source(file);
      expect(discharge, file).toContain("undischargedStorageCleanupBatchWhere()");
      /* The old one-state test is what let a claimed batch and a held batch be
         told apart only by luck; no discharge of a held manifest may keep it. */
      expect(discharge, file).not.toContain('eq(storageCleanupBatches.status, "pending")');
    }
  });
});
