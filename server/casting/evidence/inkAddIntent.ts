import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  commitBeginInkAddIntent,
  findActiveOwnedInkIntent,
  InkAddIntentStateError,
  type BeginInkAddIntentResult,
} from "../../db/inkAddIntents";
import {
  beginDirectOperation,
  failClaimedDirectOperation,
  type DirectOperationGate,
} from "../directOperation";
import {
  getAiClient,
  safeResponseText,
  SAFETY_SETTINGS,
  withTimeout,
} from "../geminiClient";
import { withTextQueue } from "../geminiQueue";
import { modelOperationLockKey } from "../operationContract";
import {
  captureEvidenceComposerEnabled,
} from "./evidenceComposerScope";
import {
  INK_ADD_CAPABILITY_KEY,
  INK_ADD_PRICE_CREDITS,
} from "./evidenceCandidateContract";
import {
  authorizeInkAddDescription,
  type InkAuthorizationRequest,
  type InkAuthorizationResult,
} from "./composer/inkAuthorization";
import {
  assertInkAddSide,
  INK_ADD_SIDES,
  INK_ADD_TARGET_VIEW,
  type InkAddSide,
} from "./composer/inkAddRecipe";

const INK_INTENT_TEMPORARILY_UNAVAILABLE =
  "Tattoo previews are temporarily unavailable. Nothing was charged.";
const INK_INTENT_UNSUPPORTED =
  "That request is outside this tattoo preview. Describe one tattoo design for the visible upper torso.";

export interface InkAddCapabilityDto {
  inkAdd: boolean;
  priceCredits: typeof INK_ADD_PRICE_CREDITS;
  targetView: typeof INK_ADD_TARGET_VIEW;
  placements: readonly InkAddSide[];
  activeIntent: null | {
    intentId: string;
    description: string;
    side: InkAddSide;
    referenceDeliveryUrl: string | null;
    candidateId: null;
    candidateStatus: null;
    candidateDeliveryUrl: null;
    expiresAt: null;
  };
}

type BeginOperation = (input: Parameters<typeof beginDirectOperation>[0]) =>
  Promise<DirectOperationGate>;

export interface InkAddIntentDependencies {
  enabledForUser?: (userId: number) => boolean;
  authorize?: (input: {
    description: unknown;
    classify(request: InkAuthorizationRequest): Promise<unknown>;
  }) => Promise<InkAuthorizationResult>;
  classify?: (request: InkAuthorizationRequest) => Promise<unknown>;
  begin?: BeginOperation;
  commit?: typeof commitBeginInkAddIntent;
  generateId?: () => string;
}

async function classifyInkAdd(
  request: InkAuthorizationRequest,
): Promise<unknown> {
  const ai = getAiClient();
  const response = await withTextQueue(
    () => withTimeout(
      ai.models.generateContent({
        model: request.model,
        contents: [{ parts: [{ text: request.prompt }] }],
        config: {
          responseMimeType: request.responseMimeType,
          maxOutputTokens: 256,
          safetySettings: SAFETY_SETTINGS,
        },
      }),
      15_000,
      "InkAuthorization",
    ),
    "inkAuthorization",
  );
  return safeResponseText(response);
}

function closedIntentResult(value: unknown): BeginInkAddIntentResult {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || typeof (value as Record<string, unknown>).intentId !== "string"
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INK_INTENT_TEMPORARILY_UNAVAILABLE,
    });
  }
  return { intentId: (value as Record<string, string>).intentId };
}

function stateError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof InkAddIntentStateError) {
    if (error.code === "model_unavailable") {
      return new TRPCError({ code: "NOT_FOUND", message: "Cast not found." });
    }
    if (
      error.code === "feature_already_selected"
      || error.code === "intent_already_active"
      || error.code === "source_unavailable"
    ) {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message: INK_INTENT_TEMPORARILY_UNAVAILABLE,
      });
    }
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: INK_INTENT_TEMPORARILY_UNAVAILABLE,
  });
}

function requireEnabled(
  userId: number,
  enabledForUser: (userId: number) => boolean,
): void {
  if (!enabledForUser(userId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tattoo previews are not available for this account.",
    });
  }
}

export async function beginInkAddIntent(
  input: {
    userId: number;
    modelId: number;
    sourceAssetId: number;
    side: InkAddSide;
    description: string;
    clientRequestId: string;
  },
  dependencies: InkAddIntentDependencies = {},
): Promise<BeginInkAddIntentResult> {
  const enabledForUser =
    dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  requireEnabled(input.userId, enabledForUser);
  try {
    assertInkAddSide(input.side);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid tattoo placement." });
  }

  const authorization = await (
    dependencies.authorize ?? authorizeInkAddDescription
  )({
    description: input.description,
    classify: dependencies.classify ?? classifyInkAdd,
  });
  if (!authorization.ok) {
    throw new TRPCError({
      code: authorization.code === "authorization_unknown"
        ? "PRECONDITION_FAILED"
        : "BAD_REQUEST",
      message: authorization.code === "authorization_unknown"
        ? INK_INTENT_TEMPORARILY_UNAVAILABLE
        : INK_INTENT_UNSUPPORTED,
    });
  }

  const begin = dependencies.begin ?? beginDirectOperation;
  const gate = await begin({
    userId: input.userId,
    clientRequestId: input.clientRequestId,
    kind: "evidence_intent_begin",
    modelId: input.modelId,
    payload: {
      modelId: input.modelId,
      sourceAssetId: input.sourceAssetId,
      side: input.side,
      normalizedDescriptor: authorization.normalizedDescriptor,
    },
    lockKey: modelOperationLockKey(input.modelId),
  });
  if (gate.type === "replay") return closedIntentResult(gate.result);

  try {
    return await (dependencies.commit ?? commitBeginInkAddIntent)({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      intentId: (dependencies.generateId ?? randomUUID)(),
      sourceAssetId: input.sourceAssetId,
      side: input.side,
      normalizedDescriptor: authorization.normalizedDescriptor,
    });
  } catch (error) {
    return failClaimedDirectOperation({
      userId: input.userId,
      operationId: gate.operationId,
      error: stateError(error),
    });
  }
}

export async function readInkAddCapability(
  input: { userId: number; modelId?: number },
  dependencies: Pick<InkAddIntentDependencies, "enabledForUser"> = {},
): Promise<InkAddCapabilityDto> {
  const enabledForUser =
    dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  const enabled = enabledForUser(input.userId);
  const active = enabled && input.modelId
    ? await findActiveOwnedInkIntent({
        userId: input.userId,
        modelId: input.modelId,
      })
    : null;
  return {
    inkAdd: enabled,
    priceCredits: INK_ADD_PRICE_CREDITS,
    targetView: INK_ADD_TARGET_VIEW,
    placements: INK_ADD_SIDES,
    activeIntent: active
      ? {
          intentId: active.id,
          description: active.normalizedDescriptor,
          side: active.side,
          referenceDeliveryUrl: active.referencePlateId
            ? `/api/evidence/plate/${active.referencePlateId}`
            : null,
          candidateId: null,
          candidateStatus: null,
          candidateDeliveryUrl: null,
          expiresAt: null,
        }
      : null,
  };
}

export function inkAddCapabilityKey(): typeof INK_ADD_CAPABILITY_KEY {
  return INK_ADD_CAPABILITY_KEY;
}
