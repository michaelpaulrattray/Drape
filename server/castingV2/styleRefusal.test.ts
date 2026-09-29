import { describe, expect, it } from "vitest";

import { castingBriefCompiler } from "./briefCompiler";
import { parseCastingIntent } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * A stated visual style is never silently dropped.
 *
 * The defect this pins: "young anime character" produced a full photoreal roll
 * and charged 160 credits for output that ignored a stated fact. The model had
 * correctly answered `cohort: "other"` — but it also sent `"reads": null`, the
 * wire schema declared that field `.optional()` rather than `.nullable()`, and
 * a bare `.optional()` rejects null. The whole reply failed validation, the
 * caller read that as "interpreter unavailable", and the fallback cast the
 * brief as a photoreal human.
 *
 * Two independent guards stood here, tested separately because either alone
 * would have let it through. ⚠ **ONE OF THEM IS GONE WITH THE HOUSE ROAD
 * (#1490 act 1) AND IT WAS NOT WEAKENED — IT WAS MADE UNNECESSARY.**
 *   1. **LIVE.** The schema tolerates null everywhere, so a correct refusal is
 *      never discarded on a technicality.
 *   2. ⚠ **RETIRED.** The fallback screened the brief itself, so an
 *      interpreter outage could not become a photoreal charge for a styled
 *      brief. On the author road the brief reaches the engine VERBATIM: an
 *      anime brief paints anime whether or not the reply parsed, so there is
 *      no photoreal charge to prevent and nothing to screen. The 24 arms that
 *      drove it are deleted below, with their reason in place.
 *
 * What protects the money now is the OUTAGE refusal (#126, his "always"): a
 * brief the reader never read is refused FREE, before anything is claimed. It
 * is untouched by that retirement and is driven below on both populations.
 */

function engineReturning(text: string): TextEngine {
  return {
    id: "test:interpreter",
    complete: async () => ({
      text,
      latencyMs: 5,
      provenance: { provider: "openrouter" as const, model: "test", servedModel: "test" },
    }),
  };
}

/** An engine that always fails — the outage the fallback is written for. */
const deadEngine: TextEngine = {
  id: "test:dead",
  complete: async () => {
    throw new Error("transport is down");
  },
};

const STYLED_BRIEFS = [
  "young anime character",
  "anime girl",
  "an anime swordswoman with silver hair",
  "a cartoon character",
  "cel-shaded cybernetic bounty hunter",
  "manga protagonist, spiky hair",
  "illustrated portrait of a woman",
  "a painterly character study",
  "comic book hero, square jaw",
  "3D render of a young man",
  "a chibi mascot",
  "Pixar-style dad",
];

describe("a null in the reply never discards it", () => {
  /*
    ⚠ THE COHORT HERE WAS `"other"` AND THE EXPECTED REASON WAS
    `unsupported_cohort` UNTIL #1495. Neither was this arm's subject: it exists
    because a reply with nulls in every optional field was once thrown away
    whole, so what it holds is that the NULLS do not discard the reading. The
    retired two-valued vocabulary was only the carrier. `likeness` is a live
    refusal carrying the same null shape, so the arm keeps its own subject
    instead of following the deletion out of the file.
  */
  it("parses a refusal whose optional fields came back null", () => {
    // The exact shape that was thrown away: a real verdict, null everywhere else.
    const parsed = parseCastingIntent(
      JSON.stringify({
        cohort: "likeness",
        role: null,
        characterNotes: null,
        sex: null,
        ageBand: null,
        agePhase: null,
        heritage: null,
        build: null,
        energy: null,
        archetype: null,
        variationAxis: null,
        look: null,
        reads: null,
      }),
    );
    expect(parsed).toEqual({ ok: false, reason: "likeness" });
  });

  it("still parses a photoreal reply whose arrays came back null", () => {
    const parsed = parseCastingIntent(
      JSON.stringify({ cohort: "photoreal_human", role: "a dad", heritage: null, reads: null }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.intent.heritage).toEqual([]);
    expect(parsed.intent.reads).toEqual([]);
  });
});

describe("stated style refuses, across phrasings", () => {
  /*
    ⚠ TWENTY-FOUR ARMS STOOD HERE — TWO `it.each(STYLED_BRIEFS)` BLOCKS, BOTH
    DELETED WITH THE HOUSE ROAD (#1490 act 1), AND THEY ARE THE ONLY ARMS IN
    THIS FILE THAT MOVED.

    Both asserted a REFUSAL this product no longer makes, and neither was
    weakened — the road underneath them was removed by his ruling:

      · *"refuses %j when the interpreter identifies it"* drove the reader with
        `{ cohort: "other" }`, which is the HOUSE road's question. The author
        road asks the four-valued SUBJECT question instead and has exactly two
        walls, likeness and not-a-being (#131 slice C). A stated style is
        not one of them.
      · *"…when the interpreter ANSWERED and the reply could not be read"* drove
        the styled-brief SCREEN, deleted from `briefCompiler` in the same
        commit. Its premise was that the FALLBACK ignores a stated style and
        bills for it; on the author road the brief reaches the engine verbatim,
        so there is nothing to screen.

    ⚠ **The defect this file was written for cannot recur in that shape, which
    is why the arms go rather than move.** An anime brief no longer becomes a
    photoreal charge — it becomes ANIME, which is what was asked for and is the
    mission's own sentence. What still protects the money is the outage refusal
    below, and it is untouched.

    The arm beneath records the new truth so the deletion is not a silent loss
    of coverage: the same briefs that used to be refused now CAST.
  */
  it.each(STYLED_BRIEFS)(
    "casts %j rather than refusing it — the author road's two walls are likeness and not_a_being, and a stated style is neither",
    async (brief) => {
      const compiled = await castingBriefCompiler({
        briefText: brief,
        candidateCount: 8,
        rollSeed: "style",
        engine: engineReturning(JSON.stringify({ subject: "human", reads: null })),
      });
      expect(compiled.candidates).toHaveLength(8);
      /* Her own words reach the engine verbatim — that is why this casts. */
      expect(compiled.candidates[0]!.prompt.startsWith(brief)).toBe(true);
    },
  );

  it.each(STYLED_BRIEFS)(
    "a dead reader refuses %j FREE as an outage, before the styled screen (#126, 'always' — reply #9)",
    async (brief) => {
      const compile = castingBriefCompiler({
        briefText: brief,
        candidateCount: 8,
        rollSeed: "style",
        engine: deadEngine,
      });
      await expect(compile).rejects.toMatchObject({ code: "reader_outage" });
    },
  );

  it("an ordinary brief on a dead reader is refused free too — nobody is charged for a sheet that read none of it", async () => {
    await expect(
      castingBriefCompiler({
        briefText: "a retired boxer with a broken nose",
        candidateCount: 8,
        rollSeed: "style",
        engine: deadEngine,
      }),
    ).rejects.toMatchObject({ code: "reader_outage" });
  });

  it("an ordinary brief whose reply could not be read still casts — the one road that falls back", async () => {
    const compiled = await castingBriefCompiler({
      briefText: "a retired boxer with a broken nose",
      candidateCount: 8,
      rollSeed: "style",
      engine: engineReturning("not json at all"),
    });
    expect(compiled.candidates).toHaveLength(8);
    expect(compiled.compiledBrief.interpreted).toBe(false);
  });
});
