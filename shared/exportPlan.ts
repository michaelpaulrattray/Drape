import type { CanonicalViewAngle } from "./boardTypes";

export const EXPORT_RESOLUTIONS = ["1K"] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];
export type DeliveredExportResolution = ExportResolution | "missing";

export interface ExportViewOutcome {
  viewType: CanonicalViewAngle;
  deliveredResolution: DeliveredExportResolution;
  issues: string[];
}

/**
 * Current customer export authority: selected package images are delivered at
 * their stored 1K resolution with no paid derivative or hidden quality tier.
 */
export function buildExportPlan(viewCount: number) {
  const safeCount = Math.max(0, Math.floor(viewCount));
  return {
    viewCount: safeCount,
    resolution: "1K" as const,
    totalCost: 0 as const,
  };
}
