/**
 * The canonical package, built under the Sign operation (plan §E, §F "Package
 * completion").
 *
 * Six views, each an independently refundable unit — the same law a roll's
 * eight candidates live under, for the same reason: a view that does not arrive
 * refunds its exact slice while the rest of the package stands, and the Cast is
 * usable from its master the whole time (D-72's progressive-package law).
 *
 * WHAT MAKES A VIEW LAND, in order:
 *
 *   generate (anchor as reference) → conformance judged against the SPEC →
 *   commit under the operation's own fence → or refund the slice and write the
 *   failure down where the room can confess to it.
 *
 * Three properties are worth stating because each of them is a defect we would
 * otherwise ship:
 *
 * 1. **The judge may fail what it JUDGED, never what it never saw** (D-246,
 *    amending D-92). A view the judge looked at and rejected still fails and
 *    refunds — D-92's purpose is intact, and view conformance is still theatre
 *    unless it can fail. But a view the judge could not reach, or answered
 *    unreadably about, is now DELIVERED and recorded as `unjudged`. The founder's
 *    ruling is the authority: *detectors must not block real generations because
 *    the detectors are flawed.* This was the last place in the product where a
 *    broken checker still took a customer's money for a picture that may have
 *    been perfect — and the frame was deleted on the way out, so nobody could
 *    ever tell which it had been.
 * 2. **One regeneration, then the slot fails named-and-refunded.** Ported from
 *    the legacy back-view gate (D-39/D-40): a second attempt is worth its cost,
 *    a third is a slot machine.
 * 3. **A lost commit deletes its object.** If the fence refuses — the sweep got
 *    here first — nothing will ever reference those bytes, and the cleanup
 *    worker only deletes keys a row handed it. Best-effort delete now, or it is
 *    an orphan in the bucket forever.
 */
import { randomUUID } from "node:crypto";

import { recordRefund } from "../casting/atomicCredits";
import { operationChargeReference } from "../casting/operationContract";
import { createGeneration, updateGeneration } from "../db/generations";
import { listOperationViewSteps } from "../db/castingV2Sign";
import {
  activateSignedCast,
  commitPackageSlotAsset,
  listCastAssets,
  recordPackageSlotFailure,
} from "../db/castingV2Sign";
import { createModuleLogger } from "../logging/logger";
import { storageDelete, storagePut } from "../storage";
import { ProviderError, type IdentityEngine, type ReferenceImage } from "../providers/types";
import { CAST_VIEW_ANGLES, type CastViewAngle } from "../../shared/boardTypes";
import {
  CAST_PACKAGE_VIEWS,
  CAST_PACKAGE_VIEW_PRICE,
  CASTING_V2_SIGN_PROMOTION_PRICE,
  castPackageView,
  composePackageViewPrompt,
} from "./castViewPackage";
import {
  inkViewCropClause,
  inkViewReferenceClause,
  type CarriedInkCrop,
  type CarriedInkPlate,
} from "./inkViewReferences";
import { pronounsForSex, type CastPronouns } from "./castPronouns";
import {
  composeViewFeatureWordsClause,
  type CarriedFeatureWords,
} from "./viewFeatureWords";
import { castingIdentityEngine, castingViewConformanceJudge } from "./signEngine";
import type { ViewConformanceJudge, ViewConformanceVerdict } from "./viewConformance";

const log = createModuleLogger("castingV2/packageOrchestrator");

/** Package objects live under one namespace so cleanup and audit can find them. */
const PACKAGE_KEY_PREFIX = "casting-v2/casts";

/**
 * The per-view refund reference.
 *
 * `mintPackage`'s `<chargeRef>:slot:<angle>` shape, derived through the shared
 * charge helper at one site. The live orchestrator and the recovery adjudicator
 * must produce byte-identical references or the ledger's uniqueness cannot make
 * a retry idempotent — it would make it a second refund.
 */
export function packageSlotChargeReference(
  operationId: string,
  angle: CastViewAngle,
): string {
  return `${operationChargeReference(operationId)}:slot:${angle}`;
}

