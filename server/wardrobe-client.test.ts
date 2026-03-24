/**
 * Wardrobe Client Tests — useWardrobeStore, constants, types
 *
 * Tests the Zustand store logic, constants validation, and type
 * definitions for the wardrobe feature.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Constants Tests ────────────────────────────────────────
describe("Wardrobe Constants", () => {
  it("SLOT_TABS has 5 categories", async () => {
    const { SLOT_TABS } = await import(
      "../client/src/features/wardrobe/constants"
    );
    expect(SLOT_TABS).toHaveLength(5);
    const ids = SLOT_TABS.map((t: { id: string }) => t.id);
    expect(ids).toContain("full_look");
    expect(ids).toContain("tops");
    expect(ids).toContain("bottoms");
    expect(ids).toContain("shoes");
    expect(ids).toContain("accessories");
  });

  it("each SLOT_TAB has required fields", async () => {
    const { SLOT_TABS } = await import(
      "../client/src/features/wardrobe/constants"
    );
    for (const tab of SLOT_TABS) {
      expect(tab).toHaveProperty("id");
      expect(tab).toHaveProperty("label");
      expect(tab).toHaveProperty("shortLabel");
      expect(tab).toHaveProperty("icon");
      expect(typeof tab.label).toBe("string");
      expect(typeof tab.shortLabel).toBe("string");
      // Lucide icons are React.memo wrapped — typeof is 'object'
      expect(tab.icon).toBeTruthy();
      expect(typeof tab.icon === 'function' || typeof tab.icon === 'object').toBe(true);
    }
  });

  it("MAX_GARMENTS_PER_SLOT is a reasonable number", async () => {
    const { MAX_GARMENTS_PER_SLOT } = await import(
      "../client/src/features/wardrobe/constants"
    );
    expect(MAX_GARMENTS_PER_SLOT).toBeGreaterThanOrEqual(5);
    expect(MAX_GARMENTS_PER_SLOT).toBeLessThanOrEqual(50);
  });

  it("MAX_FILE_SIZE_BYTES is 8MB", async () => {
    const { MAX_FILE_SIZE_BYTES } = await import(
      "../client/src/features/wardrobe/constants"
    );
    expect(MAX_FILE_SIZE_BYTES).toBe(8 * 1024 * 1024);
  });

  it("ACCEPTED_IMAGE_TYPES includes jpeg, png, webp", async () => {
    const { ACCEPTED_IMAGE_TYPES } = await import(
      "../client/src/features/wardrobe/constants"
    );
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/png");
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/webp");
  });

  it("SLOT_DISPLAY_NAMES covers all slot types", async () => {
    const { SLOT_DISPLAY_NAMES, SLOT_TABS } = await import(
      "../client/src/features/wardrobe/constants"
    );
    for (const tab of SLOT_TABS) {
      expect(SLOT_DISPLAY_NAMES).toHaveProperty(tab.id);
      expect(typeof SLOT_DISPLAY_NAMES[tab.id as keyof typeof SLOT_DISPLAY_NAMES]).toBe(
        "string",
      );
    }
  });
});

// ── Store Tests ────────────────────────────────────────────
describe("useWardrobeStore", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    // Reset store to initial state
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("initializes with correct defaults", () => {
    const state = store.useWardrobeStore.getState();
    expect(state.activeSlot).toBe("full_look");
    expect(state.showOutfits).toBe(false);
    expect(state.searchTerm).toBe("");
    expect(state.selectedGarmentIds.size).toBe(0);
    expect(Object.keys(state.styleNotes)).toHaveLength(0);
    expect(state.tattooMap).toBeNull();
    expect(state.activeSessionId).toBeNull();
    expect(state.vtoHistory).toHaveLength(0);
    expect(state.vtoHistoryIndex).toBe(-1);
    expect(state.isDecomposeOpen).toBe(false);
  });

  it("setActiveSlot changes the active slot", () => {
    const { setActiveSlot } = store.useWardrobeStore.getState();
    setActiveSlot("tops");
    expect(store.useWardrobeStore.getState().activeSlot).toBe("tops");
    setActiveSlot("shoes");
    expect(store.useWardrobeStore.getState().activeSlot).toBe("shoes");
  });

  it("setSearchTerm updates the search term", () => {
    const { setSearchTerm } = store.useWardrobeStore.getState();
    setSearchTerm("denim");
    expect(store.useWardrobeStore.getState().searchTerm).toBe("denim");
  });

  it("toggleGarmentSelection adds and removes garment IDs", () => {
    const { toggleGarmentSelection } = store.useWardrobeStore.getState();
    toggleGarmentSelection(1);
    expect(store.useWardrobeStore.getState().selectedGarmentIds.has(1)).toBe(
      true,
    );
    toggleGarmentSelection(2);
    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(2);
    toggleGarmentSelection(1);
    expect(store.useWardrobeStore.getState().selectedGarmentIds.has(1)).toBe(
      false,
    );
    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(1);
  });

  it("clearSelection empties the selection set", () => {
    const { toggleGarmentSelection, clearSelection } =
      store.useWardrobeStore.getState();
    toggleGarmentSelection(1);
    toggleGarmentSelection(2);
    clearSelection();
    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(0);
  });

  it("setSelection replaces the entire selection", () => {
    const { setSelection } = store.useWardrobeStore.getState();
    setSelection([10, 20, 30]);
    const ids = store.useWardrobeStore.getState().selectedGarmentIds;
    expect(ids.size).toBe(3);
    expect(ids.has(10)).toBe(true);
    expect(ids.has(20)).toBe(true);
    expect(ids.has(30)).toBe(true);
  });

  it("setStyleNote stores notes keyed by garment ID", () => {
    const { setStyleNote } = store.useWardrobeStore.getState();
    setStyleNote(5, "Pair with dark jeans");
    expect(store.useWardrobeStore.getState().styleNotes["5"]).toBe(
      "Pair with dark jeans",
    );
  });

  it("clearStyleNotes empties all notes", () => {
    const { setStyleNote, clearStyleNotes } =
      store.useWardrobeStore.getState();
    setStyleNote(1, "note 1");
    setStyleNote(2, "note 2");
    clearStyleNotes();
    expect(Object.keys(store.useWardrobeStore.getState().styleNotes)).toHaveLength(0);
  });

  it("setTattooMap stores and clears tattoo map", () => {
    const { setTattooMap } = store.useWardrobeStore.getState();
    const map = {
      hasTattoos: true,
      tattooAreas: ["left arm"],
      cleanAreas: ["torso"],
      promptFragment: "preserve left arm tattoo",
    };
    setTattooMap(map);
    expect(store.useWardrobeStore.getState().tattooMap).toEqual(map);
    setTattooMap(null);
    expect(store.useWardrobeStore.getState().tattooMap).toBeNull();
  });

  // ── VTO History (undo/redo) ──────────────────────────────
  describe("VTO History", () => {
    it("pushVTOResult adds to history and advances index", () => {
      const { pushVTOResult } = store.useWardrobeStore.getState();
      pushVTOResult("url1");
      expect(store.useWardrobeStore.getState().vtoHistory).toEqual(["url1"]);
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);

      pushVTOResult("url2");
      expect(store.useWardrobeStore.getState().vtoHistory).toEqual([
        "url1",
        "url2",
      ]);
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(1);
    });

    it("undoVTO moves index backward", () => {
      const { pushVTOResult, undoVTO } = store.useWardrobeStore.getState();
      pushVTOResult("url1");
      pushVTOResult("url2");
      pushVTOResult("url3");

      undoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(1);
      undoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);
      // Can't go below 0
      undoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);
    });

    it("redoVTO moves index forward", () => {
      const { pushVTOResult, undoVTO, redoVTO } =
        store.useWardrobeStore.getState();
      pushVTOResult("url1");
      pushVTOResult("url2");
      pushVTOResult("url3");

      undoVTO();
      undoVTO();
      redoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(1);
      redoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(2);
      // Can't go beyond length
      redoVTO();
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(2);
    });

    it("pushVTOResult truncates future when pushing after undo", () => {
      const { pushVTOResult, undoVTO } = store.useWardrobeStore.getState();
      pushVTOResult("url1");
      pushVTOResult("url2");
      pushVTOResult("url3");

      undoVTO(); // index = 1
      pushVTOResult("url4"); // should truncate url3

      expect(store.useWardrobeStore.getState().vtoHistory).toEqual([
        "url1",
        "url2",
        "url4",
      ]);
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(2);
    });

    it("canUndoVTO and canRedoVTO return correct values", () => {
      const { pushVTOResult, undoVTO, canUndoVTO, canRedoVTO } =
        store.useWardrobeStore.getState();

      expect(canUndoVTO()).toBe(false);
      expect(canRedoVTO()).toBe(false);

      pushVTOResult("url1");
      expect(canUndoVTO()).toBe(false); // only 1 item, index 0
      expect(canRedoVTO()).toBe(false);

      pushVTOResult("url2");
      expect(canUndoVTO()).toBe(true);
      expect(canRedoVTO()).toBe(false);

      undoVTO();
      expect(canUndoVTO()).toBe(false);
      expect(canRedoVTO()).toBe(true);
    });

    it("currentVTOResult returns the correct URL", () => {
      const { pushVTOResult, undoVTO, currentVTOResult } =
        store.useWardrobeStore.getState();

      expect(currentVTOResult()).toBeNull();

      pushVTOResult("url1");
      expect(currentVTOResult()).toBe("url1");

      pushVTOResult("url2");
      expect(currentVTOResult()).toBe("url2");

      undoVTO();
      expect(currentVTOResult()).toBe("url1");
    });

    it("clearVTOHistory resets history and index", () => {
      const { pushVTOResult, clearVTOHistory } =
        store.useWardrobeStore.getState();
      pushVTOResult("url1");
      pushVTOResult("url2");
      clearVTOHistory();
      expect(store.useWardrobeStore.getState().vtoHistory).toHaveLength(0);
      expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(-1);
    });
  });

  it("resetWardrobe returns to initial state", () => {
    const state = store.useWardrobeStore.getState();
    state.setActiveSlot("shoes");
    state.setSearchTerm("test");
    state.toggleGarmentSelection(1);
    state.setStyleNote(1, "note");
    state.pushVTOResult("url");
    state.setDecomposeOpen(true);

    state.resetWardrobe();

    const reset = store.useWardrobeStore.getState();
    expect(reset.activeSlot).toBe("full_look");
    expect(reset.searchTerm).toBe("");
    expect(reset.selectedGarmentIds.size).toBe(0);
    expect(Object.keys(reset.styleNotes)).toHaveLength(0);
    expect(reset.vtoHistory).toHaveLength(0);
    expect(reset.isDecomposeOpen).toBe(false);
  });
});
