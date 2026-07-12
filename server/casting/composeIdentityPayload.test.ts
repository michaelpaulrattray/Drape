/**
 * composeIdentityPayload — D-30 strategy (b) pure core.
 * Contracts under test: the identity text is buildIdentityAnchor's output
 * VERBATIM (D-12 reproducibility); the anchor is the newest filled headshot
 * (newest-wins, matching computePackageSlots); a missing intent view
 * degrades to headshot-only; the stale-input rule flags unpinned stale
 * intent views and stays silent on pinned ones.
 */
import { describe, it, expect } from "vitest";
import { composeFromAssets, type ComposerAssetRow } from "./composeIdentityPayload";
import { buildIdentityAnchor } from "./geminiClient";

const model = {
  masterPrompt: "A 24-year-old editorial model, angular jawline",
  technicalSchema: { subject: { sex: "female", age: 24 }, facial_features: { jawline: "angular" } },
};

const filled = (viewType: string, url: string, extra: Partial<ComposerAssetRow> = {}): ComposerAssetRow => ({
  viewType,
  storageUrl: url,
  ...extra,
});
const failedMarker = (viewType: string): ComposerAssetRow => ({
  viewType,
  storageUrl: "",
  status: { state: "failed", reason: "gate", refunded: 300 },
});

describe("composeFromAssets — payload shape (strategy b)", () => {
  it("composes headshot + intent view + verbatim identity text", () => {
    const { payload, manifest } = composeFromAssets(
      model,
      [filled("frontClose", "https://r2/head.png"), filled("sideClose", "https://r2/side.png")],
      "sideClose",
    );
    expect(payload.anchorImageUrl).toBe("https://r2/head.png");
    expect(payload.intentImageUrl).toBe("https://r2/side.png");
    expect(payload.identityText).toBe(buildIdentityAnchor(model.masterPrompt, model.technicalSchema));
    expect(manifest.identityText).toBe(payload.identityText);
    expect(manifest.strategy).toBe("headshot+intent+text");
    expect(manifest.inputs).toEqual([
      { viewAngle: "frontClose", imageUrl: "https://r2/head.png" },
      { viewAngle: "sideClose", imageUrl: "https://r2/side.png" },
    ]);
  });

  it("anchors on the NEWEST filled headshot — newest-first order wins over older rows and markers", () => {
    const { payload } = composeFromAssets(
      model,
      [
        failedMarker("frontClose"),
        filled("frontClose", "https://r2/head-v2.png"),
        filled("frontClose", "https://r2/head-v1.png"),
      ],
      "frontClose",
    );
    expect(payload.anchorImageUrl).toBe("https://r2/head-v2.png");
  });

  it("a headshot intent sends ONE image — the anchor is not duplicated", () => {
    const { payload, manifest } = composeFromAssets(model, [filled("frontClose", "https://r2/head.png")], "frontClose");
    expect(payload.intentImageUrl).toBeNull();
    expect(manifest.inputs).toHaveLength(1);
  });

  it("an unfilled intent view degrades gracefully to headshot-only (D-39c)", () => {
    const { payload, manifest, staleInputs } = composeFromAssets(
      model,
      [filled("frontClose", "https://r2/head.png"), failedMarker("backFull")],
      "backFull",
    );
    expect(payload.intentImageUrl).toBeNull();
    expect(manifest.inputs).toEqual([{ viewAngle: "frontClose", imageUrl: "https://r2/head.png" }]);
    expect(staleInputs).toEqual([]);
  });

  it("throws PRECONDITION_FAILED when no filled headshot exists — no identity, no payload", () => {
    expect(() => composeFromAssets(model, [failedMarker("frontClose")], "sideClose")).toThrowError(
      /no headshot/i,
    );
  });

  it("falls back to the masterPrompt-only anchor text when the model has no schema", () => {
    const { payload } = composeFromAssets(
      { masterPrompt: model.masterPrompt },
      [filled("frontClose", "https://r2/head.png")],
      "frontClose",
    );
    expect(payload.identityText).toBe(buildIdentityAnchor(model.masterPrompt, undefined));
  });
});

describe("stale-input rule (D-30)", () => {
  it("flags an unpinned stale intent view for the confirm UI", () => {
    const { staleInputs, payload } = composeFromAssets(
      model,
      [
        filled("frontClose", "https://r2/head.png"),
        filled("sideClose", "https://r2/side.png", { status: { state: "stale" }, pinned: false }),
      ],
      "sideClose",
    );
    expect(staleInputs).toEqual([{ viewAngle: "sideClose", label: "Side profile" }]);
    // Flagged, not blocked — the payload still composes
    expect(payload.intentImageUrl).toBe("https://r2/side.png");
  });

  it("uses a PINNED stale intent view silently — pinned is accepted-final", () => {
    const { staleInputs, payload } = composeFromAssets(
      model,
      [
        filled("frontClose", "https://r2/head.png"),
        filled("sideClose", "https://r2/side.png", { status: { state: "stale" }, pinned: true }),
      ],
      "sideClose",
    );
    expect(staleInputs).toEqual([]);
    expect(payload.intentImageUrl).toBe("https://r2/side.png");
  });

  it("never flags a clean intent view", () => {
    const { staleInputs } = composeFromAssets(
      model,
      [filled("frontClose", "https://r2/head.png"), filled("frontFull", "https://r2/full.png")],
      "frontFull",
    );
    expect(staleInputs).toEqual([]);
  });
});