/**
 * The PROMOTION refund reference — the base, refunded only on a total loss.
 *
 * Derived through the same helper for the same reason: the live orchestrator
 * and the recovery adjudicator both settle a zero-view package, and if their
 * references differed by a byte the ledger's uniqueness would read the second
 * one as a fresh refund rather than a repeat of the first.
 */
export function packagePromotionChargeReference(operationId: string): string {
  return `${operationChargeReference(operationId)}:promotion`;
}

export type PackageOrchestratorDependencies = {
  identityEngine?: () => IdentityEngine;
  judge?: () => ViewConformanceJudge;
  storeImage?: (input: {
    operationId: string;
    bytes: Buffer;
    contentType: string;
  }) => Promise<{ key: string; url: string }>;
  commitSlot?: typeof commitPackageSlotAsset;
  recordFailure?: typeof recordPackageSlotFailure;
  refund?: typeof recordRefund;
  activate?: typeof activateSignedCast;
  deleteObject?: typeof storageDelete;
};

export type PackageSlotOutcome =
  | { angle: CastViewAngle; status: "committed"; assetId: number }
  | {
      angle: CastViewAngle;
      status: "failed";
      reason: string;
      refundedCredits: number;
      refundUnrecorded: boolean;
      /** The commit lost the fence — the sweep owns this slot, and its money. */
      fenced?: boolean;
    };

export type PackageResult = {
  committed: CastViewAngle[];
  failed: CastViewAngle[];
  refundedCredits: number;
  refundUnrecorded: boolean;
  activated: boolean;
  /**
   * TRUE when nothing landed and the base went back too (founder ruling,
   * 2026-08-02). Distinct from `failed.length === promised.length` at the call
   * site because the receipt has to say which of the two prices was returned.
   */
  totalLoss: boolean;
};

export type BuildPackageInput = {
  userId: number;
  operationId: string;
  modelId: number;
  identityRevisionId: string;
  identityText: string;
  anchor: ReferenceImage;
  /**
   * HER TATTOOS, AS PICTURES — the view-reference lane (FOUNDER RULING, his
   * words at fable-987 §3: *"tattoo reference will need to be supplied to each
   * view generated otherwise it wont know what the tattoo is"*).
   *
   * The anchor is a chest-up photograph of her face. A tattoo on her upper arm
   * is barely in it or outside it, so every view an engine rendered from the
   * anchor alone was drawing that surface from nothing.
   *
   * What rides is the PLATE — the design already drawn onto a blank mannequin
   * form — never the customer's uploaded photograph (D-138). Absent or empty,
   * every view composes exactly the prompt and the single reference it composed
   * before this existed, which is what a Cast with no ink still gets.
   */
  inkPlates?: readonly CarriedInkPlate[];
  /**
   * THE TATTOOS SHE ACTUALLY HAS, AS PICTURES OF HER — the delivered-crop lane
   * (fable-1297 §3, from his own *"crop and reference any tattos it can find
   * and see - this would intrun carry into the signing angles"*).
   *
   * The lane above has never carried anything: its source is the plate table
   * and the mannequin road is parked. This one's source is the frame that
   * really delivered the ink, cut down to the tattoo as it sits on her — which
   * is a better picture than a plate as well as an available one, because it
   * holds her own skin, her own tone and the size the design really is on her.
   *
   * Absent or empty, every view composes exactly the prompt and the single
   * reference it composed before this existed.
   */
  inkCrops?: readonly CarriedInkCrop[];
  /**
   * How the product refers to this Cast — `he`, `she`, `they`.
   *
   * Required by the delivered-crop sentence and by nothing else here, so it is
   * optional and defaults to the record's own answer for a Cast whose sex was
   * never stated: `they`, which is correct English rather than a guess.
   */
  pronouns?: CastPronouns;
  /**
   * WHAT THE ANCHOR CANNOT SHOW, AS WORDS — arrow 6 (FOUNDER, 2026-08-19:
   * *"when signing a cast to make the angles the refined image is supplied as
   * the reference and a description so that any features not visible are not
   * lost"*).
   *
   * The anchor is a waist-up photograph. A tail, clawed feet or cybernetic
   * hands are outside that frame entirely, so they rode into the full-body
   * views on nothing at all.
   *
   * Selection is `viewFeatureWords.ts`'s, and it is narrow by construction: a
   * feature the master framing PRESENTS rides nothing, because re-describing
   * what the pixels already carry is the likeness drift fable-876 §2 forbids.
   * Absent or empty, every view composes exactly the prompt it composed before
   * this existed.
   */
  featureWords?: readonly CarriedFeatureWords[];
};

