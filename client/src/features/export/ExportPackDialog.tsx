/** Export identity-pack dialog available from model-library surfaces. */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Download, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { GeneratedAsset } from "@/features/casting/constants";
import type { ExportResolution } from "@shared/exportPlan";
import { useExportPack, type ExportStep } from "./useExportPack";

const STEP_COPY: Record<ExportStep, string | null> = {
  idle: null,
  upscaling: "Preparing 2K views…",
  "generating-pdf": "Building the identity document…",
  compressing: "Compressing the pack…",
  done: null,
};

export interface ExportPackDialogProps {
  modelId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportPackDialog({ modelId, isOpen, onClose }: ExportPackDialogProps) {
  const [resolution, setResolution] = useState<ExportResolution>("1K");
  useEffect(() => {
    if (isOpen) setResolution("1K");
  }, [isOpen]);

  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: isOpen && !!modelId },
  );
  const assets: GeneratedAsset[] = useMemo(
    () => (packageQuery.data?.slots ?? [])
      .filter((slot) => slot.filled && slot.url)
      .map((slot, index) => ({ id: index, viewType: slot.angle, storageUrl: slot.url! })),
    [packageQuery.data],
  );

  const pack = useExportPack({ modelId: isOpen ? modelId : null, assets });
  const busy = pack.isExporting;
  const stepCopy = STEP_COPY[pack.step];
  const paidTier = pack.exportPlan?.tiers["2K"];
  const canExport = !pack.isExportPlanLoading && !!pack.exportPlan && assets.length > 0 && !busy;

  if (!isOpen || !modelId) return null;
  const headshot = assets.find((asset) => asset.viewType === "frontClose");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(10,10,10,0.3)" }} onClick={busy ? undefined : onClose} />
      <div className="relative w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong" style={{ maxWidth: 400 }}>
        {headshot && (
          <div className="relative border-b-hairline border-canvas-border" style={{ height: 140 }}>
            <img src={headshot.storageUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 20%" }} />
          </div>
        )}
        <div className="p-5">
          <div className="text-canvas-ink font-medium mb-1" style={{ fontSize: 16 }}>Export identity pack</div>
          <div className="text-canvas-md text-canvas-ink-soft mb-4" style={{ lineHeight: 1.5 }}>
            {packageQuery.isLoading
              ? "Loading the package…"
              : `${pack.modelName} — ${assets.length} view${assets.length === 1 ? "" : "s"} with the identity document.`}
          </div>

          {pack.exportPlanError && (
            <div className="mb-3 rounded-canvas-md bg-canvas-surface-inset px-3 py-2 text-canvas-sm text-canvas-ink-soft">
              {pack.exportPlanError}{" "}
              <button type="button" onClick={pack.retryExportPlan} className="font-medium text-canvas-ink underline underline-offset-2">
                Retry
              </button>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setResolution("1K")}
              className={`w-full text-left rounded-canvas-md border-hairline p-3 ${resolution === "1K" ? "border-canvas-ink bg-canvas-surface-inset" : "border-canvas-border-strong"}`}
            >
              <div className="flex justify-between text-canvas-lg font-medium text-canvas-ink"><span>Original resolution</span><span>Free</span></div>
              <div className="text-canvas-sm text-canvas-ink-faint mt-1">No paid upscale.</div>
            </button>
            <button
              type="button"
              disabled={busy || !paidTier}
              onClick={() => setResolution("2K")}
              className={`w-full text-left rounded-canvas-md border-hairline p-3 ${resolution === "2K" ? "border-canvas-ink bg-canvas-surface-inset" : "border-canvas-border-strong"}`}
            >
              <div className="flex justify-between text-canvas-lg font-medium text-canvas-ink">
                <span>2K upscale</span><span>{paidTier ? `${paidTier.totalCost.toLocaleString()} credits` : "—"}</span>
              </div>
              <div className="text-canvas-sm text-canvas-ink-faint mt-1">
                {paidTier ? `${pack.exportPlan?.viewCount ?? 0} views × ${paidTier.unitCost} credits.` : "Confirming price…"}
              </div>
            </button>
          </div>

          <div className="text-canvas-sm text-canvas-ink-faint mb-4" style={{ lineHeight: 1.45 }}>
            {resolution === "2K"
              ? `${(paidTier?.totalCost ?? 0).toLocaleString()} credits will be charged for this export operation. Exporting again is a new paid operation.`
              : "This export operation costs 0 credits."}
          </div>

          {stepCopy && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-md text-canvas-ink-soft">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{stepCopy}</span>
              <span className="ml-auto text-canvas-ink-faint" style={{ fontVariantNumeric: "tabular-nums" }}>{pack.progress}%</span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose} disabled={busy} className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40">
              Close
            </button>
            <button
              onClick={() => void pack.downloadPdf(resolution)}
              disabled={!canExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-canvas-md text-canvas-lg font-medium text-canvas-ink-soft border-hairline border-canvas-border-strong hover:text-canvas-ink hover:border-canvas-ink transition-colors disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.6} /> PDF only
            </button>
            <button
              onClick={() => void pack.downloadZip(resolution)}
              disabled={!canExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-lg font-medium transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.6} />
              {busy ? "Exporting…" : resolution === "2K" ? "Download pack" : "Download free"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
