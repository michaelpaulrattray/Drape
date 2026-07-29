import { randomUUID } from "node:crypto";
import type { GenerateContentConfig } from "@google/genai";
import { TRPCError } from "@trpc/server";
import {
  commitBeginInkAddIntent,
  commitBeginInkAnywhereIntent,
  findActiveOwnedInkIntent,
  inspectOwnedInkAnywhereAvailability,
  InkAddIntentStateError,
  type BeginInkAddIntentResult,
  type BeginInkAnywhereIntentResult,
  type OwnedInkAddAvailability,
  type OwnedPendingInkIntent,
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
  type InkAddSide,
} from "./composer/inkAddRecipe";
import { readActiveInkCandidate } from "./inkCandidateGeneration";
import { createModuleLogger } from "../../logging/logger";
import {
  extractInkProviderTelemetry,
  type InkProviderTelemetry,
} from "./composer/inkProviderTelemetry";
import {
  planInkAddInstruction,
  type InkInstructionPlan,
  type InkInstructionPlanningRequest,
} from "./inkInstructionPlanner";
import {
  INK_ANYWHERE_CAPABILITY_KEY,
  inkAnatomyLabel,
  type InkAnatomyTuple,
} from "./inkAnatomyRegistry";
import {
  CANONICAL_VIEW_ANGLES,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
} from "../../../shared/boardTypes";

const log = createModuleLogger("casting/evidence/inkAddIntent");
const INK_INTENT_TEMPORARILY_UNAVAILABLE =
  "Tattoo previews are temporarily unavailable. Nothing was charged.";
const INK_INTENT_UNSUPPORTED =
  "That request is outside this tattoo preview. Describe one tattoo design for the visible upper torso.";
const INK_ANYWHERE_INTENT_UNSUPPORTED =
  "Describe one new tattoo and one exact body location. Existing tattoos cannot be changed in this release.";
const INK_ANYWHERE_INTENT_AMBIGUOUS =
  "Tell Drape the exact body location and side, such as right full sleeve or left upper back. Nothing was charged.";

