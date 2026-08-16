import { describe, expect, it } from "vitest";

import { declaredTakes, liveTakes, sameChain, sameStep, takeShownFor } from "./railTakes";
import type { RefineDelta } from "./refineDelta";

/**
 * The founder's ruling, driven: *"a refresh or regeneration of the same edit
 * which essentially produces no extra version"*, with the trade he confirmed —
 * *"you can regenerate it without causing extra clutter"* — meaning the prior
 * take goes from the rail.
 *
 * Every case here is about the DERIVATION. Nothing is written, nothing is
 * deleted: the older row is still a row, and these prove it is invisible rather
 * than absent.
 */
const hoops: RefineDelta = { free: { statedAccessories: "gold hoop earrings" } };
/* What a second take of the SAME ask files: the interpreter has already
   normalised the sentence, so what differs is punctuation and case. */
const hoopsAgain: RefineDelta = { free: { statedAccessories: "Gold hoop earrings." } };
/* And what a rephrasing the interpreter files DIFFERENTLY looks like — one
   extra chip, the safe direction, named rather than hidden. */
const hoopsShort: RefineDelta = { free: { statedAccessories: "gold hoops" } };
const silver: RefineDelta = { free: { statedAccessories: "silver hoop earrings" } };
const copper: RefineDelta = { hairColour: "copper" as never };
const takeOf = (publicId: string, steps: RefineDelta[]) => ({ publicId, steps });

describe("two takes of one edit", () => {
  it("reads a rephrasing as the SAME step", () => {
    expect(sameStep(hoops, hoopsAgain)).toBe(true);
  });

  it("and a different object as a different one — the arm that keeps it honest", () => {
    /*
      Without this the whole design collapses into "every accessory ask is the
      same ask", and a paid edit would silently replace an unrelated one.

      This arm is why the design note's own proposal was dropped:
      `namesSameThing` answers TRUE here, because both are earrings to the kind
      table. It was written, driven, and refuted in one run.
    */
    expect(sameStep(hoops, silver)).toBe(false);
  });

  it("errs toward SPLITTING when the interpreter files different words", () => {
    /* The named limit, driven so it is a decision rather than a surprise: a
       false split costs one chip, a false merge costs a picture she paid for. */
    expect(sameStep(hoops, hoopsShort)).toBe(false);
  });

  it("reads two different AXES as different edits, however they are worded", () => {
    expect(sameStep(hoops, copper)).toBe(false);
    expect(sameStep({ ...hoops, ...copper }, hoops)).toBe(false);
  });

  it("compares the whole chain, in order", () => {
    expect(sameChain([copper, hoops], [copper, hoopsAgain])).toBe(true);
    expect(sameChain([copper, hoops], [hoops, copper])).toBe(false);
    expect(sameChain([copper], [copper, hoops])).toBe(false);
  });
});

describe("the rail's live takes", () => {
  it("keeps ONE chip for a regenerated edit, and it is the newest", () => {
    const { live, supersededBy } = liveTakes([
      takeOf("v1", [hoops]),
      takeOf("v2", [hoops]),
    ]);
    expect(live.map((take) => take.publicId)).toEqual(["v2"]);
    expect(supersededBy.get("v1")).toBe("v2");
  });

  it("keeps the take in ITS OWN PLACE — a regeneration is the same version again", () => {
    const { live } = liveTakes([
      takeOf("hoops-1", [hoops]),
      takeOf("copper", [hoops, copper]),
      takeOf("hoops-2", [hoops]),
    ]);
    /* Not ["copper", "hoops-2"]: the rail is version history, and re-rolling
       the first version does not move it after the second. */
    expect(live.map((take) => take.publicId)).toEqual(["hoops-2", "copper"]);
  });

  it("still APPENDS a different ask — nothing is swallowed", () => {
    const { live, supersededBy } = liveTakes([
      takeOf("v1", [hoops]),
      takeOf("v2", [silver]),
    ]);
    expect(live.map((take) => take.publicId)).toEqual(["v1", "v2"]);
    expect(supersededBy.size).toBe(0);
  });

  it("resolves three takes in ONE hop, so an old id never lands on a dead take", () => {
    const { supersededBy } = liveTakes([
      takeOf("v1", [hoops]),
      takeOf("v2", [hoops]),
      takeOf("v3", [hoops]),
    ]);
    expect(takeShownFor("v1", supersededBy)).toBe("v3");
    expect(takeShownFor("v2", supersededBy)).toBe("v3");
    expect(takeShownFor("v3", supersededBy)).toBe("v3");
  });

  it("leaves an id nobody replaced exactly as it is", () => {
    const { supersededBy } = liveTakes([takeOf("v1", [hoops])]);
    expect(takeShownFor("v1", supersededBy)).toBe("v1");
    expect(takeShownFor(null, supersededBy)).toBeNull();
  });

  it("groups an UNREADABLE chain with nothing, including other unreadable ones", () => {
    /* `readStepDeltas` answers an empty list for a chain with a hole in it. Two
       rows we cannot read are not thereby the same edit — claiming they are
       would hide a paid version behind another one on the strength of a
       parsing failure. */
    const { live, supersededBy } = liveTakes([
      takeOf("broken-1", []),
      takeOf("broken-2", []),
    ]);
    expect(live.map((take) => take.publicId)).toEqual(["broken-1", "broken-2"]);
    expect(supersededBy.size).toBe(0);
  });

  it("CAN FAIL — a subtly different chain is not folded away", () => {
    /* The positive control for the whole file: if `sameChain` ever answered
       true for everything, every case above would still pass except this one. */
    const { live } = liveTakes([
      takeOf("v1", [hoops, copper]),
      takeOf("v2", [hoops, { hairColour: "jet black" as never }]),
    ]);
    expect(live.map((take) => take.publicId)).toEqual(["v1", "v2"]);
  });
});

