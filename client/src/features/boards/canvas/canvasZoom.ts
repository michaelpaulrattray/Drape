/**
 * Live canvas zoom — D-37 (spatial constancy). Nodes render identically at
 * every zoom: no tiers, no chrome retraction, no visual mode switches. The
 * ONLY zoom-aware chrome is screen-legible counter-scaling for status
 * indicators (D-6 — a stale/failed node must never become invisible) and the
 * floating toolbar. Replaces the retired zoomTiers system (VC1 thresholds
 * superseded — see DECISION_LOG D-37).
 */
import { createContext, useContext } from "react";
import { useStore } from "@xyflow/react";

export interface CanvasZoomContextValue {
  /** Live React Flow zoom — used by screen-legible chrome to counter-scale. */
  zoom: number;
}

/** Default lets primitives render sanely outside a provider (tests, studio). */
export const CanvasZoomContext = createContext<CanvasZoomContextValue>({ zoom: 1 });

export function useCanvasZoom(): CanvasZoomContextValue {
  return useContext(CanvasZoomContext);
}

/** Live zoom from React Flow's viewport. Must be called inside a ReactFlow tree. */
export function useLiveCanvasZoom(): CanvasZoomContextValue {
  return useStore(
    (s) => ({ zoom: s.transform[2] }),
    (a, b) => a.zoom === b.zoom,
  );
}

/**
 * Scale factor that keeps an element at its designed screen size when the
 * canvas zooms below 1× (legibility floor); above 1× it scales naturally
 * with the canvas like everything else.
 */
export function screenLegibleScale(zoom: number): number {
  return 1 / Math.min(Math.max(zoom, 0.05), 1);
}
