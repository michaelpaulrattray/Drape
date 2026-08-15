/**
 * THE TAG, DRIVEN DIRECTLY — because the seam's behaviour on a door that does
 * not exist yet cannot be tested through a door that does.
 *
 * The whole point of counting at the seam is that a refusal written NEXT year
 * is counted without anybody remembering to wire it. That promise lives in
 * `refusalOf`, and these are its controls (law 2: a checker that cannot fail
 * proves nothing).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import { refusal, refusalOf, refusalTagOf } from "./refusalTag";

describe("a refusal carries its own name", () => {
  it("keeps the reason, the facet and the door's verdict", () => {
    const error = refusal("removal_absent", {
      code: "BAD_REQUEST", message: "nothing to take off", facet: "statedAccessories",
    });
    expect(error).toBeInstanceOf(TRPCError);
    expect(error.code).toBe("BAD_REQUEST");
    expect(refusalTagOf(error)).toEqual({
      reason: "removal_absent", facet: "statedAccessories", outcome: "refused",
    });
  });

  it("carries `upheld` where the invention door ran and agreed", () => {
    const error = refusal("wall_unfileable", {
      code: "BAD_REQUEST", message: "not recorded", outcome: "upheld",
    });
    expect(refusalOf(error)).toMatchObject({ outcome: "upheld" });
  });

  it("does not serialize into the sentence — the tag is not part of the error's shape", () => {
    const error = refusal("busy", { code: "TOO_MANY_REQUESTS", message: "Casting is busy right now." });
    expect(JSON.stringify(error)).not.toContain("busy\":");
    expect(Object.keys(error)).not.toContain("reason");
  });
});

describe("what the seam counts when nobody tagged anything", () => {
  it("COUNTS AN UNTAGGED REFUSAL AS A GAP, so the next uncounted door is visible", () => {
    /*
      The property that makes this a fix rather than another list to maintain.
      A door written next year with a plain TRPCError still lands in the tally,
      under a name that says out loud it has not been named.
    */
    const untagged = new TRPCError({ code: "PRECONDITION_FAILED", message: "something new" });
    expect(refusalOf(untagged)).toEqual({
      reason: "untagged:PRECONDITION_FAILED", facet: null, outcome: "refused",
    });
  });

  it("NEGATIVE CONTROL — a fault is not a refusal", () => {
    /*
      A crash has a stack, a log line and a 500 of its own. Filing it here would
      put "the product said no" and "the product broke" in one tally, and the
      redesign the tally exists to guide would be reading a mixture.
    */
    expect(refusalOf(new Error("the engine fell over"))).toBeNull();
    expect(refusalOf(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "boom" }))).toBeNull();
    expect(refusalOf(null)).toBeNull();
    expect(refusalOf("a string")).toBeNull();
  });

  /*
    THE PIN, so this is a fix rather than a tidy-up that decays.

    Seventeen doors were reachable and two were counted, which happened because
    nothing ever said out loud that a refusal must be named. This says it, in
    the one file where the whole class lives, and it fails on the next
    hand-rolled one rather than in production three weeks later.
  */
  it("PINNED — the refine road throws no unnamed refusal", () => {
    const source = readFileSync("server/castingV2/refineService.ts", "utf8");

    /* The instrument's own control: if the file stopped containing refusals at
       all, the assertion below would pass by vacuity. */
    const named = source.match(/throw refusal\(/g) ?? [];
    expect(named.length, "the road still refuses in the named way").toBeGreaterThan(12);

    const unnamed = source.match(/throw new TRPCError\(/g) ?? [];
    expect(unnamed, "every user-visible refusal carries its own name").toHaveLength(0);
  });

  it("NEGATIVE CONTROL — a tag cannot be forged by an ordinary property", () => {
    const impostor = Object.assign(new TRPCError({ code: "BAD_REQUEST", message: "x" }), {
      reason: "looks_like_a_tag", facet: null,
    });
    expect(refusalTagOf(impostor), "only the symbol counts").toBeNull();
    expect(refusalOf(impostor)).toMatchObject({ reason: "untagged:BAD_REQUEST" });
  });
});
