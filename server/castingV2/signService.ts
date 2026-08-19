/**
 * The Sign ceremony — the only transition that creates Cast authority (§F, D-92).
 *
 * THE SEQUENCE, and its ordering is the whole design:
 *
 *   read → claim → running → PINNED DEDUCT → manifest → copy →
 *   [one transaction: Cast + anchor + identity + candidate CAS] →
 *   package → activate → receipt
 *
 * **The charge comes before the durable boundary, and that inverts the roll's
 * order on purpose.** A roll commits its rows first because rows are not
 * authority — they are cheap to fail, and "rows but no ledger charge" honestly
 * means nothing was taken. Sign's transaction *creates* authority: a Cast, and
 * a spent candidate. An unpaid Cast is unacceptable and undoing one means
 * un-signing, so the money moves first and everything between the charge and
 * the boundary is fully compensable — the credits by refund, the storage copy
 * by a cleanup manifest registered before the copy is made.
 *
 * Both orderings serve one invariant, and it is the sentence to keep:
 * **authority exists ⟹ money was taken.**
 *
 * What each crash point resolves to (D-92's table, as code):
 *
 *   after claim              free failure — no charge exists
 *   after running            free failure — the late-deduct recheck sees nothing
 *   after deduct / copy      PAID failure — full refund, candidate stays `ready`
 *   mid-transaction          the same; the transaction is atomic
 *   after the transaction    the Cast stands; only slices refund from here
 *   mid-package              committed views stand, uncommitted slices refund
 *   after package            activate, bind, seal — idempotently
 *
 * The promotion portion is never refunded once the candidate CAS is set,
 * because at that moment the customer has what it bought: a locked face with an
 * anchor and an id. Only views refund after that, and only their own slice.
 */
import { TRPCError } from "@trpc/server";
import { spokenError } from "../_core/spokenError";
import { randomUUID } from "node:crypto";

import { recordRefund } from "../casting/atomicCredits";
import { CASTING_V2_SIGN_COSTS } from "../casting/castingCreditCosts";
import { withUniqueCastPublicId } from "../casting/castPublicId";
import {
  beginDirectOperation,
  completeDirectOperationFailure,
  failClaimedDirectOperation,
} from "../casting/directOperation";
import { operationChargeReference } from "../casting/operationContract";
import { mintRevisionId } from "../casting/identity/anchorSelector";
import { deductCredits } from "../db/credits";
import { withTransaction } from "../db/connection";
import { createStorageCleanupManifestIn } from "../db/storageCleanup";
import {
  bindGenerationOperationModel,
  finalizeGenerationOperationSuccess,
  markGenerationOperationRecoveryRequired,
  markGenerationOperationRunning,
} from "../db/generationOperations";
import {
  SignPersistenceError,
  getSignableCandidate,
  signCandidateIntoCast,
  type SignableCandidate,
} from "../db/castingV2Sign";
import { createModuleLogger } from "../logging/logger";
import { storageCopyExact, storageReadBytes } from "../storage";
import { listCandidateInkPlates, type CandidateInkPlate } from "../db/castingV2InkPlates";
import { listLineageReferences } from "../db/castingV2ReferenceLibrary";
import type { BodyAnchorRegion } from "../../shared/bodyAnchorRegions";
import { readOpenKindProperties } from "../db/castingV2OpenKindProperties";
import { deriveLibrary } from "./referenceLibrary";
import { openKindOfSlot } from "./referenceSlots";
import {
  regionForSlot,
  selectCarriedFeatureWords,
  type CarriedFeatureWords,
} from "./viewFeatureWords";
import { placementRidesPackageViews, type CarriedInkPlate } from "./inkViewReferences";

