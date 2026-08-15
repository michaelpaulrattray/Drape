/**
 * THE COLOUR-CONTEXT DOOR — a content wall re-read without D-178's history line
 * (opus-477 / fable-635).
 *
 * # The defect these drive
 *
 * *"Give her vampire fangs"* walled `wall_content` on ~7% of attempts through
 * the service and on none of 630 asked bare, and three shifts theorised about
 * the difference. Recorded and bisected at n=120 per arm, the whole effect is
 * ONE line of the thirteen the service adds:
 *
 * ```
 * bare 0/120 · her facet values 0/120 · everything currently filed 1/120
 * D-178's "the last colour they changed was the hair" 8/120
 * all thirteen together 8/120
 * ```
 *
 * A customer typing four words and getting a refusal one time in fourteen, for
 * a sentence about her teeth, because of a sentence about her hair.
 *
 * # WHY THEY ARE DRIVEN AND NOT PROBED
 *
 * Working law 3. The event this door exists for happens on the model's own
 * schedule at about one attempt in fourteen, so a test that waited for it would
 * be a test that usually proves nothing. Every engine here is scripted: the
 * wall is claimed on demand, and the assertions are on the OUTGOING REQUEST and
 * the returned parse.
 *
 * The paid measurements live beside them and are cited rather than repeated:
 * `output/request-recorder/`, `output/wall-bisect/`, `output/wall-strip-safety/`
 * (a genuinely refusable ask, 60/60 walled with the line and 60/60 without it),
 * `output/relative-colour-corner/` (the misfile corner, and D-178's own
 * backstop catching every instance of it).
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";
import { needsColourReferent, redirectColourTo } from "./refineReask";
import { facetOfSubject } from "./refineFacets";

const FILED = JSON.stringify({ intent: "edit", free: { teeth: "vampire fangs" } });
const CONTENT_WALL = JSON.stringify({ wall: "content" });

/** An engine that records every request and replies from a script. */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)]!;
      index += 1;
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      };
    },
  } as TextEngine & { seen: TextRequest[] };
}

const FACE = {
  currentEyeColour: "near-black",
  currentEyeShape: null,
  currentHairColour: "copper",
  currentHairStyle: "ponytail",
  currentHairTexture: "wavy",
  currentMakeup: null,
};
const ASK = "give her vampire fangs";
/* The sentence the bisect convicted, quoted from the recorded request. */
const THE_LINE = "The last colour they changed was";

describe("the colour-context door", () => {
  it("re-reads a content wall with the history line withheld, and serves it", async () => {
    const engine = scripted([CONTENT_WALL, FILED]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
    });

    expect(parse.ok).toBe(true);
    expect(engine.seen).toHaveLength(2);
    /* ASSERTED AT THE WIRE, both ways. The line rides the first request and is
       absent from the second — a door that withheld nothing would pass every
       other assertion in this file. */
    expect(engine.seen[0]!.user).toContain(THE_LINE);
    expect(engine.seen[1]!.user).not.toContain(THE_LINE);
  });

  it("changes NOTHING ELSE about the second request — only that line leaves", async () => {
    const engine = scripted([CONTENT_WALL, FILED]);
    await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
      prior: { hairShade: ["copper"], marks: ["freckles"] },
    });

    const [first, second] = engine.seen;
    expect(first!.system).toBe(second!.system);
    /* Her facet values and everything filed are still there — the bisect
       exonerated them at 0/120 and 1/120, and withholding them too would be a
       wider change than the measurement supports. */
    expect(second!.user).toContain("Current hair colour: copper");
    expect(second!.user).toContain('Currently filed under marks: ["freckles"]');
    expect(second!.user).toContain(`Instruction: ${ASK}`);
    /* The whole diff between the two requests is the one line. */
    const removed = first!.user.split("\n").filter((line) => !second!.user.split("\n").includes(line));
    expect(removed).toHaveLength(1);
    expect(removed[0]).toContain(THE_LINE);
  });

  it("stands when the re-read walls again, and re-reads exactly once", async () => {
    const engine = scripted([CONTENT_WALL]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_content");
    /* Two, not three and not forever: the re-read sets `colourWithheld` and the
       door is gated on its absence. The worst case is exactly the behaviour
       that shipped before this existed, plus one free call. */
    expect(engine.seen).toHaveLength(2);
  });

  it("spends NO second call when there is no colour history to withhold", async () => {
    /* A face nobody has recoloured sends no such line, so this door does not
       exist for her — and this is the assertion that keeps it narrow. */
    const engine = scripted([CONTENT_WALL, FILED]);
    const parse = await interpretRefinement({ instruction: ASK, engine, ...FACE });

    expect(parse.ok).toBe(false);
    expect(engine.seen).toHaveLength(1);
  });

  it("leaves every other wall alone", async () => {
    const stage = scripted([JSON.stringify({ wall: "stage", asked: "a coat" })]);
    const likeness = scripted([JSON.stringify({ wall: "likeness" }), JSON.stringify({ wall: "likeness" })]);

    const one = await interpretRefinement({
      instruction: "put her in a long black coat", engine: stage, ...FACE, lastColourFacet: "the hair",
    });
    const two = await interpretRefinement({
      instruction: "make her look like Rihanna", engine: likeness, ...FACE, lastColourFacet: "the hair",
    });

    expect(one.ok === false && one.refusal.reason).toBe("wall_stage");
    expect(two.ok === false && two.refusal.reason).toBe("wall_likeness");
    /* A backed stage wall is still settled in one call — this door is pointed
       at one wall, not bolted onto all of them. */
    expect(stage.seen).toHaveLength(1);
  });

  it("does not rescue a re-read that comes back as anything but an edit", async () => {
    /* Deliberately conservative, for the invention door's reason beside it: the
       other ok shapes carry no place to record which door served them, and an
       uncounted rescue is a rescue nobody can audit. It falls through to the
       refusal that shipped before this existed. */
    const engine = scripted([CONTENT_WALL, JSON.stringify({ navigate: true })]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
    });

    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_content");
  });
});

