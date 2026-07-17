import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ExportResolution } from "@shared/exportPlan";

interface ExportPlanView {
  viewCount: number;
  tiers: {
    "1K": { totalCost: number; unitCost: number };
    "2K": { totalCost: number; unitCost: number };
  };
}

export const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  previewImage,
  viewCount,
  assetId,
  exportPlan,
  isPlanLoading = false,
  planError,
  onRetryPlan,
  isExporting = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (resolution: ExportResolution) => void | Promise<void>;
  previewImage?: string;
  viewCount?: number;
  assetId?: string;
  exportPlan?: ExportPlanView;
  isPlanLoading?: boolean;
  planError?: string | null;
  onRetryPlan?: () => void;
  isExporting?: boolean;
}) => {
  const [resolution, setResolution] = useState<ExportResolution>("1K");

  // Every newly opened export starts on the free path. A prior 2K choice is
  // never sticky across operations.
  useEffect(() => {
    if (isOpen) setResolution("1K");
  }, [isOpen]);

  if (!isOpen) return null;

  const shownCount = exportPlan?.viewCount ?? viewCount ?? 0;
  const paidTier = exportPlan?.tiers["2K"];
  const selectedCost = resolution === "2K" ? paidTier?.totalCost : 0;
  const canExport = !isPlanLoading && !!exportPlan && shownCount > 0 && !isExporting;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
    >
      <div className="w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong" style={{ maxWidth: 400 }}>
        {previewImage && (
          <div className="relative border-b-hairline border-canvas-border" style={{ height: 160 }}>
            <img src={previewImage} alt="" className="w-full h-full object-cover" />
            {assetId && (
              <div className="absolute bottom-3 left-4 px-2 py-0.5 rounded-canvas-sm bg-canvas-surface/90 text-canvas-lg font-medium text-canvas-ink">
                {assetId}
              </div>
            )}
            <div className="absolute bottom-3 right-4 px-2 py-0.5 rounded-canvas-sm bg-canvas-surface/90 text-canvas-sm text-canvas-ink-soft">
              {shownCount} view{shownCount === 1 ? "" : "s"}
            </div>
          </div>
        )}

        <div className="p-5">
          <div className="text-canvas-ink font-medium mb-1" style={{ fontSize: 16 }}>
            Export identity pack
          </div>
          <div className="text-canvas-ink-soft mb-4" style={{ fontSize: 13, lineHeight: 1.5 }}>
            The identity document uses the model’s saved name. Choose the image resolution for this export.
          </div>

          {planError && (
            <div className="mb-3 rounded-canvas-md bg-canvas-surface-inset px-3 py-2 text-canvas-sm text-canvas-ink-soft">
              {planError}{" "}
              <button type="button" onClick={onRetryPlan} className="font-medium text-canvas-ink underline underline-offset-2">
                Retry
              </button>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setResolution("1K")}
              className={`w-full text-left rounded-canvas-md border-hairline p-3 transition-colors ${resolution === "1K" ? "border-canvas-ink bg-canvas-surface-inset" : "border-canvas-border-strong"}`}
            >
              <div className="flex justify-between gap-3 text-canvas-lg font-medium text-canvas-ink">
                <span>Original resolution</span><span>Free</span>
              </div>
              <div className="text-canvas-sm text-canvas-ink-faint mt-1">Exports the current images with no paid upscale.</div>
            </button>
            <button
              type="button"
              disabled={isExporting || !paidTier}
              onClick={() => setResolution("2K")}
              className={`w-full text-left rounded-canvas-md border-hairline p-3 transition-colors ${resolution === "2K" ? "border-canvas-ink bg-canvas-surface-inset" : "border-canvas-border-strong"}`}
            >
              <div className="flex justify-between gap-3 text-canvas-lg font-medium text-canvas-ink">
                <span>2K upscale</span>
                <span>{paidTier ? `${paidTier.totalCost.toLocaleString()} credits` : "—"}</span>
              </div>
              <div className="text-canvas-sm text-canvas-ink-faint mt-1">
                {paidTier ? `${shownCount} views × ${paidTier.unitCost} credits.` : "Confirming price…"}
              </div>
            </button>
          </div>

          <div className="text-canvas-sm text-canvas-ink-faint mb-4" style={{ lineHeight: 1.45 }}>
            {resolution === "2K"
              ? `${(selectedCost ?? 0).toLocaleString()} credits will be charged for this export operation. Exporting again will be a new paid operation.`
              : "This export operation costs 0 credits."}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => void onExport(resolution)}
              disabled={!canExport}
              className="flex items-center gap-1.5 px-5 py-2 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-lg font-medium transition-colors disabled:opacity-40"
            >
              {isExporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isExporting ? "Exporting…" : resolution === "2K" ? `Export · ${(selectedCost ?? 0).toLocaleString()} credits` : "Export free"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
