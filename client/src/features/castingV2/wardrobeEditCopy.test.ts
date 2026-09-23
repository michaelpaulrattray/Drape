import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE ASK BOX SAYS ONE THING ABOUT CLOTHES AGAIN — and the cell that went was
 * the one that had never been shown (#203 slice 2 step c).
 *
 * # What this file used to guard, and why the answer inverted
 *
 * `RefinePanel`'s meta line is capability disclosure: it says what the box can
 * do BEFORE somebody types something it cannot. From fable-1490 it had two
 * cells — *"including what they're wearing"* for an account on the repaint road
 * looking at a cast born on the WARDROBE path, and today's sentence for
 * everybody else. The suite pinned that BOTH halves of that condition were
 * present, because either half alone was a contradiction one path over.
 *
 * ⚠ **THE PATHS ARE RETIRED, AND THE HALF THAT WENT WAS THE ONLY ONE HOLDING
 * THE SENTENCE SHUT.** `wardrobePath` came off `RollProjection.wardrobe`, which
 * has been `null` for every roll a customer can open since slice 1 wrote the
 * column a constant `null` — so the garment cell has never once been drawn. The
 * ACCOUNT half was `captureCastingRepaintEnabled`, and that flag stands at
 * **`all`** on production. So a sweep that deleted "the path clause" and left
 * `wardrobeEdits &&` standing would have turned the claim ON for every
 * customer, in the commit that was meant to remove dead code — and it would
 * have been FALSE: the wardrobe subject is served to no branch at all
 * (`SERVED_SUBJECTS`, `server/castingV2/refineSubjects.ts`), so an outfit ask
 * meets the generic wall for everybody.
 *
 * **That is what this file now guards: the live sentence stands alone, and
 * neither half of the retired condition came back.**
 *
 * Whether a garment ask should become a real capability for everyone is
 * **#1148** and it is his. It is filed rather than folded into a retirement.
 *
 * # Why this is a SOURCE test rather than a render
 *
 * The claim is about which sentences the component can emit at all, which is a
 * property of its source in the shape `facePanelAnatomy.test.ts` already uses.
 * ⚠ **Every absence arm below is preceded by a POSITIVE CONTROL**, because a
 * deleted or gutted panel satisfies every `not.toContain` in this file — the
 * lesson #1150's sabotage drive paid for.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const ROUTE = new URL("../../../../server/routes/castingV2.ts", import.meta.url);

/** The prose carries both sentences by design; only the CODE is the subject. */
function withoutProse(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the ask box says what it can do, and it is one sentence", () => {
  /*
    THE POSITIVE CONTROL. Every arm below asserts an absence, and an absence
    arm on a file that no longer draws a meta line passes for the wrong reason.
  */
  it("still tells somebody what the box can do, before they type", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("not their clothes or the room");
    expect(panel).toContain("credits each");
  });

  /*
    ⚠ THE SENTENCE IS UNCONDITIONAL NOW. This is the arm that would have caught
    the naive sweep: with the path clause deleted and the gate left in place,
    the source still contains today's sentence — it is just no longer what
    everybody gets. Pinning the STRING is not enough; the branch must be gone.
  */
  it("does not make the claim conditional on anything", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    /* ⚠ The WHOLE element, opening tag included — the first shape of this arm
       sliced from the sentence, which begins AFTER a ternary's `?`, so it
       stayed green through the exact sabotage it was written for. */
    const open = panel.lastIndexOf('<p className="dpc-refine__note">', panel.indexOf("not their clothes or the room"));
    const element = panel.slice(open, panel.indexOf("</p>", open));
    expect(element).not.toContain("?");
    expect(element).not.toContain("&&");
  });

  it("never claims it can reach her clothes", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).not.toContain("including what they");
    expect(panel).not.toContain("re wearing");
  });

  /*
    ⚠ NEITHER HALF OF THE RETIRED CONDITION COMES BACK ALONE. The account half
    is the dangerous one — it is the term that stands at `all` on production.
  */
  it("takes neither the account's gate nor the cast's path", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).not.toContain("wardrobeEdits");
    expect(panel).not.toContain("wardrobePath");
  });
});

describe("nothing upstream still hands the panel a path or a garment gate", () => {
  /* THE POSITIVE CONTROL: the panel is still rendered with its real props. */
  it("still renders the panel from the sheet", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    expect(sheet).toContain("<RefinePanel");
    expect(sheet.slice(sheet.indexOf("<RefinePanel"))).toContain("priceCredits");
  });

  it("passes neither prop", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const call = sheet.slice(sheet.indexOf("<RefinePanel"));
    expect(call).not.toContain("wardrobeEdits");
    expect(call).not.toContain("wardrobePath");
  });

  /*
    ⚠ AND THE SERVER GATE IS GONE, NOT MERELY UNREAD — invariant 7's own
    subject. A config field with no caller reads as a live capability switch to
    the next person who opens the file, which is exactly the state
    `stepBackEnabled` has been in since `e6d17fe9` took its menu (carded).
  */
  it("no longer sends a garment gate the client cannot use", async () => {
    const route = withoutProse(await readFile(ROUTE, "utf8"));
    /* Positive control: the config projection and its siblings still stand. */
    expect(route).toContain("authorRoadEnabled");
    expect(route).not.toContain("wardrobeEditsEnabled");
  });
});
