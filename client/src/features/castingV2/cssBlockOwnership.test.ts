import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * ONE BLOCK NAME, ONE OWNER — the law the founder's broken refine box paid for.
 *
 * fable-367 §2: *"the refine without re-casting text box looks messed up on the
 * profile page not sure what happened to the styling."* Photographed, it was a
 * 144px field clipping its placeholder mid-word with the button jammed against
 * the cut, inside a card 728px wide.
 *
 * The cause was not a bad rule. Two different surfaces had independently grown
 * the block name `dpc-refine` — the signed Cast's profile card, and the casting
 * sheet's ask panel — and the later rule (`align-items: center; width: min(100%,
 * 760px)`) therefore governed both, shrink-wrapping every row of a card it was
 * never written for. **Their child classes never collided**, which is exactly
 * why it survived: a collision that surfaces as one property on one screen
 * reads as that screen's own bad layout.
 *
 * So the guard is not "the room's card looks right" — that is one instance. It
 * is: **no `dpc-` block gets a bare rule of its own in two places.** A second
 * bare rule is either a collision or a rule that wants merging, and both are
 * worth a look before they reach a screenshot.
 */
const CSS = new URL("./castingV2.css", import.meta.url);

/** Every `.dpc-block {` rule, counted by block. Element (`__x`) and modifier
 *  (`--x`) selectors are a block's own business; the BARE block is the one that
 *  two surfaces can claim without either noticing. */
function bareBlockRules(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of css.matchAll(/^\.(dpc-[a-z0-9]+)\s*(?:,[^{]*)?\{/gim)) {
    const block = match[1]!.toLowerCase();
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }
  return counts;
}

describe("no two surfaces share a block name", () => {
  it("CAN SEE a duplicate — the detector is proved before its silence is believed", () => {
    /*
      A sweep that returns nothing is indistinguishable from a sweep that reads
      nothing, and this one returns nothing when it passes. So it is shown the
      exact shape it exists to catch, written the way the real stylesheet wrote
      it: two bare rules for one block, far apart, with unrelated rules between.
    */
    const seeded = [
      ".dpc-refine { gap: 12px; }",
      ".dpc-refine__shell { display: flex; }",
      ".dpc-other { color: red; }",
      ".dpc-refine {",
      "  align-items: center;",
      "}",
    ].join("\n");
    expect(bareBlockRules(seeded).get("dpc-refine")).toBe(2);
    /* And it does NOT count an element or a modifier as the block. */
    expect(bareBlockRules(".dpc-x__y { }\n.dpc-x--z { }").get("dpc-x")).toBeUndefined();
  });

  it("finds no block with two bare rules in the casting stylesheet", async () => {
    const css = await readFile(CSS, "utf8");
    const doubled = [...bareBlockRules(css).entries()]
      .filter(([, count]) => count > 1)
      .map(([block, count]) => `${block} (${count})`);
    expect(
      doubled,
      "two bare rules for one block: either two surfaces are sharing a name — the\n"
      + "`dpc-refine` defect — or one block's rules want merging. Rename the newer\n"
      + "surface's block rather than out-specifying it; specificity leaves them\n"
      + "fighting on the next property either one grows.",
    ).toEqual([]);
  });
});