async function defaultStoreImage(input: {
  operationId: string;
  bytes: Buffer;
  contentType: string;
}) {
  const extension = input.contentType === "image/jpeg" ? "jpg" : "png";
  // Cryptographic UUID keys, never a pseudo-random source — a guessable key is
  // all that stands between a public-bucket Cast view and anyone who guesses
  // it. (The repo-wide guard rejects the weak API by name in any storage
  // writer, so this comment names it by description.)
  return storagePut(
    `${PACKAGE_KEY_PREFIX}/${input.operationId}/views/${randomUUID()}.${extension}`,
    input.bytes,
    input.contentType,
  );
}

/**
 * Build the whole package, then activate.
 *
 * Views run concurrently under the provider queue's own budget: they are
 * independent, the room streams them in as they land, and gating the fifth on
 * the fourth would only make the customer wait longer for the same result.
 */
export async function buildCastPackage(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
): Promise<PackageResult> {
  /*
    THE PROMISE, WRITTEN DOWN BEFORE ANY WORK — and it is a money control, not
    bookkeeping.

    Recovery has to know which views this Sign PAID FOR, and the profile
    constant cannot tell it: a Sign charged under a six-view profile, left
    non-terminal by a deploy, and swept by a five-view build would have its
    retired slice charged, never generated and never refunded. That is the
    deploy-collision class the founder dogfoods through, and the constant is
    process memory — exactly what `activateSignedCast` refuses to trust.

    So the audit rows are created for the whole promised set up front. They are
    durable, per-angle, already part of the operation's children, and they are
    what `promisedPackageAngles` reads. One extra statement, one whole class of
    silent under-refund closed.
  */
  const promised = await Promise.all(
    CAST_PACKAGE_VIEWS.map(async (angle) => ({
      angle,
      auditId: await openViewAudit(input, angle),
    })),
  );

  const outcomes = await Promise.all(
    promised.map(({ angle, auditId }) => buildOneView(dependencies, input, angle, auditId)),
  );

  const committed = outcomes
    .filter((outcome): outcome is Extract<PackageSlotOutcome, { status: "committed" }> =>
      outcome.status === "committed")
    .map((outcome) => outcome.angle);
  const failures = outcomes.filter(
    (outcome): outcome is Extract<PackageSlotOutcome, { status: "failed" }> =>
      outcome.status === "failed",
  );
  const refundedCredits = failures.reduce((sum, failure) => sum + failure.refundedCredits, 0);
  const refundUnrecorded = failures.some((failure) => failure.refundUnrecorded);

  if (failures.length > 0) {
    log.warn(
      {
        operationId: input.operationId,
        modelId: input.modelId,
        failed: failures.map((failure) => failure.angle),
        refundedCredits,
      },
      "[packageOrchestrator] package incomplete — failed views refunded their slices",
    );
  }

  /*
    ZERO OF N — the base goes back too (founder ruling, 2026-08-02).

    The promotion charge buys permanence: the anchor is rescued from the sheet's
    purge, the identity is sealed, the Cast is repairable. That story is true and
    it survives a PARTIAL package, where the customer has views in hand and a
    Cast to keep them in. It does not survive a total loss — nobody came here to
    buy the preservation of a face they had already paid for on the sheet.

    Zero-of-N is only reachable through systemic failure: our provider account
    exhausted, a transport outage, a judge that could not be reached. Never
    through ordinary stochastic misses. Retaining 200 credits there charges the
    customer for OUR outage, which is precisely what the confession law forbids.

    The Cast still stands. She keeps the master she chose and the room says
    plainly what happened — see `TOTAL_LOSS_CONFESSION`. What changes is only
    the money, and the invariant it lives under: promotion is retained when the
    candidate CAS is set AND at least one view committed. Recomputable from the
    asset rows alone, which is what lets recovery reach the same verdict after a
    crash without trusting anything this process believed.
  */
  let totalLoss = false;
  let baseRefundUnrecorded = false;
  let baseRefunded = 0;
  /*
    A FENCED slot disqualifies the whole judgement, not just its own slice.

    Losing the fence does not mean the view failed — it means this process is no
    longer the authority on what happened to it. The sweep re-reads the ledger
    and settles from durable rows, so a fenced package's "nothing committed" is
    this process's opinion, not a fact. Acting on it would be a fenced writer
    spending money, which is the one thing the fence exists to stop.
  */
  const anyFenced = failures.some((failure) => failure.fenced);
  if (promised.length > 0 && committed.length === 0 && !anyFenced) {
    const outcome = await (dependencies.refund ?? recordRefund)(
      input.userId,
      CASTING_V2_SIGN_PROMOTION_PRICE,
      "Cast package: nothing arrived — the Sign refunded in full",
      packagePromotionChargeReference(input.operationId),
    );
    totalLoss = true;
    baseRefunded = outcome.recorded && !outcome.duplicate ? outcome.amount : 0;
    baseRefundUnrecorded = !outcome.recorded;
    /*
      The provider-account alarm's shape, for the same reason it has one: this
      is never the customer's brief and no retry fixes it. It says stop and look
      at the plumbing, not "what was wrong with this Cast".
    */
    log.error(
      {
        operationId: input.operationId,
        modelId: input.modelId,
        promised: promised.length,
        baseRefunded,
        refundedCredits: refundedCredits + baseRefunded,
        recorded: outcome.recorded,
      },
      "[packageOrchestrator] TOTAL LOSS — not one view landed; the whole Sign refunded, base included",
    );
    if (!outcome.recorded) {
      log.error(
        { operationId: input.operationId, reference: outcome.reference },
        "[packageOrchestrator] the promotion refund did not record — the owner remains charged",
      );
    }
  }

  /*
    Activate even when the package is partial (§F): the Cast is usable from its
    master, the missing views confess in place, and a Cast held in
    `provisioning` because one view failed would be a Cast the owner can never
    reach — invisible to every legacy procedure, by design.

    A TOTAL loss activates too: the ruling keeps the Cast and refunds the money.
    A Cast she cannot open is not a kinder outcome than one that explains itself.
  */
  const activation = await (dependencies.activate ?? activateSignedCast)({
    userId: input.userId,
    operationId: input.operationId,
    modelId: input.modelId,
  });
  if (activation.type === "unavailable") {
    log.error(
      { operationId: input.operationId, modelId: input.modelId },
      "[packageOrchestrator] the Cast could not be activated — left for the sweep",
    );
  }

  return {
    committed,
    failed: failures.map((failure) => failure.angle),
    refundedCredits: refundedCredits + baseRefunded,
    refundUnrecorded: refundUnrecorded || baseRefundUnrecorded,
    totalLoss,
    activated: activation.type === "activated" || activation.type === "already_active",
  };
}

