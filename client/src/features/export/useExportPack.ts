/** Export-pack orchestration shared by the model-library export surface. */
import { useCallback, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";
import { triggerDownload } from "@/lib/triggerDownload";
import type { GeneratedAsset } from "@/features/casting/constants";
import {
  compCardViewOrder,
  exportViewFilename,
  filenameWithActualImageExtension,
  isCanonicalViewType,
} from "@shared/exportViews";
import { VIEW_ANGLE_LABELS } from "@shared/boardTypes";
import { isModelMintedStatus } from "@shared/modelLifecycle";
import { withExportEligibility, MISSING_AGENCY_ID_COPY } from "@shared/exportEligibility";
import {
  exportPackResolutionSuffix,
  summarizeExportOutcomes,
  type ExportResolution,
} from "@shared/exportPlan";
import {
  assertExportPlanMatchesAssets,
  claimExportRun,
  dataUrlToBytes,
  exportFailureMessage,
  prepareExportViews,
  preparedPdfImages,
  standingPaidUpscaleCopy,
  type PreparedExportView,
} from "./prepareExportViews";

export type ExportStep = "idle" | "upscaling" | "generating-pdf" | "compressing" | "done";

export interface SavedLook {
  id: number;
  imageUrl: string;
  name: string | null;
  garmentIds: unknown;
  createdAt: Date;
}

interface UseExportPackParams {
  modelId: number | null;
  assets: GeneratedAsset[];
}

function safeStem(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]/g, "_") || "MODEL";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useExportPack({ modelId, assets }: UseExportPackParams) {
  const [step, setStep] = useState<ExportStep>("idle");
  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);

  const modelQuery = trpc.models.get.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId, staleTime: 30_000 },
  );
  const planQuery = trpc.generation.exportPlan.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: !!modelId },
  );
  const looksQuery = trpc.wardrobe.looks.list.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId, staleTime: 10_000 },
  );

  const generatePdfMutation = trpc.generation.generatePdf.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();
  const deleteLookMutation = trpc.wardrobe.looks.delete.useMutation();
  const renameLookMutation = trpc.wardrobe.looks.rename.useMutation();
  const utils = trpc.useUtils();

  const model = modelQuery.data ?? null;
  const isMinted = isModelMintedStatus(model?.status);
  const agencyId = model?.agencyId ?? null;
  const modelName = model?.name ?? "Unnamed Model";

  const notifyExportRefusal = useCallback((reason: "not_minted" | "missing_agency_id") => {
    if (reason === "not_minted") toast(`Name & mint ${modelName} in casting to export the identity pack.`);
    else toast.error(MISSING_AGENCY_ID_COPY);
  }, [modelName]);

  const viewAssets = useMemo(() => assets
    .filter((asset) => isCanonicalViewType(asset.viewType))
    .sort((a, b) => compCardViewOrder(a.viewType) - compCardViewOrder(b.viewType))
    .map((asset) => ({ ...asset, label: isCanonicalViewType(asset.viewType) ? VIEW_ANGLE_LABELS[asset.viewType] : asset.viewType })), [assets]);

  const savedLooks: SavedLook[] = useMemo(() => (looksQuery.data ?? []).map((look) => ({
    id: look.id,
    imageUrl: look.imageUrl,
    name: look.name,
    garmentIds: look.garmentIds,
    createdAt: look.createdAt,
  })), [looksQuery.data]);

  const preferences = useMemo(() => {
    if (!model) return null;
    const tech = (model.technicalSchema as Record<string, any>) || {};
    const pref = (model.preferences as Record<string, any>) || {};
    return {
      gender: tech.subject?.gender ?? pref.gender,
      age: tech.subject?.age ?? pref.age,
      ethnicity: tech.subject?.ethnicity ?? pref.ethnicity,
      bodyType: tech.subject?.body_type ?? pref.bodyType,
      skinTone: tech.subject?.skin_tone ?? tech.skin?.tone ?? pref.skinTone,
      eyeColor: tech.subject?.eye_color ?? pref.eyeColor,
      hairColor: tech.subject?.hair_color ?? pref.hairColor,
      hairStyle: tech.subject?.hair_style ?? tech.hair?.style ?? pref.hairStyle,
      faceShape: tech.face?.shape ?? pref.faceShape,
      castingBrand: tech.context?.casting_for ?? pref.castingBrand,
    };
  }, [model]);

  const downloadImage = useCallback(async (asset: GeneratedAsset) => {
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl: asset.storageUrl });
      if (!proxy.success || !proxy.base64) throw new Error("Image fetch failed");
      const filename = isCanonicalViewType(asset.viewType)
        ? exportViewFilename(asset.viewType, proxy.base64)
        : filenameWithActualImageExtension(safeStem(asset.viewType), proxy.base64);
      triggerDownload(proxy.base64, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download image");
    }
  }, [proxyImageMutation]);

  const downloadLookImage = useCallback(async (look: SavedLook) => {
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl: look.imageUrl });
      if (!proxy.success || !proxy.base64) throw new Error("Look fetch failed");
      triggerDownload(proxy.base64, filenameWithActualImageExtension(safeStem(look.name || `Look_${look.id}`), proxy.base64));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download look");
    }
  }, [proxyImageMutation]);

  const deleteSavedLook = useCallback(async (lookId: number) => {
    if (!modelId) return;
    try {
      await deleteLookMutation.mutateAsync({ lookId });
      await utils.wardrobe.looks.list.invalidate({ modelId });
      toast.success("Look removed");
    } catch {
      toast.error("Failed to delete look");
    }
  }, [deleteLookMutation, modelId, utils.wardrobe.looks.list]);

  const renameSavedLook = useCallback(async (lookId: number, name: string) => {
    if (!modelId) return;
    try {
      await renameLookMutation.mutateAsync({ lookId, name });
      await utils.wardrobe.looks.list.invalidate({ modelId });
    } catch {
      toast.error("Failed to rename look");
    }
  }, [modelId, renameLookMutation, utils.wardrobe.looks.list]);

  const downloadPdf = useCallback(async (resolution: ExportResolution = "1K") => {
    if (!modelId || !claimExportRun(activeRef)) return;
    setStep(resolution === "2K" ? "upscaling" : "generating-pdf");
    setProgress(5);
    let preparedForFailure: PreparedExportView[] = [];
    try {
      if (!planQuery.data) throw new Error("The export price could not be confirmed. Close the dialog and try again.");
      assertExportPlanMatchesAssets(assets, planQuery.data.viewCount);
      const outcome = await withExportEligibility(
        model,
        {
          upscale: upscaleMutation.mutateAsync,
          proxyImage: proxyImageMutation.mutateAsync,
          generatePdf: generatePdfMutation.mutateAsync,
        },
        async (exportId, mutations) => {
          const prepared = await prepareExportViews({
            assets,
            resolution,
            mutations: {
              upscale: (input) => mutations.upscale(input),
              proxyImage: (input) => mutations.proxyImage(input),
            },
            onViewPrepared: (done, total) => setProgress(Math.round((done / Math.max(total, 1)) * 70)),
            onIssue: (issue) => toast.warning("Export view fell back", { description: issue }),
          });
          preparedForFailure = prepared;
          if (!prepared.some((view) => view.dataUrl)) throw new Error("No casting views could be fetched for export.");

          setStep("generating-pdf");
          setProgress(78);
          try {
            const result = await mutations.generatePdf({ modelId, images: preparedPdfImages(prepared) });
            if (!result.success || !result.pdfBase64) throw new Error("PDF generation failed");
            downloadBlob(
              new Blob([dataUrlToBytes(result.pdfBase64)], { type: "application/pdf" }),
              result.filename || `LEGAL_IDENTITY_${exportId}.pdf`,
            );
          } catch (error) {
            // A PDF-only request still delivers the prepared images if final
            // document assembly fails after paid upscales have completed.
            const fallback = new JSZip();
            for (const view of prepared) {
              if (view.dataUrl && view.filename) fallback.file(view.filename, dataUrlToBytes(view.dataUrl));
            }
            const content = await fallback.generateAsync({ type: "blob" });
            downloadBlob(
              content,
              `CASTING_IMAGES_${safeStem(modelName.toUpperCase())}_${exportPackResolutionSuffix(resolution, prepared)}.zip`,
            );
            toast.warning("Images downloaded instead of the identity document", {
              description: [
                exportFailureMessage(error),
                standingPaidUpscaleCopy(resolution, prepared),
              ].filter(Boolean).join(" "),
            });
            return;
          }

          const summary = summarizeExportOutcomes(resolution, prepared);
          if (summary.hasProblems) toast.warning(summary.title, { description: summary.description });
          else toast.success("Identity document downloaded", { description: summary.title });
        },
      );
      if (!outcome.ok) notifyExportRefusal(outcome.reason);
    } catch (error) {
      // Includes exact refund wording/support references from the upscale
      // route and discloses any successful paid work before later failure.
      toast.error("Export could not be delivered", {
        description: [
          exportFailureMessage(error),
          standingPaidUpscaleCopy(resolution, preparedForFailure),
        ].filter(Boolean).join(" "),
      });
    } finally {
      activeRef.current = false;
      setStep("idle");
      setProgress(0);
    }
  }, [assets, generatePdfMutation.mutateAsync, model, modelId, modelName, notifyExportRefusal, planQuery.data, proxyImageMutation.mutateAsync, upscaleMutation.mutateAsync]);

  const downloadZip = useCallback(async (resolution: ExportResolution = "1K") => {
    if (!modelId || assets.length === 0 || !claimExportRun(activeRef)) return;
    setStep(resolution === "2K" ? "upscaling" : "generating-pdf");
    setProgress(5);
    let preparedForFailure: PreparedExportView[] = [];
    try {
      if (!planQuery.data) throw new Error("The export price could not be confirmed. Close the dialog and try again.");
      assertExportPlanMatchesAssets(assets, planQuery.data.viewCount);
      const outcome = await withExportEligibility(
        model,
        {
          upscale: upscaleMutation.mutateAsync,
          proxyImage: proxyImageMutation.mutateAsync,
          generatePdf: generatePdfMutation.mutateAsync,
        },
        async (exportId, mutations) => {
          const prepared = await prepareExportViews({
            assets,
            resolution,
            mutations: {
              upscale: (input) => mutations.upscale(input),
              proxyImage: (input) => mutations.proxyImage(input),
            },
            onViewPrepared: (done, total) => setProgress(Math.round((done / Math.max(total, 1)) * 65)),
            onIssue: (issue) => toast.warning("Export view fell back", { description: issue }),
          });
          preparedForFailure = prepared;
          if (!prepared.some((view) => view.dataUrl)) throw new Error("No casting views could be fetched for export.");

          const zip = new JSZip();
          for (const view of prepared) {
            if (view.dataUrl && view.filename) zip.file(view.filename, dataUrlToBytes(view.dataUrl));
          }

          const lookIssues: string[] = [];
          if (savedLooks.length > 0) {
            const folder = zip.folder("LOOKS");
            for (let i = 0; i < savedLooks.length; i++) {
              const look = savedLooks[i];
              try {
                const proxy = await mutations.proxyImage({ imageUrl: look.imageUrl });
                if (!proxy.success || !proxy.base64) throw new Error("image bytes were unavailable");
                const stem = `${String(i + 1).padStart(2, "0")}_${safeStem(look.name || `Look_${i + 1}`)}`;
                folder?.file(filenameWithActualImageExtension(stem, proxy.base64), dataUrlToBytes(proxy.base64));
              } catch (error) {
                lookIssues.push(`${look.name || `Look ${i + 1}`}: ${error instanceof Error ? error.message : "fetch failed"}`);
              }
            }
          }

          setStep("generating-pdf");
          setProgress(78);
          let pdfFailure: string | undefined;
          try {
            const pdf = await mutations.generatePdf({ modelId, images: preparedPdfImages(prepared) });
            if (!pdf.success || !pdf.pdfBase64) throw new Error("PDF generation failed");
            zip.file(pdf.filename, dataUrlToBytes(pdf.pdfBase64));
          } catch (error) {
            pdfFailure = exportFailureMessage(error);
          }

          setStep("compressing");
          setProgress(90);
          const content = await zip.generateAsync({ type: "blob" });
          downloadBlob(content, `CASTING_PACK_${safeStem(modelName.toUpperCase())}_${exportPackResolutionSuffix(resolution, prepared)}.zip`);

          const summary = summarizeExportOutcomes(resolution, prepared);
          const description = [summary.description, lookIssues.length ? `Saved looks omitted: ${lookIssues.join(" ")}` : undefined]
            .filter(Boolean).join(" ") || undefined;
          if (pdfFailure) {
            toast.warning("Images downloaded without the identity document", {
              description: [pdfFailure, standingPaidUpscaleCopy(resolution, prepared), description].filter(Boolean).join(" "),
            });
          } else if (summary.hasProblems || lookIssues.length > 0) toast.warning(summary.title, { description });
          else toast.success(summary.title);
        },
      );
      if (!outcome.ok) notifyExportRefusal(outcome.reason);
    } catch (error) {
      toast.error("Export could not be delivered", {
        description: [
          exportFailureMessage(error),
          standingPaidUpscaleCopy(resolution, preparedForFailure),
        ].filter(Boolean).join(" "),
      });
    } finally {
      activeRef.current = false;
      setStep("idle");
      setProgress(0);
    }
  }, [assets, generatePdfMutation.mutateAsync, model, modelId, modelName, notifyExportRefusal, planQuery.data, proxyImageMutation.mutateAsync, savedLooks, upscaleMutation.mutateAsync]);

  return {
    model,
    modelName,
    isMinted,
    agencyId,
    viewAssets,
    savedLooks,
    preferences,
    isLoading: modelQuery.isLoading,
    exportPlan: planQuery.isError ? undefined : planQuery.data,
    isExportPlanLoading: planQuery.isLoading || planQuery.isFetching,
    exportPlanError: planQuery.isError ? "The export price could not be confirmed." : null,
    retryExportPlan: () => void planQuery.refetch(),
    step,
    progress,
    isExporting: step !== "idle" || activeRef.current,
    downloadImage,
    downloadLookImage,
    downloadPdf,
    downloadZip,
    deleteSavedLook,
    renameSavedLook,
    refetch: modelQuery.refetch,
  };
}
