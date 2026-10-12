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
      selection.selectionViewKey(summer, ""),
      selection.selectionViewKey(autumn, ""),
      selection.selectionViewKey(all, "a"),
      selection.selectionViewKey(all, "an"),
    ]);
    expect(keys.size).toBe(5);
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
    expect(selection.filedSentence(8, 8, "Summer drop")).toBe("8 characters added to “Summer drop”.");
    expect(selection.filedSentence(1, 1, "Summer drop")).toBe("1 character added to “Summer drop”.");
    expect(selection.filedSentence(5, 8, "Summer drop")).toBe(
      "5 characters added to “Summer drop”. 3 were already in it.",
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
      "3 characters taken out of “Summer drop”.",
      "2 characters taken out of “Summer drop”. 1 wasn't in it.",
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

/* ------------------- #2275 · a run that stops half way says what it did */

describe("a stopped run of slices reports what landed, not what was meant to land (card 2275)", () => {
  /*
    ⚠ THE DEFECT: the page ran the slices in a bare `try` and reported from the
    `catch`, so a selection over 60 whose SECOND call was refused told the
    customer "Those casts couldn't be added" while the first 60 sat filed, and
    left all of them ticked. The door is all-or-nothing at its refusal
    (`server/db/castCampaigns.ts`), so the refused slice filed nothing and
    belongs with the untried rest.

    Driven through `runInBatches` with the call as a function — no React, no
    server, no network — which is the only way an arm reaches the second slice.
  */
  const sixtyThree = Array.from({ length: 63 }, (_, index) => `KI-${index}`);

  function refuseAfter(callsToAllow: number, added: (batch: string[]) => number) {
    const seen: string[][] = [];
    const call = async (batch: string[]) => {
      seen.push(batch);
      if (seen.length > callsToAllow) throw Object.assign(new Error("Cast not found"), { data: { code: "NOT_FOUND" } });
      return added(batch);
    };
    return { call, seen };
  }

  it("the second call refused: 60 answered for, 3 unreached, and the error handed back", async () => {
    const { call, seen } = refuseAfter(1, (batch) => batch.length);
    const run = await selection.runInBatches(sixtyThree, call);
    expect(seen.map((batch) => batch.length)).toEqual([60, 3]);
    expect(run.moved).toBe(60);
    /* ⚠ 60 out of 60, never out of 63 — `answered` is what `moved` is a count
       OF, and getting that wrong is how the sentence overstates. */
    expect(run.answered).toBe(60);
    expect(run.unreached).toEqual(sixtyThree.slice(60));
    expect(run.error).toBeDefined();
  });

  it("the FIRST call refused keeps the whole selection and nothing is claimed", async () => {
    const { call } = refuseAfter(0, (batch) => batch.length);
    const run = await selection.runInBatches(sixtyThree, call);
    expect(run.moved).toBe(0);
    expect(run.answered).toBe(0);
    expect(run.unreached).toEqual(sixtyThree);
  });

  it("nothing refused is an unreached list of none (the negative control)", async () => {
    const { call, seen } = refuseAfter(99, (batch) => batch.length);
    const run = await selection.runInBatches(sixtyThree, call);
    expect(seen).toHaveLength(2);
    expect(run).toEqual({ moved: 63, answered: 63, unreached: [] });
  });

  it("the server's count is summed, not the number ticked", async () => {
    /* Half of each slice was already in the campaign, so `moved` is 31 and the
       sentence must not say 63. */
    const { call } = refuseAfter(99, (batch) => Math.floor(batch.length / 2));
    const run = await selection.runInBatches(sixtyThree, call);
    expect(run.moved).toBe(31);
    expect(run.answered).toBe(63);
  });

  it("the honest sentence names both halves, and the remainder's fate", () => {
    const landed = selection.filedSentence(60, 60, "Summer drop");
    expect(`${landed} ${selection.unreachedSentence(3, "add")}`).toBe(
      "60 characters added to “Summer drop”. 3 couldn't be added. They're still selected, so you can try again.",
    );
    expect(selection.unreachedSentence(1, "add")).toBe(
      "1 couldn't be added. It's still selected, so you can try again.",
    );
    /* Taking casts out never says "removed" on its own — the module's own rule. */
    expect(selection.unreachedSentence(2, "remove")).toBe(
      "2 couldn't be taken out. They're still selected, so you can try again.",
    );
    expect(selection.unreachedSentence(2, "remove")).not.toContain("deleted");
  });

  it("the page says the landed half out of what was ANSWERED FOR, and re-ticks the unreached", () => {
    /*
      ⚠ The two facts no pure arm above can reach, read off the page's own
      source: which count the sentence is built from, and that the selection is
      replaced by `run.unreached` rather than cleared. Reading the wrong one
      would pass every arm above and still lie to the customer.
    */
    const stopped = PAGE.slice(PAGE.indexOf("if (run.error !== undefined) {"), PAGE.indexOf("clearPicks();\n    toast("));
    expect(stopped).toContain("setPicks({ view: viewKey, ids: new Set(run.unreached) });");
    expect(stopped).toContain("filedSentence(run.moved, run.answered, campaign.name)");
    expect(stopped).toContain("unfiledSentence(run.moved, run.answered, campaign.name)");
    expect(stopped).toContain("unreachedSentence(run.unreached.length, action)");
    /* And it never reports the stopped run out of the number ticked. */
    expect(stopped).not.toContain("castIds.length");
    /* The counts are refreshed before either sentence, on both roads. */
    const whole = PAGE.slice(PAGE.indexOf("const fileSelection ="), PAGE.indexOf("if (config.isLoading)"));
    expect(whole.indexOf("await invalidateLibrary();")).toBeLessThan(whole.indexOf("if (run.error !== undefined)"));
    expect(whole.match(/await invalidateLibrary\(\);/g) ?? []).toHaveLength(1);
  });
});