/** Opens one view's durable audit row — the promise this Sign is paying for. */
async function openViewAudit(
  input: BuildPackageInput,
  angle: CastViewAngle,
): Promise<number | null> {
  const audit = await createGeneration({
    userId: input.userId,
    modelId: input.modelId,
    operationId: input.operationId,
    // The shared per-view step vocabulary: `view:<angle>` with the angle
    // recorded, so refund accounting reads the same key everywhere.
    stepKey: `view:${angle}`,
    viewAngle: angle,
    type: "multiView",
    status: "processing",
    pointsCost: CAST_PACKAGE_VIEW_PRICE,
    metadata: { viewType: angle, source: "castingV2.sign" },
  });
  return audit.success ? audit.generationId ?? null : null;
}

async function buildOneView(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
  angle: CastViewAngle,
  auditId: number | null,
): Promise<PackageSlotOutcome> {
  const view = castPackageView(angle);
  const engine = (dependencies.identityEngine ?? castingIdentityEngine)();
  const judge = (dependencies.judge ?? castingViewConformanceJudge)();
  const store = dependencies.storeImage ?? defaultStoreImage;
  const commit = dependencies.commitSlot ?? commitPackageSlotAsset;
  const drop = dependencies.deleteObject ?? storageDelete;

  let lastReason = "The view could not be generated";
  /*
    EVERY attempt's verdict, not just the last (D-114).

    This was a single `lastVerdict`, so the second attempt overwrote the first
    and a slot that failed twice recorded only its final rejection. That is the
    half of the automatic re-attempt that was genuinely missing: the judge is
    young, D-115 says it self-measures and never self-modifies, and the thing
    that makes it improvable is the record of what it rejected — including the
    draw that was thrown away before the one the customer heard about.
  */
  const verdicts: ViewConformanceVerdict[] = [];

  // One generation, one regeneration. Then the slot fails named-and-refunded.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let stored: { key: string; url: string } | null = null;
    try {
      /*
        THE PLATES RIDE BESIDE THE ANCHOR, INTO EVERY VIEW — his ruling, and the
        ordinal the clause quotes is derived from the array it is quoting about
        rather than assumed, so a sentence can never point at a slot the request
        does not hold.
      */
      const plates = input.inkPlates ?? [];
      /*
        AND THE TATTOOS SHE REALLY HAS, BEHIND THEM.

        Two ink lanes, one array, and every ordinal derived from the array
        itself — the crops start where the plates stop, so neither sentence can
        come to quote a slot the request does not hold. The two lanes never
        carry one tattoo twice: the Sign hands the plate lane the slots this one
        already took.
      */
      const crops = input.inkCrops ?? [];
      const references: ReferenceImage[] = [
        input.anchor,
        ...plates.map((plate) => ({ bytes: plate.bytes, contentType: plate.contentType })),
        ...crops.map((crop) => ({ bytes: crop.bytes, contentType: crop.contentType })),
      ];
      const inkClause = inkViewReferenceClause({ plates, firstOrdinal: 2 });
      const cropClause = inkViewCropClause({
        crops,
        firstOrdinal: 2 + plates.length,
        pronouns: input.pronouns ?? pronounsForSex(null),
      });
      /*
        THE WORDS FOR WHAT THE ANCHOR CANNOT SHOW ride in the same place the
        plates' clause does, so there is one shape for "things that travel
        beside the anchor" rather than two. Both are appended rather than
        substituted: a Cast with neither sends the composer's own output, byte
        for byte, which is the inertness both lanes are asserted on.
      */
      const wordsClause = composeViewFeatureWordsClause(input.featureWords ?? []).clause;
      const image = await engine.generateView({
        prompt: [composePackageViewPrompt(angle), inkClause, cropClause, wordsClause]
          .filter((part) => part !== "")
          .join("\n"),
        references,
        // §H.10: signed package views are 2K.
        resolution: "2K",
        viewAngle: angle,
      });

      // Bytes land in OUR storage before anything references them; a provider
      // URL is never persisted and never projected (§E, §J).
      stored = await store({
        operationId: input.operationId,
        bytes: image.bytes,
        contentType: image.contentType,
      });

      const verdict = await judgeUnjudgedOnFailure(judge, {
        angle,
        anchor: input.anchor,
        candidate: { bytes: image.bytes, contentType: image.contentType },
      });
      verdicts.push(verdict);

      if (verdict.unjudged) {
        /*
          D-246, amending D-92: **"we decided it was wrong" and "we could not
          tell" are different facts about a slot the customer paid for**, and
          only the first is a reason to take the picture away. The verdict has
          carried that distinction since it was written — the comment on
          `unjudged` says in as many words that the second "is the one that
          needs an alarm" — and until now both landed in the same branch.

          So it delivers, loudly. The alarm is the log line and the `unjudged`
          flag on the row; the guarantee Sign sells is not weakened, because a
          judge that DID look and DID reject still refuses below.
        */
        log.error(
          { operationId: input.operationId, angle, attempt, method: verdict.method },
          "[packageOrchestrator] the view could not be judged — DELIVERING and recording it, "
          + "rather than charging nothing for a picture that may be perfect (D-246)",
        );
      } else if (!verdict.pass) {
        const failedAxes = (Object.keys(verdict.axes) as Array<keyof typeof verdict.axes>)
          .filter((axis) => !verdict.axes[axis].pass);
        lastReason = conformanceReason(failedAxes, verdict);
        await drop(stored.key).catch(() => undefined);
        stored = null;
        log.warn(
          { operationId: input.operationId, angle, attempt, failedAxes, method: verdict.method },
          "[packageOrchestrator] view failed conformance",
        );
        continue;
      }

      const assetId = await commit({
        userId: input.userId,
        operationId: input.operationId,
        modelId: input.modelId,
        angle,
        storageKey: stored.key,
        storageUrl: stored.url,
        identityRevisionId: input.identityRevisionId,
        identityText: input.identityText,
        pointsCost: CAST_PACKAGE_VIEW_PRICE,
        provenance: {
          source: "castingV2.sign",
          engine: image.provenance.model,
          provider: image.provenance.provider,
          ...(image.provenance.providerRef ? { providerRef: image.provenance.providerRef } : {}),
          conformance: verdict.axes,
          conformanceMethod: verdict.method,
        },
      });

      if (assetId === null) {
        /*
          The fence refused: this Sign is no longer `running`, so the recovery
          sweep has taken over and will settle this slot. Nothing will ever
          reference these bytes.
        */
        await drop(stored.key).catch(() => undefined);
        if (auditId) {
          await updateGeneration(auditId, {
            status: "failed",
            errorMessage: "fenced",
            completedAt: new Date(),
          }).catch(() => undefined);
        }
        log.warn(
          { operationId: input.operationId, angle },
          "[packageOrchestrator] slot commit lost its fence — recovery owns this view",
        );
        return {
          angle,
          status: "failed",
          reason: "This view was settled by recovery",
          // Deliberately zero: the sweep refunds this slice under the same
          // reference, and counting it here would double it on the receipt.
          refundedCredits: 0,
          refundUnrecorded: false,
          fenced: true,
        };
      }

      if (auditId) {
        await updateGeneration(auditId, {
          status: "completed",
          resultUrl: stored.url,
          completedAt: new Date(),
        }).catch(() => undefined);
      }
      return { angle, status: "committed", assetId };
    } catch (error) {
      if (stored) await drop(stored.key).catch(() => undefined);
      const failureClass = error instanceof ProviderError ? error.failureClass : "unknown";
      lastReason = "The view could not be generated";
      log.warn(
        { operationId: input.operationId, angle, attempt, failureClass },
        "[packageOrchestrator] view generation failed",
      );
      /*
        A content refusal or a capability refusal will refuse identically on a
        second attempt (§H.5) — retrying burns the customer's time to reach the
        same answer. Transport and rate limits were already retried inside the
        adapter.
      */
      if (failureClass === "content_policy" || failureClass === "capability") break;
    }
  }

  return failView(dependencies, input, angle, {
    reason: lastReason,
    verdicts,
    auditId,
    label: view.label,
  });
}

