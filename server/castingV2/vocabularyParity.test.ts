import { describe, expect, it } from "vitest";

import { ARCHETYPES, ENERGIES, LOOKS } from "./castingIntent";
import { ENERGY_KEYS, LOOK_KEYS } from "../../shared/castingVocabularies";

/**
 * The shared key lists must match the server-side prose objects exactly.
 *
 * The vocabularies moved to `shared/` so the brief echo's popover offers real
 * values, and the move immediately paid for itself twice: the hand-copied
 * client list had three wrong heritages, and the shared LOOK_KEYS was written
 * from a regex over the source that silently missed "off-kilter charm" and
 * "raw street-cast" — two of the eight casting-house looks.
 *
 * That second one is the reason this file exists rather than a comment. A
 * missing key is invisible to the type checker: `LOOKS[key]` still compiles
 * when `key` is a subset. It is only visible at runtime, as two looks that
 * never appear on any sheet because `varyByLook` cycles the short list, and as
 * two options the popover never offers.
 */

describe("shared vocabularies match the prose they key into", () => {
  it("every look has prose, and every prose entry is offered", () => {
    expect([...LOOK_KEYS].sort()).toEqual(Object.keys(LOOKS).sort());
  });

  it("every energy has prose, and every prose entry is offered", () => {
    expect([...ENERGY_KEYS].sort()).toEqual(Object.keys(ENERGIES).sort());
  });

  it("each look carries the three fields the composer reads", () => {
    // A look missing its whisper composes an undefined into a paid prompt.
    for (const key of LOOK_KEYS) {
      const look = LOOKS[key];
      expect(look.thesis, key).toBeTruthy();
      expect(look.avoid, key).toBeTruthy();
      expect(look.whisper, key).toBeTruthy();
    }
  });

  it("each archetype carries the two fields the direction block reads", () => {
    for (const [key, archetype] of Object.entries(ARCHETYPES)) {
      expect(archetype.thesis, key).toBeTruthy();
      expect(archetype.avoid, key).toBeTruthy();
    }
  });
});
