import type { GeneratedAsset } from "@/features/casting/constants";
import { VIEW_ANGLE_LABELS, type CanonicalViewAngle } from "@shared/boardTypes";
import {
  compCardViewOrder,
  exportViewFilename,
  isCanonicalViewType,
  VIEW_TO_PDF_KEY,
  type PdfImageKey,
} from "@shared/exportViews";
import type { ExportResolution, ExportViewOutcome } from "@shared/exportPlan";

export interface PreparedExportView extends ExportViewOutcome {
  sourceUrl: string;
  paidUpscaleSucceeded: boolean;
  deliveredUrl: string | null;
  dataUrl: string | null;
  filename: string | null;
}

interface ExportMutations {
  upscale: (input: { imageUrl: string; resolution: "2K" }) => Promise<{ success: boolean; imageUrl?: string }>;
  proxyImage: (input: { imageUrl: string }) => Promise<{ success: boolean; base64?: string }>;
}

export function claimExportRun(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function exportFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Unknown export error";
}

/** One current asset per canonical slot, in comp-card order. */
export function canonicalExportAssets(assets: GeneratedAsset[]): Array<GeneratedAsset & { viewType: CanonicalViewAngle }> {
  const byAngle = new Map<CanonicalViewAngle, GeneratedAsset & { viewType: CanonicalViewAngle }>();
  for (const asset of assets) {
    if (isCanonicalViewType(asset.viewType)) {
      // Current assets normally contain one row per slot. If a stale caller
      // supplies history as well, the newest (last) row wins rather than an
      // older image silently entering a paid export.
      byAngle.set(asset.viewType, asset as GeneratedAsset & { viewType: CanonicalViewAngle });
    }
  }
  return Array.from(byAngle.values()).sort(
    (a, b) => compCardViewOrder(a.viewType) - compCardViewOrder(b.viewType),
  );
}

export function assertExportPlanMatchesAssets(assets: GeneratedAsset[], plannedViewCount: number): void {
  const actual = canonicalExportAssets(assets).length;
  if (actual !== plannedViewCount) {
    throw new Error("This casting package changed while export was open. Close it, reopen it, and review the updated price before exporting.");
  }
}

async function proxyDataUrl(
  proxyImage: ExportMutations["proxyImage"],
  imageUrl: string,
): Promise<string> {
  const result = await proxyImage({ imageUrl });
  if (!result.success || !result.base64) throw new Error("The image bytes could not be fetched for export.");
  return result.base64;
}

/** Prepare each casting view once. The returned data URL is the single byte
 *  source used by both ZIP and PDF, so a paid 2K export cannot accidentally
 *  put the original into the PDF. Upscale/refund errors remain in `issues`
 *  and are never converted into an unqualified success. */
export async function prepareExportViews({
  assets,
  resolution,
  mutations,
  onViewPrepared,
  onIssue,
}: {
  assets: GeneratedAsset[];
  resolution: ExportResolution;
  mutations: ExportMutations;
  onViewPrepared?: (completed: number, total: number, viewType: CanonicalViewAngle) => void;
  onIssue?: (issue: string, viewType: CanonicalViewAngle) => void;
}): Promise<PreparedExportView[]> {
  const sources = canonicalExportAssets(assets);
  const outcomes: PreparedExportView[] = [];

  for (const source of sources) {
    const issues: string[] = [];
    const recordIssue = (issue: string) => {
      issues.push(issue);
      onIssue?.(issue, source.viewType);
    };
    let deliveredUrl: string | null = source.storageUrl;
    let deliveredResolution: PreparedExportView["deliveredResolution"] = "1K";
    let paidUpscaleSucceeded = false;

    if (resolution === "2K") {
      try {
        const result = await mutations.upscale({ imageUrl: source.storageUrl, resolution: "2K" });
        if (!result.success || !result.imageUrl) throw new Error("The upscale returned no 2K image.");
        paidUpscaleSucceeded = true;
        deliveredUrl = result.imageUrl;
        deliveredResolution = "2K";
      } catch (error) {
        // Includes withAtomicCredits' exact refund outcome/support reference.
        recordIssue(`${VIEW_ANGLE_LABELS[source.viewType]}: ${exportFailureMessage(error)}`);
        deliveredUrl = source.storageUrl;
        deliveredResolution = "1K";
      }
    }

    let dataUrl: string | null = null;
    try {
      dataUrl = await proxyDataUrl(mutations.proxyImage, deliveredUrl);
    } catch (error) {
      if (deliveredResolution === "2K") {
        recordIssue(
          `${VIEW_ANGLE_LABELS[source.viewType]}: the paid 2K image was generated but could not be added to the export (${exportFailureMessage(error)}); the original was used instead.`,
        );
        deliveredUrl = source.storageUrl;
        deliveredResolution = "1K";
        try {
          dataUrl = await proxyDataUrl(mutations.proxyImage, source.storageUrl);
        } catch (fallbackError) {
          recordIssue(`${VIEW_ANGLE_LABELS[source.viewType]} original: ${exportFailureMessage(fallbackError)}`);
        }
      } else {
        recordIssue(`${VIEW_ANGLE_LABELS[source.viewType]}: ${exportFailureMessage(error)}`);
      }
    }

    if (!dataUrl) {
      deliveredUrl = null;
      deliveredResolution = "missing";
    }

    outcomes.push({
      viewType: source.viewType,
      sourceUrl: source.storageUrl,
      paidUpscaleSucceeded,
      deliveredUrl,
      deliveredResolution,
      dataUrl,
      filename: dataUrl ? exportViewFilename(source.viewType, dataUrl) : null,
      issues,
    });
    onViewPrepared?.(outcomes.length, sources.length, source.viewType);
  }

  return outcomes;
}

export function standingPaidUpscaleCopy(
  resolution: ExportResolution,
  outcomes: PreparedExportView[],
): string | undefined {
  if (resolution !== "2K") return undefined;
  const completed = outcomes.filter((outcome) => outcome.paidUpscaleSucceeded).length;
  if (completed === 0) return undefined;
  return `${completed} paid 2K upscale${completed === 1 ? "" : "s"} completed successfully, so ${completed === 1 ? "that charge remains" : "those charges remain"}.`;
}

export function preparedPdfImages(outcomes: PreparedExportView[]): Partial<Record<PdfImageKey, string>> {
  const images: Partial<Record<PdfImageKey, string>> = {};
  for (const outcome of outcomes) {
    if (outcome.dataUrl) images[VIEW_TO_PDF_KEY[outcome.viewType]] = outcome.dataUrl;
  }
  return images;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const payload = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const binary = atob(payload);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
