/**
 * Model Upload, Lobby State & Tool Availability Tests
 *
 * Tests the extended CanvasState, tool availability logic for uploaded models,
 * the useStudioStore.loadModelFromUpload action, and the null activeTool (lobby) state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getToolAvailability, type CanvasState } from "../client/src/features/studio/types";

// ── Tool Availability with Uploaded Models ──────────────────────

describe("getToolAvailability — uploaded model", () => {
  const uploadedCanvas: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: false,
    modelSource: "uploaded",
    uploadedModelUrl: "https://s3.example.com/model.png",
  };

  it("disables Casting when model is uploaded", () => {
    const result = getToolAvailability("casting", uploadedCanvas);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain("Upload detected");
  });

  it("enables Wardrobe when uploaded model has full body", () => {
    const result = getToolAvailability("wardrobe", uploadedCanvas);
    expect(result.enabled).toBe(true);
    expect(result.tooltip).toBe("Wardrobe Studio");
  });

  it("disables Export for uploaded models (no all views)", () => {
    const result = getToolAvailability("export", uploadedCanvas);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain("Generate all views to unlock export");
  });

  it("disables Export for uploaded models even with all views", () => {
    const uploadedAllViews: CanvasState = {
      ...uploadedCanvas,
      hasAllViews: true,
    };
    const result = getToolAvailability("export", uploadedAllViews);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain("Export requires a cast model");
  });
});

describe("getToolAvailability — cast model", () => {
  const emptyCanvas: CanvasState = {
    hasModel: false,
    hasFullBody: false,
    hasAllViews: false,
    modelSource: null,
    uploadedModelUrl: null,
  };

  const castWithFullBody: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: false,
    modelSource: "cast",
    uploadedModelUrl: null,
  };

  const castWithAllViews: CanvasState = {
    hasModel: true,
    hasFullBody: true,
    hasAllViews: true,
    modelSource: "cast",
    uploadedModelUrl: null,
  };

  it("enables Casting on empty canvas", () => {
    const result = getToolAvailability("casting", emptyCanvas);
    expect(result.enabled).toBe(true);
  });

  it("disables Wardrobe on empty canvas", () => {
    const result = getToolAvailability("wardrobe", emptyCanvas);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain("Load a model first");
  });

  it("disables Wardrobe when no full body", () => {
    const noFullBody: CanvasState = {
      ...emptyCanvas,
      hasModel: true,
      modelSource: "cast",
    };
    const result = getToolAvailability("wardrobe", noFullBody);
    expect(result.enabled).toBe(false);
    expect(result.tooltip).toContain("Generate full body first");
  });

  it("enables Wardrobe when cast model has full body", () => {
    const result = getToolAvailability("wardrobe", castWithFullBody);
    expect(result.enabled).toBe(true);
  });

  it("enables Export when cast model has all views", () => {
    const result = getToolAvailability("export", castWithAllViews);
    expect(result.enabled).toBe(true);
  });

  it("disables Export when not all views", () => {
    const result = getToolAvailability("export", castWithFullBody);
    expect(result.enabled).toBe(false);
  });
});

// ── Studio Store: Lobby State (null activeTool) ────────────────

describe("useStudioStore — lobby state", () => {
  let store: typeof import("../client/src/features/studio/stores/useStudioStore");

  beforeEach(async () => {
    store = await import("../client/src/features/studio/stores/useStudioStore");
    store.useStudioStore.getState().resetStudio();
  });

  it("defaults to null activeTool (lobby state)", () => {
    const state = store.useStudioStore.getState();
    expect(state.activeTool).toBeNull();
  });

  it("setActiveTool transitions from lobby to casting", () => {
    store.useStudioStore.getState().setActiveTool("casting");
    expect(store.useStudioStore.getState().activeTool).toBe("casting");
  });

  it("setActiveTool(null) returns to lobby from any tool", () => {
    store.useStudioStore.getState().setActiveTool("casting");
    expect(store.useStudioStore.getState().activeTool).toBe("casting");

    store.useStudioStore.getState().setActiveTool(null);
    expect(store.useStudioStore.getState().activeTool).toBeNull();
  });

  it("resetStudio returns to lobby", () => {
    store.useStudioStore.getState().setActiveTool("wardrobe");
    store.useStudioStore.getState().resetStudio();
    expect(store.useStudioStore.getState().activeTool).toBeNull();
  });

  it("clearUploadedModel returns to lobby (not casting)", () => {
    store.useStudioStore.getState().loadModelFromUpload("https://example.com/model.png");
    expect(store.useStudioStore.getState().activeTool).toBe("wardrobe");

    store.useStudioStore.getState().clearUploadedModel();
    expect(store.useStudioStore.getState().activeTool).toBeNull();
  });
});

// ── Studio Store: loadModelFromUpload ────────────────────────────

describe("useStudioStore — loadModelFromUpload", () => {
  let store: typeof import("../client/src/features/studio/stores/useStudioStore");

  beforeEach(async () => {
    store = await import("../client/src/features/studio/stores/useStudioStore");
    store.useStudioStore.getState().resetStudio();
  });

  it("sets canvas to uploaded state with correct URL", () => {
    const url = "https://s3.example.com/uploaded-model.png";
    store.useStudioStore.getState().loadModelFromUpload(url);

    const state = store.useStudioStore.getState();
    expect(state.canvas.hasModel).toBe(true);
    expect(state.canvas.hasFullBody).toBe(true);
    expect(state.canvas.hasAllViews).toBe(false);
    expect(state.canvas.modelSource).toBe("uploaded");
    expect(state.canvas.uploadedModelUrl).toBe(url);
  });

  it("switches active tool to wardrobe after upload", () => {
    store.useStudioStore.getState().loadModelFromUpload("https://example.com/model.png");
    expect(store.useStudioStore.getState().activeTool).toBe("wardrobe");
  });

  it("transitions from lobby → wardrobe on upload", () => {
    // Start in lobby
    expect(store.useStudioStore.getState().activeTool).toBeNull();
    store.useStudioStore.getState().loadModelFromUpload("https://example.com/model.png");
    expect(store.useStudioStore.getState().activeTool).toBe("wardrobe");
  });
});

// ── CanvasState uploadedModelUrl field ───────────────────────────

describe("CanvasState — uploadedModelUrl field", () => {
  it("defaults to null in empty canvas", async () => {
    const store = await import("../client/src/features/studio/stores/useStudioStore");
    store.useStudioStore.getState().resetStudio();
    expect(store.useStudioStore.getState().canvas.uploadedModelUrl).toBeNull();
  });

  it("setCanvas can update uploadedModelUrl independently", async () => {
    const store = await import("../client/src/features/studio/stores/useStudioStore");
    store.useStudioStore.getState().resetStudio();
    store.useStudioStore.getState().setCanvas({ uploadedModelUrl: "https://test.com/img.png" });
    expect(store.useStudioStore.getState().canvas.uploadedModelUrl).toBe("https://test.com/img.png");
  });
});
