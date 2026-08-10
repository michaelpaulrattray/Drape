import { describe, expect, it } from "vitest";

import {
  facetsNeedingNames,
  nameForFacet,
  namingTableFacets,
  provenanceWording,
  segmentsOnFace,
} from "./segmentsOnFace";
import { pronounsForSex } from "./castPronouns";
import { facetOfSubject } from "./refineFacets";
import { currentValueOfFacet } from "./refineDelta";

/** The three faces this panel has to be able to describe. */
const SHE = pronounsForSex("female");
const HE = pronounsForSex("male");
const THEY = pronounsForSex(null);

/**
 * THE PANEL'S COPY, TESTED AS COPY.
 *
 * The UI milestone contract (founder, 2026-08-01) is that every user-visible
 * string is classified prototype-verified / adapted / invented before a founder
 * gate. This suite is the mechanical half of that: the three rows the founder
 * actually looked at are pinned verbatim, so the build cannot drift from the
 * mock he cleared, and the rules that generate every OTHER row are driven
 * rather than described.
 */

describe("a row says what the chain delivered, in her words", () => {
  /*
    PROTOTYPE-VERIFIED — these three strings are the mock the founder cleared
    on 2026-08-09 ("KEEP as mocked"), pinned against the values the production
    rows actually carry. If a naming rule changes, this is what notices.
  */
  it("reproduces the mock's own three rows, exactly", () => {
    expect(nameForFacet("marks", "freckles", SHE)).toBe("Her freckles");
    expect(nameForFacet("makeup", "nude lip gloss", SHE)).toBe("Nude lip gloss");
    expect(nameForFacet("hairWorn", "worn down", SHE)).toBe("Her hair, worn down");
  });

  it("says HIS about a man, and THEIR when the record cannot say", () => {
    /*
      Found by rendering: the mock was a woman, the string was "Her", and the
      first real dev face this panel ever drew was a man cast as "an East Asian
      idol, early 20s" — whose eyes the product then called hers, in front of
      his own photograph. Law 8 in the founder's own terms.
    */
    expect(nameForFacet("marks", "freckles", HE)).toBe("His freckles");
    expect(nameForFacet("hairWorn", "worn down", HE)).toBe("His hair, worn down");
    expect(nameForFacet("marks", "freckles", THEY)).toBe("Their freckles");
    /* A worn thing is nobody's possessive — it is the thing itself. */
    expect(nameForFacet("makeup", "nude lip gloss", HE)).toBe("Nude lip gloss");
  });

  it("lets the possessive REPLACE a leading article, rather than queue behind it", () => {
    /*
      Both of these were live in real data and both read "Her a …": the
      delivered value is sometimes a noun phrase that already introduces
      itself. A possessive determiner and an indefinite article cannot both
      introduce one noun.
    */
    expect(nameForFacet("hair.cut", "a mullet", SHE)).toBe("Her mullet");
    expect(nameForFacet("marks", "a beauty mark", HE)).toBe("His beauty mark");
    expect(nameForFacet("hair.cut", "an undercut", THEY)).toBe("Their undercut");
    /* And it does not eat a word that merely starts with those letters. */
    expect(nameForFacet("marks", "another beauty mark", SHE)).toBe("Her another beauty mark");
    expect(nameForFacet("hair.cut", "blunt bob", SHE)).toBe("Her blunt bob");
  });

  it("puts a thing she is WEARING on its own, and a part of HER with a possessive", () => {
    /* The one distinction this module makes, and it is the born/worn line the
       product already thinks in rather than a table of nouns. */
    expect(nameForFacet(facetOfSubject("statedAccessories"), "gold hoop earrings", SHE))
      .toBe("Gold hoop earrings");
    expect(nameForFacet("eye.colour", "seafoam green eyes", SHE)).toBe("Her seafoam green eyes");
  });

  it("shows NOTHING rather than a facet id when the chain has no value", () => {
    /*
      The alternative is "statedAccessories" appearing on a customer's screen —
      engineering leaking into a stylist's list. A missing row is honest; an
      ugly one is a bug she can see.
    */
    expect(nameForFacet("marks", null, SHE)).toBeNull();
    expect(nameForFacet("marks", "   ", SHE)).toBeNull();
    expect(nameForFacet("somethingNobodyHasNamed", "a value", SHE)).toBeNull();
  });

  it("says where it came from in plain language, and never in the store's", () => {
    expect(provenanceWording("edit_patch", SHE)).toBe("from an edit");
    expect(provenanceWording("detected_born", SHE)).toBe("she came with it");
    expect(provenanceWording("detected_born", HE)).toBe("he came with it");
    expect(provenanceWording("detected_born", THEY)).toBe("they came with it");
  });
});

