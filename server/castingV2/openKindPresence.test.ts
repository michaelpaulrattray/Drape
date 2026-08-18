/**
 * DOES THE PICTURE CONTAIN THE THING NOBODY HAS CATALOGUED? — the open lane
 * entering the verification net (fable-911 §2, shape (C)).
 *
 * # The gap this closes
 *
 * `VerifiableFact` was keyed on `Facet`, a CLOSED union, so an open kind could
 * not enter the net at all — not the reader's question, not the stored verdict,
 * not the report. The one lane whose entire money story is *is the thing there*
 * was the one lane with no presence check: a customer types *"give her a halo"*,
 * pays 25 credits, and if the frame comes back bare nothing disputes it and
 * nothing is recorded for anyone to count later.
 *
 * # THE LINE THIS FILE EXISTS TO KEEP TRUE
 *
 * **A presence verdict is evidence about a FRAME and never an instruction to
 * the library.** No miss retires a crop or drops a carry, ever. The structural
 * proof is here rather than in prose: an open check carries NO facet, and every
 * door that could retire pixels is keyed on one.
 *
 * Every test drives the reader through a scripted engine — no live model, no
 * network (working law 3), and both controls are driven before any verdict
 * counts (working law 2).
 */
import { describe, expect, it } from "vitest";
import type { TextEngine, TextResult } from "../providers/types";
import { openKindBinds, openKindPresenceBindsToday } from "./openKindPolicy";
import { facetOfSubject } from "./refineFacets";
import {
  aboutFacet,
  aboutOpenKind,
  facetIn,
  isMiss,
  isRefusableMiss,
  subjectKey,
  verifyRender,
  type VerifiableFact,
} from "./renderVerification";

const bytes = Buffer.from("not really a photograph");

/** A reader that says exactly what the test tells it to, and records the ask. */
function scriptedEngine(reply: string): TextEngine & { asked: string[] } {
  const engine = {
    id: "scripted",
    asked: [] as string[],
    async complete(request: { user: string }): Promise<TextResult> {
      engine.asked.push(request.user);
      return {
        text: reply,
        provenance: { provider: "test", model: "scripted" } as unknown as TextResult["provenance"],
        latencyMs: 1,
      };
    },
  };
  return engine;
}

const HALO: VerifiableFact = {
  subject: aboutOpenKind({ slot: "open:halo", noun: "halo" }),
  asked: "a thin gold ring floating above her head",
  binding: openKindPresenceBindsToday(),
};

async function read(reply: string, facts: ReadonlyArray<VerifiableFact>) {
  const engine = scriptedEngine(reply);
  const verdict = await verifyRender({ bytes, contentType: "image/png", facts, engine });
  return { verdict, engine };
}

describe("an open kind is asked about at all", () => {
  it("records the MISS on a frame that came back bare — the defect's own shape", async () => {
    const { verdict } = await read(
      '{"results":[{"id":1,"present":false,"absent":true,"saw":"nothing above her head"}]}',
      [HALO],
    );

    expect(verdict.checks).toHaveLength(1);
    expect(isMiss(verdict.checks[0]!)).toBe(true);
    expect(verdict.checks[0]!.saw).toBe("nothing above her head");
    expect(verdict.checks[0]!.absent).toBe(true);
  });

  it("POSITIVE CONTROL — the same reader passes a frame that has it", async () => {
    /* Without this the miss above proves nothing: an instrument that answers
       MISS to everything discriminates nothing (working law 2). */
    const { verdict } = await read(
      '{"results":[{"id":1,"present":true,"saw":"a thin gold ring hovering over her hair"}]}',
      [HALO],
    );

    expect(verdict.checks[0]!.verified).toBe(true);
    expect(isMiss(verdict.checks[0]!)).toBe(false);
  });

  it("asks under the STORED NOUN, never the key — `cat ears`, not `cat-ears`", async () => {
    /*
      `open:cat-ears` is lossy: `cat ears` and `cat-ears` key identically, so
      the noun cannot be recovered from the token. Composing the question from
      the key would ask a paid reader about "cat-ears".
    */
    const { engine } = await read(
      '{"results":[{"id":1,"present":true,"saw":"grey furred ears on her head"}]}',
      [{
        subject: aboutOpenKind({ slot: "open:cat-ears", noun: "cat ears" }),
        asked: "soft grey cat ears",
        binding: false,
      }],
    );

    expect(engine.asked[0]).toContain("CAT EARS: soft grey cat ears");
    expect(engine.asked[0]).not.toContain("CAT-EARS");
  });

  it("keeps the closed lane's questions exactly as they were", async () => {
    /* The negative control for the change's AIM: a facet fact is still asked
       under its own heading, so nothing about this widening moved the lane it
       was not for. */
    const { engine } = await read(
      '{"results":[{"id":1,"present":true,"saw":"hair gathered at the nape"}]}',
      [{ subject: aboutFacet(facetOfSubject("hairWorn")), asked: "tied up", binding: false }],
    );

    expect(engine.asked[0]).toContain("HAIR WORN: tied up");
  });
});

describe("a presence verdict is evidence about a FRAME, never an instruction to the library", () => {
  it("cannot refuse, however loudly the reader says the thing is absent", async () => {
    /*
      NON-BINDING ON THIS BUILD (fable-911 §2 (1)). The kind has no specimen
      family, no court and no measured reliability — an unmeasured reader may
      not spend a customer's money being wrong (law 9). Record, never refund.
    */
    const { verdict } = await read(
      '{"results":[{"id":1,"present":false,"absent":true,"saw":"nothing above her head"}]}',
      [HALO],
    );

    expect(verdict.checks[0]!.binding).toBe(false);
    expect(isRefusableMiss(verdict.checks[0]!)).toBe(false);
    expect(verdict.ok).toBe(true);
  });

  it("carries NO facet, so no door that retires pixels can ever see it", async () => {
    /*
      The structural half of decision (3). Segment earning, the disputed list
      and every library retirement are keyed on a facet; an open check has
      none, so a false ABSENT cannot destroy the only crop of a thing that
      cannot be re-catalogued.
    */
    const { verdict } = await read(
      '{"results":[{"id":1,"present":false,"absent":true,"saw":"nothing above her head"}]}',
      [HALO],
    );

    expect(facetIn(verdict.checks[0]!.subject)).toBeNull();
    expect(subjectKey(verdict.checks[0]!.subject)).toBe("open:halo");
  });

  it("declares the deviation from its own policy rather than hiding it", async () => {
    /*
      `openKindBinds()` has answered "presence" correctly to nobody since it was
      written — the gate-not-reader class. It is READ now, and the runtime's
      answer is deliberately not yet the policy's: promotion to binding takes
      accumulated verdicts plus a court with the founder's eye on the misses,
      as its own ruling.
    */
    expect(openKindBinds()).toBe("presence");
    expect(openKindPresenceBindsToday()).toBe(false);
  });
});
