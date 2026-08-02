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
 * 1. **Nothing lands unjudged.** A generation that cannot be checked — the judge
 *    refused, was unreachable, or answered something unreadable — fails and
 *    refunds. Landing it would mean the only guarantee Sign sells (this is the
 *    same person) resting on the absence of an opinion.
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
  castPackageView,
  composePackageViewPrompt,
} from "./castViewPackage";
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
    };

export type PackageResult = {
  committed: CastViewAngle[];
  failed: CastViewAngle[];
  refundedCredits: number;
  refundUnrecorded: boolean;
  activated: boolean;
};

export type BuildPackageInput = {
  userId: number;
  operationId: string;
  modelId: number;
  identityRevisionId: string;
  identityText: string;
  anchor: ReferenceImage;
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
    Activate even when the package is partial (§F): the Cast is usable from its
    master, the missing views confess in place, and a Cast held in
    `provisioning` because one view failed would be a Cast the owner can never
    reach — invisible to every legacy procedure, by design.
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
    refundedCredits,
    refundUnrecorded,
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
  let lastVerdict: ViewConformanceVerdict | null = null;

  // One generation, one regeneration. Then the slot fails named-and-refunded.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let stored: { key: string; url: string } | null = null;
    try {
      const image = await engine.generateView({
        prompt: composePackageViewPrompt(angle),
        references: [input.anchor],
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

      const verdict = await judgeOrFailClosed(judge, {
        angle,
        anchor: input.anchor,
        candidate: { bytes: image.bytes, contentType: image.contentType },
      });
      lastVerdict = verdict;

      if (!verdict.pass) {
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
    verdict: lastVerdict,
    auditId,
    label: view.label,
  });
}

/**
 * The judge, with the fail-closed rule applied to its own failures.
 *
 * The judge itself converts a refusal or an unreadable answer into a failing
 * verdict; what reaches here is a transport failure that survived its retries,
 * and that has to fail too. "We could not check it" is never "it is fine" —
 * §I's fail-closed law is the reason identity work is allowed to cost money.
 */
async function judgeOrFailClosed(
  judge: ViewConformanceJudge,
  input: Parameters<ViewConformanceJudge>[0],
): Promise<ViewConformanceVerdict> {
  try {
    return await judge(input);
  } catch (error) {
    log.error(
      { angle: input.angle, err: error },
      "[packageOrchestrator] the conformance judge failed — the view cannot land",
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
    verdict: ViewConformanceVerdict | null;
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
      ...(detail.verdict
        ? { conformance: { axes: detail.verdict.axes, method: detail.verdict.method } }
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
