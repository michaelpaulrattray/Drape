import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/*
  PICK SEVERAL CASTS AND FILE THEM IN ONE GO — card #2251, rung N2c (his Desk
  reply #273, verbatim and entire: "N2c — Campaigns").

  The rules are driven through the functions the page calls; the two
  components are driven through React's own renderer, so what is asserted is
  what the browser draws. The page's wiring — that the tick sits beside the
  tile rather than inside it, and that the selection is keyed on the box's own
  text — is read off the page's source, and was also driven in the running
  app (frames on the PR): a tick left the address unchanged, and a chip change
  or a keystroke in the search box took the bar away.
*/

const selection = await import("./castSelection");
const { CastPickBox } = await import("./components/CastPickBox");
const { CastSelectionBar } = await import("./components/CastSelectionBar");
const { CAMPAIGN_CASTS_PER_CALL_MAX } = await import("../../../../server/db/castCampaigns");

const PAGE = readFileSync(new URL("../../pages/CastingV2.tsx", import.meta.url), "utf8");

const SUMMER = { campaignId: "a".repeat(32), name: "Summer drop", castCount: 3 };
const AUTUMN = { campaignId: "b".repeat(32), name: "Autumn lookbook", castCount: 0 };

function bar(props: Partial<Parameters<typeof CastSelectionBar>[0]> = {}): string {
  return renderToStaticMarkup(createElement(CastSelectionBar, {
    count: 3,
    campaigns: [SUMMER, AUTUMN],
    busy: false,
    onAdd: () => {},
    onRemove: () => {},
    onNewCampaign: () => {},
    onClear: () => {},
    ...props,
  }));
}

describe("a batch the server would refuse is never sent", () => {
  it("the client's slice is the server's own most per call", () => {
    expect(selection.CAMPAIGN_CASTS_PER_CALL).toBe(CAMPAIGN_CASTS_PER_CALL_MAX);
  });

  it("125 ticked casts go as 60, 60 and 5, every one of them, none twice", () => {
    const ids = Array.from({ length: 125 }, (_, index) => `KI-${index}`);
    const batches = selection.castIdBatches(ids);
    expect(batches.map((batch) => batch.length)).toEqual([60, 60, 5]);
    expect(batches.flat()).toEqual(ids);
  });

  it("a selection that fits one call is one call (the negative control)", () => {
    expect(selection.castIdBatches(["KI-1", "KI-2"])).toEqual([["KI-1", "KI-2"]]);
    expect(selection.castIdBatches([])).toEqual([]);
  });
});

describe("a selection belongs to the view it was made in", () => {
  const all = { kind: "all" } as const;
  const summer = { kind: "campaign", campaignId: SUMMER.campaignId } as const;
  const autumn = { kind: "campaign", campaignId: AUTUMN.campaignId } as const;

  it("a different chip, a different campaign, or different search text is a different view", () => {
    const keys = new Set([
      selection.selectionViewKey(all, ""),
      selection.selectionViewKey({ kind: "unfiled" }, ""),
      selection.selectionViewKey(summer, ""),
      selection.selectionViewKey(autumn, ""),
      selection.selectionViewKey(all, "a"),
      selection.selectionViewKey(all, "an"),
    ]);
    expect(keys.size).toBe(6);
  });

  it("the same chip and the same text is the same view (the positive control)", () => {
    expect(selection.selectionViewKey(summer, "zel")).toBe(
      selection.selectionViewKey({ kind: "campaign", campaignId: SUMMER.campaignId }, "zel"),
    );
  });

  it("the page keys it on the search BOX's text, so it clears on the keystroke", () => {
    expect(PAGE).toContain("const viewKey = selectionViewKey(chip, search);");
    expect(PAGE).toContain("const pickedIds = picks.view === viewKey ? picks.ids : EMPTY_PICKS;");
  });
});

describe("only a cast still on screen counts", () => {
  it("a ticked cast the grid no longer draws drops out, and the grid's order is kept", () => {
    const ticked = new Set(["KI-3", "KI-gone", "KI-1"]);
    const shown = [{ castId: "KI-1" }, { castId: "KI-2" }, { castId: "KI-3" }];
    expect(selection.pickedInView(ticked, shown)).toEqual(["KI-1", "KI-3"]);
  });

  it("a tick toggles, and leaves the set it was given alone", () => {
    const before = new Set(["KI-1"]);
    const after = selection.togglePick(before, "KI-2");
    expect([...after].sort()).toEqual(["KI-1", "KI-2"]);
    expect([...selection.togglePick(after, "KI-1")]).toEqual(["KI-2"]);
    expect([...before]).toEqual(["KI-1"]);
  });
});

