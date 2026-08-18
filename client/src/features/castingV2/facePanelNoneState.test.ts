import { describe, expect, it } from "vitest";

import {
  drawnGroups, isNoneStateRow,
  type FacePanelGroup, type FacePanelRow,
} from "./components/FacePanel";

/**
 * NO FEATURE, NO ROW — the founder's final ruling on the none-state (fable-904).
 *
 * *"if he's bald i guess it doesnt need to appear — there's no feature until
 * there is one, same rule goes for clean shaven."*
 *
 * Driven against the two exported functions rather than through a render,
 * because that is where the rule actually lives (working law 3): a design law
 * whose only test mounts a component is a law that survives exactly one
 * refactor of the component. The rest of this surface's mechanizable laws sit
 * in `facePanelAnatomy.test.ts` as source assertions; this one is behaviour and
 * gets driven as behaviour.
 */

const row = (over: Partial<FacePanelRow> = {}): FacePanelRow => ({
  state: "settled",
  spoken: "her hair",
  slots: ["hair"],
  name: "Hair",
  words: ["copper, tightly curled"],
  absent: null,
  from: null,
  prefill: "her hair",
  cutouts: [],
  regions: [],
  instances: [],
  ...over,
});

/** The row the ruling is about: nothing found, and the finding is real. */
const bald = () => row({ name: "Hair", words: [], absent: "bald" });

describe("a row with no feature does not draw", () => {
  it("calls a settled found-nothing row a none-state", () => {
    expect(isNoneStateRow(bald(), false)).toBe(true);
  });

  it("CONTROL — a row with her own words is never one, even if `absent` is set", () => {
    /*
      Her words win the line whenever she has any, and the server has already
      made that decision. A predicate that keyed on `absent` alone would hide a
      row that has something to say — which is the ruling inverted.
    */
    expect(isNoneStateRow(row({ words: ["copper"], absent: "bald" }), false)).toBe(false);
  });

  it("CONTROL — an ordinary row with no `absent` at all is never one", () => {
    expect(isNoneStateRow(row(), false)).toBe(false);
    expect(isNoneStateRow(row({ words: [], absent: null }), false)).toBe(false);
  });

  it("keeps a PENDING row, because a read still running has not found nothing", () => {
    /*
      The place kept for an answer on its way. Hiding it would take the place
      away and leave her watching a panel that never mentions the thing.
    */
    expect(isNoneStateRow(row({ state: "pending", words: [], absent: "bald" }), false)).toBe(false);
  });

  it("keeps a CARRIED row, because that is another version's reading", () => {
    /* "Bald" claimed about a frame nobody has read is the exact falsehood
       `state` exists to prevent. */
    expect(isNoneStateRow(bald(), true)).toBe(false);
  });
});

describe("a heading is never left standing over nothing", () => {
  const groups = (): FacePanelGroup[] => [
    {
      group: "face",
      heading: "Face",
      rows: [row({ name: "Eyes", slots: ["eye@left", "eye@right"], words: ["green"] })],
    },
    /* The whole point: HAIR holds one row and that row is a none-state. */
    { group: "hair", heading: "Hair", rows: [bald()] },
  ];

  it("drops the none-state row AND the heading it was the only row of", () => {
    const drawn = drawnGroups(groups(), false);

    expect(drawn.map((group) => group.heading)).toEqual(["Face"]);
    expect(drawn.flatMap((group) => group.rows.map((one) => one.name))).toEqual(["Eyes"]);
  });

  it("keeps a heading whose OTHER rows survive, dropping only the none-state one", () => {
    /*
      The half that must not over-fire. A filter that dropped the group whenever
      ANY row was a none-state would pass the arm above and take her hair colour
      off the panel because her facial hair is a none-state.
    */
    const mixed: FacePanelGroup[] = [{
      group: "hair",
      heading: "Hair",
      rows: [row({ name: "Hair", words: ["copper"] }), bald()],
    }];

    const drawn = drawnGroups(mixed, false);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.rows.map((one) => one.name)).toEqual(["Hair"]);
  });

  it("CONTROL — carried groups are untouched, headings and all", () => {
    expect(drawnGroups(groups(), true).map((group) => group.heading)).toEqual(["Face", "Hair"]);
  });

  it("leaves an ordinary panel exactly as it was handed over", () => {
    /*
      The inertness arm. Every cast that has no none-state row anywhere — which
      is most of them — must draw byte-for-byte what it drew before the ruling.
    */
    const ordinary: FacePanelGroup[] = [
      { group: "face", heading: "Face", rows: [row({ name: "Eyes" }), row({ name: "Lips" })] },
    ];

    expect(drawnGroups(ordinary, false)).toEqual(ordinary);
  });
});
