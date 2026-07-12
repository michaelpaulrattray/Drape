/**
 * ExportPackDialog — the "Export identity pack" VERB, meetable anywhere a
 * model card is (R6 close-out (b): export is a verb on the model, never a
 * destination). Loads the model's package and runs the canonical pack
 * builder (useExportPack: 2K upscale → PDF → ZIP).
 */
import { useMemo } from "react";
import { Loader2, Download, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { GeneratedAsset } from "@/features/casting/constants";
import { useExportPack, type ExportStep } from "./useExportPack";

const STEP_COPY: Record<ExportStep, string | null> = {
  idle: null,
  minting: "Minting…",
  upscaling: "Upscaling views to 2K…",
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
  const packageQuery = trpc.generation.packageState.useQuery(
    { modelId: modelId ?? 0 },
    { enabled: isOpen && !!modelId },
  );

  const assets: GeneratedAsset[] = useMemo(
    () =>
      (packageQuery.data?.slots ?? [])
        .filter((s) => s.filled && s.url)
        .map((s, i) => ({ id: i, viewType: s.angle, storageUrl: s.url! })),
    [packageQuery.data],
  );

  const pack = useExportPack({ modelId: isOpen ? modelId : null, assets });
  const busy = pack.step !== "idle" && pack.step !== "done";
  const stepCopy = STEP_COPY[pack.step];

  if (!isOpen || !modelId) return null;

  const headshot = assets.find((a) => a.viewType === "frontClose");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(10,10,10,0.3)" }} onClick={busy ? undefined : onClose} />
      <div className="relative w-full overflow-hidden rounded-canvas-lg bg-canvas-surface border-hairline border-canvas-border-strong" style={{ maxWidth: 380 }}>
        {headshot && (
          <div className="relative border-b-hairline border-canvas-border" style={{ height: 140 }}>
            <img src={headshot.storageUrl} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 20%" }} />
          </div>
        )}
        <div className="p-5">
          <div className="text-canvas-ink font-medium mb-1" style={{ fontSize: 16 }}>
            Export identity pack
          </div>
          <div className="text-canvas-md text-canvas-ink-soft mb-4" style={{ lineHeight: 1.5 }}>
            {packageQuery.isLoading
              ? "Loading the package…"
              : `${pack.modelName} — ${assets.length} view${assets.length === 1 ? "" : "s"}, rendered at 2K, with the legal identity document.`}
          </div>

          {stepCopy && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-canvas-md bg-canvas-surface-inset text-canvas-md text-canvas-ink-soft">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{stepCopy}</span>
              <span className="ml-auto text-canvas-ink-faint" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pack.progress}%
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="text-canvas-lg font-medium text-canvas-ink-soft hover:text-canvas-ink transition-colors disabled:opacity-40"
            >
              Close
            </button>
            <button
              onClick={() => void pack.downloadPdf()}
              disabled={busy || assets.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-canvas-md text-canvas-lg font-medium text-canvas-ink-soft border-hairline border-canvas-border-strong hover:text-canvas-ink hover:border-canvas-ink transition-colors disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.6} />
              PDF only
            </button>
            <button
              onClick={() => void pack.downloadZip()}
              disabled={busy || assets.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-canvas-md bg-canvas-ink text-canvas-surface text-canvas-lg font-medium transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.6} />
              Download pack
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
