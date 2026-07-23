/**
 * Private R7-7A4 consumer shadow projections.
 *
 * This module is pure. It translates one already-loaded, transaction-consistent
 * shadow state into safe hashes for the R6 and explicit-selection reader
 * interpretations. It grants no read authority and performs no I/O.
 */
import { createHash } from "node:crypto";
import {
  MINT_TIER_SLOTS,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
  type MintTier,
} from "../../shared/boardTypes";
import type {
  ModelAsset,
  ModelIdentitySnapshot,
  ModelPackageSnapshotSlot,
} from "../../drizzle/schema";
import { stableCanonicalJson } from "./operationContract";
import { buildIdentityAnchor } from "./geminiClient";
import { deriveBootstrapState } from "./snapshotBootstrap";
import { computeMintIntegrity } from "./identity/mintIntegrity";
import { computePackageSlots, tierCosts, type PackageSlot } from "./mintPackage";
import { computeRefreshPlan } from "./refreshSlots";
import type { SnapshotShadowState } from "./snapshotShadow";

export const SNAPSHOT_CONSUMER_SURFACES = [
  "casting_package_state",
  "casting_mint_plan",
  "casting_refresh_plan",
  "casting_export",
  "board_library",
  "models_registry",
] as const;

export type SnapshotConsumerSurface = typeof SNAPSHOT_CONSUMER_SURFACES[number];

export interface SnapshotConsumerDigest {
  parity: boolean;
  legacyHash: string | null;
  snapshotHash: string | null;
}

export type SnapshotConsumerShadow = Record<SnapshotConsumerSurface, SnapshotConsumerDigest>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableCanonicalJson(value)).digest("hex");
}

function digest(legacy: unknown | null, snapshot: unknown | null): SnapshotConsumerDigest {
  const legacyHash = legacy === null ? null : hash(legacy);
  const snapshotHash = snapshot === null ? null : hash(snapshot);
  return { parity: legacyHash === snapshotHash, legacyHash, snapshotHash };
}

function failedAttempt(
  assets: ModelAsset[],
  angle: CanonicalViewAngle,
): { failed: boolean; refunded: number } {
  const rows = assets.filter((asset) => asset.viewType === angle);
  if (rows.some((asset) => !!asset.storageUrl)) return { failed: false, refunded: 0 };
  const status = rows[0]?.status as { state?: string; refunded?: number } | null;
  return status?.state === "failed"
    ? { failed: true, refunded: status.refunded ?? 0 }
    : { failed: false, refunded: 0 };
}

function normalizedLegacyPackage(
  state: SnapshotShadowState,
): Array<{
  angle: CanonicalViewAngle;
  selectedAssetId: number | null;
  filled: boolean;
  pinned: boolean;
  stale: boolean;
  version: number;
  failed: boolean;
  refunded: number;
}> | null {
  const derived = deriveBootstrapState(state.model, state.assets);
  if (!derived) return null;
  const selected = new Map(derived.slots.map((slot) => [slot.viewAngle, slot]));
  return (Object.keys(VIEW_ANGLE_LABELS) as CanonicalViewAngle[]).map((angle) => {
    const selection = selected.get(angle);
    const asset = selection
      ? state.assets.find((row) => row.id === selection.selectedAssetId)
      : undefined;
    const failure = failedAttempt(state.assets, angle);
    return {
      angle,
      selectedAssetId: selection?.selectedAssetId ?? null,
      filled: !!asset?.storageUrl,
      pinned: !!asset?.pinned,
      stale: selection?.compatibility === "stale",
      version: state.assets.filter((row) => row.viewType === angle && !!row.storageUrl).length,
      failed: failure.failed,
      refunded: failure.refunded,
    };
  });
}