/**
 * WHETHER A DESIGN'S ARTWORK REACHED THIS CAST'S VIEWS, AND IF NOT WHY — one
 * shape for every way it can fail (ordered fable-1005 §2).
 *
 * `noPlate` — uploaded and never plated, so there is nothing an engine may be
 * shown (D-138 forbids the customer's own photograph absolutely).
 * `engineUndecided` — plated by more than one engine, and which artwork is HER
 * tattoo is the plate court's open question; picking one by array order is the
 * quiet dispatch fallback this product has already paid for.
 * `bytesUnreadable` — the row is there and the object is not.
 * `surfaceCovered` — the package's own wardrobe covers the surface this design
 * sits on, so no view can honestly show it. The court measured what happens
 * without this: told to put an upper-chest design on a crew-necked frame the
 * engine printed it on the shirt, and told that ink goes on skin it rewrote the
 * neckline into a scoop — both of which the wardrobe check fails and refunds.
 * The interim until he rules on the wardrobe itself (fable-1006 §2).
 */
export type InkDesignDisposition =
  | { designPublicId: string; rode: true }
  | {
    designPublicId: string;
    rode: false;
    reason: "noPlate" | "engineUndecided" | "bytesUnreadable" | "surfaceCovered";
    engines?: readonly string[];
  };
import { CASTING_V2_SIGN_PRICE_CREDITS } from "./castViewPackage";
import { buildCastPackage, type PackageOrchestratorDependencies } from "./packageOrchestrator";
import { assertNotFrozen } from "./spendGuards";

const log = createModuleLogger("castingV2/signService");

/** Cast-owned objects live under one namespace so cleanup and audit find them. */
const CAST_KEY_PREFIX = "casting-v2/casts";

export type SignServiceDependencies = PackageOrchestratorDependencies & {
  begin?: typeof beginDirectOperation;
  markRunning?: typeof markGenerationOperationRunning;
  deduct?: typeof deductCredits;
  copyImage?: typeof storageCopyExact;
  readBytes?: typeof storageReadBytes;
  /** Her plated tattoos, injected in tests. Absent, the real statement runs —
   *  owner-scoped through the design to the candidate. */
  listInkPlates?: typeof listCandidateInkPlates;
  /** The feature library of the branch this Sign anchors on, injected in tests.
   *  Absent, the real statement runs — owner-scoped in its own WHERE. */
  listLibrary?: typeof listLineageReferences;
  /** Where an open kind lives on the body. A table read, never a model call:
   *  the answer was bought once at the acceptance door. */
  readKindRegion?: typeof readOpenKindProperties;
  buildPackage?: typeof buildCastPackage;
  /**
   * How the package work is scheduled after the Cast exists.
   *
   * Production hands it to the event loop and returns, because §F's room "opens
   * immediately on the signed master" and views stream in — making the customer
   * stare at a spinner for six 2K generations would be a different product.
   * That detachment is not fire-and-forget: the operation is still `running`
   * under its heartbeat and lease, so a process that dies here is exactly the
   * case the Sign adjudicator exists for.
   *
   * Tests return the promise, which makes `signCandidate` await the whole
   * ceremony — the package's money must be assertable, and an assertion that
   * races a detached promise is an assertion that passes by luck.
   */
  schedulePackage?: (run: () => Promise<void>) => void | Promise<void>;
};

export type SignInput = {
  userId: number;
  clientRequestId: string;
  /** The candidate to spend. Re-proved owner-scoped inside the CAS. */
  candidatePublicId: string;
  /** Optional. A Cast with no name shows its KI id until its owner gives it one. */
  name?: string | null;
};

export type SignResult = {
  castPublicId: string;
  chargedCredits: number;
};

/**
 * The identity documents a Cast carries, derived from what the candidate
 * persisted (§F: immutable at Sign).
 *
 * Deliberately built here rather than through the legacy `buildIdentityAnchor`:
 * that helper reads a legacy `technicalSchema` shape (`facial_features`,
 * `skin_tone`) that V2 does not produce, and importing it would tie the newest
 * paid path in the product to the module the retirement program exists to
 * delete. The only contract this text has to honour is that it is deterministic
 * and stable — it is a fingerprint, hashed onto the identity snapshot and
 * stamped on every asset written under this revision.
 *
 * These three fields together are the complete recipe for reproducing a Cast.
 * They are the single most sensitive field group in the product and they never
 * cross a projection boundary (founder ruling, 2026-07-25).
 */
