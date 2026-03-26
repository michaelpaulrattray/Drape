/**
 * useExportPack — Orchestrates the Export Pack workflow.
 *
 * Handles:
 *  - Fetching model data (name, agencyId, mint status, assets, preferences)
 *  - Minting (if not yet minted)
 *  - PDF identity document generation + download
 *  - ZIP pack generation (all views + PDF) + download
 *  - Individual image download
 *
 * All heavy lifting (PDF, proxy, upscale) runs through existing tRPC endpoints.
 */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";
import type { GeneratedAsset } from "@/features/casting/constants";

/** Human-readable labels for each view type */
const VIEW_LABELS: Record<string, string> = {
  frontClose: "Headshot",
  frontFull: "Full Body",
  sideClose: "Profile",
  sideFull: "Walk",
  backFull: "Rear",
};

/** Filenames inside the ZIP for each view type */
const VIEW_FILENAMES: Record<string, string> = {
  frontClose: "01_Headshot_Primary.png",
  frontFull: "02_Full_Body_Standing.png",
  sideClose: "03_Profile_Head.png",
  sideFull: "04_Full_Body_Walk.png",
  backFull: "05_Full_Body_Rear.png",
};

/** PDF key mapping */
const VIEW_TO_PDF_KEY: Record<string, string> = {
  frontClose: "headshot",
  frontFull: "fullBody",
  sideClose: "profile",
  sideFull: "walk",
  backFull: "back",
};

export type ExportStep =
  | "idle"
  | "minting"
  | "upscaling"
  | "generating-pdf"
  | "compressing"
  | "done";

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

  // Mutations
  const mintMutation = trpc.generation.mint.useMutation();
  const generatePdfMutation = trpc.generation.generatePdf.useMutation();
  const upscaleMutation = trpc.generation.upscale.useMutation();
  const proxyImageMutation = trpc.generation.proxyImage.useMutation();

  const model = modelQuery.data ?? null;
  const isMinted = !!model?.agencyId;
  const agencyId = model?.agencyId ?? null;
  const modelName = model?.name ?? "Unnamed Model";

  /** Sorted assets with labels */
  const viewAssets = useMemo(() => {
    const order = ["frontClose", "frontFull", "sideClose", "sideFull", "backFull"];
    return assets
      .filter((a) => VIEW_LABELS[a.viewType])
      .sort((a, b) => order.indexOf(a.viewType) - order.indexOf(b.viewType))
      .map((a) => ({
        ...a,
        label: VIEW_LABELS[a.viewType] || a.viewType,
      }));
  }, [assets]);

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
      const res = await fetch(asset.storageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = VIEW_FILENAMES[asset.viewType] || `${asset.viewType}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download image");
    }
  }, []);

  // ── Mint model ─────────────────────────────────────────────
  const mintModel = useCallback(async () => {
    if (!modelId) return;
    setStep("minting");
    try {
      await mintMutation.mutateAsync({ modelId });
      await modelQuery.refetch();
      toast.success("Model identity minted");
    } catch (e: any) {
      toast.error(e.message || "Minting failed");
    } finally {
      setStep("idle");
    }
  }, [modelId]);

  // ── Download PDF only ──────────────────────────────────────
  const downloadPdf = useCallback(async () => {
    if (!modelId) return;
    setStep("generating-pdf");
    setProgress(10);
    try {
      // Proxy images for PDF
      const pdfImages: Record<string, string> = {};
      for (const asset of assets) {
        const key = VIEW_TO_PDF_KEY[asset.viewType];
        if (!key) continue;
        try {
          const proxy = await proxyImageMutation.mutateAsync({ imageUrl: asset.storageUrl });
          if (proxy.success && proxy.base64) pdfImages[key] = proxy.base64;
        } catch { /* skip */ }
      }
      setProgress(50);

      const result = await generatePdfMutation.mutateAsync({
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
      a.download = result.filename || `IDENTITY_${agencyId || "DRAFT"}.pdf`;
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
  }, [modelId, assets, modelName, agencyId]);

  // ── Download full ZIP pack ─────────────────────────────────
  const downloadZip = useCallback(async () => {
    if (!modelId || assets.length === 0) return;

    const safeName = modelName.trim().toUpperCase().replace(/[^a-zA-Z0-9]/g, "_");
    const cleanId = (agencyId || "DRAFT").replace(/[^a-zA-Z0-9]/g, "_");

    try {
      setStep("upscaling");
      setProgress(5);
      const zip = new JSZip();
      const total = assets.length + 1; // +1 for PDF
      let done = 0;

      // Add images (upscaled to 2K)
      for (const asset of assets) {
        const filename = VIEW_FILENAMES[asset.viewType] || `${asset.viewType}.png`;
        let imageUrl = asset.storageUrl;

        try {
          const upResult = await upscaleMutation.mutateAsync({
            imageUrl: asset.storageUrl,
            resolution: "2K",
          });
          if (upResult.success && upResult.imageUrl) imageUrl = upResult.imageUrl;
        } catch { /* use original */ }

        try {
          const proxy = await proxyImageMutation.mutateAsync({ imageUrl });
          if (proxy.success && proxy.base64) {
            const b64 = proxy.base64.split(",")[1];
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            zip.file(filename, bytes);
          }
        } catch { /* skip */ }

        done++;
        setProgress(Math.round((done / total) * 80));
      }

      // Generate PDF
      setStep("generating-pdf");
      const pdfImages: Record<string, string> = {};
      for (const asset of assets) {
        const key = VIEW_TO_PDF_KEY[asset.viewType];
        if (!key) continue;
        try {
          const proxy = await proxyImageMutation.mutateAsync({ imageUrl: asset.storageUrl });
          if (proxy.success && proxy.base64) pdfImages[key] = proxy.base64;
        } catch { /* skip */ }
      }

      const pdfResult = await generatePdfMutation.mutateAsync({
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
  }, [modelId, assets, modelName, agencyId]);

  return {
    // Data
    model,
    modelName,
    isMinted,
    agencyId,
    viewAssets,
    preferences,
    isLoading: modelQuery.isLoading,
    // Export state
    step,
    progress,
    isExporting: step !== "idle",
    // Actions
    mintModel,
    downloadImage,
    downloadPdf,
    downloadZip,
    refetch: modelQuery.refetch,
  };
}
