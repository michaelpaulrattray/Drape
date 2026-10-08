import { useCallback, useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";
import { createClientRequestId } from "@shared/clientRequestId";
import {
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
} from "@shared/boardTypes";
import { trpc } from "@/lib/trpc";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";
import {
  publishCastProjectionChanged,
  subscribeCastProjectionChanged,
} from "@/features/operations/castProjectionSync";
import { usePrivateEvidenceImage } from "./PrivateEvidenceImage";
import {
  inkReferenceFileError,
} from "./inkAddUxPolicy";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InkCapability = RouterOutputs["evidence"]["inkCapability"];
type InkAction = "plan" | "generate" | "accept" | "retry" | "cancel" | null;

type ActiveInkSubject =
  | (NonNullable<InkCapability["activeIntent"]> & {
      kind: "authoring";
      targetViewAngle: CanonicalViewAngle | null;
      priceCredits: number;
    })
  | {
      kind: "projection";
      intentId: null;
      description: string;
      locationLabel: string;
      referenceDeliveryUrl: null;
      candidateId: string;
      candidateStatus: "processing" | "ready";
      candidateDeliveryUrl: string | null;
      expiresAt: string | null;
      targetViewAngle: CanonicalViewAngle;
      priceCredits: number;
    };

/**
 * The one sentence this hook authors itself, before any request leaves the
 * browser — so it is ours, and true: nothing was sent, nothing could be charged.
 */
export class ReferenceReadError extends Error {
  constructor() {
    super("The reference image could not be read.");
    this.name = "ReferenceReadError";
  }
}

function readReferenceFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ReferenceReadError());
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new ReferenceReadError());
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * WHAT A TATTOO STEP SAYS WHEN IT COULD NOT READ THE ERROR — card #2048.
 *
 * This used to show any `error.message` raw (a gateway's 502 text, a parser's
 * complaint) and otherwise *"Tattoo previews are temporarily unavailable.
 * Nothing was charged."* — a money claim on an error the client never read,
 * on six actions, one of them the paid preview. The server's own sentences
 * still pass through (`readableFailure`); the fallback now says only what is
 * known.
 *
 * ⚠ The surface is unreachable today: every `evidence.*Ink*` procedure calls
 * `requireInkCapability`, which refuses while `R7_EVIDENCE_COMPOSER_SCOPE` is
 * off (production and dev), and that refusal is a spoken `PRECONDITION_FAILED`.
 * Whether the hook should be removed is a separate decision; this only stops
 * its copy from claiming what it does not know.
 */
export const INK_STEP_UNCONFIRMED_SENTENCE =
  "We couldn't confirm that tattoo step. Check the preview before trying again.";

export function inkStepFailureSentence(error: unknown): string {
  if (error instanceof ReferenceReadError) return error.message;
  logRawFailure("useInkAddWorkflow", error);
  return readableFailure(error, INK_STEP_UNCONFIRMED_SENTENCE);
}

export interface UseInkAddWorkflowOptions {
  modelId: number | null;
  onAccepted: (modelId: number) => Promise<void>;
}