function identityDocumentsFor(source: SignableCandidate): {
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  identityText: string;
} {
  /*
    THE FACE's record, not the candidate's — §11's first landmine.

    If a user refines a face and signs it, the Cast's masterPrompt,
    technicalSchema and identityText must describe the face they are looking at.
    Reading `source.candidate.internalPrompt` here while copying the variant's
    pixels below would snapshot the ORIGINAL's recipe under the VARIANT's
    picture — the record-lies class at the most expensive site in the product,
    and permanent, because a Cast's identity documents are what every later
    generation is reproduced from.

    `face` is resolved in the same statement that proved the candidate, so the
    key and the documents cannot come from two different reads.
  */
  const internal = source.face.internalPrompt as
    | { prompt?: unknown; resolved?: unknown }
    | null;
  const masterPrompt = typeof internal?.prompt === "string" && internal.prompt.trim()
    ? internal.prompt
    : source.roll.briefText;
  const resolved = internal?.resolved && typeof internal.resolved === "object"
    ? (internal.resolved as Record<string, unknown>)
    : {};
  const technicalSchema = {
    subject: resolved,
    cohortKey: source.roll.cohortKey,
    styleKey: source.roll.styleKey,
    styleProfile: source.roll.styleProfile ?? null,
  };
  const preferences = {
    briefText: source.roll.briefText,
    personaLine: source.candidate.personaLine,
    position: source.candidate.position,
    sourceRollPublicId: source.roll.publicId,
    sourceCandidatePublicId: source.candidate.publicId,
    /*
      Which refinement this Cast was signed from — null for an unrefined face.

      Lineage that names the candidate alone would name the original for a Cast
      that is not the original, which is the same lie as the documents one, told
      quietly in the provenance instead of loudly in the recipe.
    */
    sourceVariantPublicId: source.face.variantPublicId,
  };
  const identityText = [
    "IDENTITY — THIS PERSON MUST MATCH THE REFERENCE IMAGE EXACTLY:",
    JSON.stringify(resolved),
    `Full casting spec: ${masterPrompt}`,
  ].join("\n");
  return { masterPrompt, technicalSchema, preferences, identityText };
}

/*
  The M7 seam `selectedCandidateImageKey` is GONE, and deleting it was the
  point rather than a tidy-up.

  It was written to be the one place M8 would change, and its signature took
  `{ imageKey }` — a candidate-shaped argument that structurally could not see
  a variant. Widening it would have meant Sign reading its key from this
  function and its identity documents from `getSignableCandidate`: two reads,
  which is exactly the split that lets the picture and the record describe
  different faces. The selected face now arrives from ONE statement as
  `source.face`, and there is nothing left for an accessor to indirect.
*/

