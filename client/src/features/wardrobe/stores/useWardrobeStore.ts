/**
 * Wardrobe Store — Zustand state for the Wardrobe Studio tool.
 *
 * Manages garment inventory, selection state, active slot tab,
 * search/filter, VTO session state, overlay detection, cooldown,
 * and error messaging. Server state (garment list, outfits) is
 * fetched via React Query through tRPC — this store only holds
 * UI-local state that doesn't belong on the server.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { GarmentSlotType, DetectedItem, TattooMap } from "../types";

/** Max VTO history entries before trimming oldest */
const MAX_HISTORY_LENGTH = 15;

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
  toggleGarmentSelection: (id: number, slotType?: GarmentSlotType, fullLookIdsToDeselect?: number[]) => void;
  clearSelection: () => void;
  setSelection: (ids: number[]) => void;

  /** Selection snapshots per history index (for undo/redo restore) */
  selectionSnapshots: Map<number, number[]>;
  snapshotSelection: () => void;
  restoreSelectionForIndex: () => void;

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

  /** Overlay detection state — bounding boxes on VTO result */
  resultOverlayItems: DetectedItem[];
  setResultOverlayItems: (items: DetectedItem[]) => void;
  isScanningResult: boolean;
  setIsScanningResult: (scanning: boolean) => void;
  /** Cache of overlay items per history index */
  overlayCache: Map<number, DetectedItem[]>;
  cacheOverlayItems: (index: number, items: DetectedItem[]) => void;
  getCachedOverlay: (index: number) => DetectedItem[] | undefined;

  /** Cooldown timer (seconds remaining before next generation) */
  cooldownSeconds: number;
  setCooldownSeconds: (seconds: number) => void;

  /** Error message from last generation attempt */
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;

  /** Snapshot of style notes at last generation (garmentId → note text) */
  lastGenStyleNotes: Record<string, string>;
  setLastGenStyleNotes: (notes: Record<string, string>) => void;
  /** Whether any selected garment's style note differs from last generation */
  hasDirtyStyles: () => boolean;

  /** Whether a VTO generation is currently in progress (persists across remounts) */
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  /** Current generation step message */
  generatingMessage: string | null;
  setGeneratingMessage: (msg: string | null) => void;

  /** Whether the decomposition drawer is open */
  isDecomposeOpen: boolean;
  setDecomposeOpen: (open: boolean) => void;

  /** Pending file for auto-decomposition (set when full_look upload is intercepted) */
  pendingDecomposeFile: File | null;
  setPendingDecomposeFile: (file: File | null) => void;

  /** Pre-scanned quick-detect results (S3 URL + detected items from smart decomposition) */
  pendingQuickDetect: { sourceImageUrl: string; garments: DetectedItem[] } | null;
  setPendingQuickDetect: (data: { sourceImageUrl: string; garments: DetectedItem[] } | null) => void;

  /** Reset all wardrobe state */
  resetWardrobe: () => void;
}

