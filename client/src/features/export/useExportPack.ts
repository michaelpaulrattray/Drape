/**
 * useExportPack — Orchestrates the Export Pack workflow.
 *
 * Handles:
 *  - Fetching model data (name, agencyId, mint status, assets, preferences)
 *  - Fetching saved wardrobe looks for the model
 *  - Refusing draft export (FR-2A: export never mints — the mint ceremony
 *    is the only mint path; the UI routes the user to it)
 *  - PDF identity document generation + download
 *  - ZIP pack generation (all views + looks + PDF) + download
 *  - Individual image download (views and looks)
 *
 * All heavy lifting (PDF, proxy, upscale) runs through existing tRPC endpoints.
 */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";
import { triggerDownload } from "@/lib/triggerDownload";
import type { GeneratedAsset } from "@/features/casting/constants";
// Audit V3 residue closure (Batch A-safe): this hook held the LAST era-0
// trio map, silently dropping three-quarter/walk/back from the export-verb
// packs. All view mapping now rides the shared canonical-six module.
import {
  EXPORT_VIEW_FILENAMES,
  VIEW_TO_PDF_KEY,
  isCanonicalViewType,
  compCardViewOrder,
} from "@shared/exportViews";
import { VIEW_ANGLE_LABELS } from "@shared/boardTypes";
import { isModelMintedStatus } from "@shared/modelLifecycle";
import { withExportEligibility, MISSING_AGENCY_ID_COPY } from "@shared/exportEligibility";

export type ExportStep =
  | "idle"
  | "upscaling"
  | "generating-pdf"
  | "compressing"
  | "done";

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