export async function signCandidate(
  dependencies: SignServiceDependencies,
  input: SignInput,
): Promise<SignResult> {
  const price = CASTING_V2_SIGN_PRICE_CREDITS;
  await assertNotFrozen(input.userId);

  // ---- free refusals: nothing claimed, nothing charged ----
  const source = await getSignableCandidate(input.userId, input.candidatePublicId);
  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That candidate can't be signed — it may have been discarded, expired, or already signed.",
    });
  }
  const imageKey = source.face.imageKey;
  if (!imageKey) {
    // A `ready` row without bytes is a torn write. Refusing here costs the user
    // nothing; charging and then discovering it would cost them a refund.
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That candidate's image isn't available. Nothing was charged.",
    });
  }

  const gate = await (dependencies.begin ?? beginDirectOperation)({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "castingV2.sign",
    payload: {
      candidatePublicId: input.candidatePublicId,
      name: input.name ?? null,
    },
  });
  if (gate.type === "replay") {
    // Idempotency, not an error: the same request id returns the Cast it
    // already signed rather than spending a second candidate.
    return gate.result as SignResult;
  }
  const operationId = gate.operationId;

  try {
    await (dependencies.markRunning ?? markGenerationOperationRunning)({
      userId: input.userId,
      operationId,
      plannedCredits: price,
      phase: "minting",
      heartbeat: true,
    });
  } catch (error) {
    return failClaimedDirectOperation({ userId: input.userId, operationId, error });
  }

  // ---- the pinned deduct (§H.2) ----
  const chargeResult = await (dependencies.deduct ?? deductCredits)(
    input.userId,
    price,
    "generation",
    "Sign a Cast (pending)",
    operationChargeReference(operationId),
    "castingV2",
  );
  if (!chargeResult.success) {
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: new TRPCError({
        code: "BAD_REQUEST",
        message: chargeResult.error || `Not enough credits. Signing a Cast costs ${price} credits.`,
      }),
      chargedCredits: 0,
      refundedCredits: 0,
    });
  }

  // ---- everything from here is compensable, and compensated on any throw ----
  let cast: Awaited<ReturnType<typeof signCandidateIntoCast>>;
  let documents: ReturnType<typeof identityDocumentsFor>;
  let anchorStorageKey = "";
  try {
    documents = identityDocumentsFor(source);
    const identityRevisionId = mintRevisionId();
    const extension = imageKey.toLowerCase().endsWith(".jpg") ? "jpg" : "png";
    const destinationKey = `${CAST_KEY_PREFIX}/${operationId}/anchor/${randomUUID()}.${extension}`;

    /*
      MANIFEST BEFORE COPY (D-92's orphaned-storage-copy defence).

      The copy can succeed and the process die before anything references the
      key, and the cleanup worker only ever deletes keys a row handed it. So the
      key is handed over BEFORE it exists: its own transaction, committed first,
      so the manifest cannot be rolled back by the failure it exists to clean up
      after. The Sign transaction deletes the manifest as its last act, which is
      what stops the worker deleting a live Cast's anchor.
    */
    const manifest = await withTransaction((tx) => createStorageCleanupManifestIn(tx, {
      id: randomUUID(),
      userId: input.userId,
      operationId,
      // The domain's own cleanup kind (0017). This object began life as a
      // casting-v2 candidate image and is a casting-v2 object still; the worker
      // deletes exact keys and does not read the kind.
      kind: "casting_candidate_cleanup",
      storageItems: [{ storageKey: destinationKey, storageBackend: "public_r2" }],
    }));

    const copied = await (dependencies.copyImage ?? storageCopyExact)({
      sourceKey: imageKey,
      destinationKey,
    });
    if (copied.key !== destinationKey) throw new SignPersistenceError("commit_conflict");
    anchorStorageKey = copied.key;

    /*
      A CAST OWNS ITS OWN COPY of the image, never the candidate's object. The
      candidate's row and object delete together at retention (§G.6), and a Cast
      pointing at a purged key would be a Cast whose face disappeared a week
      after it was signed.
    */
    cast = await withUniqueCastPublicId((agencyId) => signCandidateIntoCast({
      userId: input.userId,
      operationId,
      candidateId: source.candidate.id,
      rollId: source.roll.id,
      sessionId: source.session.id,
      // The selection this Sign was quoted against; the CAS refuses if it moved.
      selectedVariantId: source.face.variantId,
      name: input.name?.trim() || null,
      cohortKey: source.roll.cohortKey,
      styleKey: source.roll.styleKey,
      masterPrompt: documents.masterPrompt,
      technicalSchema: documents.technicalSchema,
      preferences: documents.preferences,
      identityText: documents.identityText,
      identityRevisionId,
      agencyId,
      anchor: {
        storageKey: copied.key,
        storageUrl: copied.url,
        provenance: {
          sourceCandidatePublicId: source.candidate.publicId,
          sourceRollPublicId: source.roll.publicId,
        },
      },
      cleanupBatchId: manifest.id,
    }));
  } catch (error) {
    /*
      PAID FAILURE. The Cast does not exist, the candidate is untouched and
      still `ready`, and the whole price goes back under the derived refund
      reference. The copied object — if the copy is what got that far — is owned
      by the cleanup manifest and the worker deletes it once this operation is
      terminal.
    */
    const refund = await recordRefund(
      input.userId,
      price,
      "Sign didn't complete",
      operationChargeReference(operationId),
    );
    if (!refund.recorded) {
      log.error(
        { operationId, userId: input.userId, reference: refund.reference },
        "[signService] the Sign refund did not record — the owner remains charged",
      );
    }
    log.warn({ operationId, err: error }, "[signService] Sign failed before the durable boundary");
    return completeDirectOperationFailure({
      userId: input.userId,
      operationId,
      error: signRefusal(error, refund.recorded, operationId),
      chargedCredits: price,
      refundedCredits: refund.recorded ? refund.amount : 0,
    });
  }

  log.info(
    { operationId, modelId: cast.modelId, castPublicId: cast.agencyId },
    "[signService] Cast signed — building the package",
  );

  const schedule = dependencies.schedulePackage ?? detach;
  await schedule(() => completeSignPackage(dependencies, {
    userId: input.userId,
    operationId,
    modelId: cast.modelId,
    agencyId: cast.agencyId,
    /* The candidate whose designs the package's views carry (fable-987 §3).
       The plate objects live under this candidate's own purge path and are read
       at build time as INPUTS — nothing about them is persisted into the Cast,
       so unlike the anchor there is no copy to take. */
    candidateId: source.candidate.id,
    /*
      The package references the CAST'S OWN copy, never the candidate's object.
      The candidate's row and its object delete together at retention (§G.6),
      and a package generated from a key that is about to be purged would be a
      package whose reference disappeared underneath it.
    */
    anchorStorageKey,
    /* The same variant the anchor's pixels came from, so the words and the
       picture describe one branch (`branch-state-identity`). */
    selectedVariantId: source.face.variantId,
    identityRevisionId: cast.identityRevisionId,
    identityText: documents.identityText,
    chargedCredits: price,
  }));

  return { castPublicId: cast.agencyId, chargedCredits: price };
}

