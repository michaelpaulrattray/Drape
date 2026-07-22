import { TRPCError } from "@trpc/server";
import type { InsertModelAsset } from "../../drizzle/schema";
import { VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "../../shared/boardTypes";
import { buildIdentityAnchor } from "./geminiClient";
import {
  assetRevisionMembership,
  currentRevisionId,
  identityStampFor,
  isRestoreCompatible,
} from "./identity/anchorSelector";
import { REFUSAL_COPY } from "./identity/refusalCopy";

interface RestoreModelTruth {
  id: number;
  userId: number;
  masterPrompt: string;
  technicalSchema: unknown;
  identityRevisionId?: string | null;
}

interface RestoreAssetTruth {
  id: number;
  viewType: string;
  storageUrl: string | null;
  resolution?: "1K" | "2K" | "4K" | null;
  storageKey?: string | null;
  provenance?: unknown;
}

/** Pure R6 restore law shared by the legacy-facing service and the atomic
 * R7 snapshot writer. `assets` must be the model's rows newest-first. */
export function prepareRestoreSlotTransition(input: {
  userId: number;
  model: RestoreModelTruth;
  assets: RestoreAssetTruth[];
  angle: CanonicalViewAngle;
  assetId: number;
}): {
  assetInsert: InsertModelAsset;
  url: string;
  version: number;
} {
  if (input.model.userId !== input.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
  const source = input.assets.find((asset) => asset.id === input.assetId);
  if (!source || source.viewType !== input.angle || !source.storageUrl) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `That version isn't a cast ${VIEW_ANGLE_LABELS[input.angle]} view of this model`,
    });
  }

  const currentIdentityText = buildIdentityAnchor(
    input.model.masterPrompt || "",
    input.model.technicalSchema ?? undefined,
  );
  const membership = assetRevisionMembership(source, input.model, currentIdentityText);
  if (!isRestoreCompatible(membership)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        membership === "mismatch"
          ? REFUSAL_COPY.crossRevisionRestore
          : REFUSAL_COPY.uncertainRestoreProvenance,
    });
  }

  const filled = input.assets.filter((asset) => asset.viewType === input.angle && !!asset.storageUrl);
  const head = filled[0];
  if (head?.id === source.id) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That's already the current version" });
  }
  if (head?.storageUrl === source.storageUrl) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That's already the current image" });
  }

  const sourceProvenance = (source.provenance ?? null) as { inputs?: unknown } | null;
  return {
    assetInsert: {
      modelId: input.model.id,
      viewType: input.angle,
      resolution: source.resolution ?? "1K",
      storageUrl: source.storageUrl,
      storageKey: source.storageKey ?? null,
      pointsCost: 0,
      pinned: false,
      provenance: {
        restoredFromAssetId: source.id,
        inputs: sourceProvenance?.inputs ?? null,
        engine: "restore",
        ...identityStampFor({
          role: "display",
          revisionId: currentRevisionId(input.model),
          identityText: currentIdentityText,
        }),
      },
    },
    url: source.storageUrl,
    version: filled.length + 1,
  };
}
