import { describe, expect, it } from "vitest";

import { readFile, readdir } from "node:fs/promises";

/**
 * A SENTENCE THE CUSTOMER TYPED MAY NOT BE CLIPPED WITH NO WAY TO READ IT BACK.
 *
 * His ruling, 2026-09-25 (Crew reply #218 on `refine-made-row-1187`), verbatim
 * and entire: *"Add a hover tooltip"*. #1187 measured the made row at a fixed
 * **701px** at 1440, 1920 and 2560 alike — the panel's own width, so no monitor
 * helps — with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
 * and no `title`. Past roughly 150 characters she could not read back the
 * sentence she typed and paid to render, while the version rail's thumbnail
 * `aria-label` carried the whole of it, which is the wrong way round.
 *
 * ⚠ **THIS GUARD IS THE CLASS, NOT THE INSTANCE** (working law 7). The card
 * said outright that *"whether other single-line rows in this panel carry
 * customer prose was NOT swept"* — and the sweep found one: the viewer's
 * waiting overlay clips her own ask at `max-width: 24ch`, a harder clip than
 * the made row's, on the screen she watches while the render runs.
 *
 * ⚠ **AND THE POPULATION IS DERIVED FROM THE STYLESHEET, NEVER LISTED HERE**
 * (working law 4). A hand list of "the rows that clip" is a second copy of a
 * fact the CSS already states, and it drifts the first time somebody adds a
 * rule. The clipping rules are read out of `castingV2.css`; every class found
 * must be CLASSIFIED below, so a new one reddens this suite until somebody
 * says which kind of text it carries.
 */

const CSS = new URL("./castingV2.css", import.meta.url);
const COMPONENTS = new URL("./components/", import.meta.url);

/**
 * HER WORDS. Every render of these must carry the whole sentence on hover.
 *
 * Note what makes a class belong here: the text is the CUSTOMER'S, typed by
 * her, and nothing else on the page shows it in full at that moment.
 */
const PROSE = new Set([".dpc-refine__madeText", ".dpc-viewer__waitSaid"]);

/**
 * OUR VOCABULARY, and exempt on purpose.
 *
 * A region name, a cast's name on the deck, a "from" label — these come from a
 * closed vocabulary the product itself wrote, they are short by construction,
 * and a tooltip repeating a two-word label is noise. If one of these ever
 * starts carrying free text it moves to `PROSE`, and the mechanism that forces
 * that conversation is the exhaustiveness arm below.
 */
const VOCABULARY = new Set([".dpc-deck__name", ".dpc-face__name", ".dpc-face__from"]);

/** Every selector in the stylesheet that clips its text with an ellipsis. */
async function clippingSelectors(): Promise<string[]> {
  const css = await readFile(CSS, "utf8");
  const found: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = match[2];
    if (!/text-overflow:\s*ellipsis/.test(body)) continue;
    const selector = match[1].trim().split("\n").pop()?.trim();
    if (selector) found.push(selector);
  }
  return found;
}

async function componentSources(): Promise<{ name: string; source: string }[]> {
  const names = (await readdir(COMPONENTS)).filter((name) => name.endsWith(".tsx"));
  return Promise.all(
    names.map(async (name) => ({
      name,
      source: await readFile(new URL(name, COMPONENTS), "utf8"),
    })),
  );
}

describe("a sentence the customer typed is readable back, however narrow the row", () => {
  /*
    ⚠ THE POSITIVE CONTROL, AND IT IS NOT DECORATION. Every assertion below is
    a loop over what the stylesheet yields; a stylesheet that yields NOTHING —
    renamed file, changed property spelling, a parser that stopped matching —
    satisfies all of them in silence. This arm is what says the reader works.
  */
  it("reads the clipping rules out of the stylesheet at all", async () => {
    const selectors = await clippingSelectors();
    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors).toContain(".dpc-refine__madeText");
    expect(selectors).toContain(".dpc-viewer__waitSaid");
  });

  /*
    The derived population has to be fully classified. A rule added later with
    no entry in either set reddens here rather than shipping a row nobody
    decided about — which is exactly how the viewer's waiting overlay reached
    production clipping her ask at 24ch with nothing to reveal it.
  */
  it("classifies every clipping rule as prose or as vocabulary", async () => {
    const selectors = await clippingSelectors();
    const unclassified = selectors.filter(
      (selector) => !PROSE.has(selector) && !VOCABULARY.has(selector),
    );
    expect(unclassified, `unclassified clipping rules: ${unclassified.join(", ")}`).toEqual([]);
  });

  /*
    The wire. A class in `PROSE` is a promise about what gets RENDERED, and the
    stylesheet cannot keep it — only the JSX can.
  */
  it("gives every rendered prose row the whole sentence on hover", async () => {
    const sources = await componentSources();
    for (const selector of PROSE) {
      const className = selector.slice(1);
      const renders = sources.flatMap(({ name, source }) =>
        [...source.matchAll(new RegExp(`className="${className}"[^>]*>`, "g"))].map((match) => ({
          name,
          tag: match[0],
        })),
      );
      /* Per-class positive control: a class nothing renders passes vacuously. */
      expect(renders.length, `${selector} is rendered nowhere`).toBeGreaterThan(0);
      for (const { name, tag } of renders) {
        expect(tag, `${selector} in ${name} carries no title`).toContain("title=");
      }
    }
  });

  /*
    ⚠ **THE SECOND `.dpc-refine__madeText` IS NOT CLIPPED, AND IT STILL CARRIES
    A TOOLTIP — SO THIS SUITE HAS NO EXEMPTION TO REMEMBER.**

    `.dpc-refine__readResult .dpc-refine__madeText` sets `white-space: normal`
    and `text-overflow: clip`, so the read-offer row below the ask box wraps and
    is fully visible. Its tooltip is belt-and-braces rather than the fix. The
    override is checked here rather than described in a comment, because the
    rule above ("every render of a prose class carries the sentence") is only
    the WHOLE answer for this panel while that row's exemption stays voluntary
    — if the override goes, the row starts clipping and the tooltip stops being
    redundant. Either way nothing has to change; this arm is what tells a reader
    which of the two worlds they are in.
  */
  it("records that the read-offer row wraps rather than clipping", async () => {
    const css = await readFile(CSS, "utf8");
    const override = css.match(
      /\.dpc-refine__readResult\s+\.dpc-refine__madeText\s*\{([^}]*)\}/,
    );
    expect(override, "the read-offer override is gone — that row now clips too").not.toBeNull();
    expect(override?.[1]).toMatch(/white-space:\s*normal/);
    expect(override?.[1]).toMatch(/text-overflow:\s*clip/);
  });
});