/** Production scheduling: hand it to the event loop, never lose the error. */
function detach(run: () => Promise<void>): void {
  void run().catch((error) => {
    log.error({ err: error }, "[signService] the detached package continuation threw");
  });
}

/**
 * HER PLATED TATTOOS, READ AND HANDED TO THE PACKAGE — and every way one can
 * fail to ride is NAMED (FOUNDER RULING fable-987 §3; the naming ordered
 * fable-1004 §3).
 *
 * Three things can go wrong here and none of them may be silent, because a
 * reference that quietly did not ride is indistinguishable from a Cast with no
 * tattoo — and the customer paid for the tattoo:
 *
 *   NO PLATE        the design was uploaded and never plated (the studio flag
 *                   was off, or the mint failed). The design cannot ride: there
 *                   is nothing to show an engine but the customer's own
 *                   photograph, and D-138 forbids that absolutely
 *   TWO PLATES      one design plated by two engines. Which artwork is HER
 *                   tattoo is the plate court's open question, and picking the
 *                   newest would be a quiet dispatch fallback — the class this
 *                   product has paid for before. It does not ride, and it says
 *                   which design and which engines
 *   BYTES GONE      the row is there and the object is not. The picture cannot
 *                   ride and the log says which design lost it
 *
 * A failure here NEVER fails the Sign. The Cast exists, the views are worth
 * having, and a tattoo missing from five frames is a smaller harm than five
 * frames nobody gets — so this returns what it could read and reports the rest.
 *
 * **Exported to be driven** (working law 3): every refusal here is reachable
 * only through a whole Sign, and a backstop whose only test runs through a
 * caller that usually behaves is a backstop nothing has tested.
 */