/**
 * The judge, with its own failures turned into an HONEST verdict rather than a
 * verdict at all.
 *
 * The judge converts a refusal or an unreadable answer into `unjudged`; what
 * reaches here is a transport failure that survived its retries, and it gets the
 * same treatment. **`unjudged` is not "it failed" — it is "nobody looked"**, and
 * since D-246 the caller delivers on it and records the fact.
 *
 * §I's fail-closed law is not repealed by that. It said a check that reports
 * success loudest exactly when it understood nothing is worthless, and that is
 * still true: nothing here reports success. It reports that no opinion exists,
 * which is a different sentence and lands on the row as one.
 */
async function judgeUnjudgedOnFailure(
  judge: ViewConformanceJudge,
  input: Parameters<ViewConformanceJudge>[0],
): Promise<ViewConformanceVerdict> {
  try {
    return await judge(input);
  } catch (error) {
    log.error(
      { angle: input.angle, err: error },
      "[packageOrchestrator] the conformance judge failed — no opinion exists about this view",
    );
    const axis = { pass: false, note: "the view could not be checked" };
    return {
      pass: false,
      method: "unavailable",
      unjudged: true,
      axes: { identity: { ...axis }, angle: { ...axis }, wardrobe: { ...axis } },
    };
  }
}

/** Customer words for a conformance failure. No judge text is ever shown. */
function conformanceReason(
  failedAxes: readonly string[],
  verdict: ViewConformanceVerdict,
): string {
  if (verdict.unjudged) return "This view couldn't be checked";
  if (failedAxes.includes("identity")) return "This view didn't hold the signed likeness";
  if (failedAxes.includes("angle")) return "This view didn't come back at the angle it should";
  if (failedAxes.includes("wardrobe")) return "This view came back in the wrong clothing";
  return "This view didn't match what it should be";
}

