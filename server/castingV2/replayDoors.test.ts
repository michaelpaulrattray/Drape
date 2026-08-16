/**
 * THE DOOR LIST, PINNED — so a new door has to declare its class.
 *
 * fable-733 §2 stopped the one-door-at-a-time repair after the third strike and
 * asked for the sweep instead: enumerate every door between the Regenerate
 * click and dispatch, class each as state-comparing or not, and pin the list so
 * a NEW door added later declares which it is. This is the pin.
 *
 * The list is verbatim on purpose. Folding a classification into a helper is
 * exactly the kind of change that quietly reclassifies a door, and the cost of
 * getting one wrong runs both ways: a state door left ON refuses the founder's
 * fresh take, and a safety door turned OFF lets a replay through something that
 * was never about her current state.
 */
import { describe, expect, it } from "vitest";

import { REPLAY_DOORS, skippedOnReplay, type DoorGround } from "./replayDoors";

describe("the doors a fresh take walks through", () => {
  it("pins every door and its ground, verbatim", () => {
    expect(REPLAY_DOORS.map((door) => [door.key, door.ground])).toEqual([
      ["did-you-mean", "words"],
      ["which-facet", "words"],
      ["colour-needs-referent", "words"],
      ["interpreter-refusal", "safety-or-infrastructure"],
      ["already-true", "state-comparison"],
      ["same-ask-again-offer", "state-comparison"],
      ["already-upswept", "state-comparison"],
      ["glasses-hide-eyes", "readability"],
      ["forbidden-recipe", "safety-or-infrastructure"],
      ["reference-bytes-moved", "safety-or-infrastructure"],
    ]);
  });

  it("skips exactly the state-comparison doors and nothing else", () => {
    /*
      The three that stand aside are the three whose refusal ground is her
      current frame already satisfying the ask — which on a replay is the
      premise. Everything else holds, because a replay is not a bypass.
    */
    const skipped = REPLAY_DOORS.filter((door) => skippedOnReplay(door.key)).map((d) => d.key);
    expect(skipped).toEqual(["already-true", "same-ask-again-offer", "already-upswept"]);
  });

  it("CAN FAIL — an unknown door is not skipped, and neither are the other grounds", () => {
    /*
      The negative control. A predicate that answered true for everything would
      pass the arm above by accident, and a predicate that answered true for an
      unknown key would silently turn off every door somebody forgot to file.
      Both are the failure this list exists to prevent, so both are driven.
    */
    expect(skippedOnReplay("a-door-nobody-filed")).toBe(false);
    expect(skippedOnReplay("glasses-hide-eyes"), "readability is not state").toBe(false);
    expect(skippedOnReplay("forbidden-recipe"), "safety is never skipped").toBe(false);
    expect(skippedOnReplay("did-you-mean"), "a typo is about the words").toBe(false);
  });

  it("gives every door exactly one ground, drawn from the closed set", () => {
    const grounds: DoorGround[] = [
      "state-comparison",
      "words",
      "safety-or-infrastructure",
      "readability",
    ];
    const keys = REPLAY_DOORS.map((door) => door.key);
    expect(new Set(keys).size, "no key is filed twice").toBe(keys.length);
    for (const door of REPLAY_DOORS) {
      expect(grounds, door.key).toContain(door.ground);
      expect(door.site.length, `${door.key} says where it lives`).toBeGreaterThan(0);
    }
  });
});
