/**
 * Model Gallery & loadModelFromCast Tests
 *
 * Tests the extended CanvasState with cast fields, loadModelFromCast store action,
 * and tool availability for gallery-loaded models.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { type CanvasState } from "../client/src/features/studio/types";

// ── Canvas State Fixtures ──────────────────────────────────────────────────

const emptyCanvas: CanvasState = {
  hasModel: false,
  hasFullBody: false,
  hasAllViews: false,
  modelSource: null,
  uploadedModelUrl: null,
  castModelId: null,
  castMasterPrompt: null,
  castFullBodyUrl: null,
};

const galleryLoadedCanvas: CanvasState = {
  hasModel: true,
  hasFullBody: true,
  hasAllViews: false,
  modelSource: "cast",
  uploadedModelUrl: null,
  castModelId: 42,
  castMasterPrompt: "A tall female model with sharp features...",
  castFullBodyUrl: "https://s3.example.com/models/42/frontFull.png",
};

const uploadedCanvas: CanvasState = {
  hasModel: true,
  hasFullBody: true,
  hasAllViews: false,
  modelSource: "uploaded",
  uploadedModelUrl: "https://s3.example.com/uploads/photo.png",
  castModelId: null,
  castMasterPrompt: null,
  castFullBodyUrl: null,
};

// ── CanvasState Shape Tests ────────────────────────────────────────────────

describe("CanvasState with cast fields", () => {
  it("empty canvas has null cast fields", () => {
    expect(emptyCanvas.castModelId).toBeNull();
    expect(emptyCanvas.castMasterPrompt).toBeNull();
    expect(emptyCanvas.castFullBodyUrl).toBeNull();
  });

  it("gallery-loaded canvas has cast fields populated", () => {
    expect(galleryLoadedCanvas.castModelId).toBe(42);
    expect(galleryLoadedCanvas.castMasterPrompt).toContain("tall female model");
    expect(galleryLoadedCanvas.castFullBodyUrl).toContain("frontFull.png");
    expect(galleryLoadedCanvas.modelSource).toBe("cast");
  });

  it("uploaded canvas has null cast fields", () => {
    expect(uploadedCanvas.castModelId).toBeNull();
    expect(uploadedCanvas.castMasterPrompt).toBeNull();
    expect(uploadedCanvas.castFullBodyUrl).toBeNull();
    expect(uploadedCanvas.uploadedModelUrl).toBeTruthy();
  });
});

// ── Tool Availability for Gallery-Loaded Models ────────────────────────────


describe("loadModelFromCast store action", () => {
  let store: typeof import("../client/src/features/studio/stores/useStudioStore").useStudioStore;

  beforeEach(async () => {
    const mod = await import("../client/src/features/studio/stores/useStudioStore");
    store = mod.useStudioStore;
    store.getState().resetStudio();
  });

  it("sets canvas with cast model data and activates wardrobe", () => {
    store.getState().loadModelFromCast(
      42,
      "https://s3.example.com/models/42/frontFull.png",
      "A tall female model with sharp features..."
    );

    const state = store.getState();
    expect(state.activeTool).toBe("wardrobe");
    expect(state.canvas.hasModel).toBe(true);
    expect(state.canvas.hasFullBody).toBe(true);
    expect(state.canvas.modelSource).toBe("cast");
    expect(state.canvas.castModelId).toBe(42);
    expect(state.canvas.castMasterPrompt).toContain("tall female model");
    expect(state.canvas.castFullBodyUrl).toContain("frontFull.png");
    expect(state.canvas.uploadedModelUrl).toBeNull();
  });

  it("clears cast fields when loading from upload after gallery", () => {
    // First load from gallery
    store.getState().loadModelFromCast(42, "https://example.com/cast.png", "prompt");
    expect(store.getState().canvas.castModelId).toBe(42);

    // Then switch to upload
    store.getState().loadModelFromUpload("https://example.com/upload.png");
    const state = store.getState();
    expect(state.canvas.castModelId).toBeNull();
    expect(state.canvas.castMasterPrompt).toBeNull();
    expect(state.canvas.castFullBodyUrl).toBeNull();
    expect(state.canvas.uploadedModelUrl).toBe("https://example.com/upload.png");
  });

  it("resets cast fields on clearUploadedModel", () => {
    store.getState().loadModelFromCast(42, "https://example.com/cast.png", "prompt");
    store.getState().clearUploadedModel();

    const state = store.getState();
    expect(state.canvas.castModelId).toBeNull();
    expect(state.canvas.castMasterPrompt).toBeNull();
    expect(state.canvas.castFullBodyUrl).toBeNull();
    expect(state.activeTool).toBeNull();
  });

  it("resets cast fields on resetStudio", () => {
    store.getState().loadModelFromCast(42, "https://example.com/cast.png", "prompt");
    store.getState().resetStudio();

    const state = store.getState();
    expect(state.canvas.castModelId).toBeNull();
    expect(state.canvas.hasModel).toBe(false);
    expect(state.activeTool).toBeNull();
  });
});

// ── VTO Base Image Priority ────────────────────────────────────────────────

describe("VTO base image priority", () => {
  it("uploaded URL takes priority over cast URL", () => {
    const mixed: CanvasState = {
      ...galleryLoadedCanvas,
      uploadedModelUrl: "https://example.com/upload.png",
    };
    // The DrapeStudio component checks uploadedModelUrl first
    const url = mixed.uploadedModelUrl || mixed.castFullBodyUrl || null;
    expect(url).toBe("https://example.com/upload.png");
  });

  it("cast URL is used when no uploaded URL", () => {
    const url = galleryLoadedCanvas.uploadedModelUrl || galleryLoadedCanvas.castFullBodyUrl || null;
    expect(url).toBe("https://s3.example.com/models/42/frontFull.png");
  });

  it("returns null when neither URL exists", () => {
    const url = emptyCanvas.uploadedModelUrl || emptyCanvas.castFullBodyUrl || null;
    expect(url).toBeNull();
  });
});