async function failView(
  dependencies: PackageOrchestratorDependencies,
  input: BuildPackageInput,
  angle: CastViewAngle,
  detail: {
    reason: string;
    /** Every attempt's verdict, oldest first. Empty when nothing was judged. */
    verdicts: readonly ViewConformanceVerdict[];
    auditId: number | null;
    label: string;
  },
): Promise<PackageSlotOutcome> {
  const refund = dependencies.refund ?? recordRefund;
  const outcome = await refund(
    input.userId,
    CAST_PACKAGE_VIEW_PRICE,
    `Cast package: ${detail.label} didn't arrive`,
    packageSlotChargeReference(input.operationId, angle),
  );
  /*
    Two different numbers, deliberately.

    The SLOT shows what the customer got back for this view, and a duplicate
    means they did get it back — just earlier, from whoever refunded it first.
    The RECEIPT total counts only what this process actually moved, because
    adding a duplicate would report the same 50 credits twice.
  */
  const refundedForSlot = outcome.recorded ? outcome.amount : 0;
  const refundedCredits = outcome.recorded && !outcome.duplicate ? outcome.amount : 0;
  if (!outcome.recorded) {
    // A refund that did not record is never reported as "you weren't charged".
    log.error(
      { operationId: input.operationId, angle, reference: outcome.reference },
      "[packageOrchestrator] view refund did not record — the owner remains charged",
    );
  }

  if (detail.auditId) {
    await updateGeneration(detail.auditId, {
      status: "failed",
      errorMessage: detail.reason,
      completedAt: new Date(),
    }).catch(() => undefined);
  }

  await (dependencies.recordFailure ?? recordPackageSlotFailure)({
    userId: input.userId,
    operationId: input.operationId,
    modelId: input.modelId,
    angle,
    failure: {
      reason: detail.reason,
      // What ACTUALLY recorded, so the room never claims money moved that did
      // not.
      refunded: refundedForSlot,
      refundReference: outcome.reference,
      /*
        The FINAL verdict stays where it was, under the same key, because the
        room and any dispute read that shape — widening it would be a projection
        change for a record nobody asked to see differently.

        The earlier attempts ride alongside it under their own key. A slot that
        failed twice now says so, and says what the first draw was rejected for.
      */
      ...(detail.verdicts.length > 0
        ? {
            conformance: {
              axes: detail.verdicts[detail.verdicts.length - 1].axes,
              method: detail.verdicts[detail.verdicts.length - 1].method,
            },
          }
        : {}),
      ...(detail.verdicts.length > 1
        ? {
            earlierAttempts: detail.verdicts.slice(0, -1).map((verdict) => ({
              axes: verdict.axes,
              method: verdict.method,
            })),
          }
        : {}),
    },
  });

  return {
    angle,
    status: "failed",
    reason: detail.reason,
    refundedCredits,
    refundUnrecorded: !outcome.recorded,
  };
}

