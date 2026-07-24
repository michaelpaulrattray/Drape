/**
 * Server-owned Wardrobe model-image authority for the R7-7B5 cutover.
 *
 * A model-linked session always resolves the selected full-body Cast view.
 * A model-less session is an independent upload and keeps the image captured
 * when that owned session was created. Client-supplied URLs remain part of the
 * R6 rollback contract, but never select a Cast image in snapshot mode.
 */
import { TRPCError } from "@trpc/server";
import { getSessionById } from "../db";
import { resolveEffectiveCastStateForRead } from "../casting/effectiveCastRead";
import type { SnapshotReadMode } from "../casting/snapshotReadScope";
import { classifyStorageReference } from "../casting/deletionAudit";

const FULL_BODY_REQUIRED =
  "This Cast needs a selected full-body view before Wardrobe can use it. No credits were used.";
const OWNED_UPLOAD_REQUIRED =
  "Upload this model image again before starting Wardrobe. No credits were used.";

function selectedFullBodyUrl(
  state: Awaited<ReturnType<typeof resolveEffectiveCastStateForRead>>,
): string {
  if (state.status !== "current") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: FULL_BODY_REQUIRED,
    });
  }
  const selected = state.selectedViews.find((view) => view.angle === "frontFull");
  if (!selected?.asset.storageUrl) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: FULL_BODY_REQUIRED,
    });
  }
  return selected.asset.storageUrl;
}

async function resolveSelectedCastFullBody(input: {
  userId: number;
  modelId: number;
}): Promise<string> {
  const state = await resolveEffectiveCastStateForRead(input);
  return selectedFullBodyUrl(state);
}

function assertOwnedWardrobeUpload(input: {
  userId: number;
  requestedImageUrl: string;
}): string {
  const classified = classifyStorageReference({
    url: input.requestedImageUrl,
    currentPublicUrl: process.env.R2_PUBLIC_URL ?? "",
  });
  if (
    classified.kind !== "current_origin_url"
    || !classified.key.startsWith(`${input.userId}-models/upload-`)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: OWNED_UPLOAD_REQUIRED,
    });
  }
  return input.requestedImageUrl;
}

/**
 * Resolve the image persisted on a newly created Wardrobe session.
 *
 * Model-less sessions are the explicit upload-only boundary. For model-backed
 * sessions, snapshot mode ignores the requested URL entirely.
 */
export async function resolveWardrobeSessionCreateImage(input: {
  userId: number;
  modelId: number | null;
  requestedImageUrl: string;
  readMode: SnapshotReadMode;
}): Promise<string> {
  if (input.readMode === "r6") {
    return input.requestedImageUrl;
  }
  if (input.modelId == null) return assertOwnedWardrobeUpload(input);
  return resolveSelectedCastFullBody({
    userId: input.userId,
    modelId: input.modelId,
  });
}

/**
 * Resolve the model image for work attached to an existing Wardrobe session.
 *
 * The owned durable session decides whether this is Cast-backed or upload-only.
 * Even upload-only calls reuse the session's captured image rather than allowing
 * a later request to substitute another URL.
 */
export async function resolveWardrobeSessionUseImage(input: {
  userId: number;
  sessionId: number;
  requestedImageUrl: string;
  readMode: SnapshotReadMode;
}): Promise<string> {
  if (input.readMode === "r6") return input.requestedImageUrl;

  const session = await getSessionById(input.sessionId);
  if (!session || session.userId !== input.userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Wardrobe session not found",
    });
  }
  if (session.modelId == null) return session.modelImageUrl;

  return resolveSelectedCastFullBody({
    userId: input.userId,
    modelId: session.modelId,
  });
}