export async function carriedInkPlates(
  dependencies: SignServiceDependencies,
  input: { userId: number; candidateId: number; operationId: string },
): Promise<{ plates: readonly CarriedInkPlate[]; dispositions: readonly InkDesignDisposition[] }> {
  let rows: readonly CandidateInkPlate[];
  try {
    rows = await (dependencies.listInkPlates ?? listCandidateInkPlates)({
      userId: input.userId,
      candidateId: input.candidateId,
    });
  } catch (error) {
    log.error(
      { operationId: input.operationId, err: error },
      "[signService] her tattoos could not be read — the package renders without them",
    );
    return { plates: [], dispositions: [] };
  }
  if (rows.length === 0) return { plates: [], dispositions: [] };

  const byDesign = new Map<string, CandidateInkPlate[]>();
  for (const row of rows) {
    const held = byDesign.get(row.designPublicId) ?? [];
    held.push(row);
    byDesign.set(row.designPublicId, held);
  }

  const plates: CarriedInkPlate[] = [];
  const dispositions: InkDesignDisposition[] = [];
  const read = dependencies.readBytes ?? storageReadBytes;
  for (const [designPublicId, rowsOfDesign] of Array.from(byDesign.entries())) {
    /*
      THE SURFACE'S OWN DOOR, BEFORE THE PLATE'S — a design the package cannot
      show honestly does not ride, whether or not it was ever plated, and saying
      `noPlate` about it would name the wrong fact.
    */
    if (!placementRidesPackageViews(rowsOfDesign[0]!.placement)) {
      dispositions.push({ designPublicId, rode: false, reason: "surfaceCovered" });
      continue;
    }
    const minted = rowsOfDesign.filter((row) => row.storageKey !== null);
    if (minted.length === 0) {
      dispositions.push({ designPublicId, rode: false, reason: "noPlate" });
      continue;
    }
    if (minted.length > 1) {
      dispositions.push({
        designPublicId,
        rode: false,
        reason: "engineUndecided",
        engines: minted.map((row) => row.engine ?? "unnamed"),
      });
      continue;
    }
    const plate = minted[0]!;
    try {
      const bytes = await read(plate.storageKey!);
      plates.push({
        designPublicId,
        placement: plate.placement,
        side: plate.side,
        bytes: bytes.bytes,
        contentType: bytes.contentType,
      });
      dispositions.push({ designPublicId, rode: true });
    } catch (error) {
      dispositions.push({ designPublicId, rode: false, reason: "bytesUnreadable" });
      log.error(
        { operationId: input.operationId, designPublicId, err: error },
        "[signService] a plate's own bytes could not be read",
      );
    }
  }

  /*
    ONE LINE, EVERY DESIGN, RODE OR NOT — the amendment fable-1005 §2 ordered.

    As first built the three refusals reported at two different altitudes: a
    design with no plate produced nothing at all (it was invisible to a reader
    that started from plates), and the other two produced log lines of their own.
    Two refusals of the same promise on two surfaces is how a fact ends up
    collected and never asserted. This is the single surface: every design on the
    Cast, whether it rode, and if not, why.
  */
  log.info(
    { operationId: input.operationId, dispositions },
    "[signService] the tattoos this Cast's views carry — every design, rode or not",
  );
  return { plates, dispositions };
}

