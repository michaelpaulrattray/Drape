import { useCallback, useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../../server/routers";
import { createClientRequestId } from "@shared/clientRequestId";
import { trpc } from "@/lib/trpc";
import {
  publishCastProjectionChanged,
  subscribeCastProjectionChanged,
} from "@/features/operations/castProjectionSync";
import { usePrivateEvidenceImage } from "./PrivateEvidenceImage";
import {
  inkDescriptionReady,
  inkReferenceFileError,
} from "./inkAddUxPolicy";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type InkCapability = RouterOutputs["evidence"]["inkCapability"];
type InkSide = InkCapability["placements"][number];
type InkAction = "generate" | "accept" | "retry" | "cancel" | null;

function readReferenceFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The reference image could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The reference image could not be read."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function publicMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Tattoo previews are temporarily unavailable. Nothing was charged.";
}

export interface UseInkAddWorkflowOptions {
  modelId: number | null;
  sourceAssetId: number | null;
  onAccepted: (modelId: number) => Promise<void>;
}

export function useInkAddWorkflow({
  modelId,
  sourceAssetId,
  onAccepted,
}: UseInkAddWorkflowOptions) {
  const utils = trpc.useUtils();
  const [panelOpen, setPanelOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [side, setSide] = useState<InkSide>("centre");
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
  const beginIntent = trpc.evidence.beginInkAddIntent.useMutation();
  const attachReference = trpc.evidence.attachInkIntentReference.useMutation();
  const generateCandidate = trpc.evidence.generateInkAddCandidate.useMutation();
  const retryCandidate = trpc.evidence.retryInkAddCandidate.useMutation();
  const acceptCandidate = trpc.evidence.acceptInkAddCandidate.useMutation();
  const cancelIntent = trpc.evidence.cancelInkAddIntent.useMutation();

  const capability = capabilityQuery.data ?? null;
  const activeIntent = capability?.activeIntent ?? null;
  const candidateImage = usePrivateEvidenceImage(
    activeIntent?.candidateStatus === "ready"
      ? activeIntent.candidateDeliveryUrl
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
    setDescription("");
    setSide("centre");
    setReferenceFileState(null);
    setReferenceError(null);
    setAction(null);
    setActionError(null);
  }, [modelId]);

  useEffect(() => {
    if (!activeIntent) return;
    setPanelOpen(true);
    setDescription(activeIntent.description);
    setSide(activeIntent.side);
  }, [activeIntent?.description, activeIntent?.intentId, activeIntent?.side]);

  useEffect(() => subscribeCastProjectionChanged(({ modelId: changedId }) => {
    if (modelId !== changedId) return;
    void utils.evidence.inkCapability.invalidate({ modelId: changedId });
  }), [modelId, utils]);

  const refreshTruth = useCallback(async (changedModelId: number) => {
    await Promise.allSettled([
      utils.evidence.inkCapability.invalidate({ modelId: changedModelId }),
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

  const generate = useCallback(async () => {
    if (modelId === null || sourceAssetId === null || action !== null) return;
    const normalized = description.trim();
    if (!activeIntent && !inkDescriptionReady(normalized)) {
      setActionError("Describe one tattoo design in a short sentence.");
      return;
    }
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
      let intentId = activeIntent?.intentId ?? null;
      if (!intentId) {
        const begun = await beginIntent.mutateAsync({
          modelId,
          sourceAssetId,
          side,
          description: normalized,
          clientRequestId: createClientRequestId(),
        });
        intentId = begun.intentId;
        await refreshTruth(modelId);
      }
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
      setActionError(publicMessage(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    action,
    activeIntent,
    attachReference,
    beginIntent,
    description,
    generateCandidate,
    modelId,
    referenceError,
    referenceFile,
    refreshTruth,
    side,
    sourceAssetId,
  ]);

  const accept = useCallback(async () => {
    if (
      modelId === null
      || action !== null
      || !activeIntent?.candidateId
      || candidateImage.phase !== "loaded"
    ) return;
    setAction("accept");
    setActionError(null);
    try {
      const result = await acceptCandidate.mutateAsync({
        candidateId: activeIntent.candidateId,
        clientRequestId: createClientRequestId(),
      });
      await refreshTruth(modelId);
      await onAccepted(result.modelId);
      setPanelOpen(false);
    } catch (error) {
      setActionError(publicMessage(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [
    acceptCandidate,
    action,
    activeIntent?.candidateId,
    candidateImage.phase,
    modelId,
    onAccepted,
    refreshTruth,
  ]);

  const retry = useCallback(async () => {
    if (modelId === null || action !== null || !activeIntent) return;
    setAction("retry");
    setActionError(null);
    try {
      await retryCandidate.mutateAsync({
        intentId: activeIntent.intentId,
        clientRequestId: createClientRequestId(),
      });
      await refreshTruth(modelId);
    } catch (error) {
      setActionError(publicMessage(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [action, activeIntent, modelId, refreshTruth, retryCandidate]);

  const cancel = useCallback(async () => {
    if (modelId === null || action !== null || !activeIntent) return;
    setAction("cancel");
    setActionError(null);
    try {
      await cancelIntent.mutateAsync({
        intentId: activeIntent.intentId,
        clientRequestId: createClientRequestId(),
      });
      setReferenceFileState(null);
      setPanelOpen(false);
      await refreshTruth(modelId);
    } catch (error) {
      setActionError(publicMessage(error));
      await refreshTruth(modelId);
    } finally {
      setAction(null);
    }
  }, [action, activeIntent, cancelIntent, modelId, refreshTruth]);

  return {
    capability,
    capabilityLoading: capabilityQuery.isLoading,
    activeIntent,
    panelOpen,
    openPanel: () => {
      setActionError(null);
      setPanelOpen(true);
    },
    closePanel: () => {
      if (activeIntent) return;
      setPanelOpen(false);
      setActionError(null);
    },
    description,
    setDescription,
    side,
    setSide,
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
    generate,
    accept,
    retry,
    cancel,
  };
}
