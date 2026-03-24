/**
 * Wardrobe Store — Zustand state for the Wardrobe Studio tool.
 *
 * Manages garment inventory, selection state, active slot tab,
 * search/filter, and VTO session state. Server state (garment list,
 * outfits) is fetched via React Query through tRPC — this store only
 * holds UI-local state that doesn't belong on the server.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { GarmentSlotType, TattooMap } from "../types";

interface WardrobeState {
  /** Currently active slot tab in the rack panel */
  activeSlot: GarmentSlotType;
  setActiveSlot: (slot: GarmentSlotType) => void;

  /** Whether the "Outfits" sub-tab is showing instead of garment tabs */
  showOutfits: boolean;
  setShowOutfits: (show: boolean) => void;

  /** Search term for filtering garments */
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  /** Set of selected garment IDs (for VTO composition) */
  selectedGarmentIds: Set<number>;
  toggleGarmentSelection: (id: number) => void;
  clearSelection: () => void;
  setSelection: (ids: number[]) => void;

  /** Style notes per garment (keyed by garment ID) */
  styleNotes: Record<string, string>;
  setStyleNote: (garmentId: number, note: string) => void;
  clearStyleNotes: () => void;

  /** Tattoo map for identity preservation during VTO */
  tattooMap: TattooMap | null;
  setTattooMap: (map: TattooMap | null) => void;

  /** Active wardrobe session ID */
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;

  /** VTO result history (client-side undo/redo) */
  vtoHistory: string[];
  vtoHistoryIndex: number;
  pushVTOResult: (url: string) => void;
  undoVTO: () => void;
  redoVTO: () => void;
  canUndoVTO: () => boolean;
  canRedoVTO: () => boolean;
  currentVTOResult: () => string | null;
  clearVTOHistory: () => void;

  /** Whether the decomposition drawer is open */
  isDecomposeOpen: boolean;
  setDecomposeOpen: (open: boolean) => void;

  /** Reset all wardrobe state */
  resetWardrobe: () => void;
}

const INITIAL_STATE = {
  activeSlot: "full_look" as GarmentSlotType,
  showOutfits: false,
  searchTerm: "",
  selectedGarmentIds: new Set<number>(),
  styleNotes: {} as Record<string, string>,
  tattooMap: null as TattooMap | null,
  activeSessionId: null as number | null,
  vtoHistory: [] as string[],
  vtoHistoryIndex: -1,
  isDecomposeOpen: false,
};

export const useWardrobeStore = create<WardrobeState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      setActiveSlot: (slot) =>
        set({ activeSlot: slot }, false, "setActiveSlot"),

      showOutfits: false,
      setShowOutfits: (show) =>
        set({ showOutfits: show }, false, "setShowOutfits"),

      setSearchTerm: (term) =>
        set({ searchTerm: term }, false, "setSearchTerm"),

      // ── Selection ──────────────────────────────────────────
      toggleGarmentSelection: (id) =>
        set(
          (state) => {
            const next = new Set(state.selectedGarmentIds);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return { selectedGarmentIds: next };
          },
          false,
          "toggleGarmentSelection",
        ),

      clearSelection: () =>
        set({ selectedGarmentIds: new Set() }, false, "clearSelection"),

      setSelection: (ids) =>
        set({ selectedGarmentIds: new Set(ids) }, false, "setSelection"),

      // ── Style Notes ────────────────────────────────────────
      setStyleNote: (garmentId, note) =>
        set(
          (state) => ({
            styleNotes: { ...state.styleNotes, [String(garmentId)]: note },
          }),
          false,
          "setStyleNote",
        ),

      clearStyleNotes: () =>
        set({ styleNotes: {} }, false, "clearStyleNotes"),

      // ── Tattoo Map ─────────────────────────────────────────
      setTattooMap: (map) =>
        set({ tattooMap: map }, false, "setTattooMap"),

      // ── Session ────────────────────────────────────────────
      setActiveSessionId: (id) =>
        set({ activeSessionId: id }, false, "setActiveSessionId"),

      // ── VTO History (undo/redo) ────────────────────────────
      pushVTOResult: (url) =>
        set(
          (state) => {
            // Truncate any "future" entries when pushing new result
            const trimmed = state.vtoHistory.slice(0, state.vtoHistoryIndex + 1);
            return {
              vtoHistory: [...trimmed, url],
              vtoHistoryIndex: trimmed.length,
            };
          },
          false,
          "pushVTOResult",
        ),

      undoVTO: () =>
        set(
          (state) => ({
            vtoHistoryIndex: Math.max(0, state.vtoHistoryIndex - 1),
          }),
          false,
          "undoVTO",
        ),

      redoVTO: () =>
        set(
          (state) => ({
            vtoHistoryIndex: Math.min(
              state.vtoHistory.length - 1,
              state.vtoHistoryIndex + 1,
            ),
          }),
          false,
          "redoVTO",
        ),

      canUndoVTO: () => {
        const s = get();
        return s.vtoHistoryIndex > 0;
      },

      canRedoVTO: () => {
        const s = get();
        return s.vtoHistoryIndex < s.vtoHistory.length - 1;
      },

      currentVTOResult: () => {
        const s = get();
        if (s.vtoHistory.length === 0 || s.vtoHistoryIndex < 0) return null;
        return s.vtoHistory[s.vtoHistoryIndex] ?? null;
      },

      clearVTOHistory: () =>
        set({ vtoHistory: [], vtoHistoryIndex: -1 }, false, "clearVTOHistory"),

      // ── Decompose ──────────────────────────────────────────
      setDecomposeOpen: (open) =>
        set({ isDecomposeOpen: open }, false, "setDecomposeOpen"),

      // ── Reset ──────────────────────────────────────────────
      resetWardrobe: () =>
        set(
          {
            ...INITIAL_STATE,
            selectedGarmentIds: new Set(),
          },
          false,
          "resetWardrobe",
        ),
    }),
    { name: "WardrobeStore" },
  ),
);
