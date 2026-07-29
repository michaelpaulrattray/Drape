import { describe, expect, it } from "vitest";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import { affectedViewsForInkAdd } from "./inkViewImpact";

describe("ink evidence view impact", () => {
  it.each(["left", "centre", "right"] as const)(
    "stales only Full for an anterior-pec %s tattoo",
    (side) => {
      expect(affectedViewsForInkAdd({
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        zone: INK_ADD_ZONE,
        surface: INK_ADD_SURFACE,
        side,
      })).toEqual(["frontFull"]);
    },
  );

  it("keeps the headshot trio, Walk, and rear view compatible", () => {
    const affected = new Set(affectedViewsForInkAdd({
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      side: "left",
    }));
    expect(
      ["frontClose", "threeQuarter", "sideClose", "sideFull", "backFull"]
        .filter((angle) => affected.has(angle as never)),
    ).toEqual([]);
  });

  it("fails closed for an unknown future zone, surface, or side", () => {
    for (const input of [
      {
        capabilityKey: "unknown",
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        zone: INK_ADD_ZONE,
        surface: INK_ADD_SURFACE,
        side: "left",
      },
      {
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: "body-zones.future.v2",
        zone: INK_ADD_ZONE,
        surface: INK_ADD_SURFACE,
        side: "left",
      },
      {
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        zone: "unknown",
        surface: INK_ADD_SURFACE,
        side: "left",
      },
      {
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        zone: INK_ADD_ZONE,
        surface: "unknown",
        side: "left",
      },
      {
        capabilityKey: INK_ADD_CAPABILITY_KEY,
        ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
        zone: INK_ADD_ZONE,
        surface: INK_ADD_SURFACE,
        side: "unknown",
      },
    ]) {
      expect(affectedViewsForInkAdd(input)).toEqual(CANONICAL_VIEW_ANGLES);
    }
  });

  it("classifies every canonical framing exactly once", () => {
    const affected = new Set(affectedViewsForInkAdd({
      capabilityKey: INK_ADD_CAPABILITY_KEY,
      ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
      zone: INK_ADD_ZONE,
      surface: INK_ADD_SURFACE,
      side: "left",
    }));
    expect(CANONICAL_VIEW_ANGLES.map((angle) => [
      angle,
      affected.has(angle) ? "affected" : "unaffected",
    ])).toEqual([
      ["frontClose", "unaffected"],
      ["threeQuarter", "unaffected"],
      ["frontFull", "affected"],
      ["sideClose", "unaffected"],
      ["sideFull", "unaffected"],
      ["backFull", "unaffected"],
    ]);
  });
});
