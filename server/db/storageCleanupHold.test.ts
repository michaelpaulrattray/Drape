import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
 * the discharge's new state is exactly "the worker has never touched it".
 *
 * ⚠ AND ITS TWO POPULATIONS ARE READ OUT OF THE TREE SINCE #1183. They were
 * hand-written lists of ONE FILE EACH — a shape that can notice neither a new
 * writer that forgets to hold nor its own last entry leaving. Deriving them
 * turned up a measurement the hand list was hiding: **five** modules discharge a
 * manifest, not one, and all five already used the shared predicate. The rule
 * the population turns on is the SYNTHETIC OPERATION ID rather than "calls the
 * manifest" — there are 24 call sites and most correctly do not hold, because a
 * manifest for objects that already exist is a deletion order. See the reader's
 * own comment for why the card's proposed rule is not the tree's.
 *
 * ⚠ AND THE REAL-SQL RACE PROOF IS GONE, WHICH IS A LOSS AND NOT A TIDY-UP.
 * `scripts/drive-born-held-race-disposable.mts` drove the race itself against a
 * throwaway database built from the repo's own migrations, with an UNHELD
 * manifest as its control so that "not claimed" could not be confused with a
 * driver that never claims anything. Its specimen was
 * `recordDetectedSegments` — one of the segment store's writers — so #1160
 * slice 3 left it unable to compile, let alone run. It was DELETED rather than
 * re-pointed at one of the seven surviving born-held writers, because choosing a
 * new specimen and re-proving it is new coverage judged on its own terms, not a
 * consequence of a retirement. What is left here is a PIN, and its own comment
 * below has always said so. Filed, with the seven names on it.
 */

const source = (file: string) =>
  readFile(new URL(file, import.meta.url), "utf8");

/* ───────────────────────── the reader both populations come from ─────────────
   #1183. Until this existed, each of the two pins below was a HAND-WRITTEN LIST
   OF ONE FILE, and a list of one cannot notice its own last entry leaving. Both
   are now read out of the tree, so a module that arrives tomorrow is in scope
   the moment it exists (working law 4).

   ⚠ AND THE CARD'S PROPOSED RULE IS NOT THE TREE'S — measured before building.
   #1183 says *"every module calling `createStorageCleanupManifest*` must either
   hold or be the retention sweep — which is the fourth caller of the same
   shape"*. There are **24 call sites in 21 modules**, not four, and most do not
   hold, correctly: a manifest for objects that ALREADY EXIST is a deletion
   order, and holding it would delay the purge it exists to perform.

   So the discriminator is not "calls the manifest". It is the SYNTHETIC
   OPERATION ID, which is the defect's own definition: the worker's in-flight
   fence tests the manifest's `operationId` against a live operation row, so a
   real id is fenced by that row and `randomUUID()` matches nothing and is
   fenced by nothing at all. A synthetic-id manifest is therefore claimable the
   instant it exists unless it is born held — and every one of them either holds
   or is enumerated below with its reason. */

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function productionFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await productionFiles(full, out);
    else if (
      entry.name.endsWith(".ts")
      && !entry.name.endsWith(".test.ts")
      && !entry.name.endsWith(".d.ts")
    ) out.push(full);
  }
  return out;
}

/** The argument text of a call whose opening paren is already located. */
function argumentsAt(text: string, afterOpenParen: number): string {
  let depth = 1;
  let index = afterOpenParen;
  while (index < text.length && depth > 0) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") depth -= 1;
    index += 1;
  }
  return text.slice(afterOpenParen, index - 1);
}

type ManifestSite = {
  file: string;
  line: number;
  /** `operationId: randomUUID()` — unfenced by any live operation row. */
  synthetic: boolean;
  /** The text of the `heldUntil:` value, or null when the site does not hold. */
  heldUntil: string | null;
};

/** Every `createStorageCleanupManifestIn` call in production server code, with
 *  the two facts the rule below turns on, read out of its own argument list. */
