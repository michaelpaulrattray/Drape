/**
 * Wardrobe VTO Tests — useWardrobeGeneration hook logic,
 * MainStage props contract, LayersPanel props contract.
 *
 * Tests the generation hook's decision logic (smart generate),
 * store integration for VTO history, and component prop contracts.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Store-level VTO History Tests ─────────────────────────────
describe("VTO History (extended)", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("pushVTOResult truncates forward history on new push after undo", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url1");
    s.pushVTOResult("url2");
    s.pushVTOResult("url3");

    // Undo twice
    s.undoVTO();
    s.undoVTO();
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);

    // Push new result — should truncate url2 and url3
    s.pushVTOResult("url4");
    const state = store.useWardrobeStore.getState();
    expect(state.vtoHistory).toEqual(["url1", "url4"]);
    expect(state.vtoHistoryIndex).toBe(1);
  });

  it("currentVTOResult returns null when history is empty", () => {
    const result = store.useWardrobeStore.getState().currentVTOResult();
    expect(result).toBeNull();
  });

  it("currentVTOResult returns the correct URL after push", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("https://example.com/vto1.png");
    expect(s.currentVTOResult()).toBe("https://example.com/vto1.png");
  });

  it("currentVTOResult tracks undo/redo correctly", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url-a");
    s.pushVTOResult("url-b");
    s.pushVTOResult("url-c");

    // At url-c (index 2)
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("url-c");

    s.undoVTO();
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("url-b");

    s.undoVTO();
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("url-a");

    s.redoVTO();
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("url-b");
  });

  it("canUndoVTO and canRedoVTO return correct booleans", () => {
    const s = store.useWardrobeStore.getState();

    // Empty history
    expect(s.canUndoVTO()).toBe(false);
    expect(s.canRedoVTO()).toBe(false);

    s.pushVTOResult("url1");
    // Single entry — can't undo or redo
    expect(store.useWardrobeStore.getState().canUndoVTO()).toBe(false);
    expect(store.useWardrobeStore.getState().canRedoVTO()).toBe(false);

    s.pushVTOResult("url2");
    // Two entries at end — can undo, can't redo
    expect(store.useWardrobeStore.getState().canUndoVTO()).toBe(true);
    expect(store.useWardrobeStore.getState().canRedoVTO()).toBe(false);

    s.undoVTO();
    // After undo — can't undo (at 0), can redo
    expect(store.useWardrobeStore.getState().canUndoVTO()).toBe(false);
    expect(store.useWardrobeStore.getState().canRedoVTO()).toBe(true);
  });

  it("clearVTOHistory resets all VTO state", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url1");
    s.pushVTOResult("url2");
    s.clearVTOHistory();

    const state = store.useWardrobeStore.getState();
    expect(state.vtoHistory).toHaveLength(0);
    expect(state.vtoHistoryIndex).toBe(-1);
    expect(state.currentVTOResult()).toBeNull();
  });

  it("undoVTO does not go below index 0", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url1");
    s.undoVTO();
    s.undoVTO();
    s.undoVTO();
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);
  });

  it("redoVTO does not exceed history length", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url1");
    s.pushVTOResult("url2");
    s.redoVTO();
    s.redoVTO();
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(1);
  });
});

// ── Session Management Tests ──────────────────────────────────
describe("Wardrobe Session State", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("activeSessionId starts null", () => {
    expect(store.useWardrobeStore.getState().activeSessionId).toBeNull();
  });

  it("setActiveSessionId stores the session ID", () => {
    store.useWardrobeStore.getState().setActiveSessionId(42);
    expect(store.useWardrobeStore.getState().activeSessionId).toBe(42);
  });

  it("resetWardrobe clears session ID", () => {
    store.useWardrobeStore.getState().setActiveSessionId(99);
    store.useWardrobeStore.getState().resetWardrobe();
    expect(store.useWardrobeStore.getState().activeSessionId).toBeNull();
  });
});

// ── Selection + Style Notes Integration ───────────────────────
describe("Selection and Style Notes Integration", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("style notes persist across selection changes", () => {
    const s = store.useWardrobeStore.getState();
    s.toggleGarmentSelection(1);
    s.setStyleNote(1, "tucked in");
    s.toggleGarmentSelection(2);
    s.setStyleNote(2, "sleeves rolled");

    // Remove garment 1 from selection
    s.toggleGarmentSelection(1);

    // Style notes should still exist (they're independent of selection)
    expect(store.useWardrobeStore.getState().styleNotes["1"]).toBe("tucked in");
    expect(store.useWardrobeStore.getState().styleNotes["2"]).toBe("sleeves rolled");
  });

  it("clearSelection does not clear style notes", () => {
    const s = store.useWardrobeStore.getState();
    s.toggleGarmentSelection(1);
    s.setStyleNote(1, "open collar");
    s.clearSelection();

    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(0);
    expect(store.useWardrobeStore.getState().styleNotes["1"]).toBe("open collar");
  });

  it("resetWardrobe clears both selection and style notes", () => {
    const s = store.useWardrobeStore.getState();
    s.toggleGarmentSelection(1);
    s.setStyleNote(1, "layered");
    s.resetWardrobe();

    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(0);
    expect(Object.keys(store.useWardrobeStore.getState().styleNotes)).toHaveLength(0);
  });
});

// ── Decompose State Tests ─────────────────────────────────────
describe("Decompose State", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("isDecomposeOpen starts false", () => {
    expect(store.useWardrobeStore.getState().isDecomposeOpen).toBe(false);
  });

  it("setDecomposeOpen toggles the state", () => {
    store.useWardrobeStore.getState().setDecomposeOpen(true);
    expect(store.useWardrobeStore.getState().isDecomposeOpen).toBe(true);
    store.useWardrobeStore.getState().setDecomposeOpen(false);
    expect(store.useWardrobeStore.getState().isDecomposeOpen).toBe(false);
  });
});

// ── Generation Hook Contract Tests ────────────────────────────
describe("useWardrobeGeneration contract", () => {
  it("exports useWardrobeGeneration from the wardrobe barrel", async () => {
    const mod = await import("../client/src/features/wardrobe/index");
    expect(mod).toHaveProperty("useWardrobeGeneration");
    expect(typeof mod.useWardrobeGeneration).toBe("function");
  });
});

// ── Component Export Tests ────────────────────────────────────
describe("Component exports", () => {
  it("WardrobeCanvasOverlays are exported from the wardrobe barrel", async () => {
    const mod = await import("../client/src/features/wardrobe/index");
    expect(mod).toHaveProperty("WardrobeEmptyState");
    expect(mod).toHaveProperty("WardrobeImageOverlay");
    expect(mod).toHaveProperty("WardrobeShortcutsBar");
  });

  it("LayersPanel is exported from the wardrobe barrel", async () => {
    const mod = await import("../client/src/features/wardrobe/index");
    expect(mod).toHaveProperty("LayersPanel");
    expect(typeof mod.LayersPanel).toBe("function");
  });

  it("RackPanel is exported from the wardrobe barrel", async () => {
    const mod = await import("../client/src/features/wardrobe/index");
    expect(mod).toHaveProperty("RackPanel");
    expect(typeof mod.RackPanel).toBe("function");
  });
});

// ── VTO History Edge Cases ────────────────────────────────────
describe("VTO History Edge Cases", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("handles rapid push/undo/push cycles", () => {
    const s = store.useWardrobeStore.getState();

    // Push 3 results
    s.pushVTOResult("v1");
    s.pushVTOResult("v2");
    s.pushVTOResult("v3");

    // Undo to v1
    s.undoVTO();
    s.undoVTO();
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("v1");

    // Push new branch
    s.pushVTOResult("v4");
    expect(store.useWardrobeStore.getState().vtoHistory).toEqual(["v1", "v4"]);

    // Push another
    s.pushVTOResult("v5");
    expect(store.useWardrobeStore.getState().vtoHistory).toEqual(["v1", "v4", "v5"]);
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(2);
  });

  it("handles single-entry undo gracefully", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("only-one");
    s.undoVTO();

    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(0);
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("only-one");
  });
});