/**
 * The views this Sign PROMISED, read from its own durable audit rows.
 *
 * Never the profile constant: the constant is what a NEW Sign would buy, and
 * recovery is settling an old one. A Sign charged for six views must be
 * refunded against six, whatever this deploy happens to promise.
 *
 * Falls back to today's profile only when no audit row exists at all — a crash
 * so early that no view was ever opened. The caller cross-checks that fallback
 * against `plannedCredits` and refuses to guess if the two disagree.
 */
export async function promisedPackageAngles(input: {
  userId: number;
  operationId: string;
}): Promise<{ angles: CastViewAngle[]; source: "recorded" | "profile" }> {
  const rows = await listOperationViewSteps(input.operationId);
  const angles = rows
    .map((row) => row.viewAngle)
    .filter((angle): angle is CastViewAngle =>
      (CAST_VIEW_ANGLES as readonly string[]).includes(angle ?? ""));
  /*
    CAST_VIEW_ANGLES, never the comp-card six — this is the refund work-list.
    Reading the durable promise back through a filter that predates the promise
    is the deploy-collision landmine wearing a different coat: a v3 Sign swept
    by this code would have its close-up dropped here and never refunded.
  */
  const unique = CAST_VIEW_ANGLES.filter((angle) => angles.includes(angle));
  return unique.length > 0
    ? { angles: [...unique], source: "recorded" }
    : { angles: [...CAST_PACKAGE_VIEWS], source: "profile" };
}

