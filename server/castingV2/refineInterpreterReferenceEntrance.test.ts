/**
 * THE TWO SENTENCES A PICTURE ADDS, ASSERTED AT THE WIRE (working laws 3 and 5).
 *
 * # The incident these come from
 *
 * The founder's FIRST use of the reference road was refused. Read off
 * production: an attachment on candidate 1641 at 2026-08-20T01:14:16Z, and an
 * audit row `casting.refusal` / `wall_likeness` on that same candidate
 * thirty-nine seconds later. Nothing charged, no variant row, and no record
 * anywhere of the sentence he typed — `refusalCounter.ts` files "reason, facet,
 * outcome — and nothing she typed", by design.
 *
 * Courted live (`scripts/court-reference-likeness-wall-disposable.mts`), the
 * axis was the SENTENCE and not the Cast — a foil with hair behaved
 * identically, so "female reference onto a bald male" was killed as a
 * hypothesis:
 *
 *     with a picture attached, n=3 per cell, two independent runs
 *     "copy this hairstyle"                    filed 3/3, 3/3
 *     "give him the hair from this picture"    filed 3/3, 3/3
 *     "give him HER hairstyle"                 LIKENESS 3/3, 3/3   ← his shape
 *     "make him look like this woman"          LIKENESS 3/3, 3/3   (control)
 *
 * The pointer list named `this`, `this picture`, `the photo`, `the reference`,
 * `like this` and `from this` — and not the possessive, which is the most
 * natural way an English speaker points at the person in a photo when taking a
 * feature FROM them. So the model did what the prompt told it: read "her" as a
 * real person and raised the likeness wall.
 *
 * The second sentence came from the wall that was standing BEHIND the first.
 * With the possessive admitted, the ask reached containment, which refused it
 * correctly (D-172 — "attached picture" is not in her sentence), and the
 * invention door then upheld the refusal because THAT door is asked by a judge
 * that had never been told a picture existed. Driven directly, on the value
 * production actually produced:
 *
 *     value "her hairstyle in the attached picture", instruction "give him her hairstyle"
 *       without the note   {"invents":true,"fact":"hairstyle is shown in an attached picture"}
 *       with the note      {"invents":false,"fact":null}
 *       NEGATIVE: "a chin-length platinum blonde bob from the attached picture"
 *                          {"invents":true,"fact":"chin-length platinum blonde bob"}
 *
 * # Why these tests and not the court
 *
 * The court costs money and needs a network, so it cannot gate a commit. What
 * survives without it is the pair below, and both are asserted on the OUTGOING
 * REQUEST rather than on a constant beside it — the failure being guarded
 * against is a clause that stops riding, which a constant-equality test cannot
 * see.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { asksNothingOfItsOwn, interpretRefinement } from "./refineInterpreter";

/** An engine that records every request and answers the same thing forever. */
function recording(reply: string): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  return {
    id: "recording",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "recording" },
        latencyMs: 0,
      };
    },
  } as never;
}

const ANY_EDIT = JSON.stringify({ intent: "edit", eyeShape: "fox eyes" });

async function systemOfFirstRead(referenceAttached: boolean): Promise<string> {
  const engine = recording(ANY_EDIT);
  await interpretRefinement({
    instruction: "give him her hairstyle",
    referenceAttached,
    engine,
  } as never);
  expect(engine.seen.length, "the interpreter was never asked anything").toBeGreaterThan(0);
  return String(engine.seen[0]!.system ?? "");
}

describe("what the reading is told when a picture rides the ask", () => {
  it("admits the POSSESSIVE as a pointer at the picture", async () => {
    const system = await systemOfFirstRead(true);
    /* The words his sentence used. Asserted on the outgoing system prompt, so a
       future edit that keeps the constant and stops sending it goes red. */
    expect(system).toContain('"her"');
    expect(system).toContain('"his"');
    expect(system).toContain('"their"');
    expect(system).toContain("the person in it is THE PICTURE'S SUBJECT");
  });

  it("still says the PERSON is the wall, in the same breath", async () => {
    /*
      `misaimed-guard-fails-both-ways`. The clause above widened what counts as
      pointing; if the sentence that keeps the likeness wall ever leaves with
      it, this road starts serving "make him look like this woman".
    */
    const system = await systemOfFirstRead(true);
    expect(system).toContain("STILL THE LIKENESS WALL");
    expect(system).toContain("asking for the PERSON in the picture");
  });

  it("sends none of it when no picture rides", async () => {
    /* THE NEGATIVE CONTROL for both arms above: absent an attachment the prompt
       is byte-identical to the one every other ask has always been read with. */
    const system = await systemOfFirstRead(false);
    expect(system).not.toContain("A PICTURE IS ATTACHED TO THIS INSTRUCTION");
    expect(system).not.toContain("the person in it is THE PICTURE'S SUBJECT");
  });
});

describe("what the invention door is told when a picture rides the ask", () => {
  async function systemOfDoor(referenceAttached: boolean): Promise<string> {
    const engine = recording(JSON.stringify({ invents: false, fact: null }));
    await asksNothingOfItsOwn(engine, {
      instruction: "give him her hairstyle",
      subject: "hairCut",
      /* The value production actually produced — quoted from the log line, not
         a plausible stand-in. An earlier version of this court asked about a
         phrase the door answered the same way with the note and without it, so
         its positive arm was passing on a case that had never been broken. */
      value: "her hairstyle in the attached picture",
      prior: [],
      referenceAttached,
    });
    expect(engine.seen).toHaveLength(1);
    return String(engine.seen[0]!.system ?? "");
  }

  it("tells the door the picture exists, so naming it is not an invention", async () => {
    const system = await systemOfDoor(true);
    expect(system).toContain("THEY ATTACHED A PICTURE TO THIS INSTRUCTION");
    expect(system).toContain("invents nothing");
  });

  it("keeps the door's own question underneath it", async () => {
    /* The note is an ADDITION. The day it replaces the question rather than
       riding after it, the door stops asking anything at all. */
    const system = await systemOfDoor(true);
    expect(system).toContain("Answer whether that value asserts any FACT that is not theirs.");
    expect(system).toContain("Adding a detail they did not give is NOT theirs");
  });

  it("sends none of it when no picture rides", async () => {
    const system = await systemOfDoor(false);
    expect(system).not.toContain("THEY ATTACHED A PICTURE TO THIS INSTRUCTION");
    expect(system).toContain("Answer whether that value asserts any FACT that is not theirs.");
  });

  it("carries the reading's own bit into the door rather than defaulting it", async () => {
    /*
      THE WIRE BETWEEN THE TWO. The door is a separate call and its note is
      worth nothing if the caller never passes the bit — which is exactly the
      shape of the defect that caused this file (`gate-not-reader`: a control
      that reports correctly and is never consulted). Driven through
      `interpretRefinement` so the ARGUMENT is proven, not the parameter.
    */
    const engine = recording(JSON.stringify({
      intent: "edit",
      free: { hairCut: "her hairstyle in the attached picture" },
      fromReference: true,
    }));
    await interpretRefinement({
      instruction: "give him her hairstyle",
      referenceAttached: true,
      engine,
    } as never);
    const doorRequests = engine.seen.filter((request) =>
      String(request.system ?? "").includes("Answer whether that value asserts any FACT"));
    expect(doorRequests.length, "containment never reached the invention door").toBeGreaterThan(0);
    for (const request of doorRequests) {
      expect(String(request.system ?? "")).toContain("THEY ATTACHED A PICTURE TO THIS INSTRUCTION");
    }
  });
});