describe("every facet the product can keep has a name waiting for it", () => {
  it("names every facet, so a new one cannot arrive unnamed", () => {
    /*
      THE REVERSE DIRECTION, which is the only kind of coverage that survives
      somebody adding a facet six months from now. `FRINGE_AT_EDGE` carries this
      same test for the same reason, and this file carries the scar it was
      written from: a `names[0]` harvest and a literal "earring" fallback, both
      true for the only case anyone had driven and silent about the rest.
    */
    const named = new Set(namingTableFacets());
    const missing = facetsNeedingNames().filter((facet) => !named.has(facet));
    expect(missing, `these facets would be dropped from the panel: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("the panel's rows", () => {
  const urlOf = (key: string) => `https://cdn.example/${key}`;
  const segments = [
    {
      publicId: "seg-1", facet: "marks", provenance: "edit_patch", variantId: 10,
      maskKey: "a-mask.png", contentKey: "a-content.png",
    },
    {
      publicId: "seg-2", facet: "makeup", provenance: "edit_patch", variantId: 11,
      maskKey: "b-mask.png", contentKey: "b-content.png",
    },
  ];
  const delivered = (segment: { facet: string }) => (
    segment.facet === "marks" ? "freckles" : "nude lip gloss"
  );

  it("keeps the compositor's own order, because that is her edit order", () => {
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf, pronouns: SHE });
    expect(rows.map((row) => row.name)).toEqual(["Her freckles", "Nude lip gloss"]);
  });

  it("writes the start of HER sentence, lowercased", () => {
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf, pronouns: SHE });
    expect(rows[0].prefill).toBe("her freckles — ");
    expect(rows[1].prefill).toBe("nude lip gloss — ");
  });

  it("carries both objects, because a row's thumbnail is the crop CUT BY its mask", () => {
    /*
      The mock's own finding: the stored crop alone is useless in a list — a
      `marks` crop IS her whole face and a `hairWorn` crop is her head, so three
      rows read as the same photograph three times. The row shows only the pixels
      it owns, which needs both objects.
    */
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf, pronouns: SHE });
    expect(rows[0].contentUrl).toBe("https://cdn.example/a-content.png");
    /*
      AND THE STENCIL COMES BACK SAME-ORIGIN, which is not a preference.

      A CSS `mask-image` is a CORS-mode fetch and the bucket sends no
      `Access-Control-Allow-Origin`, so a bucket URL here loads NOTHING and the
      row renders an empty box with every stylesheet assertion still true. Found
      by looking at the running app; asserted here so the projection cannot
      quietly go back to the direct URL.
    */
    expect(rows[0].maskUrl).toBe(
      `/api/image-proxy?url=${encodeURIComponent("https://cdn.example/a-mask.png")}`,
    );
    expect(rows[0].maskUrl.startsWith("/")).toBe(true);
  });

  it("CONTROL — the mask url is never the bucket's own, for any row", () => {
    /* The whole class in one line: if any row's stencil is cross-origin, that
       row is invisible in the product and green here. */
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf, pronouns: SHE });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.maskUrl.startsWith("http")).toBe(false);
      expect(row.maskUrl).toContain("/api/image-proxy?url=");
    }
  });

  it("drops a row it cannot name rather than showing an id", () => {
    const rows = segmentsOnFace({
      segments,
      deliveredValue: (segment) => (segment.facet === "marks" ? "freckles" : null),
      urlOf,
      pronouns: SHE,
    });
    expect(rows.map((row) => row.facet)).toEqual(["marks"]);
  });

  it("CONTROL — no row carries a version tag, which the founder called ugly", () => {
    /* His ruling, 2026-08-09: `v1` tags DROP. Asserted on the shape rather than
       remembered, since a version is on the row underneath and would be easy to
       pass through by reflex. */
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf, pronouns: SHE });
    for (const row of rows) {
      expect(Object.keys(row).some((key) => /version/i.test(key))).toBe(false);
      expect(JSON.stringify(row)).not.toMatch(/\bv[0-9]+\b/);
    }
  });
});