export interface InkAddCapabilityDto {
  inkAdd: boolean;
  subjectStatus:
    | "disabled"
    | "eligible"
    | "active"
    | "model_unavailable"
    | "source_unavailable"
    | "feature_selected";
  priceCredits: typeof INK_ADD_PRICE_CREDITS;
  activeIntent: null | {
    intentId: string;
    description: string;
    locationLabel: string;
    sourceViewAngle: CanonicalViewAngle;
    sourceViewLabel: string;
    referenceDeliveryUrl: string | null;
    candidateId: string | null;
    candidateStatus: "processing" | "ready" | null;
    candidateDeliveryUrl: string | null;
    expiresAt: string | null;
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
  warnAuthorizationUnknown?: (input: {
    userId: number;
    modelId: number;
    provider: InkProviderTelemetry | null;
  }) => void;
  begin?: BeginOperation;
  commit?: typeof commitBeginInkAddIntent;
  generateId?: () => string;
}

export interface InkAnywhereIntentDependencies {
  enabledForUser?: (userId: number) => boolean;
  plan?: typeof planInkAddInstruction;
  classify?: (request: InkInstructionPlanningRequest) => Promise<unknown>;
  warnAuthorizationUnknown?: InkAddIntentDependencies["warnAuthorizationUnknown"];
  begin?: BeginOperation;
  commit?: typeof commitBeginInkAnywhereIntent;
  generateId?: () => string;
}

export interface PlannedInkAnywhereIntent {
  intentId: string;
  instruction: string;
  locationLabel: string;
  priceCredits: typeof INK_ADD_PRICE_CREDITS;
  sourceViewLabel: string;
}

export interface InkAddCapabilityDependencies {
  enabledForUser?: (userId: number) => boolean;
  findActiveIntent?: (input: {
    userId: number;
    modelId: number;
  }) => Promise<OwnedPendingInkIntent | null>;
  inspectAvailability?: (input: {
    userId: number;
    modelId: number;
  }) => Promise<OwnedInkAddAvailability>;
  readCandidate?: typeof readActiveInkCandidate;
}

export function buildInkAuthorizationProviderConfig(
  request: InkAuthorizationRequest,
): GenerateContentConfig {
  const properties = Object.fromEntries(
    Object.entries(request.responseSchema).map(([key, type]) => [
      key,
      { type: type === "boolean" ? "BOOLEAN" : "INTEGER" },
    ]),
  );
  return {
    responseMimeType: request.responseMimeType,
    responseSchema: {
      type: "OBJECT",
      properties,
      required: Object.keys(properties),
    },
    thinkingConfig: {
      thinkingBudget: request.thinkingBudget,
      includeThoughts: request.includeThoughts,
    },
    maxOutputTokens: request.maxOutputTokens,
    safetySettings: SAFETY_SETTINGS,
  };
}

export function buildInkInstructionProviderConfig(
  request: InkInstructionPlanningRequest,
): GenerateContentConfig {
  return {
    responseMimeType: request.responseMimeType,
    responseSchema: {
      type: "OBJECT",
      properties: {
        tattooOnly: { type: "BOOLEAN" },
        operationAdd: { type: "BOOLEAN" },
        singleFeature: { type: "BOOLEAN" },
        zone: {
          type: "STRING",
          enum: [...request.responseSchema.enumKeys.zone],
        },
        surface: {
          type: "STRING",
          enum: [...request.responseSchema.enumKeys.surface],
        },
        side: {
          type: "STRING",
          enum: [...request.responseSchema.enumKeys.side],
        },
        ambiguousAnatomy: { type: "BOOLEAN" },
        containsPromptControl: { type: "BOOLEAN" },
        confidence: { type: "INTEGER" },
      },
      required: [
        ...request.responseSchema.booleanKeys,
        "zone",
        "surface",
        "side",
        ...request.responseSchema.integerKeys,
      ],
    },
    thinkingConfig: {
      thinkingBudget: request.thinkingBudget,
      includeThoughts: request.includeThoughts,
    },
    maxOutputTokens: request.maxOutputTokens,
    safetySettings: SAFETY_SETTINGS,
  };
}

async function classifyInkAdd(
  request: InkAuthorizationRequest,
  observe: (provider: InkProviderTelemetry) => void,
): Promise<unknown> {
  const ai = getAiClient();
  try {
    const response = await withTextQueue(
      () => withTimeout(
        ai.models.generateContent({
          model: request.model,
          contents: [{ parts: [{ text: request.prompt }] }],
          config: buildInkAuthorizationProviderConfig(request),
        }),
        15_000,
        "InkAuthorization",
      ),
      "inkAuthorization",
    );
    const text = safeResponseText(response);
    observe(extractInkProviderTelemetry({
      response,
      textLength: text.length,
    }));
    return text;
  } catch (error) {
    observe(extractInkProviderTelemetry({ error }));
    throw error;
  }
}

async function classifyInkInstruction(
  request: InkInstructionPlanningRequest,
  observe: (provider: InkProviderTelemetry) => void,
): Promise<unknown> {
  const ai = getAiClient();
  try {
    const response = await withTextQueue(
      () => withTimeout(
        ai.models.generateContent({
          model: request.model,
          contents: [{ parts: [{ text: request.prompt }] }],
          config: buildInkInstructionProviderConfig(request),
        }),
        15_000,
        "InkInstructionPlanning",
      ),
      "inkInstructionPlanning",
    );
    const text = safeResponseText(response);
    observe(extractInkProviderTelemetry({
      response,
      textLength: text.length,
    }));
    return text;
  } catch (error) {
    observe(extractInkProviderTelemetry({ error }));
    throw error;
  }
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

function closedAnywhereIntentResult(
  value: unknown,
  plan: Extract<InkInstructionPlan, { ok: true }>,
): PlannedInkAnywhereIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INK_INTENT_TEMPORARILY_UNAVAILABLE,
    });
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.intentId !== "string"
    || typeof result.sourceViewAngle !== "string"
    || !(CANONICAL_VIEW_ANGLES as readonly string[]).includes(
      result.sourceViewAngle,
    )
    || !Number.isSafeInteger(result.sourceAssetId)
  ) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INK_INTENT_TEMPORARILY_UNAVAILABLE,
    });
  }
  return {
    intentId: result.intentId,
    instruction: plan.normalizedDescriptor,
    locationLabel: plan.locationLabel,
    priceCredits: INK_ADD_PRICE_CREDITS,
    sourceViewLabel:
      VIEW_ANGLE_LABELS[result.sourceViewAngle as CanonicalViewAngle],
  };
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

  let providerTelemetry: InkProviderTelemetry | null = null;
  const authorization = await (
    dependencies.authorize ?? authorizeInkAddDescription
  )({
    description: input.description,
    classify: dependencies.classify ?? ((request) =>
      classifyInkAdd(request, (provider) => {
        providerTelemetry = provider;
      })),
  });
  if (!authorization.ok) {
    if (authorization.code === "authorization_unknown") {
      const diagnostic = {
        userId: input.userId,
        modelId: input.modelId,
        provider: providerTelemetry,
      };
      if (dependencies.warnAuthorizationUnknown) {
        dependencies.warnAuthorizationUnknown(diagnostic);
      } else {
        log.warn(
          diagnostic,
          "Ink authorization returned unavailable",
        );
      }
    }
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

export async function beginInkAnywhereIntent(
  input: {
    userId: number;
    modelId: number;
    instruction: string;
    clientRequestId: string;
  },
  dependencies: InkAnywhereIntentDependencies = {},
): Promise<PlannedInkAnywhereIntent> {
  const enabledForUser =
    dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  requireEnabled(input.userId, enabledForUser);

  let providerTelemetry: InkProviderTelemetry | null = null;
  const plan = await (dependencies.plan ?? planInkAddInstruction)({
    instruction: input.instruction,
    classify: dependencies.classify ?? ((request) =>
      classifyInkInstruction(request, (provider) => {
        providerTelemetry = provider;
      })),
  });
  if (!plan.ok) {
    if (plan.code === "authorization_unknown") {
      const diagnostic = {
        userId: input.userId,
        modelId: input.modelId,
        provider: providerTelemetry,
      };
      if (dependencies.warnAuthorizationUnknown) {
        dependencies.warnAuthorizationUnknown(diagnostic);
      } else {
        log.warn(diagnostic, "Ink instruction planning returned unavailable");
      }
    }
    const ambiguous = plan.code === "ambiguous_anatomy";
    throw new TRPCError({
      code: plan.code === "authorization_unknown"
        ? "PRECONDITION_FAILED"
        : "BAD_REQUEST",
      message: plan.code === "authorization_unknown"
        ? INK_INTENT_TEMPORARILY_UNAVAILABLE
        : ambiguous
          ? INK_ANYWHERE_INTENT_AMBIGUOUS
          : INK_ANYWHERE_INTENT_UNSUPPORTED,
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
      normalizedDescriptor: plan.normalizedDescriptor,
      anatomy: plan.anatomy,
      recipeVersion: plan.recipeVersion,
    },
    lockKey: modelOperationLockKey(input.modelId),
  });
  if (gate.type === "replay") {
    return closedAnywhereIntentResult(gate.result, plan);
  }

  try {
    const result: BeginInkAnywhereIntentResult = await (
      dependencies.commit ?? commitBeginInkAnywhereIntent
    )({
      userId: input.userId,
      modelId: input.modelId,
      operationId: gate.operationId,
      intentId: (dependencies.generateId ?? randomUUID)(),
      anatomy: plan.anatomy,
      normalizedDescriptor: plan.normalizedDescriptor,
    });
    return closedAnywhereIntentResult(result, plan);
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
  dependencies: InkAddCapabilityDependencies = {},
): Promise<InkAddCapabilityDto> {
  const enabledForUser =
    dependencies.enabledForUser ?? captureEvidenceComposerEnabled;
  const enabled = enabledForUser(input.userId);
  const active = enabled && input.modelId
    ? await (dependencies.findActiveIntent ?? findActiveOwnedInkIntent)({
        userId: input.userId,
        modelId: input.modelId,
      })
    : null;
  const candidate = active
    ? await (dependencies.readCandidate ?? readActiveInkCandidate)({
        userId: input.userId,
        intentId: active.id,
      })
    : null;
  const availability = enabled && input.modelId && !active
    ? await (
        dependencies.inspectAvailability
        ?? inspectOwnedInkAnywhereAvailability
      )({
        userId: input.userId,
        modelId: input.modelId,
      })
    : null;
  return {
    inkAdd: enabled,
    subjectStatus: !enabled
      ? "disabled"
      : active
        ? "active"
        : availability ?? "model_unavailable",
    priceCredits: INK_ADD_PRICE_CREDITS,
    activeIntent: active
      ? {
          intentId: active.id,
          description: active.normalizedDescriptor,
          locationLabel: active.capabilityKey === INK_ANYWHERE_CAPABILITY_KEY
            ? inkAnatomyLabel({
                zone: active.zone,
                surface: active.surface,
                side: active.side,
              } as InkAnatomyTuple)
            : `${active.side === "centre" ? "Centre" : active.side} chest`,
          sourceViewAngle: active.sourceViewAngle,
          sourceViewLabel: VIEW_ANGLE_LABELS[active.sourceViewAngle],
          referenceDeliveryUrl: active.referencePlateId
            ? `/api/evidence/plate/${active.referencePlateId}`
            : null,
          candidateId: candidate?.candidateId ?? null,
          candidateStatus: candidate?.candidateStatus ?? null,
          candidateDeliveryUrl: candidate?.candidateDeliveryUrl ?? null,
          expiresAt: candidate?.expiresAt ?? null,
        }
      : null,
  };
}

export function inkAddCapabilityKey(): typeof INK_ADD_CAPABILITY_KEY {
  return INK_ADD_CAPABILITY_KEY;
}
