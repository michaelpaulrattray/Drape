/**
 * Model Upload, Lobby State & Tool Availability Tests
 *
 * Tests the extended CanvasState, tool availability logic for uploaded models,
 * the useStudioStore.loadModelFromUpload action, and the null activeTool (lobby) state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { type CanvasState } from "../client/src/features/studio/types";

// ── Tool Availability with Uploaded Models ──────────────────────


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
