import { describe, expect, it } from "vitest";

import { selectPackAssets } from "./characterSheetPack";

/**
 * Choosing what goes in the sheet.
 *
 * These drive the REAL provenance shape a signed Cast carries, because the one
 * bug this module has had was invisible to every test that did not: the reader
 * looked for `role` where the column holds `identityRole`, the anchor silently
 * fell out of the pack, and the composer's eleven unit tests all passed because
 * they build cells directly and never come through here.
 *
 * Caught by composing a real Cast and counting — six assets in, five cells out.
 */

const asset = (over: Record<string, unknown>) => ({
  id: 1, modelId: 42, viewType: "frontClose", resolution: "2K",
  storageKey: "k.png", storageUrl: "u", pointsCost: 50, pinned: false,
  status: null, provenance: {}, createdAt: new Date(), ...over,
}) as never;

describe("what goes into the pack", () => {
  it("finds the anchor by the key the column actually uses", () => {
    const pack = selectPackAssets([
      // The real shape: `identityStampFor({ role })` writes `identityRole`.
      asset({ id: 1, resolution: "1K", pointsCost: 0, provenance: { identityRole: "anchor" } }),
      asset({ id: 2, viewType: "closeUp", provenance: { identityRole: "display" } }),
    ]);
    expect(pack).toHaveLength(2);
    expect((pack[0].provenance as { identityRole: string }).identityRole).toBe("anchor");
  });

  /*
    The anchor and the Portrait SHARE `frontClose` — the free 1K signed face and
    the paid 2K view. Telling them apart by resolution would be reading a
    coincidence; the stamp is what distinguishes them, and both must survive.
  */
  it("keeps both the anchor and the view that shares its angle", () => {
    const pack = selectPackAssets([
      asset({ id: 1, resolution: "1K", pointsCost: 0, provenance: { identityRole: "anchor" } }),
      asset({ id: 2, resolution: "2K", provenance: { identityRole: "display" } }),
    ]);
    expect(pack).toHaveLength(2);
  });

  it("keeps only the newest asset per slot, so a revision supersedes", () => {
    // `listCastAssets` returns newest first.
    const pack = selectPackAssets([
      asset({ id: 9, viewType: "backFull", storageKey: "new.png", provenance: { identityRole: "display" } }),
      asset({ id: 2, viewType: "backFull", storageKey: "old.png", provenance: { identityRole: "display" } }),
    ]);
    expect(pack).toHaveLength(1);
    expect(pack[0].storageKey).toBe("new.png");
  });

  it("survives an asset with no provenance at all", () => {
    const pack = selectPackAssets([asset({ provenance: null })]);
    expect(pack).toHaveLength(1);
  });
});
