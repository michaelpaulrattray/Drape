/**
 * V9 — the placed-draft name-and-mint door (Batch A-safe).
 *
 * The regression: CastModelModal's `addFirst` branch (existing placed draft
 * opened through Edit) rendered NO name input, while `canMint` required a
 * non-empty name — so the "Name & mint" door was permanently disabled with
 * a tooltip pointing at a field that did not exist (audit V9, introduced by
 * the r2 defect-4 fix).
 *
 * These tests render the real component (react-dom/server static markup —
 * no DOM needed) and pin the structural contract: every non-upgrade mode
 * has a usable name field AND both labeled doors; upgrade mode has neither
 * a name field nor a mint door. The full click-through (type a name → the
 * mint door enables) is proven in the SD13 browser drive.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CastModelModal,
  confirmArgsForDoor,
  type TierPlan,
} from "../client/src/features/studio/components/CastModelModal";

const tiers: TierPlan = {
  draft: { missing: [], cost: 0 },
  core: { missing: ["sideClose", "threeQuarter", "frontFull"], cost: 950 },
  production: { missing: ["sideClose", "threeQuarter", "frontFull", "sideFull", "backFull"], cost: 1550 },
};

function render(props: Partial<Parameters<typeof CastModelModal>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(CastModelModal, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      tiers,
      isCasting: false,
      ...props,
    }),
  );
}

describe("V9 — placed-draft Edit (addFirst) has a working name-and-mint door", () => {
  it("renders a name input — the field the old branch structurally lacked", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("<input");
  });

  it("names the field honestly: optional draft label until minted (D-55 stays-draft nickname)", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Name — optional draft label until you mint");
    // …and says which door does what: mint locks, add-views stays a draft
    expect(html).toContain("locks her identity");
    expect(html).toContain("stays a draft");
    // The mint-trigger label belongs to the fresh-cast path only
    expect(html).not.toContain("this mints her identity");
  });

  it("renders BOTH labeled doors: Add views (stays draft) and Name & mint", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Add views");
    expect(html).toContain("Name &amp; mint");
  });

  it("the mint door starts disabled with the name hint — enabled is the drive's job", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Enter a name to mint her identity");
  });
});

describe("fresh cast and upgrade modes keep their shapes", () => {
  it("fresh cast: name field present, mint is the primary door", () => {
    const html = render();
    expect(html).toContain("<input");
    expect(html).toContain("Name &amp; mint");
    expect(html).toContain("Cast this model");
    // On a fresh cast the name field IS the mint trigger — the label says so
    expect(html).toContain("Name — this mints her identity");
  });

  it("upgrade: NO name field (name is fixed), no mint door — only Add views", () => {
    const html = render({ mode: "upgrade", fixedName: "Vera" });
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Name &amp; mint");
    expect(html).toContain("Add views");
    expect(html).toContain("Complete the card");
  });
});

describe("confirmArgsForDoor — what each door actually sends (behavior, not copy)", () => {
  it("mint door: trimmed name, stayDraft false — on both paths", () => {
    for (const addFirst of [true, false]) {
      expect(confirmArgsForDoor("mint", { addFirst, name: "  Vera  ", tier: "core" })).toEqual({
        characterName: "Vera",
        tier: "core",
        stayDraft: false,
      });
    }
  });

  it("FRESH cast Add views: the mint-labeled field's value is NOT harvested as a nickname", () => {
    // The fresh field says "this mints her identity" (founder-ruled wording)
    // — so a typed name must not silently ride the stays-draft door
    expect(confirmArgsForDoor("addViews", { addFirst: false, name: "Vera", tier: "core" })).toEqual({
      characterName: "",
      tier: "core",
      stayDraft: true,
    });
  });

  it("PLACED-DRAFT Add views: the typed name rides as the optional draft label (D-55, copy explains it)", () => {
    expect(confirmArgsForDoor("addViews", { addFirst: true, name: " Vera ", tier: "production" })).toEqual({
      characterName: "Vera",
      tier: "production",
      stayDraft: true,
    });
    // …and no name typed means no nickname sent
    expect(confirmArgsForDoor("addViews", { addFirst: true, name: "   ", tier: "core" }).characterName).toBe("");
  });
});
