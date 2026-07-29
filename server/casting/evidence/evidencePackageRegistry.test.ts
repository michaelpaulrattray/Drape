import { describe, expect, it } from "vitest";
import { CANONICAL_VIEW_ANGLES } from "../../../shared/boardTypes";
import {
  INK_ADD_ONTOLOGY_VERSION,
  INK_ADD_SIDES,
  INK_ADD_SURFACE,
  INK_ADD_ZONE,
} from "./composer/inkAddRecipe";
import { INK_ADD_CAPABILITY_KEY } from "./evidenceCandidateContract";
import {
  INK_ADD_PACKAGE_DIRECTIVES,
  inkPackageDirective,
} from "./evidencePackageRegistry";

const tuple = {
  capabilityKey: INK_ADD_CAPABILITY_KEY,
  ontologyVersion: INK_ADD_ONTOLOGY_VERSION,
  zone: INK_ADD_ZONE,
  surface: INK_ADD_SURFACE,
} as const;

describe("evidence package directive registry", () => {
  it("classifies every canonical angle and pilot side exactly once", () => {
    expect(Object.keys(INK_ADD_PACKAGE_DIRECTIVES)).toEqual(CANONICAL_VIEW_ANGLES);
    for (const angle of CANONICAL_VIEW_ANGLES) {
      expect(Object.keys(INK_ADD_PACKAGE_DIRECTIVES[angle]))
        .toEqual(INK_ADD_SIDES);
    }
  });

  it.each(INK_ADD_SIDES)(
    "keeps an existing %s anterior-pec Walk and omits the feature from a missing one",
    (side) => {
      expect(inkPackageDirective({
        ...tuple,
        side,
        angle: "sideFull",
      })).toEqual({
        existingSelectionImpact: "unaffected",
        missingViewAuthority: "compose",
        visibility: "hidden_omit",
        requiredVisibleAnatomicalSide: null,
        facingDirective: "strict_profile_direction_flexible",
        normalizedTargetZone: null,
      });
    },
  );

  it("does not infer lateral-surface visibility from anterior-zone laterality", () => {
    for (const side of ["left", "right"] as const) {
      expect(inkPackageDirective({
        ...tuple,
        side,
        angle: "sideFull",
      })).not.toMatchObject({
        visibility: "reproduce_visible",
      });
    }
  });

  it("keeps cropped and posterior selections compatible while governing missing views", () => {
    for (const angle of ["threeQuarter", "sideClose", "backFull"] as const) {
      expect(inkPackageDirective({
        ...tuple,
        side: "left",
        angle,
      })).toMatchObject({
        existingSelectionImpact: "unaffected",
        missingViewAuthority: "compose",
      });
    }
  });

  it("returns no authority for an unknown tuple or angle", () => {
    expect(inkPackageDirective({
      ...tuple,
      ontologyVersion: "future",
      side: "left",
      angle: "sideFull",
    })).toBeNull();
    expect(inkPackageDirective({
      ...tuple,
      side: "left",
      angle: "future",
    })).toBeNull();
  });
});