export function useInkAddWorkflow({
  modelId,
  onAccepted,
}: UseInkAddWorkflowOptions) {
  const utils = trpc.useUtils();
  const [panelOpen, setPanelOpen] = useState(false);
  const [referenceFile, setReferenceFileState] = useState<File | null>(null);
  const [localReferenceUrl, setLocalReferenceUrl] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [action, setAction] = useState<InkAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const capabilityQuery = trpc.evidence.inkCapability.useQuery(
    { modelId: modelId ?? 0 },
    {
      enabled: modelId !== null,
      refetchOnWindowFocus: "always",
      refetchInterval: (query) => {
        const data = query.state.data as InkCapability | undefined;
        return data?.activeIntent?.candidateStatus === "processing" ? 2_500 : false;
      },
    },
  );
  const projectionQuery = trpc.evidence.inkProjectionCandidate.useQuery(
    { modelId: modelId ?? 0 },
    {
      enabled: modelId !== null,
      refetchOnWindowFocus: "always",
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.candidateStatus === "processing" ? 2_500 : false;
      },
    },
  );
  const beginIntent = trpc.evidence.beginInkAddIntent.useMutation();
  const attachReference = trpc.evidence.attachInkIntentReference.useMutation();
  const generateCandidate = trpc.evidence.generateInkAddCandidate.useMutation();
  const retryCandidate = trpc.evidence.retryInkAddCandidate.useMutation();
  const generateProjection =
    trpc.evidence.generateInkProjectionCandidate.useMutation();
  const retryProjection =
    trpc.evidence.retryInkProjectionCandidate.useMutation();
  const acceptCandidate = trpc.evidence.acceptInkAddCandidate.useMutation();
  const cancelIntent = trpc.evidence.cancelInkAddIntent.useMutation();
  const cancelProjection =
    trpc.evidence.cancelInkProjectionCandidate.useMutation();

  const capability = capabilityQuery.data ?? null;
  const activeIntent = capability?.activeIntent ?? null;
  const activeProjection = projectionQuery.data ?? null;
  const activeSubject: ActiveInkSubject | null = activeIntent
    ? {
        ...activeIntent,
        kind: "authoring",
        targetViewAngle: null,
        priceCredits: capability!.priceCredits,
      }
    : activeProjection
      ? {
          ...activeProjection,
          kind: "projection",
          intentId: null,
          description:
            `Update ${VIEW_ANGLE_LABELS[activeProjection.targetViewAngle]} with accepted tattoos`,
          locationLabel: "Tattoo coverage",
          referenceDeliveryUrl: null,
        }
      : null;
  const candidateImage = usePrivateEvidenceImage(
    activeSubject?.candidateStatus === "ready"
      ? activeSubject.candidateDeliveryUrl
      : null,
  );
  const attachedReferenceImage = usePrivateEvidenceImage(
    activeIntent?.referenceDeliveryUrl ?? null,
  );
  useEffect(() => {
    if (!referenceFile) {
      setLocalReferenceUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(referenceFile);
    setLocalReferenceUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [referenceFile]);

  useEffect(() => {
    setPanelOpen(false);
    setReferenceFileState(null);
    setReferenceError(null);
    setAction(null);
    setActionError(null);
  }, [modelId]);

  useEffect(() => {
    if (!activeSubject) return;
    setPanelOpen(true);
  }, [activeSubject?.candidateId, activeSubject?.intentId]);

  useEffect(() => subscribeCastProjectionChanged(({ modelId: changedId }) => {
    if (modelId !== changedId) return;
    void utils.evidence.inkCapability.invalidate({ modelId: changedId });
    void utils.evidence.inkProjectionCandidate.invalidate({
      modelId: changedId,
    });
  }), [modelId, utils]);

  const refreshTruth = useCallback(async (changedModelId: number) => {
    await Promise.allSettled([
      utils.evidence.inkCapability.invalidate({ modelId: changedModelId }),
      utils.evidence.inkProjectionCandidate.invalidate({
        modelId: changedModelId,
      }),
      utils.generation.packageState.invalidate({ modelId: changedModelId }),
      utils.generation.refreshSlotsPlan.invalidate({ modelId: changedModelId }),
      utils.generation.activeOperations.invalidate(),
      utils.credits.getBalance.invalidate(),
    ]);
    publishCastProjectionChanged(changedModelId);
  }, [utils]);

  const setReferenceFile = useCallback((file: File | null) => {
    if (!file) {
      setReferenceFileState(null);
      setReferenceError(null);
      return;
    }
    const error = inkReferenceFileError(file);
    setReferenceError(error);
    setReferenceFileState(error ? null : file);
  }, []);

  const planInstruction = useCallback(async (
    instruction: string,
  ): Promise<boolean> => {
    if (modelId === null || action !== null || activeSubject) return false;
    setPanelOpen(true);
    setAction("plan");
    setActionError(null);
    try {
      await beginIntent.mutateAsync({
        modelId,
        instruction: instruction.trim(),
        clientRequestId: createClientRequestId(),
      });
      await refreshTruth(modelId);
      return true;
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
      return false;
    } finally {
      setAction(null);
    }
  }, [action, activeSubject, beginIntent, modelId, refreshTruth]);

  const generate = useCallback(async () => {
    if (modelId === null || action !== null || !activeIntent) return;
    if (referenceError) {
      setActionError(referenceError);
      return;
    }

    setAction("generate");
    setActionError(null);
    try {
      const imageDataUrl = referenceFile
        ? await readReferenceFile(referenceFile)
        : null;
      const intentId = activeIntent.intentId;
      if (imageDataUrl && !activeIntent?.referenceDeliveryUrl) {
        await attachReference.mutateAsync({
          intentId,
          imageDataUrl,
          clientRequestId: createClientRequestId(),
        });
        await refreshTruth(modelId);
      }
      await generateCandidate.mutateAsync({
        intentId,
        clientRequestId: createClientRequestId(),
      });
      setReferenceFileState(null);
      await refreshTruth(modelId);
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    action,
    activeIntent,
    attachReference,
    generateCandidate,
    modelId,
    referenceError,
    referenceFile,
    refreshTruth,
  ]);

  const generateProjectionCandidate = useCallback(async (
    targetViewAngle: CanonicalViewAngle,
  ): Promise<boolean> => {
    if (modelId === null || action !== null || activeSubject) return false;
    setPanelOpen(true);
    setAction("generate");
    setActionError(null);
    try {
      await generateProjection.mutateAsync({
        modelId,
        targetViewAngle,
        clientRequestId: createClientRequestId(),
      });
      await refreshTruth(modelId);
      return true;
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
      return false;
    } finally {
      setAction(null);
    }
  }, [
    action,
    activeSubject,
    generateProjection,
    modelId,
    refreshTruth,
  ]);

  const accept = useCallback(async () => {
    if (
      modelId === null
      || action !== null
      || !activeSubject?.candidateId
      || candidateImage.phase !== "loaded"
    ) return;
    setAction("accept");
    setActionError(null);
    try {
      const result = await acceptCandidate.mutateAsync({
        candidateId: activeSubject.candidateId,
        clientRequestId: createClientRequestId(),
      });
      await refreshTruth(modelId);
      await onAccepted(result.modelId);
      setPanelOpen(false);
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    acceptCandidate,
    action,
    activeSubject?.candidateId,
    candidateImage.phase,
    modelId,
    onAccepted,
    refreshTruth,
  ]);

  const retry = useCallback(async () => {
    if (modelId === null || action !== null || !activeSubject) return;
    setAction("retry");
    setActionError(null);
    try {
      if (activeSubject.kind === "authoring") {
        await retryCandidate.mutateAsync({
          intentId: activeSubject.intentId,
          clientRequestId: createClientRequestId(),
        });
      } else {
        await retryProjection.mutateAsync({
          modelId,
          targetViewAngle: activeSubject.targetViewAngle,
          clientRequestId: createClientRequestId(),
        });
      }
      await refreshTruth(modelId);
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    action,
    activeSubject,
    modelId,
    refreshTruth,
    retryCandidate,
    retryProjection,
  ]);

  const cancel = useCallback(async () => {
    if (modelId === null || action !== null || !activeSubject) return;
    setAction("cancel");
    setActionError(null);
    try {
      if (activeSubject.kind === "authoring") {
        await cancelIntent.mutateAsync({
          intentId: activeSubject.intentId,
          clientRequestId: createClientRequestId(),
        });
      } else {
        await cancelProjection.mutateAsync({
          candidateId: activeSubject.candidateId,
          clientRequestId: createClientRequestId(),
        });
      }
      setReferenceFileState(null);
      setPanelOpen(false);
      await refreshTruth(modelId);
    } catch (error) {
      setActionError(inkStepFailureSentence(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    action,
    activeSubject,
    cancelIntent,
    cancelProjection,
    modelId,
    refreshTruth,
  ]);

  return {
    capability,
    capabilityLoading: capabilityQuery.isLoading,
    activeIntent,
    activeProjection,
    activeSubject,
    panelOpen,
    openPanel: () => {
      setActionError(null);
      setPanelOpen(true);
    },
    closePanel: () => {
      if (activeSubject) return;
      setPanelOpen(false);
      setActionError(null);
    },
    referenceFile,
    referenceUrl: activeIntent?.referenceDeliveryUrl
      ? attachedReferenceImage.objectUrl
      : localReferenceUrl,
    referencePhase: activeIntent?.referenceDeliveryUrl
      ? attachedReferenceImage.phase
      : referenceFile
        ? "loaded" as const
        : "unavailable" as const,
    referenceError,
    setReferenceFile,
    action,
    actionError,
    clearActionError: () => setActionError(null),
    candidateImage,
    planInstruction,
    generate,
    generateProjectionCandidate,
    accept,
    retry,
    cancel,
  };
}
