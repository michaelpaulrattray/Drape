import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * WHAT THE RAIL SAYS WHILE SOMETHING IS BEING MADE — the mechanizable half.
 *
 * Two founder rulings, both from one evening's dogfood, and both about the same
 * square of screen:
 *
 * - **fable-702**, verbatim: *"just give it a spinning ring centered no words
 *   why go over the top its meant to be minimalist."*
 * - **fable-703**, on screenshot #303: he hit Regenerate and the version's own
 *   thumbnail *"just stayed the same"* — an in-place re-roll REPLACES that
 *   version, and its own chip said nothing about it.
 *
 * The answer to both is one state with one look: a quiet ring on the square
 * that is changing, and no words anywhere. These are the parts of that a suite
 * can hold; the feel is the founder's, on his next edit.
 */

const RAIL = new URL("./components/VersionRail.tsx", import.meta.url);
const PANEL = new URL("./components/RefinePanel.tsx", import.meta.url);
const ROUTE = new URL("../../../../server/routes/castingV2.ts", import.meta.url);
const SERVICE = new URL("../../../../server/castingV2/refineService.ts", import.meta.url);
const CLAIM = new URL("../../../../server/db/castingV2Variants.ts", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

/** The code with its prose removed — a comment explaining a rule must not be
 *  mistaken for a breach of it, nor for compliance with one. */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the chip that is being made says so without words (fable-702)", () => {
  it("prints no sentence under the ghost chip", async () => {
    const rail = withoutProse(await readFile(RAIL, "utf8"));

    /* The words are gone from the eye and kept for a screen reader, which has
       no ring to look at. "No words" was about the surface, not about who can
       use it. */
    expect(rail).not.toContain("<span>{entry.instruction}</span>");
    expect(rail).toContain("aria-label={entry.instruction}");
  });

  it("keeps the ring centered on the chip rather than in a corner", async () => {
    const css = await readFile(CSS, "utf8");
    const ring = css.slice(css.indexOf(".dpc-refine__ghostSpin {"));

    /* Centred by the pair — an offset of half its own size against a 50% edge.
       One without the other is a ring hanging off the middle. */
    expect(ring).toContain("top: 50%;");
    expect(ring).toContain("left: 50%;");
    expect(ring).toContain("margin: -7px 0 0 -7px;");
  });
});

describe("a version being redrawn says so on its own chip (fable-703)", () => {
  it("records at the CLAIM which version a fresh take replaces", async () => {
    const [service, claim] = await Promise.all([
      readFile(SERVICE, "utf8"),
      readFile(CLAIM, "utf8"),
    ]);

    /* The fact exists at landing already; the four minutes in between are the
       whole point, so it is written when the decision is made. */
    expect(service).toContain(
      "regeneratesVariantPublicId: repeatsThisVersion ? predecessor?.publicId ?? null : null,",
    );
    /* Into the column that already exists — a NEW column on this table is in
       every INSERT, and that ordering hazard is not worth a spinner. */
    expect(claim).toContain("internalPrompt: input.regeneratesVariantPublicId");
    expect(claim).toContain("? { regeneratedFrom: input.regeneratesVariantPublicId }");
  });

  it("hands the client the id rather than the record", async () => {
    const route = await readFile(ROUTE, "utf8");

    /* Invariant 8: the internal object stays inside, the answer crosses. */
    expect(route).toContain("regenerating: readRegeneratedFrom(variant.internalPrompt),");
  });

  it("draws the wait on the chip being replaced, from server truth", async () => {
    const [rail, panel] = await Promise.all([
      readFile(RAIL, "utf8").then(withoutProse),
      readFile(PANEL, "utf8").then(withoutProse),
    ]);

    expect(panel).toContain("regenerating?: string | null;");
    /* A lookup on what the row SAYS it replaces — never a match on which
       pending sentence resembles which chip, which is the whole fable-704
       class. */
    expect(rail).toContain("pending.map((entry) => entry.regenerating)");
    expect(rail).toContain("redrawing.has(variant.variantId)");
    expect(rail).toContain("dpc-refine__ghostSpin--onChip");
  });

  it("does NOT also draw a ghost for it — one render, one mark", async () => {
    const rail = withoutProse(await readFile(RAIL, "utf8"));

    /* A ghost stands in for a version that is COMING. A fresh take is not
       coming: it is replacing something already on the rail, and at landing the
       ghost would vanish with no new chip where it stood. */
    expect(rail).toContain("pending.filter((entry) => !entry.regenerating).map((entry) =>");
  });

  it("centres that ring on the picture, not on the button and its label", async () => {
    const css = await readFile(CSS, "utf8");

    /* The chip is a flex column of a 64×84 thumbnail then its words, so the
       middle of the BUTTON is below the middle of the picture. */
    expect(css).toContain(".dpc-refine__ghostSpin--onChip {");
    const onChip = css.slice(css.indexOf(".dpc-refine__ghostSpin--onChip {"));
    expect(onChip).toContain("top: 42px;");
    expect(onChip).toContain("left: 32px;");
    /* And it needs something to be positioned against. */
    expect(css.slice(css.indexOf(".dpc-refine__pick {"))).toContain("position: relative;");
  });
});