/**
 * WHAT THE ANCHOR CANNOT SHOW, GATHERED FOR THE VIEWS — arrow 6 (FOUNDER,
 * 2026-08-19: *"when signing a cast to make the angles the refined image is
 * supplied as the reference and a description so that any features not visible
 * are not lost"*).
 *
 * The rule is `viewFeatureWords.ts`'s and it is narrow by construction. What
 * this function owns is the READ: the library of the branch this Sign is
 * anchoring on, and the body region of every open kind in it.
 *
 * # The branch, not the face
 *
 * `anchorVariantId` is the variant the Sign was quoted against, so the words and
 * the pixels come from the same frame. Anchoring anywhere else is
 * branch-state-identity failing: a Cast signed off a copper-shag branch would
 * carry the blonde branch's features into its own views.
 *
 * # No model call, no credit
 *
 * The regions come from `casting_open_kind_properties`, a row the open lane
 * already bought at the acceptance door — one text read per new noun ever. A
 * kind with no row rides nothing rather than a guess.
 *
 * # A failure here NEVER fails the Sign
 *
 * Same shape as the plate lane, same reason. The Cast exists and the views are
 * worth having; a feature missing from five frames is a smaller harm than five
 * frames nobody gets. It returns what it could read and reports the rest.
 *
 * # AND THE LOG CARRIES SLOTS, NEVER WORDS
 *
 * The library's words are the customer's creative content — the class the access
 * grid keeps out of every staff surface. They ride to the ENGINE, which is where
 * every render already goes, and to nothing else. This line says WHICH features
 * rode and why the others did not; `signServicePrivacy.test.ts` drives it.
 *
 * **Exported to be driven** (working law 3): every refusal here is reachable
 * only through a whole Sign.
 */
export async function carriedFeatureWords(
  dependencies: SignServiceDependencies,
  input: {
    userId: number;
    candidateId: number;
    selectedVariantId: number | null;
    operationId: string;
  },
): Promise<readonly CarriedFeatureWords[]> {
  let rows: Awaited<ReturnType<typeof listLineageReferences>>;
  try {
    rows = await (dependencies.listLibrary ?? listLineageReferences)({
      userId: input.userId,
      candidateId: input.candidateId,
      anchorVariantId: input.selectedVariantId,
    });
  } catch (error) {
    log.error(
      { operationId: input.operationId, err: error },
      "[signService] the feature library could not be read — the package renders without its words",
    );
    return [];
  }
  if (rows.length === 0) return [];

  const entries = deriveLibrary(rows);
  /*
    ONE READ PER KIND, not one per row: a distributed kind files two slots and
    they share a properties row. The map is built before the selection because
    the selection is synchronous — a `regionOf` that awaited would make the
    ordering of a customer's features depend on a database.
  */
  const regions = new Map<string, BodyAnchorRegion | null>();
  for (const entry of entries) {
    const open = openKindOfSlot(entry.slot);
    if (open === null || regions.has(open.kind)) continue;
    try {
      const row = await (dependencies.readKindRegion ?? readOpenKindProperties)(open.kind);
      regions.set(open.kind, row?.anchorRegion ?? null);
    } catch (error) {
      log.warn(
        { operationId: input.operationId, kind: open.kind, err: error },
        "[signService] a kind's region could not be read — it rides nothing rather than a guess",
      );
      regions.set(open.kind, null);
    }
  }

  const selection = selectCarriedFeatureWords({
    entries,
    regionOf: (slot) => regionForSlot(slot, (kind) => regions.get(kind) ?? null),
  });

  log.info(
    {
      operationId: input.operationId,
      rode: selection.carried.map((feature) => feature.slot),
      declined: selection.declined,
    },
    "[signService] the features this Cast's views carry as words — slots only, never the words",
  );
  return selection.carried;
}

/**
 * Everything after the durable boundary: build, activate, seal.
 *
 * Contained on purpose — a throw in here must never look like a Sign failure to
 * the customer, because the Cast already exists. The worst case is that this
 * function does nothing at all, and then the operation's lease lapses and the
 * Sign adjudicator finishes exactly this work from the durable rows.
 */