export function useExportPack({ modelId, assets }: UseExportPackParams) {
  const [step, setStep] = useState<ExportStep>("idle");
  const [progress, setProgress] = useState(0);

  // Queries
  const modelQuery = trpc.models.get.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId, staleTime: 30_000 },
  );

  const looksQuery = trpc.wardrobe.looks.list.useQuery(
    { modelId: modelId! },
    { enabled: !!modelId, staleTime: 10_000 },
  );

  // Mutations
  const generatePdfMutation = trpc.generation.generatePdf.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();
  const deleteLookMutation = trpc.wardrobe.looks.delete.useMutation();
  const renameLookMutation = trpc.wardrobe.looks.rename.useMutation();
  const utils = trpc.useUtils();

  const model = modelQuery.data ?? null;
  // Batch B: minted is STATUS truth (active | legacy locked) — agencyId is
  // the dossier's print detail, never the read-model discriminator. The
  // server's generatePdf keeps its own fail-closed status+agencyId gate.
  const isMinted = isModelMintedStatus(model?.status);
  const agencyId = model?.agencyId ?? null;
  const modelName = model?.name ?? "Unnamed Model";

  /** Review correction 1 + final round C: every export action runs through
   *  the shared withExportEligibility BOUNDARY — on refusal the action body
   *  (and every mutation) is never entered. This helper only voices the
   *  refusal: an unminted model routes to the mint message; a status-minted
   *  row missing its ID gets the repair copy (never a mint prompt, never a
   *  "DRAFT" placeholder printed into an identity artifact). */
  const notifyExportRefusal = useCallback((reason: "not_minted" | "missing_agency_id") => {
    if (reason === "not_minted") {
      toast(`Name & mint ${modelName} in casting to export the identity pack.`);
    } else {
      toast.error(MISSING_AGENCY_ID_COPY);
    }
  }, [modelName]);

  /** Sorted assets with labels — the canonical six, in comp-card order */
  const viewAssets = useMemo(() => {
    return assets
      .filter((a) => isCanonicalViewType(a.viewType))
      .sort((a, b) => compCardViewOrder(a.viewType) - compCardViewOrder(b.viewType))
      .map((a) => ({
        ...a,
        label: isCanonicalViewType(a.viewType) ? VIEW_ANGLE_LABELS[a.viewType] : a.viewType,
      }));
  }, [assets]);

  /** Saved wardrobe looks */
  const savedLooks: SavedLook[] = useMemo(() => {
    return (looksQuery.data ?? []).map((look) => ({
      id: look.id,
      imageUrl: look.imageUrl,
      name: look.name,
      garmentIds: look.garmentIds,
      createdAt: look.createdAt,
    }));
  }, [looksQuery.data]);

  /** Preferences extracted from technical schema */
  const preferences = useMemo(() => {
    if (!model) return null;
    const ts = (model.technicalSchema as Record<string, any>) || {};
    return {
      gender: ts.subject?.gender,
      age: ts.subject?.age,
      ethnicity: ts.subject?.ethnicity,
      bodyType: ts.subject?.body_type,
      skinTone: ts.subject?.skin_tone || ts.skin?.tone,
      eyeColor: ts.subject?.eye_color,
      hairColor: ts.subject?.hair_color,
      hairStyle: ts.subject?.hair_style || ts.hair?.style,
      faceShape: ts.face?.shape,
      castingBrand: ts.context?.casting_for,
    };
  }, [model]);

  // ── Download single image ──────────────────────────────────
  const downloadImage = useCallback(async (asset: GeneratedAsset) => {
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl: asset.storageUrl });
      if (!proxy.success || !proxy.base64) throw new Error("Proxy failed");
      const filename = isCanonicalViewType(asset.viewType)
        ? EXPORT_VIEW_FILENAMES[asset.viewType]
        : `${asset.viewType}.png`;
      triggerDownload(proxy.base64, filename);
    } catch {
      toast.error("Failed to download image");
    }
  }, [proxyImageMutation]);

  // ── Download single look image ────────────────────────────
  const downloadLookImage = useCallback(async (look: SavedLook) => {
    try {
      const proxy = await proxyImageMutation.mutateAsync({ imageUrl: look.imageUrl });
      if (!proxy.success || !proxy.base64) throw new Error("Proxy failed");
      const safeName = (look.name || `Look_${look.id}`).replace(/[^a-zA-Z0-9]/g, "_");
      triggerDownload(proxy.base64, `${safeName}.png`);
    } catch {
      toast.error("Failed to download look");
    }
  }, [proxyImageMutation]);

  // ── Delete a saved look ───────────────────────────────────
  const deleteSavedLook = useCallback(async (lookId: number) => {
    if (!modelId) return;
    try {
      await deleteLookMutation.mutateAsync({ lookId });
      utils.wardrobe.looks.list.invalidate({ modelId });
      toast.success("Look removed");
    } catch {
      toast.error("Failed to delete look");
    }
  }, [modelId, deleteLookMutation, utils]);

  // ── Rename a saved look ───────────────────────────────────
  const renameSavedLook = useCallback(async (lookId: number, name: string) => {
    if (!modelId) return;
    try {
      await renameLookMutation.mutateAsync({ lookId, name });
      utils.wardrobe.looks.list.invalidate({ modelId });
    } catch {
      toast.error("Failed to rename look");
    }
  }, [modelId, renameLookMutation, utils]);

  // ── Download PDF only ──────────────────────────────────────
  const downloadPdf = useCallback(async () => {
    if (!modelId) return;
    // FR-2(A) + review correction 1 + final round C: the whole action runs
    // inside the shared eligibility BOUNDARY — on refusal (unminted, or a
    // status-minted row missing its agencyId) the body below, and therefore
    // every proxy/PDF mutation, is never entered.
    const outcome = await withExportEligibility(
      model,
      { proxyImage: proxyImageMutation.mutateAsync, generatePdf: generatePdfMutation.mutateAsync },
      async (exportId, m) => {
        setStep("generating-pdf");
        setProgress(10);
        try {
          const pdfImages: Record<string, string> = {};
          for (const asset of assets) {
            if (!isCanonicalViewType(asset.viewType)) continue;
            const key = VIEW_TO_PDF_KEY[asset.viewType];
            try {
              const proxy = await m.proxyImage({ imageUrl: asset.storageUrl });
              if (proxy.success && proxy.base64) pdfImages[key] = proxy.base64;
            } catch { /* skip */ }
          }
          setProgress(50);

          const result = await m.generatePdf({
            modelId,
            modelName: modelName.toUpperCase(),
            images: pdfImages,
          });

          if (!result.success || !result.pdfBase64) throw new Error("PDF generation failed");

          setProgress(90);
          const binary = atob(result.pdfBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename || `IDENTITY_${exportId}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setProgress(100);
          toast.success("Identity document downloaded");
        } catch (e: any) {
          toast.error(e.message || "PDF download failed");
        } finally {
          setStep("idle");
          setProgress(0);
        }
      },
    );
    if (!outcome.ok) notifyExportRefusal(outcome.reason);
  }, [modelId, model, assets, modelName, notifyExportRefusal]);

  // ── Download full ZIP pack ─────────────────────────────────
  const downloadZip = useCallback(async () => {
    if (!modelId || assets.length === 0) return;
    // FR-2(A) + review correction 1 + final round C: the whole action runs
    // inside the shared eligibility BOUNDARY — on refusal the paid upscale
    // loop and every proxy/PDF mutation are never entered. A verified
    // agencyId is the only thing ever printed into the pack (no "DRAFT").
    const outcome = await withExportEligibility(
      model,
      {
        upscale: upscaleMutation.mutateAsync,
        proxyImage: proxyImageMutation.mutateAsync,
        generatePdf: generatePdfMutation.mutateAsync,
      },
      async (exportId, m) => {
        const safeName = modelName.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, "_");
        const cleanId = exportId.replace(/[^a-zA-Z0-9]/g, "_");

        try {
          setStep("upscaling");
          setProgress(5);
          const zip = new JSZip();
          const totalItems = assets.length + savedLooks.length + 1; // views + looks + PDF
          let done = 0;

          // Add casting views (upscaled to 2K)
          for (const asset of assets) {
            const filename = isCanonicalViewType(asset.viewType)
              ? EXPORT_VIEW_FILENAMES[asset.viewType]
              : `${asset.viewType}.png`;
            let imageUrl = asset.storageUrl;

            try {
              const upResult = await m.upscale({
                imageUrl: asset.storageUrl,
                resolution: "2K",
              });
              if (upResult.success && upResult.imageUrl) imageUrl = upResult.imageUrl;
            } catch { /* use original */ }

            try {
              const proxy = await m.proxyImage({ imageUrl });
              if (proxy.success && proxy.base64) {
                const b64 = proxy.base64.split(",")[1];
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                zip.file(filename, bytes);
              }
            } catch { /* skip */ }

            done++;
            setProgress(Math.round((done / totalItems) * 75));
          }

          // Add saved wardrobe looks (original resolution, in LOOKS/ subfolder)
          if (savedLooks.length > 0) {
            const looksFolder = zip.folder("LOOKS");
            for (let i = 0; i < savedLooks.length; i++) {
              const look = savedLooks[i];
              const lookName = (look.name || `Look_${i + 1}`).replace(/[^a-zA-Z0-9]/g, "_");
              const lookFilename = `${String(i + 1).padStart(2, "0")}_${lookName}.png`;

              try {
                const proxy = await m.proxyImage({ imageUrl: look.imageUrl });
                if (proxy.success && proxy.base64) {
                  const b64 = proxy.base64.split(",")[1];
                  const bin = atob(b64);
                  const bytes = new Uint8Array(bin.length);
                  for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
                  looksFolder!.file(lookFilename, bytes);
                }
              } catch { /* skip */ }

              done++;
              setProgress(Math.round((done / totalItems) * 75));
            }
          }

          // Generate PDF
          setStep("generating-pdf");
          const pdfImages: Record<string, string> = {};
          for (const asset of assets) {
            if (!isCanonicalViewType(asset.viewType)) continue;
            const key = VIEW_TO_PDF_KEY[asset.viewType];
            try {
              const proxy = await m.proxyImage({ imageUrl: asset.storageUrl });
              if (proxy.success && proxy.base64) pdfImages[key] = proxy.base64;
            } catch { /* skip */ }
          }

          const pdfResult = await m.generatePdf({
            modelId,
            modelName: safeName,
            images: pdfImages,
          });

          if (pdfResult.success && pdfResult.pdfBase64) {
            const bin = atob(pdfResult.pdfBase64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            zip.file(`LEGAL_IDENTITY_${cleanId}.pdf`, bytes);
          }
          setProgress(90);

          // Compress and download
          setStep("compressing");
          const content = await zip.generateAsync({ type: "blob" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(content);
          link.download = `CASTING_PACK_${safeName}_2K.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          setProgress(100);
          toast.success("Export pack downloaded");
        } catch (e: any) {
          toast.error(e.message || "Export failed");
        } finally {
          setStep("idle");
          setProgress(0);
        }
      },
    );
    if (!outcome.ok) notifyExportRefusal(outcome.reason);
  }, [modelId, model, assets, savedLooks, modelName, notifyExportRefusal]);

  return {
    // Data
    model,
    modelName,
    isMinted,
    agencyId,
    viewAssets,
    savedLooks,
    preferences,
    isLoading: modelQuery.isLoading,
    // Export state
    step,
    progress,
    isExporting: step !== "idle",
    // Actions
    downloadImage,
    downloadLookImage,
    downloadPdf,
    downloadZip,
    deleteSavedLook,
    renameSavedLook,
    refetch: modelQuery.refetch,
  };
}
