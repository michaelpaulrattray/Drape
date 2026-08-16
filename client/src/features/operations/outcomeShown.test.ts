import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetOutcomeShown,
  markOutcomeShown,
  outcomeShownFor,
  resetOutcomesShownForTests,
} from "./outcomeShown";
import { bridgeShouldSpeak } from "./surfaceOwnership";
import { failureIsOurs } from "@/lib/failureSentence";
import { LOST_CONTACT, refineFailureMessage } from "@/features/castingV2/failureCopy";
import { SPOKEN_ERROR_FLAG } from "@shared/spokenError";

/**
 * THE PRODUCER SIDE of the per-request answer, driven end to end.
 *
 * The bridge's own arms live in `bridgeOwnership.test.ts`. What is proved here
 * is the thing that FEEDS it: the panel's decision about whose sentence it just
 * put on screen, taken with the same function the panel calls, off error shapes
 * the server really produces.
 *
 * This is the half that would otherwise be assumed. A predicate that reads
 * `outcomeShown` correctly is worthless if nothing ever writes the right value
 * into it — the invariant-7 shape, and the reason the kind list existed in the
 * first place was that `pendingCastRegistry`'s per-request answer had no
 * Casting V2 producer at all.
 */

beforeEach(() => resetOutcomesShownForTests());

describe("what the panel records about whose sentence it showed", () => {
  it("calls an authored refusal OURS — the spoken marker", () => {
    /*
      The `spoken` marker is how a refusal thrown as INTERNAL_SERVER_ERROR still
      reaches a person (run-15). It must also make the panel say "the server
      answered", or the bridge would repeat a sentence already on screen.
    */
    const refusal = Object.assign(
      new Error("That one came back twice without fox eyes, so it wasn't delivered "
        + "and your credits have been returned. Try saying it a different way."),
      { data: { code: "INTERNAL_SERVER_ERROR", [SPOKEN_ERROR_FLAG]: true } },
    );
    expect(failureIsOurs(refusal)).toBe(true);
    expect(refineFailureMessage(refusal)).toMatch(/fox eyes/);
  });

  it("calls an authored refusal OURS by its code too — the older evidence", () => {
    const refusal = Object.assign(
      new Error("Makeup isn't something I can place yet. Nothing was charged."),
      { data: { code: "PRECONDITION_FAILED" } },
    );
    expect(failureIsOurs(refusal)).toBe(true);
  });

  it("calls run-9's gateway 502 NOT ours — this is the 1.7% case", () => {
    /*
      The specimen is production's: a plain-text 502 from the edge, reaching the
      client as a JSON parse error, after 304.9 seconds. Nothing about it is a
      sentence anyone wrote for a person, and the true answer is on the other
      side of a closed socket.
    */
    const gateway = new Error(`Unexpected token 'u', "upstream error" is not valid JSON`);
    expect(failureIsOurs(gateway)).toBe(false);
    expect(refineFailureMessage(gateway)).toBe(LOST_CONTACT);
  });

  it("calls an UNMARKED internal error not ours, marker absent and code untrusted", () => {
    const bare = Object.assign(new Error("upstream error"), {
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
    expect(failureIsOurs(bare)).toBe(false);
  });

  it("refuses to call an EMPTY message ours, whatever it is wearing", () => {
    /* Otherwise the bridge would stay silent on the strength of a surface
       having shown nothing at all. */
    const empty = Object.assign(new Error("   "), {
      data: { code: "BAD_REQUEST", [SPOKEN_ERROR_FLAG]: true },
    });
    expect(failureIsOurs(empty)).toBe(false);
  });
});

describe("the mark reaches the bridge's decision", () => {
  const REFUSAL = "That one came back twice with glasses still in the picture, "
    + "so it wasn't delivered and your credits have been returned.";

  const decide = (clientRequestId: string) =>
    bridgeShouldSpeak({
      kind: "castingV2.refine",
      status: "failed",
      publicMessage: REFUSAL,
      outcomeShown: outcomeShownFor(clientRequestId),
    });

  it("silences the bridge once the panel has recorded the server's own words", () => {
    markOutcomeShown("req-a", "server");
    expect(decide("req-a")).toBe(false);
  });

  it("leaves the bridge speaking when the panel recorded its fallback", () => {
    markOutcomeShown("req-b", "fallback");
    expect(decide("req-b")).toBe(true);
  });

  it("keeps requests apart — one face's answer never silences another's", () => {
    /*
      The map is keyed on clientRequestId for this reason. A single shared flag
      would let a resolved edit mute a different edit that had just lost its
      connection, which is the founder's "another cast's request must not mute
      this one" (fable-465) in a new place.
    */
    markOutcomeShown("req-c", "server");
    markOutcomeShown("req-d", "fallback");
    expect(decide("req-c")).toBe(false);
    expect(decide("req-d")).toBe(true);
  });

  it("forgets, so a decided request cannot silence a later one that reuses nothing", () => {
    markOutcomeShown("req-e", "server");
    forgetOutcomeShown("req-e");
    expect(outcomeShownFor("req-e")).toBeNull();
    /* And absence reads as "nobody was watching", which SPEAKS — the safe
       direction, and the reload case. */
    expect(decide("req-e")).toBe(true);
  });
});
