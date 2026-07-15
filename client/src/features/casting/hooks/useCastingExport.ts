import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";
import type { GeneratedAsset, GenerationState, ImageResolution } from "@/features/casting/constants";
// One canonical-six export mapping, shared with useExportPack — copies of
// this map are how V3's dropped views happened (audit V3 / trio-map residue)
import {
  EXPORT_VIEW_FILENAMES,
  VIEW_TO_PDF_KEY,
  isCanonicalViewType,
  type PdfImageKey,
} from "@shared/exportViews";
import { withExportEligibility, MISSING_AGENCY_ID_COPY } from "@shared/exportEligibility";

interface UseCastingExportParams {
  currentModelId: number | null;
  currentAssets: GeneratedAsset[];
  genState: GenerationState;
  setGenState: (updater: GenerationState | ((prev: GenerationState) => GenerationState)) => void;
  setShowExportModal: (show: boolean) => void;
}

export function useCastingExport({
  currentModelId,
  currentAssets,
  genState,
  setGenState,
  setShowExportModal,
}: UseCastingExportParams) {
  const utils = trpc.useUtils();
  const generatePdfMutation = trpc.generation.generatePdf.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();

  const handleExport = useCallback(async (characterName: string, exportRes: ImageResolution) => {
    if (currentAssets.length === 0) {
      toast.error('No assets to export');
      return;
    }

    if (!currentModelId) {
      toast.error('No model to export');
      return;
    }

    setShowExportModal(false);
    setGenState({ isGenerating: true, currentStep: `Preparing Export...`, error: null, progress: 0, startTime: Date.now(), estimatedDuration: 5000 });

    try {
      // FR-2(A), Batch 0 / Batch B (review correction 1 + final round C):
      // export NEVER mints, and the whole action runs inside the shared
      // eligibility BOUNDARY — on refusal, no upscale/proxy/PDF mutation is
      // ever invoked. Unminted (status truth — legacy 'locked' counts as
      // minted) refuses and routes to the mint door; a status-minted row
      // missing its agencyId is an inconsistent record — fail closed with
      // repair copy, never a mint prompt, never a fake ID.
      const model = await utils.models.get.fetch({ modelId: currentModelId });
      const outcome = await withExportEligibility(
        model,
        {
          upscale: upscaleMutation.mutateAsync,
          proxyImage: proxyImageMutation.mutateAsync,
          generatePdf: generatePdfMutation.mutateAsync,
        },
        async (exportId, m) => {
          setGenState({ isGenerating: true, currentStep: `Processing Export Pack (${exportRes})...`, error: null, progress: 30, startTime: genState.startTime, estimatedDuration: 20000 });

          const safeName = characterName ? characterName.trim().toUpperCase() : `MODEL ID ${exportId}`;
          const cleanId = exportId.replace(/[^a-zA-Z0-9]/g, '_');
          const zipFilename = `CASTING_PACK_${safeName.replace(/[^a-zA-Z0-9]/g, '_')}_2K.zip`;
          const pdfFilename = `LEGAL_IDENTITY_${cleanId}.pdf`;

          const zip = new JSZip();

          for (const asset of currentAssets) {
            const filename = isCanonicalViewType(asset.viewType)
              ? EXPORT_VIEW_FILENAMES[asset.viewType]
              : `${asset.viewType}.png`;

            try {
              let imageUrl = asset.storageUrl;

              // Always upscale to 2K for export unless source is already at target
              // All generated images are stored at default resolution, so upscale is needed
              if (exportRes !== '1K') {
                setGenState(prev => ({ ...prev, currentStep: `Upscaling ${asset.viewType} to ${exportRes}...` }));
                try {
                  const upscaleResult = await m.upscale({
                    imageUrl: asset.storageUrl,
                    resolution: exportRes,
                  });
                  if (upscaleResult.success && upscaleResult.imageUrl) {
                    imageUrl = upscaleResult.imageUrl;
                  }
                } catch (upscaleErr) {
                  // If upscale fails, continue with original image rather than failing the entire export
                  console.warn(`Upscale failed for ${asset.viewType}, using original:`, upscaleErr);
                }
              } else {
                setGenState(prev => ({ ...prev, currentStep: `Adding ${asset.viewType}...` }));
              }

              const proxyResult = await m.proxyImage({ imageUrl });
              if (proxyResult.success && proxyResult.base64) {
                const base64Data = proxyResult.base64.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                zip.file(filename, bytes);
              }
            } catch (e) {
              console.error(`Failed to process ${asset.viewType}:`, e);
              try {
                const fallbackResult = await m.proxyImage({ imageUrl: asset.storageUrl });
                if (fallbackResult.success && fallbackResult.base64) {
                  const base64Data = fallbackResult.base64.split(',')[1];
                  const binaryString = atob(base64Data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  zip.file(filename, bytes);
                }
              } catch (fallbackError) {
                console.error(`Failed to fetch fallback ${asset.viewType}:`, fallbackError);
              }
            }
          }

          // Generate Premium PDF Identity Document via server
          setGenState(prev => ({ ...prev, currentStep: 'Generating Premium Identity Document...' }));

          const pdfImages: Partial<Record<PdfImageKey, string>> = {};

          for (const asset of currentAssets) {
            if (!isCanonicalViewType(asset.viewType)) continue;
            const pdfKey = VIEW_TO_PDF_KEY[asset.viewType];
            try {
              const proxyResult = await m.proxyImage({ imageUrl: asset.storageUrl });
              if (proxyResult.success && proxyResult.base64) {
                pdfImages[pdfKey] = proxyResult.base64;
              }
            } catch (e) {
              console.error(`Failed to proxy image for ${asset.viewType}:`, e);
            }
          }

          const pdfResult = await m.generatePdf({
            modelId: currentModelId,
            modelName: safeName,
            images: pdfImages,
          });

          if (!pdfResult.success || !pdfResult.pdfBase64) {
            throw new Error('Failed to generate PDF');
          }

          const pdfBinaryString = atob(pdfResult.pdfBase64);
          const pdfBytes = new Uint8Array(pdfBinaryString.length);
          for (let i = 0; i < pdfBinaryString.length; i++) {
            pdfBytes[i] = pdfBinaryString.charCodeAt(i);
          }
          zip.file(pdfFilename, pdfBytes);

          setGenState(prev => ({ ...prev, currentStep: 'Compressing Pack...' }));
          const content = await zip.generateAsync({ type: 'blob' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = zipFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setGenState({ isGenerating: false, currentStep: '', error: null });
          toast.success(`Export complete! ID: ${exportId}`);
        },
      );

      if (!outcome.ok) {
        setGenState({ isGenerating: false, currentStep: '', error: null });
        if (outcome.reason === 'not_minted') {
          toast('Name & mint this model to export the identity pack — opening the mint step.');
          window.dispatchEvent(new CustomEvent('casting-open-mint'));
        } else {
          toast.error(MISSING_AGENCY_ID_COPY);
        }
        return;
      }

    } catch (e: any) {
      console.error('Export failed:', e);
      setGenState({ isGenerating: false, currentStep: '', error: e.message || 'Export Failed' });
      toast.error('Export failed: ' + (e.message || 'Unknown error'));
    }
  }, [currentModelId, currentAssets, genState.startTime]);

  return { handleExport };
}
