/**
 * useCanvasLayers — the Esc layer registry (Decision 7 / DS §9).
 *
 * Esc closes the topmost layer, strictly: popover → hover card → dialog →
 * takeover → clear selection. Radix surfaces and the takeover each close
 * themselves on Esc; what the board-level handler needs to know is only
 * whether ANY layer is open — if so, that keypress belonged to the layer
 * and selection must survive it. Node-hosted popovers register here because
 * BoardPage cannot see their state.
 */
import { create } from "zustand";
import { useEffect } from "react";

interface CanvasLayersState {
  layers: string[];
  push: (id: string) => void;
  remove: (id: string) => void;
}

export const useCanvasLayers = create<CanvasLayersState>()((set) => ({
  layers: [],
  push: (id) => set((s) => ({ layers: [...s.layers.filter((l) => l !== id), id] })),
  remove: (id) => set((s) => ({ layers: s.layers.filter((l) => l !== id) })),
}));

export function hasOpenCanvasLayers(): boolean {
  return useCanvasLayers.getState().layers.length > 0;
}

/** Register an open/closed layer (popovers, node-hosted dialogs). */
export function useRegisterCanvasLayer(id: string, open: boolean) {
  useEffect(() => {
    if (!open) return;
    useCanvasLayers.getState().push(id);
    return () => useCanvasLayers.getState().remove(id);
  }, [id, open]);
}
