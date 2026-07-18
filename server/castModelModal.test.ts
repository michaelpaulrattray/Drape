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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CastModelModal,
  confirmArgsForDoor,
  draftNameToPersist,
  hasCompleteMintPackage,
  initialMintName,
  mintTierForPlan,
  type TierPlan,
} from "../client/src/features/studio/components/CastModelModal";

const tiers: TierPlan = {
  draft: { missing: [], cost: 0 },
  core: { missing: ["sideClose", "threeQuarter", "frontFull"], cost: 950 },
  production: { missing: ["sideClose", "threeQuarter", "frontFull", "sideFull", "backFull"], cost: 1550 },
};

const completeTiers: TierPlan = {
  draft: { missing: [], cost: 700 },
  core: { missing: [], cost: 900 },
  production: { missing: [], cost: 1_500 },
};

const modalSource = readFileSync(
  join(process.cwd(), "client/src/features/studio/components/CastModelModal.tsx"),
  "utf8",
);
const takeoverSource = readFileSync(
  join(process.cwd(), "client/src/features/studio/takeover/CastingTakeover.tsx"),
  "utf8",
);
const studioSource = readFileSync(
  join(process.cwd(), "client/src/pages/DrapeStudio.tsx"),
  "utf8",
);

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

  it("names the field honestly as a saved draft label until minted", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Name — saved as this model&#x27;s draft label until you mint");
    // …and says which door does what: mint locks, add-views stays a draft
    expect(html).toContain("locks its identity");
    expect(html).toContain("stays a draft");
  });

  it("renders BOTH labeled doors: Add views (stays draft) and Name & mint", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Add views");
    expect(html).toContain("Name &amp; mint");
  });

  it("the mint door starts disabled with the name hint — enabled is the drive's job", () => {
    const html = render({ existingDraft: true });
    expect(html).toContain("Enter a name to mint this model&#x27;s identity");
  });

  it("prefills the stored honest draft nickname and rejects the auto-name sentinel", () => {
    expect(initialMintName("  Chelsea  ")).toBe("Chelsea");
    expect(initialMintName("Draft Model")).toBe("");
    expect(render({ existingDraft: true, initialName: "Chelsea" })).toContain('value="Chelsea"');
    expect(render({ existingDraft: true, initialName: "Draft Model" })).toContain('value=""');
  });
});

describe("fresh cast and upgrade modes keep their shapes", () => {
  it("fresh cast: name field present, mint is the primary door", () => {
    const html = render();
    expect(html).toContain("<input");
    expect(html).toContain("Name &amp; mint");
    expect(html).toContain("Cast this model");
    expect(html).toContain("Name — saved as this model&#x27;s draft label until you mint");
  });

  it("upgrade: NO name field (name is fixed), no mint door — only Add views", () => {
    const html = render({ mode: "upgrade", fixedName: "Vera" });
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Name &amp; mint");
    expect(html).toContain("Add views");
    expect(html).toContain("Complete the card");
  });
});

describe("W6-B complete package collapses to one honest mint door", () => {
  it("uses missing-slot truth rather than price to decide completeness", () => {
    expect(hasCompleteMintPackage(completeTiers)).toBe(true);
    expect(hasCompleteMintPackage({
      draft: { missing: [], cost: 0 },
      core: { missing: ["sideClose"], cost: 0 },
      production: { missing: [], cost: 0 },
    })).toBe(false);
  });

  it("uses the production tier for a completed package", () => {
    expect(mintTierForPlan(completeTiers, "core")).toBe("production");
    expect(mintTierForPlan(tiers, "core")).toBe("core");
  });

  it("hides the redundant tier and add-views choices while preserving naming and minting", () => {
    const html = render({ tiers: completeTiers, existingDraft: true, initialName: "Haniel" });
    expect(html).toContain("Ready to mint — all six views are complete. No new views to generate.");
    expect(html).toContain('value="Haniel"');
    expect(html).toContain("Name &amp; mint");
    expect(html).not.toContain("Core identity");
    expect(html).not.toContain("Full comp card");
    expect(html).not.toContain(">Add views<");
  });

  it("keeps the production integrity refusal and repair door in the collapsed state", () => {
    const ok = {
      anchor: { ok: true },
      displayHeadshot: { ok: true },
      tierViews: [],
      ok: true,
    };
    const html = render({
      tiers: completeTiers,
      initialName: "Haniel",
      onResolvePackage: () => {},
      integrity: {
        draft: ok,
        core: ok,
        production: {
          ...ok,
          anchor: { ok: false, message: "Headshot anchor needs review" },
          ok: false,
        },
      },
    });
    expect(html).toContain("Headshot anchor needs review");
    expect(html).toContain("Review and refresh views");
    expect(html).toContain('title="Headshot anchor needs review"');
    expect(html).toContain("Name &amp; mint");
  });
});

