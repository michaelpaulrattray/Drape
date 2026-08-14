import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * "ON HER FACE" — the kept panel's anatomy, and its COPY as a founder ruling.
 *
 * The UI milestone contract (founder, 2026-08-01) is that prototype content is
 * quotation, not requirement: every user-visible string is re-derived against
 * current capability and classified before a founder gate. This suite is the
 * mechanical half of that contract for the panel he cleared in fable-122 —
 * what must be there verbatim, what he ruled OUT, and the two adaptations the
 * real context forced.
 */

const PANEL = new URL("./components/SegmentsOnFace.tsx", import.meta.url);
const REFINE = new URL("./components/RefinePanel.tsx", import.meta.url);
const SHEET = new URL("../../pages/CastingSheet.tsx", import.meta.url);
const CSS = new URL("./castingV2.css", import.meta.url);

/**
 * The code with its prose removed.
 *
 * The first version of the two absence assertions below failed on the file's
 * own DOC COMMENT — which contains the words "version", "region" and
 * `statedAccessories` precisely because it explains why none of them may reach
 * the screen. A test that cannot tell an explanation from a leak would force
 * the explanation out, and the comment is the more valuable of the two.
 */
const withoutProse = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("the panel says what the founder cleared, and nothing he did not", () => {
  it("carries his own two sentences, with the one word the face decides", async () => {
    /*
      fable-122: "Panel copy: KEEP as mocked." Pinned so the build cannot
      quietly improve on the thing he actually looked at — with ONE derivation
      he did not rule on because his mock could not raise it: the mock was of a
      woman, and rendered against a real sheet the literal "On her face" sat
      over a man's photograph. Structure verbatim, pronoun derived (fable-127).
    */
    const source = await readFile(PANEL, "utf8");
    expect(source).toContain(">On {possessive} face<");
    expect(source).toContain("Things this version is keeping. Tap one to talk about it.");
    /* The word comes from the server, which is the only side allowed to read a
       face's sex — never guessed in the component. */
    expect(source).not.toMatch(/possessive\s*=\s*["'](his|her|their)["']/);
  });

  it("carries NO version tag, which he called ugly and not required", async () => {
    /*
      The row has a `version` on it in the store; the panel must not reach for
      it. Asserted as the FIELD and the ELEMENT rather than as the word — his
      own cleared copy is "Things this version is keeping", so a test that
      banned the word would ban the sentence he approved.
    */
    const code = withoutProse(await readFile(PANEL, "utf8"));
    expect(code).not.toMatch(/\bversion\s*[:.]|\.version\b/);
    expect(code).not.toContain("__mark");
    expect(code).not.toMatch(/>\s*v\{/);
  });

  it("offers no delete, no restyle and no reorder — it reads and prefills", async () => {
    /*
      The design's own boundary. A delete here would be a paid re-render wearing
      a free control's clothes (D-121), and a menu would make a stylist's list
      into an editor.
    */
    const source = await readFile(PANEL, "utf8");
    for (const forbidden of ["onDelete", "onRemove", "onReorder", "draggable", "Remove"]) {
      expect(source, `the panel must not offer ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).toContain("onPrefill");
  });

  it("shows nothing at all when nothing is kept", async () => {
    /*
      Not an empty panel with a heading over a blank list. A first edit carries
      nothing by definition, so empty is the COMMON state and a permanent
      "nothing yet" box would compete with the picture forever.
    */
    const source = await readFile(PANEL, "utf8");
    expect(source).toContain("if (rows.length === 0) return null;");
  });

  it("names no region, no pixel count and no detector", async () => {
    /* The store's vocabulary is not the customer's. Law 8. */
    const code = withoutProse(await readFile(PANEL, "utf8")).toLowerCase();
    for (const leak of ["region", "detector", "pixels", "bbox", "statedaccessories"]) {
      expect(code, `${leak} is engineering leaking into a stylist's list`).not.toContain(leak);
    }
  });
});

describe("the thumbnail is the crop cut by its own mask", () => {
  it("masks by LUMINANCE, because a segment mask carries no alpha", async () => {
    /*
      The single most breakable line in the panel. A segment mask is a
      one-channel PNG — white where the facet is, black where it is not, and no
      alpha channel at all. CSS masking defaults to `alpha`, which reads that as
      opaque everywhere and shows the WHOLE crop: three rows, three
      near-identical faces, which is precisely the useless version the mock
      started with and the founder pulled this panel forward to avoid.
    */
    const css = await readFile(CSS, "utf8");
    expect(css).toContain("mask-mode: luminance");
    expect(css).toContain("-webkit-mask-source-type: luminance");
  });

  it("uses both objects, since one of them is the stencil", async () => {
    const source = await readFile(PANEL, "utf8");
    expect(source).toContain("row.contentUrl");
    expect(source).toContain("row.maskUrl");
    expect(source).toContain("maskImage");
    expect(source).toContain("WebkitMaskImage");
  });
});

describe("it is wired to the version she is looking at", () => {
  it("asks for the SELECTED version, never for the candidate at large", async () => {
    /*
      fable-091's fork semantics reaching the panel: going back to an earlier
      version shows THAT version's layers. A panel keyed on the candidate would
      list a later branch's earrings on a face that never had them.
    */
    const sheet = await readFile(SHEET, "utf8");
    expect(sheet).toContain("trpc.castingV2.segmentsOnFace.useQuery");
    expect(sheet).toContain("variantId: variants.data?.selectedVariantId ?? null");
  });

  it("adds no polling interval of its own", async () => {
    /*
      Kept segments change only when a refinement lands, which is exactly when
      `variants` refetches. A second interval on the same surface is a cost
      nobody sees and everybody pays.

      The slice ends at the query's OWN closing rather than at a comment several
      hundred lines below it: the wide window used to reach past three other
      queries, so the scan's bounded interval (below) reddened a rule about
      kept segments. A guard aimed at the wrong span fails in both directions —
      it accused an innocent line here, and it would have missed a real interval
      added to this query after that comment moved.
    */
    const sheet = await readFile(SHEET, "utf8");
    const from = sheet.indexOf("trpc.castingV2.segmentsOnFace.useQuery");
    const query = sheet.slice(from, sheet.indexOf("useQuery", from + 40));
    expect(query).not.toContain("refetchInterval");
  });

  it("lets the SCAN ask again while it is still reading, and only until then", async () => {
    /*
      The one interval on this surface, and it is bounded by an answer rather
      than by a clock: the scan publishes features as they land, so the panel
      asks again every second while the server says the reading is unfinished
      and stops the moment it says otherwise. A warm version says `done` on the
      first answer and never polls at all.
    */
    const sheet = await readFile(SHEET, "utf8");
    const from = sheet.indexOf("trpc.castingV2.faceScan.useQuery");
    const query = sheet.slice(from, sheet.indexOf("useQuery", from + 40));
    expect(query).toContain("refetchInterval");
    expect(query).toContain("done === false");
  });

  it("sits immediately above the box it writes into", async () => {
    /*
      Tapping a row prefills the ask, so the row and the field it fills are
      adjacent — the cause of the text appearing is visible in one glance.
    */
    const refine = await readFile(REFINE, "utf8");
    expect(refine.indexOf("<SegmentsOnFace"))
      .toBeLessThan(refine.indexOf('className="dpc-refine__ask"'));
    expect(refine.indexOf("<SegmentsOnFace")).toBeGreaterThan(-1);
  });
});

describe("the adaptation from the mock is declared, not silent", () => {
  it("is written in the SCRIM's language, because that is where it lives", async () => {
    /*
      The mock is a card on `--surface`; a mock has no neighbours. This panel
      sits beside `.dpc-refine__field`, which is written in `--onScrim`, and the
      mock's treatment here would be a white card punched into a dark viewer.
      Structure and copy are his; the surface language is the one its actual
      neighbours speak — quotation is not requirement.
    */
    const css = await readFile(CSS, "utf8");
    const block = css.slice(css.indexOf(".dpc-kept {"));
    expect(block).toContain("var(--onScrim)");
    expect(block.slice(0, block.indexOf(".dpc-kept__body"))).not.toContain("var(--surface)");
  });

  it("puts no focus ring inside a row — the same law the field follows", async () => {
    const css = await readFile(CSS, "utf8");
    const block = css.slice(css.indexOf(".dpc-kept__row:focus-visible"));
    expect(block.slice(0, 160)).toContain("outline: none");
  });
});
