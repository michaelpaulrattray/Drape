import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";
import type { GeneratedAsset } from "@/features/casting/constants";
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
} from "@/features/export/prepareExportViews";

interface UseCastingExportParams {
  currentModelId: number | null;
  currentAssets: GeneratedAsset[];
  isOpen: boolean;
  setShowExportModal: (show: boolean) => void;
}

export function useCastingExport({
  currentModelId,
  currentAssets,
  isOpen,
  setShowExportModal,
}: UseCastingExportParams) {
  const utils = trpc.useUtils();
  const generatePdfMutation = trpc.generation.generatePdf.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();
  const planQuery = trpc.generation.exportPlan.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId !== null && isOpen, staleTime: 0 },
  );
  const activeRef = useRef(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async (exportRes: ExportResolution) => {
    // State updates render asynchronously; this ref closes the same-tick
    // double-click window before a second paid submission can start.
    if (!claimExportRun(activeRef)) return;
    setIsExporting(true);
    let preparedForFailure: PreparedExportView[] = [];

    try {
      if (currentAssets.length === 0) throw new Error("No assets to export");
      if (!currentModelId) throw new Error("No model to export");
      if (planQuery.isFetching || !planQuery.data) {
        throw new Error("The export price could not be confirmed. Close the dialog and try again.");
      }
      assertExportPlanMatchesAssets(currentAssets, planQuery.data.viewCount);

      // Export never mints. The shared boundary rejects a draft or broken
      // agency-ID row before any upscale/proxy/PDF mutation is called.
      const model = await utils.models.get.fetch({ modelId: currentModelId });
      const outcome = await withExportEligibility(
        model,
        {
          upscale: upscaleMutation.mutateAsync,
          proxyImage: proxyImageMutation.mutateAsync,
          generatePdf: generatePdfMutation.mutateAsync,
        },
        async (exportId, mutations) => {
          const prepared = await prepareExportViews({
            assets: currentAssets,
            resolution: exportRes,
            mutations: {
              upscale: (input) => mutations.upscale(input),
              proxyImage: (input) => mutations.proxyImage(input),
            },
            onIssue: (issue) => toast.warning("Export view fell back", { description: issue }),
          });
          preparedForFailure = prepared;

          if (!prepared.some((view) => view.dataUrl)) {
            throw new Error("No casting views could be fetched for export.");
          }

          const zip = new JSZip();
          for (const view of prepared) {
            if (view.dataUrl && view.filename) zip.file(view.filename, dataUrlToBytes(view.dataUrl));
          }

          let pdfFailure: string | undefined;
          try {
            const pdfResult = await mutations.generatePdf({
              modelId: currentModelId,
              images: preparedPdfImages(prepared),
            });
            if (!pdfResult.success || !pdfResult.pdfBase64) throw new Error("PDF generation failed");
            zip.file(pdfResult.filename, dataUrlToBytes(pdfResult.pdfBase64));
          } catch (error) {
            // Already-prepared images remain deliverable even if the identity
            // document fails. Any successful paid work is disclosed below.
            pdfFailure = exportFailureMessage(error);
          }

          const content = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(content);
          const link = document.createElement("a");
          const safeName = (model?.name?.trim() || exportId).toUpperCase().replace(/[^a-zA-Z0-9]/g, "_");
          const suffix = exportPackResolutionSuffix(exportRes, prepared);
          link.href = url;
          link.download = `CASTING_PACK_${safeName}_${suffix}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          const summary = summarizeExportOutcomes(exportRes, prepared);
          if (pdfFailure) {
            const standing = standingPaidUpscaleCopy(exportRes, prepared);
            toast.warning("Images downloaded without the identity document", {
              description: [pdfFailure, standing, summary.description].filter(Boolean).join(" "),
            });
          } else if (summary.hasProblems) {
            toast.warning(summary.title, { description: summary.description });
          } else {
            toast.success(summary.title, { description: summary.description });
          }
          setShowExportModal(false);
        },
      );

      if (!outcome.ok) {
        setShowExportModal(false);
        if (outcome.reason === "not_minted") {
          toast("Name & mint this model to export the identity pack — opening the mint step.");
          window.dispatchEvent(new CustomEvent("casting-open-mint"));
        } else {
          toast.error(MISSING_AGENCY_ID_COPY);
        }
      }
    } catch (error) {
      const message = exportFailureMessage(error);
      const standing = standingPaidUpscaleCopy(exportRes, preparedForFailure);
      console.error("Export failed:", error);
      // Upscale failures retain the server's exact refund wording. If later
      // assembly fails, disclose successful paid work whose charge remains.
      toast.error("Export could not be delivered", {
        description: [message, standing].filter(Boolean).join(" "),
      });
    } finally {
      activeRef.current = false;
      setIsExporting(false);
    }
  }, [
    currentAssets,
    currentModelId,
    generatePdfMutation.mutateAsync,
    planQuery.data,
    planQuery.isFetching,
    proxyImageMutation.mutateAsync,
    setShowExportModal,
    upscaleMutation.mutateAsync,
    utils.models.get,
  ]);

  return {
    handleExport,
    exportPlan: planQuery.isFetching || planQuery.isError ? undefined : planQuery.data,
    isExportPlanLoading: planQuery.isLoading || planQuery.isFetching,
    exportPlanError: planQuery.isError ? "The export price could not be confirmed." : null,
    retryExportPlan: () => void planQuery.refetch(),
    isExporting,
  };
}