describe("W3 mint blockers route into Package health", () => {
  it("adds a working review-and-refresh door when integrity blocks minting", () => {
    const failedIntegrity = {
      draft: {
        anchor: { ok: true },
        displayHeadshot: { ok: true },
        tierViews: [{ angle: "sideClose", label: "Side profile", present: true, ok: false, message: "Side profile is out of sync" }],
        ok: false,
      },
      core: {
        anchor: { ok: true },
        displayHeadshot: { ok: true },
        tierViews: [{ angle: "sideClose", label: "Side profile", present: true, ok: false, message: "Side profile is out of sync" }],
        ok: false,
      },
      production: {
        anchor: { ok: true },
        displayHeadshot: { ok: true },
        tierViews: [{ angle: "sideClose", label: "Side profile", present: true, ok: false, message: "Side profile is out of sync" }],
        ok: false,
      },
    };
    const html = render({ integrity: failedIntegrity, onResolvePackage: () => {} });
    expect(html).toContain("Review and refresh views");
  });
});

describe("W5-F truthful background-view copy", () => {
  it("does not claim views are generating while a zero-view mint only saves identity", () => {
    const html = render({
      isCasting: true,
      castingMessage: "Saving identity...",
      viewsGenerating: false,
    });
    expect(html).toContain("Saving identity...");
    expect(html).not.toContain("These views will continue generating");
  });

  it("shows the continuation guidance when the server plan has missing views", () => {
    const html = render({
      isCasting: true,
      castingMessage: "Casting 3 views...",
      viewsGenerating: true,
    });
    expect(html).toContain("These views will continue generating");
  });
});

describe("W6-C draft-name persistence", () => {
  it("trims non-empty changes and ignores empty or already-saved labels", () => {
    expect(draftNameToPersist("  Haniel  ", "Draft Model")).toBe("Haniel");
    expect(draftNameToPersist(" Haniel ", "Haniel")).toBeNull();
    expect(draftNameToPersist("   ", "Haniel")).toBeNull();
  });

  it("carries the typed label through Keep editing, scrim, and Escape dismissals", () => {
    expect(modalSource).toContain("onClose: (typedName: string) => void");
    expect(modalSource.match(/onClick=\{requestClose\}/g)).toHaveLength(3);
    expect(modalSource).toContain("if (event.target === event.currentTarget) requestClose()");
    expect(modalSource).toContain("window.addEventListener('keydown', handleEscape, true)");
  });

  it("both hosts persist through the display-only route and surface failures", () => {
    for (const source of [takeoverSource, studioSource]) {
      expect(source).toContain("trpc.models.update.useMutation()");
      expect(source).toContain("setModelName(nextName)");
      expect(source).toContain("utils.models.get.invalidate({ modelId: currentModelId })");
      expect(source).toContain("utils.boardOps.listCastableModels.invalidate()");
      expect(source).toContain("Couldn't save the name — it will not be remembered");
      expect(source).toContain("onClose={dismissCastModal}");
    }
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

  it("FRESH cast Add views: the explicit draft label rides the stays-draft door", () => {
    expect(confirmArgsForDoor("addViews", { addFirst: false, name: "Vera", tier: "core" })).toEqual({
      characterName: "Vera",
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
