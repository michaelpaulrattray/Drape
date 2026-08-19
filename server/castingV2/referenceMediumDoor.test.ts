/**
 * THE CLASS DOOR, DRIVEN BOTH WAYS AND FOR FREE.
 *
 * A door that only ever runs behind a vision call is a door nobody has seen
 * refuse — and, more to the point here, nobody has seen ADMIT. The routing rule
 * has three rows and the third is the one a court could never buy cheaply: a
 * reader that did not answer must change nothing at all.
 *
 * The court that costs money answers a different question — whether a REAL
 * stylised photograph reads as a photograph — and it cannot be run here.
 */
import { describe, expect, it } from "vitest";

import {
  DRAWN_NARROWED_NOTE,
  REFERENCE_MEDIA,
  cropTakeAllowedOn,
  readMediumAnswer,
  readReferenceMedium,
} from "./referenceMediumDoor";

const BYTES = { bytes: Buffer.from("not really a picture"), contentType: "image/png" };

const engineSaying = (text: string) => ({
  id: "test:medium",
  complete: async () => ({ text, tokensIn: 1, tokensOut: 1 }),
} as never);

describe("the routing rule — it chooses a lane and never turns anyone away", () => {
  it("lets a photograph take both roads", () => {
    expect(cropTakeAllowedOn("photograph")).toBe(true);
  });

  it("narrows a DRAWING away from the crop road", () => {
    expect(cropTakeAllowedOn("drawn")).toBe(false);
  });

  it("CHANGES NOTHING when the reader did not answer — the arm that matters", () => {
    /*
      A door that narrows on silence turns customers away on a provider's bad
      minute, which is exactly the verdict fable-1052 forbids. The licence to
      narrow comes from a positive `drawn` answer or from nowhere.
    */
    expect(cropTakeAllowedOn("unreadable")).toBe(true);
  });

  it("covers every medium the type can hold", () => {
    /* Totality, so a fourth member cannot arrive with no rule about it. */
    for (const medium of REFERENCE_MEDIA) {
      expect(typeof cropTakeAllowedOn(medium)).toBe("boolean");
    }
  });
});

describe("the answer parser — driven on the shapes a model actually returns", () => {
  it("reads the JSON it asked for", () => {
    expect(readMediumAnswer('{"medium":"photograph"}')).toBe("photograph");
    expect(readMediumAnswer('{"medium":"drawn"}')).toBe("drawn");
  });

  it("reads a bare word, because a one-word question invites one", () => {
    expect(readMediumAnswer("photograph")).toBe("photograph");
    expect(readMediumAnswer("  Drawn.  ")).toBe("drawn");
    expect(readMediumAnswer('"photograph"')).toBe("photograph");
  });

  it("REFUSES A SENTENCE CONTAINING THE WORD — the trap in a substring match", () => {
    /*
      "This is not a photograph" contains "photograph" and would read as its own
      opposite under a `includes()` test. The whole reply must BE the word.
    */
    expect(readMediumAnswer("This is not a photograph, it is a painting")).toBe("unreadable");
    expect(readMediumAnswer("I think it may be drawn, but I am not sure")).toBe("unreadable");
  });

  it("calls anything else unreadable rather than guessing", () => {
    expect(readMediumAnswer("")).toBe("unreadable");
    expect(readMediumAnswer("{}")).toBe("unreadable");
    expect(readMediumAnswer('{"medium":"illustration"}')).toBe("unreadable");
    expect(readMediumAnswer('{"medium":null}')).toBe("unreadable");
  });
});

describe("the read itself, with the engine injected", () => {
  it("returns what the reader said", async () => {
    expect(await readReferenceMedium({ ...BYTES, engine: engineSaying('{"medium":"drawn"}') }))
      .toBe("drawn");
  });

  it("is UNREADABLE with no transport — never a guess in either direction", async () => {
    expect(await readReferenceMedium({ ...BYTES, engine: null })).toBe("unreadable");
  });

  it("is UNREADABLE when the call throws, and does not take the ask down with it", async () => {
    const engine = {
      id: "test:medium",
      complete: async () => { throw new Error("the transport is having a moment"); },
    } as never;
    expect(await readReferenceMedium({ ...BYTES, engine })).toBe("unreadable");
  });
});

describe("what she is told", () => {
  it("says no and offers the road that DOES serve her picture, in one breath", () => {
    /* A refusal that only says no leaves a customer holding a picture with
       nowhere to go, and the words road genuinely serves a drawing well. */
    expect(DRAWN_NARROWED_NOTE).toMatch(/illustration/);
    expect(DRAWN_NARROWED_NOTE).toMatch(/colour/i);
    /* And it names the sentence she could type — the difference between a door
       and a dead end. */
    expect(DRAWN_NARROWED_NOTE).toMatch(/copy just the hair colour/);
  });

  it("never says the ask was refused, because it was not", () => {
    expect(DRAWN_NARROWED_NOTE).not.toMatch(/can't do that|cannot be rendered|nothing was charged/i);
  });
});