const INITIAL_STATE = {
  activeSlot: "full_look" as GarmentSlotType,
  showOutfits: false,
  searchTerm: "",
  selectedGarmentIds: new Set<number>(),
  selectionSnapshots: new Map<number, number[]>(),
  styleNotes: {} as Record<string, string>,
  tattooMap: null as TattooMap | null,
  activeSessionId: null as number | null,
  vtoHistory: [] as string[],
  vtoHistoryIndex: -1,
  resultOverlayItems: [] as DetectedItem[],
  isScanningResult: false,
  overlayCache: new Map<number, DetectedItem[]>(),
  cooldownSeconds: 0,
  errorMessage: null as string | null,
  isGenerating: false,
  generatingMessage: null as string | null,
  isDecomposeOpen: false,
  pendingDecomposeFile: null as File | null,
  pendingQuickDetect: null as { sourceImageUrl: string; garments: DetectedItem[] } | null,
  lastGenStyleNotes: {} as Record<string, string>,
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
      // SOT: full_look is radio (only one at a time), other slots are additive
      toggleGarmentSelection: (id, slotType, fullLookIdsToDeselect) =>
        set(
          (state) => {
            const next = new Set(state.selectedGarmentIds);
            if (next.has(id)) {
              next.delete(id);
            } else {
              // Full look is radio — deselect any other full_look first
              if (slotType === "full_look" && fullLookIdsToDeselect) {
                for (const fid of fullLookIdsToDeselect) {
                  if (fid !== id) next.delete(fid);
                }
              }
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

      // ── Selection Snapshots ────────────────────────────────
      snapshotSelection: () =>
        set(
          (state) => {
            const snapshots = new Map(state.selectionSnapshots);
            snapshots.set(state.vtoHistoryIndex, Array.from(state.selectedGarmentIds));
            return { selectionSnapshots: snapshots };
          },
          false,
          "snapshotSelection",
        ),

      restoreSelectionForIndex: () => {
        const state = get();
        const snapshot = state.selectionSnapshots.get(state.vtoHistoryIndex);
        if (snapshot) {
          set(
            { selectedGarmentIds: new Set(snapshot) },
            false,
            "restoreSelectionForIndex",
          );
        }
      },

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
            const keepCount = state.vtoHistoryIndex + 1;
            const trimmed = state.vtoHistory.slice(0, keepCount);
            const newHistory = [...trimmed, url];

            // Prune orphaned future keys from Maps
            const snapshots = new Map(state.selectionSnapshots);
            const overlay = new Map(state.overlayCache);
            for (const key of Array.from(snapshots.keys())) {
              if (key >= keepCount) snapshots.delete(key);
            }
            for (const key of Array.from(overlay.keys())) {
              if (key >= keepCount) overlay.delete(key);
            }

            // Trim to MAX_HISTORY_LENGTH (remove oldest) and shift Map keys
            if (newHistory.length > MAX_HISTORY_LENGTH) {
              const excess = newHistory.length - MAX_HISTORY_LENGTH;
              const shiftedSnapshots = new Map<number, number[]>();
              const shiftedOverlay = new Map<number, DetectedItem[]>();
              Array.from(snapshots.entries()).forEach(([key, val]) => {
                const newKey = key - excess;
                if (newKey >= 0) shiftedSnapshots.set(newKey, val);
              });
              Array.from(overlay.entries()).forEach(([key, val]) => {
                const newKey = key - excess;
                if (newKey >= 0) shiftedOverlay.set(newKey, val);
              });
              return {
                vtoHistory: newHistory.slice(excess),
                vtoHistoryIndex: newHistory.length - excess - 1,
                selectionSnapshots: shiftedSnapshots,
                overlayCache: shiftedOverlay,
              };
            }

            return {
              vtoHistory: newHistory,
              vtoHistoryIndex: newHistory.length - 1,
              selectionSnapshots: snapshots,
              overlayCache: overlay,
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
        set(
          {
            vtoHistory: [],
            vtoHistoryIndex: -1,
            selectionSnapshots: new Map(),
            overlayCache: new Map(),
          },
          false,
          "clearVTOHistory",
        ),

      // ── Overlay Detection ──────────────────────────────────
      setResultOverlayItems: (items) =>
        set({ resultOverlayItems: items }, false, "setResultOverlayItems"),

      setIsScanningResult: (scanning) =>
        set({ isScanningResult: scanning }, false, "setIsScanningResult"),

      cacheOverlayItems: (index, items) =>
        set(
          (state) => {
            const cache = new Map(state.overlayCache);
            cache.set(index, items);
            return { overlayCache: cache };
          },
          false,
          "cacheOverlayItems",
        ),

      getCachedOverlay: (index) => {
        return get().overlayCache.get(index);
      },

      // ── Cooldown ───────────────────────────────────────────
      setCooldownSeconds: (seconds) =>
        set({ cooldownSeconds: seconds }, false, "setCooldownSeconds"),

      // ── Error ──────────────────────────────────────────────
      setErrorMessage: (msg) =>
        set({ errorMessage: msg }, false, "setErrorMessage"),

      // ── Style Refresh ────────────────────────────────────────
      setLastGenStyleNotes: (notes) =>
        set({ lastGenStyleNotes: notes }, false, "setLastGenStyleNotes"),

      hasDirtyStyles: () => {
        const s = get();
        if (s.vtoHistory.length <= 1) return false;
        if (Object.keys(s.lastGenStyleNotes).length === 0) return false;
        return Array.from(s.selectedGarmentIds).some((id) => {
          const key = String(id);
          const lastNote = s.lastGenStyleNotes[key];
          const currentNote = s.styleNotes[key] || "";
          return lastNote !== undefined && lastNote !== currentNote;
        });
      },

      // ── Decompose ──────────────────────────────────────────
      // ── Generation State (persists across remounts) ────────
      setIsGenerating: (generating) =>
        set({ isGenerating: generating }, false, "setIsGenerating"),
      setGeneratingMessage: (msg) =>
        set({ generatingMessage: msg }, false, "setGeneratingMessage"),

      setDecomposeOpen: (open) =>
        set({ isDecomposeOpen: open }, false, "setDecomposeOpen"),

      setPendingDecomposeFile: (file) =>
        set({ pendingDecomposeFile: file }, false, "setPendingDecomposeFile"),

      setPendingQuickDetect: (data) =>
        set({ pendingQuickDetect: data }, false, "setPendingQuickDetect"),

      // ── Reset ──────────────────────────────────────────────
      resetWardrobe: () =>
        set(
          {
            ...INITIAL_STATE,
            selectedGarmentIds: new Set(),
            selectionSnapshots: new Map(),
            overlayCache: new Map(),
            lastGenStyleNotes: {},
          },
          false,
          "resetWardrobe",
        ),
    }),
    { name: "WardrobeStore" },
  ),
);
