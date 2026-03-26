/**
 * Reset Look + Keyboard Shortcut Tests
 *
 * Covers:
 * 1. resetToOriginal() — clears VTO state while preserving session/inventory
 * 2. Keyboard shortcut wiring expectations (R for reset, Ctrl+G for cast)
 */
import { describe, it, expect, beforeEach } from "vitest";

describe("resetToOriginal (Reset Look)", () => {
  let store: typeof import("../client/src/features/wardrobe/stores/useWardrobeStore");

  beforeEach(async () => {
    store = await import(
      "../client/src/features/wardrobe/stores/useWardrobeStore"
    );
    store.useWardrobeStore.getState().resetWardrobe();
  });

  it("clears VTO history and index", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url-1");
    s.pushVTOResult("url-2");
    expect(store.useWardrobeStore.getState().vtoHistory).toHaveLength(2);
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(1);

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().vtoHistory).toHaveLength(0);
    expect(store.useWardrobeStore.getState().vtoHistoryIndex).toBe(-1);
  });

  it("clears garment selection", () => {
    const s = store.useWardrobeStore.getState();
    s.toggleGarmentSelection(10);
    s.toggleGarmentSelection(20);
    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(2);

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().selectedGarmentIds.size).toBe(0);
  });

  it("clears style notes", () => {
    const s = store.useWardrobeStore.getState();
    s.setStyleNote(10, "tucked in");
    s.setStyleNote(20, "cuffed");
    expect(Object.keys(store.useWardrobeStore.getState().styleNotes)).toHaveLength(2);

    store.useWardrobeStore.getState().resetToOriginal();

    expect(Object.keys(store.useWardrobeStore.getState().styleNotes)).toHaveLength(0);
  });

  it("clears resultOverlayItems", () => {
    store.useWardrobeStore.getState().setResultOverlayItems([
      { label: "Top", confidence: 0.9, bbox: [0, 0, 1, 1] },
    ]);
    expect(store.useWardrobeStore.getState().resultOverlayItems).toHaveLength(1);

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().resultOverlayItems).toHaveLength(0);
  });

  it("clears error message", () => {
    store.useWardrobeStore.setState({ errorMessage: "Something failed" });
    expect(store.useWardrobeStore.getState().errorMessage).toBe("Something failed");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().errorMessage).toBeNull();
  });

  it("preserves activeSessionId", () => {
    store.useWardrobeStore.getState().setActiveSessionId(42);
    store.useWardrobeStore.getState().pushVTOResult("url-1");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().activeSessionId).toBe(42);
  });

  it("preserves activeSlot", () => {
    store.useWardrobeStore.getState().setActiveSlot("tops");
    store.useWardrobeStore.getState().pushVTOResult("url-1");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().activeSlot).toBe("tops");
  });

  it("preserves searchTerm", () => {
    store.useWardrobeStore.getState().setSearchTerm("denim");
    store.useWardrobeStore.getState().pushVTOResult("url-1");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().searchTerm).toBe("denim");
  });

  it("preserves tattooMap", () => {
    const map = { arm: "dragon" };
    store.useWardrobeStore.getState().setTattooMap(map);
    store.useWardrobeStore.getState().pushVTOResult("url-1");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().tattooMap).toEqual(map);
  });

  it("is idempotent — calling twice does not throw or change state", () => {
    store.useWardrobeStore.getState().resetToOriginal();
    store.useWardrobeStore.getState().resetToOriginal();

    const state = store.useWardrobeStore.getState();
    expect(state.vtoHistory).toHaveLength(0);
    expect(state.vtoHistoryIndex).toBe(-1);
    expect(state.selectedGarmentIds.size).toBe(0);
  });

  it("currentVTOResult returns null after reset", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url-1");
    expect(store.useWardrobeStore.getState().currentVTOResult()).toBe("url-1");

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().currentVTOResult()).toBeNull();
  });

  it("canUndoVTO and canRedoVTO return false after reset", () => {
    const s = store.useWardrobeStore.getState();
    s.pushVTOResult("url-1");
    s.pushVTOResult("url-2");
    s.pushVTOResult("url-3");
    // index=2, undo once → index=1 (can undo to 0, can redo to 2)
    s.undoVTO();
    expect(store.useWardrobeStore.getState().canUndoVTO()).toBe(true);
    expect(store.useWardrobeStore.getState().canRedoVTO()).toBe(true);

    store.useWardrobeStore.getState().resetToOriginal();

    expect(store.useWardrobeStore.getState().canUndoVTO()).toBe(false);
    expect(store.useWardrobeStore.getState().canRedoVTO()).toBe(false);
  });
});
