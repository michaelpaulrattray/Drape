import { describe, expect, it, vi } from "vitest";

import {
  BRIEF_CHIPS_MAX,
  BRIEF_CHIP_MAX_WORDS,
  briefChipsFor,
  briefChipsSystemPrompt,
  chipRefusal,
  chipRepeatsBrief,
  normalizeChip,
} from "./briefChips";
import {
  REIMAGINE_DIRECTION_MARGIN,
  REIMAGINE_WORD_BUDGET,
  reimagineBrief,
} from "./reimagine";
import { countWords } from "./promptAuthor";
import type { TextEngine } from "../providers/types";

/**
 * THE GENERATED CHIPS (#535 decision 12) and the tap that folds one in.
 *
 * The defect the whole feature answers is his, verbatim (Crew reply #144):
 * *"The chip options come from the old lists ("slim build" offered on an
 * ogre) and the edit gets tacked onto the end of the prompt instead of
 * rewritten into it."* Both halves have an arm below with his own specimen in
 * it, because a guard proven on invented words is a guard proven against
 * nothing (`specimen joins the vocabulary`).
 *
 * Every arm here drives the real functions. The engine is a double, but it is
 * a double that answers like the OUTCOME — a list of lines — rather than one
 * that answers like the assertion.
 */

function engineSaying(replies: string[]): { engine: TextEngine; calls: () => number; asked: () => string[] } {
  let call = 0;
  const asked: string[] = [];
  const engine = {
    id: "double",
    complete: vi.fn(async (request: { system: string; user: string }) => {
      asked.push(`${request.system}\n---USER---\n${request.user}`);
      const reply = replies[Math.min(call, replies.length - 1)];
      call += 1;
      return {
        text: reply,
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      };
    }),
  } as unknown as TextEngine;
  return { engine, calls: () => call, asked: () => asked };
}

const OGRE = "an ogre chieftain in his 50s";

