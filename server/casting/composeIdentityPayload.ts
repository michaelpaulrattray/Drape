/**
 * composeIdentityPayload — D-30 strategy (b), the one server function that
 * owns identity-payload composition (founder-ratified with Group 6c).
 *
 * An edge from a cast to a consumer means "reference this cast, weighted
 * toward this view" — never "this image is the input". The composed payload
 * is the proven house pattern: the CURRENT headshot (anchor image) + one
 * intent view for pose/framing weight + the generated identity text
 * (buildIdentityAnchor — the hallucination clamps live in that text). Two
 * images + text avoids multi-ref dilution, is cheap, and keeps pass-4 video
 * payloads sane.
 *
 * Escalation path (ratified): if dogfooding shows identity drift, switching
 * to full-package payloads is a change to THIS function, not to callers.
 *
 * Stale-input rule (D-30): the composer always uses the current headshot +
 * identity text. An unpinned STALE intent view is flagged so plan()/confirm
 * UIs can warn ("Side view is out of sync — refresh first?"); pinned views
 * are accepted-final and used silently.
 *
 * D-12: the manifest records the exact image URLs sent plus the composed
 * identityText VERBATIM — full reproducibility, not just a pointer. The
 * manifest adopts the model_assets provenance vocabulary ({viewAngle,
 * imageUrl}); board-item provenance keeps its InputSnapshot shape — the two
 * are reconciled at the call site that writes each row, never merged.
 *
 * Pass 1 ships the composer + manifest shape + tests; no consumer nodes
 * exist yet (image-gen is pass 3, VTO pass 2).
 */
import { TRPCError } from "@trpc/server";
import { getModelById, getModelAssets } from "../db";
import { buildIdentityAnchor } from "./geminiClient";
import { VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "../../shared/boardTypes";

/** The asset-row shape the pure core reads (matches getModelAssets rows). */
export interface ComposerAssetRow {
  viewType: string;
  storageUrl: string;
  pinned?: boolean | null;
  status?: unknown;
}

export interface IdentityPayload {
  /** The CURRENT canonical headshot — always the anchor (D-30). */
  anchorImageUrl: string;
  /** The intent view's image, when that slot is filled; null degrades to
   *  headshot-only composition (D-39c graceful degradation). */
  intentImageUrl: string | null;
  /** buildIdentityAnchor(masterPrompt, technicalSchema), verbatim. */
  identityText: string;
}

/** D-12 provenance manifest — stored verbatim by consumers. */
export interface IdentityManifest {
  strategy: "headshot+intent+text";
  intentViewAngle: CanonicalViewAngle;
  /** model_assets provenance vocabulary: the exact images sent. */
  inputs: Array<{ viewAngle: CanonicalViewAngle; imageUrl: string }>;
  /** Verbatim — a few KB of JSON buys full reproducibility. */
  identityText: string;
  composedAt: string;
}

export interface StaleInputFlag {
  viewAngle: CanonicalViewAngle;
  label: string;
}

export interface ComposedIdentity {
  payload: IdentityPayload;
  manifest: IdentityManifest;
  /** Unpinned stale intent views — plan()/confirm UIs warn on these.
   *  Pinned stale views are accepted-final and never flagged. */
  staleInputs: StaleInputFlag[];
}

function newestFilled(assets: ComposerAssetRow[], angle: CanonicalViewAngle): ComposerAssetRow | undefined {
  return assets.find((a) => a.viewType === angle && a.storageUrl);
}

function isStale(row: ComposerAssetRow | undefined): boolean {
  const status = row?.status as { state?: string } | undefined;
  return status?.state === "stale";
}

/** Pure core — exported for tests. `assets` MUST be newest-first
 *  (getModelAssets order); newest-wins matches computePackageSlots. */
export function composeFromAssets(
  model: { masterPrompt: string; technicalSchema?: unknown },
  assets: ComposerAssetRow[],
  intentViewAngle: CanonicalViewAngle,
): ComposedIdentity {
  const headshot = newestFilled(assets, "frontClose");
  if (!headshot) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This model has no headshot — there is no identity to reference yet",
    });
  }

  const identityText = buildIdentityAnchor(model.masterPrompt, model.technicalSchema);

  // The headshot intent is already the anchor — one image, no second send
  const intentRow = intentViewAngle === "frontClose" ? undefined : newestFilled(assets, intentViewAngle);

  const inputs: IdentityManifest["inputs"] = [{ viewAngle: "frontClose", imageUrl: headshot.storageUrl }];
  if (intentRow) inputs.push({ viewAngle: intentViewAngle, imageUrl: intentRow.storageUrl });

  const staleInputs: StaleInputFlag[] = [];
  if (intentRow && isStale(intentRow) && !intentRow.pinned) {
    staleInputs.push({ viewAngle: intentViewAngle, label: VIEW_ANGLE_LABELS[intentViewAngle] });
  }

  return {
    payload: {
      anchorImageUrl: headshot.storageUrl,
      intentImageUrl: intentRow?.storageUrl ?? null,
      identityText,
    },
    manifest: {
      strategy: "headshot+intent+text",
      intentViewAngle,
      inputs,
      identityText,
      composedAt: new Date().toISOString(),
    },
    staleInputs,
  };
}

/** Ownership-checked wrapper — the shape every future consumer op calls. */
export async function composeIdentityPayload(input: {
  userId: number;
  modelId: number;
  intentViewAngle: CanonicalViewAngle;
}): Promise<ComposedIdentity> {
  const model = await getModelById(input.modelId);
  if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
  if (model.userId !== input.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  const assets = await getModelAssets(input.modelId);
  return composeFromAssets(
    { masterPrompt: model.masterPrompt, technicalSchema: model.technicalSchema ?? undefined },
    assets,
    input.intentViewAngle,
  );
}
