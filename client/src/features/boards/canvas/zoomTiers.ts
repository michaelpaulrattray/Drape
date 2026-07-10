/**
 * Zoom-tier system — DESIGN_SYSTEM.md §12.
 *
 * The card is the constant; chrome is the variable. Three tiers drive what
 * chrome each node renders. THE CONSTANTS BELOW ARE THE SINGLE TUNING POINT —
 * nothing else may hardcode a zoom breakpoint. Values tuned by the founder at
 * VC1 (2026-07-10) on the seeded density mock.
 */
import { createContext, useContext, useRef } from "react";
import { useStore } from "@xyflow/react";

export const ZOOM_TIER_MID = 0.45; // below this: "mid" — chrome retracts (VC1 ruling)
export const ZOOM_TIER_FAR = 0.35; // below this: "far" — cards become tiles (VC1 ruling)
export const ZOOM_TIER_HYSTERESIS = 0.03; // upward re-crossing band

export type ZoomTier = "working" | "mid" | "far";

export interface ZoomTierThresholds {
  mid: number;
  far: number;
  hysteresis: number;
}

export const DEFAULT_THRESHOLDS: ZoomTierThresholds = {
  mid: ZOOM_TIER_MID,
  far: ZOOM_TIER_FAR,
  hysteresis: ZOOM_TIER_HYSTERESIS,
};

/**
 * Pure tier computation with hysteresis: dropping a tier happens exactly at
 * the threshold; climbing back requires threshold + hysteresis, so panning
 * near a boundary doesn't flicker.
 */
export function tierForZoom(
  zoom: number,
  prev: ZoomTier | null,
  t: ZoomTierThresholds = DEFAULT_THRESHOLDS,
): ZoomTier {
  const up = t.hysteresis;
  if (prev === "far") {
    if (zoom < t.far + up) return "far";
    return zoom < t.mid ? "mid" : zoom < t.mid + up ? "mid" : "working";
  }
  if (prev === "mid") {
    if (zoom < t.far) return "far";
    if (zoom < t.mid + up) return "mid";
    return "working";
  }
  if (zoom < t.far) return "far";
  if (zoom < t.mid) return "mid";
  return "working";
}

export interface ZoomTierContextValue {
  tier: ZoomTier;
  /** Live canvas zoom — used by screen-fixed chrome to counter-scale (D-2). */
  zoom: number;
}

/** Default lets primitives render sanely outside a provider (tests, studio). */
export const ZoomTierContext = createContext<ZoomTierContextValue>({
  tier: "working",
  zoom: 1,
});

export function useZoomTierContext(): ZoomTierContextValue {
  return useContext(ZoomTierContext);
}

/**
 * Live tier from React Flow's viewport. Must be called inside a ReactFlow
 * tree. `thresholds` is only overridden by the VC1 density mock's dev slider.
 */
export function useZoomTier(
  thresholds: ZoomTierThresholds = DEFAULT_THRESHOLDS,
): ZoomTierContextValue {
  const prevRef = useRef<ZoomTier>("working");
  return useStore((s) => {
    const zoom = s.transform[2];
    const tier = tierForZoom(zoom, prevRef.current, thresholds);
    prevRef.current = tier;
    return { tier, zoom };
  }, (a, b) => a.tier === b.tier && a.zoom === b.zoom);
}
