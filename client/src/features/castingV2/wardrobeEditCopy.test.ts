import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * THE ASK BOX'S CAPABILITY LINE, AND THE ONE CELL WHERE IT USED TO BE FALSE —
 * design §10's fifth flip precondition (found opus-1132 §5, ruled fable-1490).
 *
 * `RefinePanel`'s meta line is capability disclosure: it says what the box can
 * do BEFORE somebody types something it cannot, which is worth more than a
 * refusal after the fact. It said *"Anything about them — not their clothes or
 * the room"* on every surface, and the two paths gave the panel a WARDROBE
 * section four lines above it — so on a Wardrobe-path cast, whose owner is on
 * the repaint road, the sentence denies a capability the panel is inviting a tap
 * on.
 *
 * ⚠ **IT WAS TRUE THE DAY IT WAS FOUND AND IT WAS STILL WORTH FIXING.** The
 * wardrobe subject is `admittedOn: "repaintOnly"`, so a garment ask needs an
 * account on the repaint road AND a cast on the Wardrobe path — a population
 * that is empty in both worlds while `CASTING_TWO_PATHS_SCOPE` is off. The flip
 * creates it, on day one, for the first customer who opens a pathed cast.
 *
 * # Why this is a SOURCE test rather than a render
 *
 * The condition is a join of two facts the panel is HANDED — the server's own
 * gate and the roll's path — and what has to be pinned is that it decides
 * neither of them, that both are required, and that every other cell keeps
 * today's sentence. That is a claim about the component's source, in the shape
 * `facePanelAnatomy.test.ts` and `referenceAttachCopy.test.ts` already use.
 */
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const ROUTE = new URL("../../../../server/routes/castingV2.ts", import.meta.url);

/** The prose carries both sentences by design; only the CODE is the subject. */
function withoutProse(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("the ask box says what it can do, on the path where it can do it", () => {
  it("says the capability where a garment ask is admitted", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("including what they");
    expect(panel).toContain("re wearing");
  });

  /*
    AND KEEPS TODAY'S SENTENCE EVERYWHERE ELSE, byte for byte. Basics refuses an
    outfit in its own words (`wall_basics_wardrobe`), an unpathed cast has no
    wardrobe to edit, and an account off the repaint road meets the subject
    card's own `repaintOnly`. Three cells, one sentence, unchanged.
  */
  it("keeps the old sentence for every other cell", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toContain("not their clothes or the room");
  });

  /*
    ⚠ BOTH HALVES, OR IT IS A NEW CONTRADICTION ONE PATH OVER. The gate alone
    would tell a BASICS customer the box reaches her clothes on the one path
    that refuses an outfit by design; the path alone would tell an account off
    the repaint road the same thing about a subject that is `repaintOnly`.
  */
  it("requires the account's gate AND the cast's path, not either", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toMatch(/wardrobeEdits\s*&&\s*wardrobePath === "wardrobe"/);
  });

  /*
    THE DEFAULT IS THE CLAIM WE DO NOT MAKE. A caller that passes neither prop —
    or an older bundle against a server without the field — must get today's
    sentence rather than a capability claim.
  */
  it("defaults to claiming nothing", async () => {
    const panel = withoutProse(await readFile(PANEL, "utf8"));
    expect(panel).toMatch(/wardrobeEdits = false/);
    expect(panel).toMatch(/wardrobePath = null/);
  });
});

describe("the panel is HANDED both facts and decides neither", () => {
  it("reads the server's own gate rather than a flag", async () => {
    const route = withoutProse(await readFile(ROUTE, "utf8"));
    /* Named for the capability, like the five gates beside it. */
    expect(route).toMatch(/wardrobeEditsEnabled:\s*captureCastingRepaintEnabled/);
  });

  /*
    ⚠ A SEPARATE FIELD FROM `stepBackEnabled` THOUGH BOTH READ THE SAME CAPTURE
    TODAY, and that is the whole reason it was added (fable-1483 ASK 2, ruled
    fable-1490). `stepBackEnabled` is named for the version chip's "take this
    step back"; one gate answering two questions under one of their names is how
    the two drift the day the wardrobe subject is promoted off `repaintOnly`.
  */
  it("does not reuse the step-back gate under its own name", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const call = sheet.slice(sheet.indexOf("<RefinePanel"));
    expect(call).toContain("wardrobeEditsEnabled");
    expect(call.slice(0, call.indexOf("wardrobePath="))).not.toContain("stepBackEnabled");
  });

  it("takes the path from the roll rather than from the account", async () => {
    const sheet = withoutProse(await readFile(SHEET, "utf8"));
    const call = sheet.slice(sheet.indexOf("<RefinePanel"));
    expect(call).toMatch(/wardrobePath=\{sheetWardrobe\?\.path \?\? null\}/);
  });
});