/**
 * THE CORNER, DRIVEN RATHER THAN ARGUED (fable-635 §2b, fable-636 §4).
 *
 * The door withholds the one line that says what "it" is. On *"make it darker"*
 * that line is the whole referent, so a rescue could file the change against
 * the wrong feature of her face and she pays for an edit she never asked for.
 *
 * Two things are proved here, and the first is what makes the second worth
 * anything: **the corner is REACHABLE** — B's own path really can serve a
 * misfiled colour — and **the product already catches it**, in code, from its
 * own remembered facet rather than from anything the interpreter was told.
 *
 * Measured beside this on the real transport (`output/relative-colour-corner/`):
 * with the line withheld the interpreter targeted her EYES on 2 of 24 served
 * reads of "make it warmer", and D-178's backstop corrected every one. It also
 * misfiled ONCE WITH the line present — so this corner is older than this door
 * and was never created by it.
 */
describe("a colour-relative ask that flakes into the content wall", () => {
  it("REACHES the corner: the re-read serves, and it can file the wrong feature", async () => {
    const misfiled = JSON.stringify({ intent: "edit", eyeColour: "amber" });
    const engine = scripted([CONTENT_WALL, misfiled]);
    const parse = await interpretRefinement({
      instruction: "make it darker", engine, ...FACE, lastColourFacet: "the hair",
    });

    /* Served, so the corner is not synthetic — a corner declared unreachable is
       a corner nobody writes the test for. */
    expect(parse.ok).toBe(true);
    expect(parse.ok && "delta" in parse && parse.delta.eyeColour).toBe("amber");
    expect(engine.seen[1]!.user).not.toContain(THE_LINE);
  });

  it("and the product's own backstop moves it back, from the facet the SERVICE remembers", () => {
    /*
      `refineService.ts` runs this on the composed delta whenever the sentence
      needs a referent — from its OWN `lastColourFacet` local, which survives
      whatever the interpreter was or was not told. So the rescue cannot escape
      it. Driven both ways: it fires here, and it stays silent on an ask that
      names its own subject.
    */
    expect(needsColourReferent("make it darker")).toBe(true);
    expect(needsColourReferent(ASK)).toBe(false);

    const moved = redirectColourTo({ eyeColour: "amber" }, facetOfSubject("hairShade"));
    expect(moved.eyeColour).toBeUndefined();
    expect(moved.free?.hairShade).toBe("amber");
  });

  it("re-walls honestly when the second read walls too — no rescue, no misfile", async () => {
    const engine = scripted([CONTENT_WALL]);
    const parse = await interpretRefinement({
      instruction: "make it darker", engine, ...FACE, lastColourFacet: "the hair",
    });
    expect(parse.ok).toBe(false);
    expect(parse.ok === false && parse.refusal.reason).toBe("wall_content");
  });
});

describe("the tally can tell the two doors apart", () => {
  it("stamps a colour-context rescue with its own wall", async () => {
    const engine = scripted([CONTENT_WALL, FILED]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
    });

    expect(parse.ok && "door" in parse && parse.door).toBe("rescued");
    expect(parse.ok && "doorAt" in parse && parse.doorAt).toBe("wall_content");
  });

  it("stamps a colour-context refusal it upheld", async () => {
    const engine = scripted([CONTENT_WALL]);
    const parse = await interpretRefinement({
      instruction: ASK, engine, ...FACE, lastColourFacet: "the hair",
    });

    expect(parse.ok === false && parse.door).toBe("upheld");
    expect(parse.ok === false && parse.doorAt).toBe("wall_content");
  });

  it("leaves the INVENTION door stamped with ITS wall — the control that stops one label swallowing both", async () => {
    /*
      Without this, `doorAt: "wall_content"` everywhere would pass both tests
      above and file every rescue in the product under one name — which is the
      exact defect fable-635 §2c ordered fixed, reintroduced from the other
      side.

      The route: a free value containment refuses, the echo pass tries twice,
      the invention door asks whether the value invents, it says no, and the
      re-read with it vouched serves.
    */
    const his = "give her a harry potter lighting bolt scar on her forehead";
    const repaired = JSON.stringify({
      intent: "edit",
      free: { marks: "a lightning bolt scar on her forehead" },
    });
    const asksNothing = JSON.stringify({ invents: false, fact: null });
    const engine = scripted([repaired, repaired, repaired, asksNothing, repaired]);
    const parse = await interpretRefinement({
      instruction: his, engine, ...FACE, lastColourFacet: "the hair",
    });

    if (parse.ok && "door" in parse && parse.door !== undefined) {
      expect(parse.doorAt).toBe("wall_unfileable");
    } else if (parse.ok === false && parse.door !== undefined) {
      expect(parse.doorAt).toBe("wall_unfileable");
    } else {
      throw new Error("no door ran — this control has stopped controlling anything and must be repaired, not deleted");
    }
  });
});