function normalizedSnapshotPackage(
  state: SnapshotShadowState,
): ReturnType<typeof normalizedLegacyPackage> {
  if (!state.currentPackage || !state.currentIdentity) return null;
  const selected = new Map(state.currentSlots.map((slot) => [slot.viewAngle, slot]));
  return (Object.keys(VIEW_ANGLE_LABELS) as CanonicalViewAngle[]).map((angle) => {
    const selection = selected.get(angle);
    const asset = selection
      ? state.assets.find((row) => row.id === selection.selectedAssetId)
      : undefined;
    const failure = failedAttempt(state.assets, angle);
    return {
      angle,
      selectedAssetId: selection?.selectedAssetId ?? null,
      filled: !!asset?.storageUrl,
      pinned: !!asset?.pinned,
      stale: selection?.compatibility === "stale",
      version: state.assets.filter((row) => row.viewType === angle && !!row.storageUrl).length,
      failed: failure.failed,
      refunded: failure.refunded,
    };
  });
}

function packageSlotsFromProjection(
  projection: NonNullable<ReturnType<typeof normalizedLegacyPackage>>,
): PackageSlot[] {
  return projection.map((slot) => ({
    angle: slot.angle,
    label: VIEW_ANGLE_LABELS[slot.angle],
    filled: slot.filled,
    url: slot.filled ? `asset:${slot.selectedAssetId}` : null,
    pinned: slot.pinned,
    stale: slot.stale,
    version: slot.version,
    failed: slot.failed
      ? { reason: "failed", refunded: slot.refunded, at: "" }
      : null,
  }));
}

function normalizeRefreshPlan(slots: PackageSlot[]) {
  const plan = computeRefreshPlan(slots);
  return {
    slots: plan.slots.map((slot) => ({
      angle: slot.angle,
      cost: slot.cost,
      pinned: slot.pinned,
      stale: slot.stale,
      refusal: slot.refusal,
    })),
    refreshable: plan.refreshable,
    totalCost: plan.totalCost,
  };
}

function normalizeLegacyMintPlan(state: SnapshotShadowState) {
  const derived = deriveBootstrapState(state.model, state.assets);
  if (!derived) return null;
  const existing = derived.slots.map((slot) => slot.viewAngle);
  const identityText = buildIdentityAnchor(
    state.model.masterPrompt,
    state.model.technicalSchema ?? undefined,
  );
  const tiers = {} as Record<MintTier, unknown>;
  for (const tier of ["draft", "core", "production"] as const) {
    const integrity = computeMintIntegrity(
      state.model,
      state.assets,
      MINT_TIER_SLOTS[tier],
      identityText,
    );
    tiers[tier] = {
      price: tierCosts(existing)[tier],
      anchor: integrity.anchor.ok,
      displayHeadshot: integrity.displayHeadshot.ok,
      tierViews: integrity.tierViews.map((view) => ({
        angle: view.angle,
        present: view.present,
        ok: view.ok,
      })),
      ok: integrity.ok,
    };
  }
  return {
    hasHeadshot: existing.includes("frontClose"),
    tiers,
  };
}

function snapshotAnchorValid(
  identity: ModelIdentitySnapshot,
  assets: ModelAsset[],
): boolean {
  const anchor = assets.find((asset) => asset.id === identity.anchorAssetId);
  return !!(
    anchor
    && anchor.modelId === identity.modelId
    && anchor.viewType === "frontClose"
    && anchor.storageUrl
  );
}

function normalizeSnapshotMintPlan(state: SnapshotShadowState) {
  if (!state.currentPackage || !state.currentIdentity) return null;
  const byAngle = new Map(state.currentSlots.map((slot) => [slot.viewAngle, slot]));
  const existing = state.currentSlots.map((slot) => slot.viewAngle);
  const front = byAngle.get("frontClose");
  const anchorOk = snapshotAnchorValid(state.currentIdentity, state.assets);
  const selectedAssetIsValid = (
    slot: Pick<ModelPackageSnapshotSlot, "selectedAssetId" | "viewAngle">,
  ) => state.assets.some((asset) => (
    asset.id === slot.selectedAssetId
    && asset.modelId === state.model.id
    && asset.viewType === slot.viewAngle
    && !!asset.storageUrl
  ));
  const displayOk = !front || (
    front.compatibility === "current"
    && selectedAssetIsValid(front)
  );
  const tiers = {} as Record<MintTier, unknown>;
  for (const tier of ["draft", "core", "production"] as const) {
    const tierViews = MINT_TIER_SLOTS[tier]
      .filter((angle) => angle !== "frontClose")
      .map((angle) => {
        const slot = byAngle.get(angle);
        const failure = failedAttempt(state.assets, angle);
        return {
          angle,
          present: !!slot || failure.failed,
          ok: (!slot && !failure.failed) || (
            !!slot
            && slot.compatibility === "current"
            && selectedAssetIsValid(slot)
          ),
        };
      });
    tiers[tier] = {
      price: tierCosts(existing)[tier],
      anchor: anchorOk,
      displayHeadshot: displayOk,
      tierViews,
      ok: anchorOk && displayOk && tierViews.every((view) => view.ok),
    };
  }
  return {
    hasHeadshot: !!front,
    tiers,
  };
}

