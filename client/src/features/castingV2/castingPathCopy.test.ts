import { describe, expect, it } from "vitest";

import { CASTING_PATHS } from "@shared/castingPaths";

import { CASTING_PATH_NAMES, wardrobeLineText } from "./castingPathCopy";

/*
  ⚠ WHAT THIS SUITE COVERS SHRANK WITH THE ROAD, AND THE REASON MATTERS (#203).

  The two promise lines, the draw order and the plan/label note were arms about
  a CONTROL — what a customer would be choosing and what she would be told
  before she chose it. The control is retired on his ruling, so those arms had
  no subject left; they are deleted rather than weakened.

  What survives is a READER of rows the road already wrote: a sheet cast on a
  path still shows its record, so the NAMES must still exist for every member
  of the vocabulary, and the engine-pick label must still be honest.
*/
describe("every path a sheet can have a record of is named", () => {
  /*
    THE POPULATION IS DERIVED FROM THE VOCABULARY, NEVER RE-LISTED (working law
    4). The column's enum is `CASTING_PATHS`, so a value a historical row can
    hold and this map cannot name would redden here rather than rendering
    `undefined` over somebody's sheet.
  */
  it("names each member of the closed vocabulary", () => {
    for (const path of CASTING_PATHS) {
      expect(CASTING_PATH_NAMES[path]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  /* Title case, because the record line sets these in the chrome register. */
  it("names them the way the record line draws them", () => {
    expect(CASTING_PATH_NAMES.wardrobe).toBe("Wardrobe");
    expect(CASTING_PATH_NAMES.basics).toBe("Basics");
  });
});

describe("the sheet's wardrobe line", () => {
  const line = "dark canvas work jacket, straight jeans, plain boots";

  /*
    §4.1(1): an engine-picked outfit is labelled where she reads it, because she
    is never told she asked for something she did not.
  */
  it("labels an engine pick as one", () => {
    expect(wardrobeLineText({ line, enginePicked: true })).toBe(`${line} · engine's pick`);
  });

  /*
    And it labels NOTHING ELSE. Her own stated outfit carrying "engine's pick"
    would be the same promise broken from the other side.
  */
  it("leaves her own outfit unlabelled", () => {
    expect(wardrobeLineText({ line, enginePicked: false })).toBe(line);
  });
});