/**
 * THE SHIPPED RULE — a take is replaced only when a newer row SAYS so.
 *
 * The inference above is the same shape and the wrong risk to take on rows that
 * already exist, so the render records what it replaced and this reads the
 * record. Forward-only by construction: a row written before the ruling
 * declares nothing and is never hidden.
 */
describe("the declared takes", () => {
  const rowOf = (publicId: string, regeneratedFrom: string | null) => ({ publicId, regeneratedFrom });

  it("hides a take a newer row declares it replaced", () => {
    const { live, supersededBy } = declaredTakes([
      rowOf("v1", null),
      rowOf("v2", "v1"),
    ]);
    expect(live.map((row) => row.publicId)).toEqual(["v2"]);
    expect(supersededBy.get("v1")).toBe("v2");
  });

  it("keeps the newest take in the REPLACED one's place", () => {
    const { live } = declaredTakes([
      rowOf("hoops-1", null),
      rowOf("copper", null),
      rowOf("hoops-2", "hoops-1"),
    ]);
    expect(live.map((row) => row.publicId)).toEqual(["hoops-2", "copper"]);
  });

  it("hides NOTHING on rows that declare nothing — the forward-only guarantee", () => {
    /* Two rows that share a chain by accident (a step back, then the same ask
       again) are two pictures somebody paid for, and neither says it replaced
       the other. The inference would hide one; the record does not. */
    const { live, supersededBy } = declaredTakes([
      rowOf("v1", null),
      rowOf("v2", null),
      rowOf("v3", null),
    ]);
    expect(live.map((row) => row.publicId)).toEqual(["v1", "v2", "v3"]);
    expect(supersededBy.size).toBe(0);
  });

  it("resolves a chain of three declarations in one hop", () => {
    const { live, supersededBy } = declaredTakes([
      rowOf("v1", null),
      rowOf("v2", "v1"),
      rowOf("v3", "v2"),
    ]);
    expect(live.map((row) => row.publicId)).toEqual(["v3"]);
    expect(takeShownFor("v1", supersededBy)).toBe("v3");
    expect(takeShownFor("v2", supersededBy)).toBe("v3");
  });
});

/**
 * AND THE RAIL ACTUALLY READS IT (fable-717 §4, executing fable-575 §3).
 *
 * The rule above was written, tested and documented in this module as "THE
 * SHIPPED RULE" — and the route went on calling the INFERENCE for a day. A
 * control that is not invoked does not exist (invariant 7), and this is that
 * class exactly: two readers, one of them correct, and the wrong one wired.
 *
 * The risk it was carrying is the one `liveTakes`' own comment names as
 * "severe, silent, and unrecoverable from the UI": two rows can describe one
 * chain by accident — a step back, then the same ask again — and each is a
 * picture somebody paid for. The behaviour is proved above; this proves the
 * caller asks it.
 */
describe("the shipped rule is the one the rail is given", () => {
  const routeSource = async () => {
    const { readFile } = await import("node:fs/promises");
    return readFile(new URL("../routes/castingV2.ts", import.meta.url), "utf8");
  };

  it("groups the rail by what a row DECLARES, never by inference", async () => {
    const route = await routeSource();

    expect(route).toContain("const { live, supersededBy } = declaredTakes(");
    expect(route).toContain("regeneratedFrom: readRegeneratedFrom(variant.internalPrompt),");
  });

  it("and the inference is not wired anywhere on the request path", async () => {
    const route = await routeSource();
    /* Prose is allowed to name it — the comment there explains why it went. A
       CALL is not. */
    expect(route).not.toContain("liveTakes(");
  });

  it("the accident case, end to end: neither paid picture leaves the rail", () => {
    /*
      A step back, then the same ask again. Both rows describe one chain and
      neither declares it replaced the other, so both stay — which is the
      forward-only guarantee doing the only job it exists for.
    */
    const { live, supersededBy } = declaredTakes([
      { publicId: "paid-1", regeneratedFrom: null },
      { publicId: "paid-2", regeneratedFrom: null },
    ]);
    expect(live.map((row) => row.publicId)).toEqual(["paid-1", "paid-2"]);
    expect(takeShownFor("paid-1", supersededBy)).toBe("paid-1");

    /* The inference, on the same two rows, takes one of them off the rail —
       named here so the difference between the two readers is a fact in this
       file rather than an argument about it. */
    const inferred = liveTakes([
      { publicId: "paid-1", steps: [hoops] },
      { publicId: "paid-2", steps: [hoopsAgain] },
    ]);
    expect(inferred.live.map((row) => row.publicId)).toEqual(["paid-2"]);
  });
});