function selectedManifest(
  slots: Array<Pick<ModelPackageSnapshotSlot, "viewAngle" | "selectedAssetId">>,
) {
  return [...slots]
    .sort((a, b) => a.viewAngle.localeCompare(b.viewAngle))
    .map((slot) => ({ angle: slot.viewAngle, assetId: slot.selectedAssetId }));
}

function legacySelectionManifest(state: SnapshotShadowState) {
  return deriveBootstrapState(state.model, state.assets)?.slots.map((slot) => ({
    viewAngle: slot.viewAngle,
    selectedAssetId: slot.selectedAssetId,
  })) ?? null;
}

function snapshotSelectionManifest(state: SnapshotShadowState) {
  return state.currentPackage && state.currentIdentity ? state.currentSlots : null;
}

function identityProjection(input: {
  masterPrompt: string;
  technicalSchema: unknown;
  preferences: unknown;
  anchorAssetId: number | null;
}) {
  return {
    masterPrompt: input.masterPrompt,
    technicalSchema: input.technicalSchema,
    preferences: input.preferences,
    anchorAssetId: input.anchorAssetId,
  };
}

export function compareSnapshotConsumers(state: SnapshotShadowState): SnapshotConsumerShadow {
  const legacyPackage = normalizedLegacyPackage(state);
  const snapshotPackage = normalizedSnapshotPackage(state);
  const legacySlots = legacyPackage ? packageSlotsFromProjection(legacyPackage) : null;
  const snapshotSlots = snapshotPackage ? packageSlotsFromProjection(snapshotPackage) : null;
  const legacySelection = legacySelectionManifest(state);
  const snapshotSelection = snapshotSelectionManifest(state);
  const legacyManifest = legacySelection ? selectedManifest(legacySelection) : null;
  const snapshotManifest = snapshotSelection ? selectedManifest(snapshotSelection) : null;
  const legacyFront = legacyManifest?.find((slot) => slot.angle === "frontClose") ?? null;
  const snapshotFront = snapshotManifest?.find((slot) => slot.angle === "frontClose") ?? null;
  const derived = deriveBootstrapState(state.model, state.assets);
  const legacyIdentity = derived
    ? identityProjection({
        masterPrompt: state.model.masterPrompt,
        technicalSchema: state.model.technicalSchema,
        preferences: state.model.preferences,
        anchorAssetId: derived.anchorAssetId,
      })
    : null;
  const snapshotIdentity = state.currentIdentity
    ? identityProjection(state.currentIdentity)
    : null;

  return {
    casting_package_state: digest(legacyPackage, snapshotPackage),
    casting_mint_plan: digest(
      normalizeLegacyMintPlan(state),
      normalizeSnapshotMintPlan(state),
    ),
    casting_refresh_plan: digest(
      legacySlots ? normalizeRefreshPlan(legacySlots) : null,
      snapshotSlots ? normalizeRefreshPlan(snapshotSlots) : null,
    ),
    casting_export: digest(
      legacyManifest && legacyIdentity ? { identity: legacyIdentity, slots: legacyManifest } : null,
      snapshotManifest && snapshotIdentity
        ? { identity: snapshotIdentity, slots: snapshotManifest }
        : null,
    ),
    board_library: digest(legacyFront, snapshotFront),
    models_registry: digest(
      legacyManifest && legacyIdentity ? { identity: legacyIdentity, slots: legacyManifest } : null,
      snapshotManifest && snapshotIdentity
        ? { identity: snapshotIdentity, slots: snapshotManifest }
        : null,
    ),
  };
}
