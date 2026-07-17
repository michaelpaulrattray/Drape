import type { CanonicalViewAngle } from "./boardTypes";
import { VIEW_ANGLE_LABELS } from "./boardTypes";

export const EXPORT_RESOLUTIONS = ["1K", "2K"] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];
export type DeliveredExportResolution = ExportResolution | "missing";

export interface ExportViewOutcome {
  viewType: CanonicalViewAngle;
  deliveredResolution: DeliveredExportResolution;
  issues: string[];
}

export function buildExportPlan(viewCount: number, upscaleUnitCost: number) {
  const safeCount = Math.max(0, Math.floor(viewCount));
  return {
    viewCount: safeCount,
    tiers: {
      "1K": { resolution: "1K" as const, unitCost: 0, totalCost: 0 },
      "2K": {
        resolution: "2K" as const,
        unitCost: upscaleUnitCost,
        totalCost: safeCount * upscaleUnitCost,
      },
    },
  };
}

export function exportPackResolutionSuffix(
  requested: ExportResolution,
  outcomes: ExportViewOutcome[],
): "1K" | "2K" | "MIXED" {
  if (requested === "1K") return "1K";
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.deliveredResolution === "2K")
    ? "2K"
    : "MIXED";
}

export function summarizeExportOutcomes(
  requested: ExportResolution,
  outcomes: ExportViewOutcome[],
): { title: string; description?: string; hasProblems: boolean } {
  const fallbacks = outcomes.filter((outcome) => outcome.deliveredResolution === "1K" && requested === "2K");
  const missing = outcomes.filter((outcome) => outcome.deliveredResolution === "missing");
  const issues = outcomes.flatMap((outcome) => outcome.issues);

  if (missing.length > 0) {
    const names = missing.map((outcome) => VIEW_ANGLE_LABELS[outcome.viewType]).join(", ");
    return {
      title: "Export completed with missing views",
      description: [`Missing: ${names}.`, ...issues].join(" "),
      hasProblems: true,
    };
  }

  if (fallbacks.length > 0) {
    const names = fallbacks.map((outcome) => VIEW_ANGLE_LABELS[outcome.viewType]).join(", ");
    return {
      title: "Export completed with mixed resolution",
      description: [`Original-resolution fallback: ${names}.`, ...issues].join(" "),
      hasProblems: true,
    };
  }

  return {
    title: requested === "2K" ? `${outcomes.length} views exported at 2K` : `${outcomes.length} views exported at original resolution`,
    ...(issues.length > 0 ? { description: issues.join(" ") } : {}),
    hasProblems: issues.length > 0,
  };
}