describe("a chip is written from HER brief, not from a list (#535 decision 12)", () => {
  it("keeps directions in the brief's own world", async () => {
    const { engine } = engineSaying([
      ["weathered by a hard country", "gear of old iron and hide", "scars he never explains"].join("\n"),
    ]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toEqual([
      "weathered by a hard country",
      "gear of old iron and hide",
      "scars he never explains",
    ]);
  });

  /*
    HIS OWN SPECIMEN, as the negative control. "slim build" is what the legacy
    list offered his ogre, and it is refused here for the reason it was wrong
    there: `build` is a piece noun the brief never named. If this arm ever
    goes green on the chip surviving, the feature has grown back its defect.
  */
  it("refuses his named defect — a body word off a generic list", () => {
    expect(chipRefusal("slim build", OGRE)).not.toBeNull();
  });

  it("refuses a colour the brief never asked about", () => {
    expect(chipRefusal("piercing blue eyes", OGRE)).not.toBeNull();
  });

  it("refuses the locked trio — a chip may not age, sex or re-species the subject", () => {
    expect(chipRefusal("in his twenties still", OGRE)).toBe("claims an age");
    expect(chipRefusal("still young enough to prove it", OGRE)).toBe("claims an age");
    expect(chipRefusal("a woman who has seen things", OGRE)).toBe("claims a sex");
    expect(chipRefusal("something wolflike in the jaw", OGRE)).toBe("claims a species");
  });

  /*
    THE SEED EXEMPTION, driven before it was written and the reason it exists:
    without it `saysSex` reads the "he" in the best chip written for his ogre
    as a claim, and the guard meant to protect him refuses him.
  */
  it("a chip in her brief's own register keeps her pronoun, her age and her kind", () => {
    expect(chipRefusal("scars he never explains", OGRE)).toBeNull();
    expect(chipRefusal("an ogre's patience with nobody", "an ogre chieftain in his 50s")).toBeNull();
  });

  /*
    DECLARED LIMITS, pinned so the next reader finds them here rather than in
    production. Both fall the safe way: the chip lands in a box she reads and
    can undo in one tap.
  */
  it("names what the readers cannot see", () => {
    /* `ageClaimsIn` reads "in his twenties" and not "barely into his twenties". */
    expect(chipRefusal("barely into his twenties", OGRE)).not.toBe("claims an age");
    /* The species floor is a closed vocabulary — an open-set kind passes. */
    expect(chipRefusal("a moth-winged stillness", OGRE)).toBeNull();
  });

  it("refuses lighting and the room — the studio owns those (decision 7)", () => {
    expect(chipRefusal("lit from below", OGRE)).toContain("camera");
    expect(chipRefusal("a soft key light on him", OGRE)).toContain("camera");
    expect(chipRefusal("against a bare backdrop", OGRE)).toContain("camera");
    expect(chipRefusal("shot on a long lens", OGRE)).toContain("camera");
  });

  /*
    ⚠ THE OTHER HALF OF THE SAME GUARD, and it is here because the first draft
    got it wrong and the LIVE DRIVE caught it: a word list that owned `crop`,
    `light`, `set`, `shot` and `shadow` refused "hair cropped brutally short"
    on his cyborg — while HIS OWN standing brief says "close-cropped hair".
    These are the sentences that must survive; the typo-gate class is exactly
    a guard that owns a real word.
  */
  it("does NOT own the ordinary words of casting prose", () => {
    expect(chipRefusal("hair cropped brutally short", OGRE)).toBeNull();
    expect(chipRefusal("a set jaw and no hurry", OGRE)).toBeNull();
    expect(chipRefusal("shadows worn under the eyes", OGRE)).toBeNull();
    expect(chipRefusal("shot through with old wounds", OGRE)).toBeNull();
    expect(chipRefusal("small status lights that never rest", OGRE)).toBeNull();
    expect(chipRefusal("light on his feet for his size", OGRE)).toBeNull();
  });

  it("refuses an instruction — a chip is a quality the customer adopts", () => {
    expect(chipRefusal("make him more monstrous", OGRE)).toBe("an instruction, not a quality");
  });

  it("refuses a fragment that is only her own words back", () => {
    expect(chipRefusal("an ogre chieftain", OGRE)).toBe("already in the brief");
    /* One shared content word is not a repeat — the chip is still doing work. */
    expect(chipRepeatsBrief("gear of old iron and hide", "an ogre chieftain with gear")).toBe(false);
  });

  it("holds the fragment shape at both ends", () => {
    expect(chipRefusal("weathered", OGRE)).toContain("single word");
    expect(chipRefusal("a".concat(" b").repeat(BRIEF_CHIP_MAX_WORDS + 2), OGRE)).toContain("fragment");
    /* His ogre's best line was nine words and an eight-word ceiling threw it away — driven, then raised. */
    expect(chipRefusal("a calm that settles a room before he speaks", OGRE)).toBeNull();
  });

  it("normalizes what a model wraps around a bare line", () => {
    expect(normalizeChip("- weathered by a hard country")).toBe("weathered by a hard country");
    expect(normalizeChip('2. "scars he never explains."')).toBe("scars he never explains");
  });
});

describe("the honest empty (his sentence: a brief that pins everything shows no taste chips)", () => {
  it("drops the bad chips and keeps the good ones — one bad line never costs the list", async () => {
    const { engine } = engineSaying([
      ["slim build", "weathered by a hard country", "make him angrier", "scars he never explains"].join("\n"),
    ]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toEqual(["weathered by a hard country", "scars he never explains"]);
    expect(outcome.dropped).toHaveLength(2);
  });

  it("re-asks ONCE when nothing at all survived, then stands with nothing", async () => {
    const { engine, calls } = engineSaying(["slim build\nblue eyes", "slim build\nblue eyes"]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toEqual([]);
    expect(calls()).toBe(2);
  });

  it("does NOT re-ask to top up a partial list", async () => {
    const { engine, calls } = engineSaying(["slim build\nweathered by a hard country"]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toEqual(["weathered by a hard country"]);
    expect(calls()).toBe(1);
  });

  it("an empty reply is nothing to offer, and costs one call", async () => {
    const { engine, calls } = engineSaying([""]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toEqual([]);
    expect(calls()).toBe(1);
  });

  it("never throws when the call does — the sheet draws nothing rather than breaking", async () => {
    const engine = {
      id: "broken",
      complete: vi.fn(async () => {
        throw new Error("upstream is down");
      }),
    } as unknown as TextEngine;
    await expect(briefChipsFor({ engine, briefText: OGRE })).resolves.toEqual(
      expect.objectContaining({ chips: [] }),
    );
  });

  it("caps the list and never repeats a direction", async () => {
    const { engine } = engineSaying([
      [
        "weathered by a hard country",
        "gear of old iron and hide",
        "Weathered by a hard country",
        "scars he never explains",
        "a stillness that reads as threat",
        "hands that have done the work",
      ].join("\n"),
    ]);
    const outcome = await briefChipsFor({ engine, briefText: OGRE });
    expect(outcome.chips).toHaveLength(BRIEF_CHIPS_MAX);
    expect(new Set(outcome.chips).size).toBe(BRIEF_CHIPS_MAX);
  });
});

describe("the instruction says the things his rulings say", () => {
  const prompt = briefChipsSystemPrompt();

  it("carries a worked example and his named miss — and the example is NOT an ogre", () => {
    expect(prompt).toContain("Worked example");
    expect(prompt).toContain("slim build");
    /*
      Driven, then pinned: an ogre example made an ogre BRIEF come back with
      the example's own lines. An ogre is the subject of his defect, so the
      one brief that must be genuinely generated is exactly the one an ogre
      example would spoil.
    */
    expect(prompt).not.toContain("ogre chieftain");
  });

  it("bans the studio's own subjects and the customer's own three facts", () => {
    expect(prompt).toContain("Never lighting, camera");
    expect(prompt).toContain("Never their sex, their age or what kind of being they are");
    expect(prompt).toContain("QUALITIES, NEVER PIECES");
  });

  it("asks for the empty answer out loud", () => {
    expect(prompt).toContain("return NOTHING AT ALL");
  });
});

describe("the tap is a FOLD — written into the brief, never tacked onto its end (his ruling #144)", () => {
  it("composes the direction onto the brief as the editing instruction it is", async () => {
    const { engine, asked } = engineSaying([
      "An ogre chieftain in his 50s, weathered by a hard country he has never left.",
    ]);
    const outcome = await reimagineBrief({
      engine,
      briefText: OGRE,
      direction: "weathered by a hard country",
    });
    expect(outcome.kind).toBe("idea");
    const sent = asked()[0];
    expect(sent).toContain("Apply this direction to the brief above: weathered by a hard country");
    /* The customer's own words go first and whole — the fold's contract. */
    expect(sent).toContain(OGRE);
  });

  /*
    THE ARM THAT PROVES THE SHARED ROAD IS THE FOLD ROAD. The instruction's
    first paragraph is what turns a direction into a rewrite rather than an
    append, so a change that quietly stopped sending it would break his
    ruling with every other arm still green.
  */
  it("sends the fold paragraph with a direction, so the change is rewritten in", async () => {
    const { engine, asked } = engineSaying(["An ogre chieftain in his 50s, weathered by a hard country."]);
    await reimagineBrief({ engine, briefText: OGRE, direction: "weathered by a hard country" });
    expect(asked()[0]).toContain("never tacked onto the end");
  });

  /*
    A STEER IS THE SMALL ACT — driven, then pinned. With the press's own
    220-word allowance, one tap on his eight-word brief came back with
    eighty-five words of new prose: a full re-imagining, which is what the
    glyph beside it is for. Both halves of the fix are asserted, because the
    instruction alone did not hold it.
  */
  it("a tap keeps the brief's own length — the paragraph AND the number", async () => {
    const { engine, asked } = engineSaying(["An ogre chieftain in his 50s, weathered by a hard country."]);
    await reimagineBrief({ engine, briefText: OGRE, direction: "weathered by a hard country" });
    expect(asked()[0]).toContain("that is a STEER, not a re-imagining");
    expect(asked()[0]).toContain(`at most ${countWords(OGRE) + REIMAGINE_DIRECTION_MARGIN} words`);
  });

  it("a press keeps the press's own allowance — the steer clause is not sent", async () => {
    const { engine, asked } = engineSaying(["An ogre chieftain in his 50s, built like a landslide."]);
    await reimagineBrief({ engine, briefText: OGRE });
    expect(asked()[0]).not.toContain("that is a STEER");
    expect(asked()[0]).toContain(`at most ${REIMAGINE_WORD_BUDGET} words`);
  });

  it("a plain press sends no direction line at all", async () => {
    const { engine, asked } = engineSaying(["An ogre chieftain in his 50s, built like a landslide."]);
    await reimagineBrief({ engine, briefText: OGRE });
    expect(asked()[0]).not.toContain("Apply this direction");
  });

  it("an empty or whitespace direction is a plain press, never a fold on nothing", async () => {
    const { engine, asked } = engineSaying(["An ogre chieftain in his 50s, built like a landslide."]);
    await reimagineBrief({ engine, briefText: OGRE, direction: "   " });
    expect(asked()[0]).not.toContain("Apply this direction");
  });

  /*
    The guards still run on a fold, and they run against the COMPOSED text —
    so the direction's own words are the customer's for the seed exemptions,
    which is why a chip may steer a thing the bare brief never named.
  */
  it("still refuses a draft that drops a locked fact on a fold", async () => {
    const { engine } = engineSaying([
      /* Drops "his" — the sex the brief typed — twice, so the re-ask fails too. */
      "An ogre chieftain in their 50s, weathered by a hard country.",
      "An ogre chieftain in their 50s, weathered by a hard country.",
    ]);
    const outcome = await reimagineBrief({
      engine,
      briefText: OGRE,
      direction: "weathered by a hard country",
    });
    expect(outcome.kind).toBe("nothing");
  });
});