async function completeSignPackage(
  dependencies: SignServiceDependencies,
  input: {
    userId: number;
    operationId: string;
    modelId: number;
    agencyId: string;
    candidateId: number;
    anchorStorageKey: string;
    /** The branch the Sign was quoted against — the words come from it too. */
    selectedVariantId: number | null;
    identityRevisionId: string;
    identityText: string;
    chargedCredits: number;
  },
): Promise<void> {
  try {
    const anchorBytes = await (dependencies.readBytes ?? storageReadBytes)(input.anchorStorageKey);
    const ink = await carriedInkPlates(dependencies, {
      userId: input.userId,
      candidateId: input.candidateId,
      operationId: input.operationId,
    });
    const featureWords = await carriedFeatureWords(dependencies, {
      userId: input.userId,
      candidateId: input.candidateId,
      selectedVariantId: input.selectedVariantId,
      operationId: input.operationId,
    });
    const result = await (dependencies.buildPackage ?? buildCastPackage)(dependencies, {
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      identityRevisionId: input.identityRevisionId,
      identityText: input.identityText,
      anchor: anchorBytes,
      inkPlates: ink.plates,
      featureWords,
    });

    if (result.refundUnrecorded) {
      /*
        A refund that did not record is never sealed as a clean receipt. The
        Cast stands and its views stand; what needs a human is the money.
      */
      await markGenerationOperationRecoveryRequired({
        userId: input.userId,
        operationId: input.operationId,
        publicMessage:
          `Part of this Cast's refund could not be recorded — quote operation ${input.operationId} and support will restore the balance.`,
        chargedCredits: input.chargedCredits,
        refundedCredits: result.refundedCredits,
      }).catch((error) => {
        log.fatal(
          { operationId: input.operationId, err: error },
          "[signService] could not mark an unrecorded refund for recovery",
        );
      });
      return;
    }

    // Bind BEFORE the receipt: the helper is gated on `running`, and the
    // operation stops being running the moment it is finalized.
    await bindGenerationOperationModel({
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
    }).catch((error) => {
      log.warn(
        { operationId: input.operationId, modelId: input.modelId, err: error },
        "[signService] the operation could not be bound to its Cast",
      );
    });

    await finalizeGenerationOperationSuccess({
      userId: input.userId,
      operationId: input.operationId,
      result: {
        castPublicId: input.agencyId,
        views: result.committed.length,
        failedViews: result.failed.length,
      },
      chargedCredits: input.chargedCredits,
      refundedCredits: result.refundedCredits,
      terminalStatus: result.failed.length > 0 ? "partial" : "succeeded",
    });
  } catch (error) {
    /*
      The sweep owns it from here. Sealing is the only thing that can have
      failed by this point — the money was settled slice by slice as the views
      resolved — and the adjudicator recomputes the totals from the ledger
      rather than trusting anything this process believed.
    */
    log.error(
      { operationId: input.operationId, modelId: input.modelId, err: error },
      "[signService] the package could not be sealed — leaving it for the recovery sweep",
    );
  }
}

function signRefusal(error: unknown, refunded: boolean, operationId: string): TRPCError {
  const tail = refunded
    ? "You were not charged."
    : `Part of the refund could not be recorded — quote operation ${operationId} and support will restore the balance.`;
  if (error instanceof TRPCError) return error;
  if (error instanceof SignPersistenceError) {
    switch (error.code) {
      case "candidate_unavailable":
        return new TRPCError({
          code: "CONFLICT",
          message: `That candidate was already signed or discarded. ${tail}`,
        });
      case "session_unavailable":
        return new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `That sheet is no longer open. ${tail}`,
        });
      case "operation_unavailable":
        return new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `This Sign was already settled. ${tail}`,
        });
      default:
        return spokenError({
          code: "INTERNAL_SERVER_ERROR",
          message: `The Cast couldn't be signed. ${tail}`,
        });
    }
  }
  /* The tail is where the money is named, and it was being dropped for the
     panel's generic line — see `shared/spokenError`. */
  return spokenError({
    code: "INTERNAL_SERVER_ERROR",
    message: `The Cast couldn't be signed. ${tail}`,
  });
}

export { CASTING_V2_SIGN_PRICE_CREDITS, CASTING_V2_SIGN_COSTS };