async function manifestSites(): Promise<ManifestSite[]> {
  const sites: ManifestSite[] = [];
  for (const absolute of await productionFiles(serverRoot)) {
    const file = path.relative(serverRoot, absolute).replaceAll("\\", "/");
    /* The declaration itself, and its own internal re-use, are not call sites
       whose callers can forget anything. */
    if (file === "db/storageCleanup.ts") continue;
    const text = await readFile(absolute, "utf8");
    if (!text.includes("createStorageCleanupManifestIn")) continue;
    for (const match of text.matchAll(/\bcreateStorageCleanupManifestIn\s*\(/g)) {
      const body = argumentsAt(text, match.index + match[0].length);
      const held = /\bheldUntil\s*:\s*([^,\n]+)/.exec(body);
      sites.push({
        file,
        line: text.slice(0, match.index).split("\n").length,
        synthetic: /\boperationId\s*:\s*randomUUID\(\)/.test(body),
        heldUntil: held ? held[1].trim() : null,
      });
    }
  }
  return sites;
}

/**
 * A SYNTHETIC-ID MANIFEST THAT DELIBERATELY DOES NOT HOLD, each with the reason
 * the hold would be wrong. This is an ENUMERATED EXCEPTION LIST in the shape
 * this repository already uses for the public-endpoint surface, and it is
 * checked in BOTH directions: a module here that stops having an unheld
 * synthetic-id manifest reddens too, so the list cannot rot into a mirror.
 *
 * Every one of them is a DELETION ORDER — the objects it names already exist and
 * are meant to die, so a hold would delay the purge it was written to perform.
 * That is the retention sweep's stated reason, generalised to the six other
 * places the same shape occurs.
 */
const DELETION_ORDERS: Record<string, string> = {
  "castingV2/candidateRetention.ts":
    "the retention sweep — the manifest IS the deletion order",
  "db/castingV2FaceScans.ts":
    "a replaced face scan's old keys, discharged-and-re-ordered in one statement",
  "db/castingV2InkDesignRemoval.ts":
    "the per-design delete — the design's bytes are what is being removed",
  "db/inkAddCandidates.ts":
    "superseded ink candidates: their frames are already stored and already dead",
  "db/inkAddRecovery.ts":
    "a recovery sweeping the frames of an operation that will not finish",
};

/**
 * The born-held writers, by the road a customer walks to reach each one. Named
 * as a POSITIVE CONTROL on the derived reader — if the walker or the argument
 * matcher quietly stops finding sites, an empty population would satisfy every
 * "all of them hold" assertion, and this is what refuses that.
 *
 * `inkReferenceMint.ts` is NOT here and that is the reader working: it shares
 * `inkUploadService`'s `defaultManifest`, so the hold is written once for two
 * roads rather than copied. Seven roads, six sites.
 */
const BORN_HELD_WRITERS = [
  "castingV2/hairReferenceCutter.ts",
  "castingV2/inkUploadService.ts",
  "castingV2/keptFaceScan.ts",
  "castingV2/referenceAttachService.ts",
  "castingV2/referenceMint.ts",
  "castingV2/refusalLoopCapture.ts",
];

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
    A PIN, not a proof — it stops the writers drifting apart, because a writer
    that registers before the bytes and does NOT hold has the whole defect back.
    The proof that each one holds correctly is the driven race, and the driven
    race is still missing (see the docblock).

    ⚠ TWO WRITERS LEFT THIS POPULATION WITH THE SEGMENT STORE (#1160 slice 2),
    both DELETED rather than changed: `segmentPersistence.ts` ("a kept edit's
    mask and crop") and `bornWornCatalogue.ts` ("a born-worn mask and crop").
    His ruling of 2026-09-24 — *"Retire both. The paste road is gone; nothing
    reads these"* — retired the road they wrote for, and the store was measured
    empty in BOTH worlds before a line was cut. That left the hand-written list
    at ONE file, which is what #1183 is about and what the reader above ends.
  */
  it("pins every register-before-the-bytes writer as born held", async () => {
    const sites = await manifestSites();

    /* Positive control FIRST: the walker really walked. An empty population
       satisfies every "all of them hold" assertion below by finding nobody, and
       that is the one way this arm could go green while proving nothing. */
    expect(sites.length, "the walker found no manifest call sites at all")
      .toBeGreaterThanOrEqual(20);
    expect(
      [...new Set(sites.filter((site) => site.heldUntil !== null).map((site) => site.file))].sort(),
      "a born-held writer stopped being found, or a new one appeared unrecorded",
    ).toEqual(BORN_HELD_WRITERS);

    /* THE RULE. A synthetic operation id is fenced by nothing, so the manifest
       is claimable the moment it exists unless it is born held. */
    const unfenced = sites
      .filter((site) => site.synthetic && site.heldUntil === null)
      .filter((site) => DELETION_ORDERS[site.file] === undefined)
      .map((site) => `${site.file}:${site.line}`);
    expect(unfenced, "a synthetic-id manifest that neither holds nor is an enumerated deletion order")
      .toEqual([]);

    /* And the exception list is checked the OTHER way too, so it cannot rot
       into a mirror of a tree that has moved: every module named above must
       still have an unheld synthetic-id manifest to be excused for. */
    const excused = new Set(
      sites.filter((site) => site.synthetic && site.heldUntil === null).map((site) => site.file),
    );
    expect(
      Object.keys(DELETION_ORDERS).filter((file) => !excused.has(file)),
      "an enumerated deletion order no longer has one — delete its line",
    ).toEqual([]);
  });

  /*
    AND THE HOLD ITSELF IS NEVER HAND ARITHMETIC (#1183).

    The grace is the operation lease, derived in one place. A writer computing
    its own `new Date(Date.now() + …)` is the drift working law 4 is about, and
    it would be invisible to the arm above, which only asks whether a hold
    exists at all.
  */
  it("every born-held writer takes the grace from the one place it is derived", async () => {
    const sites = (await manifestSites()).filter((site) => site.heldUntil !== null);
    expect(sites.length).toBeGreaterThanOrEqual(6);

    const byFile = new Map(sites.map((site) => [site.file, site.heldUntil!]));
    for (const [file, held] of byFile) {
      if (file === "castingV2/refusalLoopCapture.ts") continue;
      expect(held, `${file} invents its own hold instead of deriving it`)
        .toBe("storageCleanupManifestHeldUntil()");
    }

    /*
      ⚠ ONE ENUMERATED EXCEPTION, AND IT IS A DIFFERENT HOLD RATHER THAN A
      LOOSER ONE. The refusal-loop capture holds for the whole RETENTION window:
      there the hold IS the retention, so a held batch is unclaimable until it
      lapses and the worker needs no rule of its own to delete the words late.
      Pinned to its own constant so the exception cannot quietly become a hand-
      written duration.
    */
    expect(byFile.get("castingV2/refusalLoopCapture.ts")).toBe("input.heldUntil");
    const capture = await source("../castingV2/refusalLoopCapture.ts");
    expect(capture).toContain("new Date(now.getTime() + REFUSAL_LOOP_RETENTION_MS)");
  });

  /*
    ### THE ONE-ENTRY LIST THAT USED TO STAND HERE, AND WHAT IT WAS HIDING

    #1160 slice 3 took `castingV2Segments.ts` off this list, and it had to: the
    discharge lived inside the store's two WRITERS and the module is now the
    purge path alone, which registers no manifest and therefore discharges
    nothing. That left a hand list of ONE file — the shape that goes green while
    proving nothing, since it can notice neither a new discharge that uses the
    wrong predicate nor its own last entry leaving.

    ⚠ AND THE LIST OF ONE WAS UNDER-COUNTING BY FOUR. Derived out of the tree,
    **five** modules discharge a manifest and all five already use the shared
    predicate: the reference library, the ink designs, the ink delivery crops,
    the reference attachments and the face scans. A hand list is not merely
    fragile here — it was describing a fifth of its own subject.
  */
  it("pins every discharge of a held manifest to the shared predicate", async () => {
    const dischargers: string[] = [];
    for (const absolute of await productionFiles(serverRoot)) {
      const file = path.relative(serverRoot, absolute).replaceAll("\\", "/");
      if (file === "db/storageCleanup.ts") continue;
      const text = await readFile(absolute, "utf8");
      /* A CALL, not a mention: the import line names the symbol too, and an
         importer that never calls it is not a discharge. */
      if (!/\bundischargedStorageCleanupBatchWhere\s*\(\s*\)/.test(text)) continue;
      dischargers.push(file);

      /* The old one-state test is what let a claimed batch and a held batch be
         told apart only by luck; no discharge of a held manifest may keep it. */
      expect(text, file).not.toContain('eq(storageCleanupBatches.status, "pending")');
    }

    /* Positive control: the walker found the population rather than going quiet.
       The per-file assertion above is inside the loop, so an empty walk would
       run no assertions at all and pass. */
    expect(dischargers.sort(), "a discharge left the population, or a new one appeared").toEqual([
      "db/castingV2FaceScans.ts",
      "db/castingV2InkDeliveryCrops.ts",
      "db/castingV2InkDesigns.ts",
      "db/castingV2ReferenceAttachments.ts",
      "db/castingV2ReferenceLibrary.ts",
    ]);
  });
});
