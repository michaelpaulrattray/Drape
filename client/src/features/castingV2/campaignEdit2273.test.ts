import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";
import {
  campaignDeleteBody,
  campaignNameReady,
  chipAfterCampaignGone,
  type RosterChip,
} from "./rosterChips";
import { CampaignMenu, campaignMenuItems } from "./components/CampaignMenu";

/**
 * RENAME AND DELETE A CAMPAIGN — card #2273 (rung N2c).
 *
 * The server doors (`castingV2.renameCampaign` / `deleteCampaign`) are driven
 * owner-scoped in `server/castCampaignsRoute.test.ts`; what was missing was any
 * way into them from the app. These pin the rules the library page now keeps
 * when it calls them, driven directly; the frames on the PR show the menu and
 * both dialogs, and the drive there renamed and deleted a real campaign.
 */

const SUMMER = { campaignId: "a".repeat(32), name: "Summer" };
const AUTUMN = { campaignId: "b".repeat(32), name: "Autumn" };

describe("deleting the campaign on screen returns the library to All", () => {
  it("the campaign on screen is deleted — the library goes to All", () => {
    const chip: RosterChip = { kind: "campaign", campaignId: SUMMER.campaignId };
    expect(chipAfterCampaignGone(chip, [AUTUMN])).toEqual({ kind: "all" });
  });

  it("the LAST campaign goes while Unfiled is chosen — All, because Unfiled is hidden with none", () => {
    expect(chipAfterCampaignGone({ kind: "unfiled" }, [])).toEqual({ kind: "all" });
  });

  it("negative control — another campaign is deleted, and the chip on screen does not move", () => {
    const chip: RosterChip = { kind: "campaign", campaignId: AUTUMN.campaignId };
    expect(chipAfterCampaignGone(chip, [AUTUMN])).toBe(chip);
    const unfiled: RosterChip = { kind: "unfiled" };
    expect(chipAfterCampaignGone(unfiled, [AUTUMN])).toBe(unfiled);
    const all: RosterChip = { kind: "all" };
    expect(chipAfterCampaignGone(all, [])).toBe(all);
  });
});

describe("delete asks once, and says the casts stay", () => {
  it("names the campaign and says its cast members stay in the library", () => {
    const body = campaignDeleteBody("Summer", 3);
    expect(body).toContain("“Summer”");
    expect(body).toContain("The 3 cast members in it stay in your library");
    expect(body).toContain("Only the campaign goes.");
  });

  it("one cast member is singular; an empty campaign says only the campaign goes", () => {
    expect(campaignDeleteBody("Summer", 1)).toContain("The 1 cast member in it stays in your library");
    expect(campaignDeleteBody("Summer", 0)).toBe("“Summer” is empty, so only the campaign goes.");
  });
});

describe("the rename box saves only a real new name", () => {
  it("positive — a different name is ready", () => {
    expect(campaignNameReady("Summer refill", "Summer")).toBe(true);
    expect(campaignNameReady("Summer")).toBe(true);
  });

  it("negative — blank, or the same name with spaces around it, is not", () => {
    expect(campaignNameReady("   ", "Summer")).toBe(false);
    expect(campaignNameReady("  Summer ", "Summer")).toBe(false);
    expect(campaignNameReady("")).toBe(false);
  });
});

describe("the campaign's ⋯ holds exactly rename and delete", () => {
  it("rename first, delete last and marked as the dangerous one; each calls its own act", () => {
    const rename = vi.fn();
    const remove = vi.fn();
    const items = campaignMenuItems(rename, remove);
    expect(items.map((item) => [item.label, item.danger === true])).toEqual([
      ["Rename campaign", false],
      ["Delete campaign", true],
    ]);
    items[0]!.onSelect();
    expect(rename).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    items[1]!.onSelect();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("renders as the row-placed menu, named for the campaign, closed at rest", () => {
    const html = renderToStaticMarkup(
      createElement(CampaignMenu, { name: "Summer", onRename: () => {}, onDelete: () => {} }),
    );
    expect(html).toContain("dpc-cardmenu--row");
    expect(html).toContain('aria-label="Actions for the campaign “Summer”"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
  });
});

describe("the library page actually calls the doors (the card's defect: nothing did)", () => {
  it("rename and delete are wired, the ⋯ shows only for the campaign on screen, and delete moves the chip first", async () => {
    const page = withoutComments(await readFile(new URL("../../pages/CastingV2.tsx", import.meta.url), "utf8"));
    expect(page).toContain("trpc.castingV2.renameCampaign.useMutation()");
    expect(page).toContain("trpc.castingV2.deleteCampaign.useMutation()");
    expect(page).toContain("renameCampaign.mutateAsync({ campaignId: campaign.campaignId, name })");
    expect(page).toContain("deleteCampaign.mutateAsync({ campaignId: campaign.campaignId })");
    expect(page).toContain("currentName={renamingCampaign.name}");
    expect(page).toContain("body={campaignDeleteBody(deletingCampaign.name, deletingCampaign.castCount)}");
    expect(page).toContain('const onScreenCampaign = chip.kind === "campaign"');
    expect(page).toContain("{onScreenCampaign ? (");
    /* The chip moves to All BEFORE the lists are re-read. */
    const body = page.slice(page.indexOf("const confirmCampaignDelete"), page.indexOf("const fileSelection"));
    expect(body.indexOf("chooseChip(next)")).toBeGreaterThan(-1);
    expect(body.indexOf("chooseChip(next)")).toBeLessThan(body.lastIndexOf("await invalidateLibrary()"));
  });
});