describe("what the bar says afterwards is the server's count, not the number ticked", () => {
  it("filing", () => {
    expect(selection.filedSentence(8, 8, "Summer drop")).toBe("8 cast members added to “Summer drop”.");
    expect(selection.filedSentence(1, 1, "Summer drop")).toBe("1 cast member added to “Summer drop”.");
    expect(selection.filedSentence(5, 8, "Summer drop")).toBe(
      "5 cast members added to “Summer drop”. 3 were already in it.",
    );
    expect(selection.filedSentence(0, 4, "Summer drop")).toBe("All 4 are already in “Summer drop”.");
    expect(selection.filedSentence(0, 1, "Summer drop")).toBe("Already in “Summer drop”.");
  });

  it("taking out — never a word that says a cast was deleted", () => {
    const lines = [
      selection.unfiledSentence(3, 3, "Summer drop"),
      selection.unfiledSentence(2, 3, "Summer drop"),
      selection.unfiledSentence(0, 3, "Summer drop"),
      selection.unfiledSentence(0, 1, "Summer drop"),
    ];
    expect(lines).toEqual([
      "3 cast members taken out of “Summer drop”.",
      "2 cast members taken out of “Summer drop”. 1 wasn't in it.",
      "None of them are in “Summer drop”.",
      "Not in “Summer drop”.",
    ]);
    for (const line of lines) expect(line).not.toMatch(/delet/i);
  });
});

describe("the tick on a tile", () => {
  it("is a real checkbox, named for the cast, and says whether it is ticked", () => {
    const off = renderToStaticMarkup(createElement(CastPickBox, { name: "Zelda", checked: false, onToggle: () => {} }));
    const on = renderToStaticMarkup(createElement(CastPickBox, { name: "Zelda", checked: true, onToggle: () => {} }));
    expect(off).toContain('type="checkbox"');
    expect(off).toContain('aria-label="Select Zelda"');
    expect(off).not.toContain("checked");
    expect(on).toContain('checked=""');
  });

  it("sits BESIDE the tile's button, never inside it — a tick must not open the cast", () => {
    const tileStart = PAGE.indexOf('className="dpc-castcard"');
    expect(tileStart).toBeGreaterThan(-1);
    const tileEnd = PAGE.indexOf("</button>", tileStart);
    const pick = PAGE.indexOf("<CastPickBox", tileStart);
    const menu = PAGE.indexOf('<span className="dpc-castmenu">', tileStart);
    expect(pick).toBeGreaterThan(tileEnd);
    expect(pick).toBeLessThan(menu);
    /* And the tile still navigates on its own click, unchanged. */
    expect(PAGE.slice(tileStart, tileEnd)).toContain("onClick={() => navigate(`/app/casting/cast/${cast.castId}`)}");
  });
});

describe("the selection bar", () => {
  it("offers Add to… and Remove from… over the customer's campaigns, with a way to let go", () => {
    const html = bar();
    expect(html).toContain("3 selected");
    expect(html).toContain("Add to…");
    expect(html).toContain("Remove from…");
    expect(html).toContain('aria-label="Clear selection"');
  });

  it("with no campaign yet, Remove from… is absent rather than disabled", () => {
    const html = bar({ campaigns: [] });
    expect(html).toContain("Add to…");
    expect(html).not.toContain("Remove from…");
  });

  it("while a filing is in flight, nothing can be sent twice", () => {
    const html = bar({ busy: true });
    expect(html).toContain("Saving…");
    expect(html).not.toContain("Add to…");
    expect(html).not.toContain("Remove from…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Clear selection"|<button[^>]*aria-label="Clear selection"[^>]*disabled=""/);
  });

  it("the choosers are the foundation's picker, not a third menu", () => {
    const html = bar();
    expect(html.match(/aria-haspopup="listbox"/g) ?? []).toHaveLength(2);
    expect(html).not.toContain('aria-haspopup="menu"');
  });
});
