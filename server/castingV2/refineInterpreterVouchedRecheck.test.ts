/**
 * THE INVENTION DOOR'S RESCUE ASKS THE MODEL NOTHING (ruled fable-1141 §2).
 *
 * # The defect, measured on the founder's own road
 *
 * When containment refuses a value, the invention door asks whether the value
 * asserts anything that is not hers. If it does not, the reading is rescued.
 * That rescue used to be a SECOND READING with the value vouched — and a second
 * sampling is free to re-word the value the door has just adjudicated:
 *
 *     vouched on   "her hairstyle in the attached picture"
 *     re-read got  "her hairstyle FROM the attached picture"   → vouch misses
 *
 * On a Cast whose hair was already filed, a legitimate reference ask landed
 * **4 of 11**, and every refusal arrived AFTER the door had said the value says
 * only what she asked. The door was right and the re-sample threw its answer
 * away. After the fix, the same bench cell: **4 of 4**, and the whole eleven-
 * sentence bench is 20/20 on the take arms with 12/12 still walling on the
 * identity arms.
 *
 * # What is asserted here, and why a live bench cannot assert it
 *
 * The bench proves the outcome. It cannot prove the MECHANISM — a bench cell
 * that passes because the re-read happened to keep its wording looks exactly
 * like one that passes because there is no re-read. These arms are driven
 * against a scripted engine, so the absence of the second reading is a fact
 * about the code rather than about a sampling.
 *
 * The third arm is the one that would have caught the original defect: the
 * script's next reply is a DIFFERENT value, and the assertion is that it is
 * never consumed. Under the old path it would have been, and the vouch would
 * have missed.
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement } from "./refineInterpreter";

/**
 * An engine that answers BY PURPOSE and records every request.
 *
 * Deliberately not a positional script. The first version of this file supplied
 * four replies in order and asserted a count of three — and the real path asks
 * `interpret`, `reask.echo`, `reask.echo`, then the door, so the door was
 * handed a reading and the arms failed for a reason that had nothing to do with
 * their subject. **A test that encodes an incidental call count is testing the
 * call count.** What these arms are actually about is whether a READING ever
 * follows the door, and that is asked directly below.
 */
function scripted(input: { readings: string[]; door: string }): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const isDoor = String(request.system ?? "").includes("Answer whether that value asserts any FACT");
      const reply = isDoor
        ? input.door
        : (input.readings[index] ?? input.readings[input.readings.length - 1]!);
      if (!isDoor) index += 1;
      return {
        text: reply,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      };
    },
  } as never;
}

/* The instruction contains none of "attached", "picture" or "hairstyle in", so
   containment must refuse this value — which is the state the door exists for. */
const INSTRUCTION = "give him her hairstyle";
const REFUSED_VALUE = "her hairstyle in the attached picture";
const REWORDED_VALUE = "her hairstyle FROM the attached picture";

const readingWith = (value: string) => JSON.stringify({
  intent: "edit",
  free: { hairCut: value },
  fromReference: true,
});
const DOOR_SAYS_FINE = JSON.stringify({ invents: false, fact: null });
const DOOR_SAYS_INVENTS = JSON.stringify({ invents: true, fact: "a colour she never gave" });

function isDoorRequest(request: TextRequest): boolean {
  return String(request.system ?? "").includes("Answer whether that value asserts any FACT");
}

/**
 * EVERY READING THIS PATH ASKS FOR, in order, with the re-worded value waiting
 * at the end of the queue.
 *
 * The trap is the last entry: if anything reads again after the door, it gets a
 * DIFFERENT value, the vouch misses, and the arms below say so. Under the fixed
 * path nothing reaches it.
 */
const READINGS = [
  readingWith(REFUSED_VALUE),
  readingWith(REFUSED_VALUE),
  readingWith(REFUSED_VALUE),
  readingWith(REWORDED_VALUE),
];

describe("rescuing a contained value", () => {
  it("files the value the door approved, without reading anything again", async () => {
    /*
      The engine answers readings from a queue whose LAST entry is a different
      value. Nothing may reach it, so the delta must carry the value the door
      judged and not that one.
    */
    const engine = scripted({ readings: READINGS, door: DOOR_SAYS_FINE });
    const parse = await interpretRefinement({
      instruction: INSTRUCTION,
      referenceAttached: true,
      engine,
    } as never);

    expect(parse.ok, "the door approved it, so the reading is rescued").toBe(true);
    if (!parse.ok || !("delta" in parse)) throw new Error("expected a rescued edit");
    expect(parse.door).toBe("rescued");
    expect(parse.doorAt).toBe("wall_unfileable");
    /* THE VALUE IS THE ONE THE DOOR JUDGED — not the re-worded one waiting at
       the end of the queue, and not a normalisation of either. */
    expect(JSON.stringify(parse.delta)).toContain(REFUSED_VALUE);
    expect(JSON.stringify(parse.delta)).not.toContain("FROM the attached picture");
  });

  it("consumes NO reading after the door — the fourth reply is never asked for", async () => {
    /*
      THE MECHANISM, not the outcome. This is the arm the live bench cannot
      supply: it fails if a rescue ever goes back to the model, whatever that
      model would have said.
    */
    const engine = scripted({ readings: READINGS, door: DOOR_SAYS_FINE });
    await interpretRefinement({
      instruction: INSTRUCTION,
      referenceAttached: true,
      engine,
    } as never);

    const doors = engine.seen.filter(isDoorRequest);
    expect(doors, "the door is asked exactly once").toHaveLength(1);
    /*
      THE ASSERTION THAT IS THE SUBJECT: nothing is READ after the door. Stated
      as a position rather than as a total, so the arm survives the path gaining
      or losing an echo pass and fails only on the thing it is about.
    */
    const doorAt = engine.seen.findIndex(isDoorRequest);
    const afterTheDoor = engine.seen.slice(doorAt + 1);
    expect(afterTheDoor, "a reading after the door is the re-sample this fix deleted").toHaveLength(0);
  });

  it("still upholds the refusal when the door says the value invents", async () => {
    /*
      THE NEGATIVE CONTROL. The rescue path was made cheaper, not wider — a
      value the door refuses must still be refused, or the fix would have turned
      a guard into a bypass (`misaimed-guard-fails-both-ways`).
    */
    const engine = scripted({ readings: READINGS, door: DOOR_SAYS_INVENTS });
    const parse = await interpretRefinement({
      instruction: INSTRUCTION,
      referenceAttached: true,
      engine,
    } as never);

    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("wall_unfileable");
    expect(parse.door).toBe("upheld");
    /* And it did not shop for a better answer after being refused. */
    const doorAt = engine.seen.findIndex(isDoorRequest);
    expect(engine.seen.slice(doorAt + 1)).toHaveLength(0);
  });

  it("upholds when the door cannot be asked at all", async () => {
    /*
      An unreadable verdict may not become a licence — the door's own rule, and
      it has to survive a change to what the door does afterwards.
    */
    const engine = scripted({ readings: READINGS, door: "not json at all" });
    const parse = await interpretRefinement({
      instruction: INSTRUCTION,
      referenceAttached: true,
      engine,
    } as never);
    expect(parse.ok).toBe(false);
    if (parse.ok) return;
    expect(parse.refusal.reason).toBe("wall_unfileable");
  });
});
