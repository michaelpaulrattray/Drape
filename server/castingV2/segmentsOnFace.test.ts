import { describe, expect, it } from "vitest";

import {
  facetsNeedingNames,
  nameForFacet,
  namingTableFacets,
  provenanceWording,
  segmentsOnFace,
} from "./segmentsOnFace";
import { facetOfSubject } from "./refineFacets";

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
    expect(nameForFacet("marks", "freckles")).toBe("Her freckles");
    expect(nameForFacet("makeup", "nude lip gloss")).toBe("Nude lip gloss");
    expect(nameForFacet("hairWorn", "worn down")).toBe("Her hair, worn down");
  });

  it("puts a thing she is WEARING on its own, and a part of HER with a possessive", () => {
    /* The one distinction this module makes, and it is the born/worn line the
       product already thinks in rather than a table of nouns. */
    expect(nameForFacet(facetOfSubject("statedAccessories"), "gold hoop earrings"))
      .toBe("Gold hoop earrings");
    expect(nameForFacet("eye.colour", "seafoam green eyes")).toBe("Her seafoam green eyes");
  });

  it("shows NOTHING rather than a facet id when the chain has no value", () => {
    /*
      The alternative is "statedAccessories" appearing on a customer's screen —
      engineering leaking into a stylist's list. A missing row is honest; an
      ugly one is a bug she can see.
    */
    expect(nameForFacet("marks", null)).toBeNull();
    expect(nameForFacet("marks", "   ")).toBeNull();
    expect(nameForFacet("somethingNobodyHasNamed", "a value")).toBeNull();
  });

  it("says where it came from in plain language, and never in the store's", () => {
    expect(provenanceWording("edit_patch")).toBe("from an edit");
    expect(provenanceWording("detected_born")).toBe("she came with it");
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
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf });
    expect(rows.map((row) => row.name)).toEqual(["Her freckles", "Nude lip gloss"]);
  });

  it("writes the start of HER sentence, lowercased", () => {
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf });
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
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf });
    expect(rows[0].maskUrl).toBe("https://cdn.example/a-mask.png");
    expect(rows[0].contentUrl).toBe("https://cdn.example/a-content.png");
  });

  it("drops a row it cannot name rather than showing an id", () => {
    const rows = segmentsOnFace({
      segments,
      deliveredValue: (segment) => (segment.facet === "marks" ? "freckles" : null),
      urlOf,
    });
    expect(rows.map((row) => row.facet)).toEqual(["marks"]);
  });

  it("CONTROL — no row carries a version tag, which the founder called ugly", () => {
    /* His ruling, 2026-08-09: `v1` tags DROP. Asserted on the shape rather than
       remembered, since a version is on the row underneath and would be easy to
       pass through by reflex. */
    const rows = segmentsOnFace({ segments, deliveredValue: delivered, urlOf });
    for (const row of rows) {
      expect(Object.keys(row).some((key) => /version/i.test(key))).toBe(false);
      expect(JSON.stringify(row)).not.toMatch(/\bv[0-9]+\b/);
    }
  });
});