/** Angles that have neither landed nor been written off — recovery's work list. */
/**
 * The views that actually LANDED — a full-resolution picture on disk.
 *
 * Recovery's half of the total-loss rule, and it is deliberately read from the
 * asset rows rather than from anything a process believed. That is the property
 * that lets the adjudicator reach the same verdict as the live orchestrator
 * after the process holding the package has been killed mid-flight: promotion
 * is retained when the candidate CAS is set AND at least one view committed,
 * and both halves are recomputable from durable rows alone (D-103).
 *
 * The 1K anchor is excluded by the same `2K` test the settlement uses. It is
 * the face she already had; it is not a view the package delivered.
 */
export async function committedPackageAngles(input: {
  userId: number;
  modelId: number;
  promised?: readonly CastViewAngle[];
}): Promise<CastViewAngle[]> {
  const assets = await listCastAssets(input.userId, input.modelId);
  const landed = new Set<string>();
  for (const asset of assets) {
    if (asset.storageUrl && asset.resolution === "2K") landed.add(asset.viewType);
  }
  return (input.promised ?? CAST_PACKAGE_VIEWS).filter((angle) => landed.has(angle));
}

export async function unsettledPackageAngles(input: {
  userId: number;
  modelId: number;
  /** The promised set. Defaults to today's profile for live callers. */
  promised?: readonly CastViewAngle[];
}): Promise<CastViewAngle[]> {
  const assets = await listCastAssets(input.userId, input.modelId);
  const settled = new Set<string>();
  for (const asset of assets) {
    const status = asset.status as { state?: string } | null;
    // A filled row is a landed view; a failure marker is a written-off one. The
    // 1K anchor is filled `frontClose`, so a headshot whose 2K re-render never
    // happened still counts as unsettled only if no marker was written for it —
    // which is exactly the case recovery must refund.
    if (asset.storageUrl && asset.resolution === "2K") settled.add(asset.viewType);
    if (status?.state === "failed") settled.add(asset.viewType);
  }
  return (input.promised ?? CAST_PACKAGE_VIEWS).filter((angle) => !settled.has(angle));
}