/**
 * §3b — A HAIR SEGMENT THE PANEL CANNOT NAME DOES NOT SHIP (fable-143).
 *
 * The condition Fable folded into the silhouette build as a hard requirement,
 * discharged as a JOIN rather than as two halves. Both halves were already
 * covered and the seam between them was not: `currentValueOfFacet` is tested in
 * `refineDelta`, `nameForFacet` is tested above, and nothing asserted that the
 * string one produces is a string the other can use.
 *
 * That seam is exactly where law 4's shape lives — "the store and the panel
 * holding two different answers to what this face keeps" — and it is the shape
 * that actually occurred: `ee5d6988` v158 banked a `hairWorn` segment the panel
 * showed no row for.
 *
 * The values below are the founder's OWN production rows, read at the wire in
 * opus-110: `statedDetails.hairWorn` was `"down"` on v#163 and `"tied up"` on
 * v#91. A fixture invented here would prove the join over a value the product
 * never files.
 */
describe("a hairWorn segment is nameable, end to end", () => {
  const identityWith = (hairWorn: string) => ({
    realized: { statedDetails: { hairWorn } },
  } as never);

  it("reads the delivered value and turns it into a row the stylist would say", () => {
    for (const [delivered, expected] of [
      ["down", "Her hair, down"],
      ["tied up", "Her hair, tied up"],
    ] as const) {
      const value = currentValueOfFacet(identityWith(delivered), facetOfSubject("hairWorn"));
      expect(value, "the store's own value, from where the chain files it").toBe(delivered);
      expect(nameForFacet("hairWorn", value, SHE)).toBe(expected);
    }
  });

  it("survives the whole projection, with its prefill and its provenance", () => {
    const [row] = segmentsOnFace({
      segments: [{
        publicId: "seg-hair",
        facet: facetOfSubject("hairWorn"),
        provenance: "edit_patch",
        variantId: 163,
        maskKey: "m.png",
        contentKey: "c.png",
      }],
      deliveredValue: () => currentValueOfFacet(identityWith("down"), facetOfSubject("hairWorn")),
      urlOf: (key) => `https://pub.example/${key}`,
      pronouns: SHE,
    });

    expect(row.name).toBe("Her hair, down");
    expect(row.from).toBe("from an edit");
    /* Tapping it opens HER sentence about her own hair — the thing an undo and
       a re-ask both need, and the thing a nameless segment cannot offer. */
    expect(row.prefill).toBe("her hair, down — ");
  });

  it("CONTROL — a face whose chain never wrote hairWorn gets NO row, not a blank one", () => {
    /*
      The negative control the requirement implies. If this ever renders a row,
      the panel has started naming a facet from something other than what the
      chain delivered — which is the direction that puts a name on pixels
      nobody bought.
    */
    expect(currentValueOfFacet({ realized: {} } as never, facetOfSubject("hairWorn"))).toBeNull();
    const rows = segmentsOnFace({
      segments: [{
        publicId: "seg-hair",
        facet: facetOfSubject("hairWorn"),
        provenance: "edit_patch",
        variantId: 158,
        maskKey: "m.png",
        contentKey: "c.png",
      }],
      deliveredValue: () => currentValueOfFacet({ realized: {} } as never, facetOfSubject("hairWorn")),
      urlOf: (key) => key,
      pronouns: SHE,
    });
    expect(rows).toEqual([]);
  });
});
