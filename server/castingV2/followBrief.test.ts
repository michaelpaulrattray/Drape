/**
 * THE FOLLOW BRIEF (#2576) — the writer, the resolver, and the wire.
 *
 * Driven with engine doubles (law 3: a backstop is tested without a model that
 * usually behaves), and the wire arm drives the REAL `follow` procedure through
 * `appRouter.createCaller` and reads the `briefText` it hands `createRoll`
 * (law 5: the contract is proven on the outgoing request, not on a constant).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import type { FollowBriefSource } from "../db/castingV2";
import {
  BODY_LOOK_ANATOMY,
  FOLLOW_BRIEF_DEADLINE_MS,
  FOLLOW_BRIEF_RETRIES,
  FOLLOW_BRIEF_SYSTEM,
  FOLLOW_BRIEF_TIMEOUT_MS,
  ONE_PERSON_SPECIFICS,
  droppedClauseBudget,
  followBriefUserTurn,
  introducedOnePersonSpecific,
  statesAnEyeColour,
  writeFollowBrief,
} from "./currentDescription";
import { resolveFollowBrief } from "./followBrief";
import { CONTENDED_TEST_TIMEOUT_MS } from "../testing/contendedTestTimeout";

/*
  ⚠ THE CONTENDED FLOOR, AND THIS SUITE EARNED IT BY REDDENING RATHER THAN BY
  SHAPE (#2584, pinned in `server/contendedTestTimeouts.test.ts`).

  The wire arms boot the WHOLE tRPC router (`await import("../routers")`) inside
  the vitest worker, which is real in-process work the derived population cannot
  see — `sourceSweepSuites` watches suites that walk the SOURCE TREE, and this
  one walks a router graph instead.

  Measured on #2584's branch, `followBrief` beside `refineService` in one
  invocation: **RED in 2 of 3 runs with an extra arm in the neighbour, 0 of 4
  without it** — and the red is the shape `contendedTestTimeout.ts`'s own
  docblock warns is the worst of this class, because it does not look like a
  timeout at all. The first wire arm exceeds the 5 s default; vitest abandons
  it and moves on; its in-flight `follow` then lands in the NEXT arm's
  recorder, and that arm fails `expect(wire.createRollInputs).toHaveLength(1)`
  with somebody else's `userId` in the array. Probed to be sure rather than
  reasoned: the pushes read `user=5102 n=1` then `user=5103 n=2` with no reset
  between them, which only happens if the first arm had already been
  abandoned. **It reads exactly like a real defect in the follow road.**

  File level, never per arm: a number typed onto one `it(…)` is not inherited
  by its neighbour, and the neighbour is where this one lands.
*/
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const wire = vi.hoisted(() => ({
  createRollInputs: [] as Array<{ briefText: string; followCandidatePublicId?: string | null }>,
  source: null as FollowBriefSource | null,
  engine: null as TextEngine | null,
}));

vi.mock("./rollService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rollService")>();
  return {
    ...actual,
    createRoll: vi.fn(async (_deps: unknown, input: { briefText: string; followCandidatePublicId?: string | null }) => {
      wire.createRollInputs.push(input);
      /* Stop here: what is being proven is what reached the roll. */
      throw new Error("wire-stop");
    }),
  };
});

vi.mock("../db/castingV2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/castingV2")>();
  return { ...actual, getFollowBriefSource: vi.fn(async () => wire.source) };
});

vi.mock("./interpreter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./interpreter")>();
  return { ...actual, interpreterEngine: () => wire.engine };
});

function engineSaying(text: string, sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:follow",
    complete: async (request) => {
      sink.push(request);
      return {
        text,
        latencyMs: 9,
        tokens: { in: 200, out: 60 },
        provenance: { provider: "openrouter", model: "anthropic/claude-sonnet-5", providerRef: "r" },
      } as never;
    },
  };
}

function engineThrowing(sink: TextRequest[] = []): TextEngine {
  return {
    id: "test:follow-down",
    complete: async (request) => {
      sink.push(request);
      throw new Error("ECONNRESET");
    },
  };
}

const BRIEF = "A cyberpunk operative with dark undercut hair, chrome jaw implants and a long black coat.";
const REWRITTEN = "A cyberpunk operative with platinum blonde graphic undercut hair, chrome jaw implants and a long black coat.";

const editedSource = (overrides: Partial<FollowBriefSource> = {}): FollowBriefSource => ({
  rollBrief: BRIEF,
  edited: true,
  description: "A cyberpunk operative with platinum blonde undercut hair, a thin scar through the left eyebrow, chrome jaw implants and a long black coat.",
  asks: ["make the hair platinum blonde"],
  ...overrides,
});

describe("the follow brief writer", () => {
  it("asks under its own purpose, with the brief and the edited version, on the short budget", async () => {
    const sent: TextRequest[] = [];
    const result = await writeFollowBrief(
      engineSaying(REWRITTEN, sent),
      { brief: BRIEF, description: editedSource().description, asks: [] },
      4000,
    );
    expect(result).toMatchObject({ ok: true, brief: REWRITTEN, model: "anthropic/claude-sonnet-5" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.about).toBe("follow.brief");
    expect(sent[0]!.timeoutMs).toBe(FOLLOW_BRIEF_TIMEOUT_MS);
    expect(sent[0]!.retries).toBe(FOLLOW_BRIEF_RETRIES);
    expect(FOLLOW_BRIEF_TIMEOUT_MS).toBeLessThanOrEqual(8_000);
    expect(FOLLOW_BRIEF_RETRIES).toBe(1);
    expect(sent[0]!.user).toContain(BRIEF);
    expect(sent[0]!.user).toContain("platinum blonde undercut hair");
  });

  /*
    THE SPLIT HIS RULING TURNS ON — "cousins of that direction of cast not exact
    replicas of the same person you followed". Pinned as two rules, each naming
    its members, so a rewrite of the prompt that drops either half reddens.
  */
  it("pins the direction-level versus one-person-specific split in the prompt", () => {
    const direction = FOLLOW_BRIEF_SYSTEM.split("\n").find((line) => line.includes("DIRECTION-LEVEL"));
    const specifics = FOLLOW_BRIEF_SYSTEM.split("\n").find((line) => line.includes("ONE-PERSON SPECIFICS"));
    expect(direction).toBeDefined();
    expect(specifics).toBeDefined();
    for (const member of ["hair colour", "hairstyle", "overall style", "augments", "outfit direction", "build"]) {
      expect(direction).toContain(member);
    }
    for (const member of ["exact scar", "single mole", "one particular tattoo", "eye colour unless the brief itself already states an eye colour"]) {
      expect(specifics).toContain(member);
    }
    expect(direction).toMatch(/^- Fold in/);
    expect(specifics).toMatch(/^- Leave out/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/cousins and never copies of one person/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/never as a list of edits/);
  });

  /*
    THE NON-PERSON DIRECTION SURVIVES (the reviewer's risk the relay verified):
    setting, light, camera and framing, style and mood are the look of the whole
    family. The prompt rule is pinned, the brief reaches the writer verbatim, and
    a reply that collapses the brief to a person-only paragraph is REFUSED by a
    check no model can talk its way past — the box's own words go instead.
  */
  it("keeps a brief's scene and style direction, and refuses a rewrite that drops it", async () => {
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/the setting, the light, the camera and framing, the picture style and the mood/);
    expect(FOLLOW_BRIEF_SYSTEM).toMatch(/keep every one of those phrases word for word/);
    const scene = "A cyberpunk operative with dark undercut hair and chrome jaw implants, standing in a rain-soaked neon alley at night, shot from a low angle, cinematic, moody teal and magenta light.";
    const scenePhrases = ["rain-soaked neon alley", "low angle", "cinematic", "teal and magenta light"];
    const input = { brief: scene, description: "A cyberpunk operative with a platinum blonde undercut and chrome jaw implants.", asks: [] };

    const sent: TextRequest[] = [];
    const kept = scene.replace("dark undercut hair", "a platinum blonde undercut");
    const good = await writeFollowBrief(engineSaying(kept, sent), input, 4000);
    expect(good).toMatchObject({ ok: true, brief: kept });
    for (const phrase of scenePhrases) {
      expect(sent[0]!.user).toContain(phrase);
      expect(good.ok && good.brief).toContain(phrase);
    }

    const personOnly = await writeFollowBrief(
      engineSaying("A cyberpunk operative with a platinum blonde undercut and chrome jaw implants."),
      input,
      4000,
    );
    expect(personOnly).toMatchObject({ ok: false, reason: "dropped_clauses" });
  });

  /*
    ⚠ THE CHECK THAT GUARDS THAT WAS A LENGTH FLOOR AND WAS WEAK IN BOTH
    DIRECTIONS (#2582 item 2). Both directions are driven here, because a
    replacement that fixed one and not the other would pass a single arm.
  */
  describe("the brief's other clauses must come back — length never answered this", () => {
    it("⚠ a REMOVAL on a short brief is kept, where the 70% floor refused it", async () => {
      /*
        The card's own example. "shaved head" is 56% of the brief's length, so
        the floor threw away the edit's whole direction and sent the box's
        words — the one thing the customer could see was that Follow ignored
        what they had just changed.
      */
      const brief = "long curly red hair down to her waist";
      const rewrite = "a shaved head";
      expect(rewrite.length / brief.length).toBeLessThan(0.7); // the floor would have refused
      const kept = await writeFollowBrief(
        engineSaying(rewrite),
        { brief, description: "A woman with a shaved head.", asks: [] },
        4000,
      );
      expect(kept).toMatchObject({ ok: true, brief: rewrite });
    });

    it("⚠ a scene clause under 30% of the brief cannot be dropped, where the floor passed it", async () => {
      /*
        The mirror, and the failure that matters: the floor asks how much text
        came back, so a long person paragraph with a short scene clause could
        lose the scene entirely and still clear 70%.
      */
      const brief = "A weathered north-Atlantic fisherman in his sixties with a heavy salt-stained oilskin coat, "
        + "deep-set eyes and a grey stubbled jaw, on a wet harbour wall at dawn";
      const personOnly = "A weathered north-Atlantic fisherman in his sixties with a heavy salt-stained oilskin coat, "
        + "a shaved head and a grey stubbled jaw";
      expect(personOnly.length / brief.length).toBeGreaterThan(0.7); // the floor would have passed
      const refused = await writeFollowBrief(
        engineSaying(personOnly),
        { brief, description: "A weathered fisherman with a shaved head.", asks: [] },
        4000,
      );
      expect(refused).toMatchObject({ ok: false, reason: "dropped_clauses" });
    });

    /*
      ⚠ WHAT THE REPLY ADDED NEVER PAYS FOR WHAT IT DROPPED (the relay's finding
      on PR #2586). The refusal read `dropped > added`, so a rewrite that lost
      the brief's scene and put back person clauses in its place satisfied it —
      the exact collapse the length floor was replaced to catch, now with a way
      to buy out of it. The allowance is the EDITS, and nothing the reply says
      can raise it.
    */
    it("⚠ added person clauses cannot pay for a dropped scene", async () => {
      const brief = "A cyberpunk operative with dark undercut hair, a rain-soaked neon alley at night, low angle";
      const collapsed = "A cyberpunk operative with a platinum blonde undercut, a chrome collar, heavy boots";
      /* Three dropped and three added — `dropped > added` is false, so this is
         the shape that passed. */
      const refused = await writeFollowBrief(
        engineSaying(collapsed),
        { brief, description: "A cyberpunk operative.", asks: ["platinum blonde undercut"] },
        4000,
      );
      expect(refused).toMatchObject({ ok: false, reason: "dropped_clauses" });
    });

    it("the allowance is the edits, and a version with none recorded still gets one", () => {
      expect(droppedClauseBudget([])).toBe(1);
      expect(droppedClauseBudget(["   ", ""])).toBe(1);
      expect(droppedClauseBudget(["shave their head"])).toBe(1);
      expect(droppedClauseBudget(["shave their head", "green eyes", "a leather jacket"])).toBe(3);
    });

    it("⚠ three edits may swap three of the brief's phrases", async () => {
      /*
        The mirror, and the direction that costs a customer their work: an
        allowance of one would refuse this and the Follow would go out on the
        box's words with none of the three changes in it.
      */
      const brief = "A courier with long red hair, a canvas satchel, brown eyes, on a wet street at dawn";
      const rewrite = "A courier with a shaved head, a leather satchel, green eyes, on a wet street at dawn";
      const kept = await writeFollowBrief(
        engineSaying(rewrite),
        {
          brief,
          description: "A courier with a shaved head, a leather satchel and green eyes.",
          asks: ["shave their head", "a leather satchel", "green eyes"],
        },
        4000,
      );
      expect(kept).toMatchObject({ ok: true, brief: rewrite });
    });

    it("re-punctuating or merging kept phrases is not a loss", async () => {
      /* The words survive; only the commas moved. A clause-shaped comparison
         that demanded whole clauses would refuse this correct rewrite. */
      const brief = "A courier, standing in a rain-soaked alley at night, low angle, cinematic";
      const merged = "A bicycle courier standing in a rain-soaked alley at night low angle cinematic";
      const kept = await writeFollowBrief(
        engineSaying(merged),
        { brief, description: "A bicycle courier.", asks: [] },
        4000,
      );
      expect(kept).toMatchObject({ ok: true });
    });
  });

  /*
    ⚠ ONE-PERSON SPECIFICS ARE REFUSED ON THE WAY OUT, NOT ONLY FORBIDDEN IN THE
    PROMPT (#2582 item 5). His ruling is the bar: *"cousins of that direction of
    cast not exact replicas"* — a scar in the brief re-locks every cousin onto
    one face.
  */
  describe("a feature of one face that the brief never stated", () => {
    it("⚠ refuses the scar-bearing description handed back as the brief", async () => {
      /*
        The card's own sabotage: the writer returns the VERSION DESCRIPTION,
        which legitimately carries "a thin scar through the left eyebrow",
        as though it were the rewritten brief. Every cousin would wear it.
      */
      const source = editedSource();
      const refused = await writeFollowBrief(
        engineSaying(source.description!),
        { brief: BRIEF, description: source.description, asks: source.asks },
        4000,
      );
      expect(refused).toMatchObject({ ok: false, reason: "one_person_specific" });
      expect(source.description).toMatch(/scar/);
      expect(BRIEF).not.toMatch(/scar/);
    });

    it("refuses an EYE COLOUR the brief never stated, and keeps one it did", async () => {
      const withEyes = `${BRIEF.replace(/\.$/, "")}, with emerald green eyes.`;
      /* Invented: the brief says nothing about anyone's eyes. */
      expect(await writeFollowBrief(
        engineSaying(withEyes),
        { brief: BRIEF, description: "A cyberpunk operative.", asks: [] },
        4000,
      )).toMatchObject({ ok: false, reason: "one_person_specific" });

      /* The customer's own: a brief that states green eyes may keep them —
         it is the family's direction because they wrote it. */
      const briefWithEyes = "A cyberpunk operative with green eyes and dark undercut hair, chrome jaw implants and a long black coat.";
      const rewritten = briefWithEyes.replace("dark undercut hair", "platinum blonde undercut hair");
      expect(await writeFollowBrief(
        engineSaying(rewritten),
        { brief: briefWithEyes, description: "A cyberpunk operative with green eyes.", asks: [] },
        4000,
      )).toMatchObject({ ok: true, brief: rewritten });
    });

    it("⚠ CONTROL — a scene colour is not an eye colour", () => {
      /*
        `grey` is in `EYE_COLOURS` and is also the colour of weather, a coat and
        a jaw. A check that matched the colour word alone would refuse most
        correct rewrites, which is the failure direction that costs a customer
        their feature silently.
      */
      expect(statesAnEyeColour("moody teal and magenta light, a grey stubbled jaw, grey skies")).toBe(false);
      expect(statesAnEyeColour("deep-set eyes and a grey stubbled jaw")).toBe(false);
      expect(statesAnEyeColour("with grey eyes")).toBe(true);
      expect(statesAnEyeColour("a grey-eyed courier")).toBe(true);
      expect(statesAnEyeColour("her eyes are near-black")).toBe(true);
    });

    it("⚠ the prompt's own sentence is BUILT from the same words the check uses", () => {
      /*
        Working law 4 in the one place its drift would be invisible: a prompt
        that forbids one list while the backstop refuses another still READS
        correctly. The sentence is interpolated from `ONE_PERSON_SPECIFICS`, so
        this holds the two equal rather than hoping.
      */
      const line = FOLLOW_BRIEF_SYSTEM.split("\n").find((l) => l.includes("ONE-PERSON SPECIFICS"));
      expect(line).toBeDefined();
      for (const specific of Object.values(ONE_PERSON_SPECIFICS)) {
        expect(line, `the prompt must name ${specific.word}`).toContain(specific.word);
        /* And every other writing of it is an inflection OF that word, never a
           repeat: a forms list that drifted off its own stem would be checking
           a feature the prompt never forbids, and read correctly either way. */
        for (const form of specific.alsoWritten) {
          expect(form, `${form} must be a writing of ${specific.word}`)
            .toMatch(new RegExp(`^${specific.word.slice(0, -1)}`));
          expect(form).not.toBe(specific.word);
        }
      }
    });

    /*
      ⚠ A WORD THAT MERELY STARTS WITH THE FEATURE IS NOT THE FEATURE (the
      relay's finding on PR #2586). The check was a boundary at the front of the
      stem and nothing at the back, so *a red scarf* and *a scarlet coat* read
      as an invented scar and *molecule* as a mole — and the Follow then went
      out silently on the box's words, losing the edit the customer had just
      made. These three are CORRECT rewrites.
    */
    it("⚠ CONTROL — scarf, scarlet and molecule are not a scar or a mole", async () => {
      const brief = "A courier in a long black coat, standing in a rain-soaked alley at night, cinematic";
      for (const rewrite of [
        "A courier in a long black coat and a red scarf, standing in a rain-soaked alley at night, cinematic",
        "A courier in a scarlet coat, standing in a rain-soaked alley at night, cinematic",
        "A courier in a long black coat with molecule-print gloves, standing in a rain-soaked alley at night, cinematic",
      ]) {
        const kept = await writeFollowBrief(
          engineSaying(rewrite),
          { brief, description: "A courier in a red scarf.", asks: ["put them in a red scarf"] },
          4000,
        );
        expect(kept, rewrite).toMatchObject({ ok: true, brief: rewrite });
      }
    });

    it("and every writing of the word is still caught", async () => {
      const brief = "A courier in a long black coat, standing in a rain-soaked alley at night, cinematic";
      for (const invented of [
        "two scars",
        "a scarred cheek",
        "scattered freckles",
        "a freckled nose",
        "tattooed forearms",
        "three moles",
      ]) {
        const rewrite = brief.replace("a long black coat", `a long black coat and ${invented}`);
        expect(
          await writeFollowBrief(
            engineSaying(rewrite),
            { brief, description: "A courier.", asks: ["give them a long black coat"] },
            4000,
          ),
          invented,
        ).toMatchObject({ ok: false, reason: "one_person_specific" });
      }
    });
  });

  /*
    ⚠ BODY-LOOK ANATOMY IS DIRECTION (#2621). His report: "her fangs i gave her
    ... when i follow her the fangs end up non existent or as tattoos on the lips
    of the new casts." Fangs, tusks, horns, pointed ears, unusual eyes and
    scales are what a whole casting call shares, so the prompt must ASK for them
    and the one-person refusal must never throw them away.
  */
  describe("body-look anatomy a whole casting call could share (#2621)", () => {
    const brief = "A pale nightclub singer in a black velvet gown, standing under a red spotlight, cinematic";

    it("is named in the DIRECTION-LEVEL rule and nowhere in the one-person rule", () => {
      const lines = FOLLOW_BRIEF_SYSTEM.split("\n");
      const direction = lines.find((line) => line.includes("DIRECTION-LEVEL"))!;
      const specifics = lines.find((line) => line.includes("ONE-PERSON SPECIFICS"))!;
      for (const entry of BODY_LOOK_ANATOMY) {
        expect(direction, entry.phrase).toContain(entry.phrase);
        expect(specifics, entry.phrase).not.toContain(entry.phrase);
      }
      for (const word of ["fangs", "tusks", "horns", "ears", "slit pupils", "scales"]) {
        expect(direction).toContain(word);
        expect(specifics).not.toContain(word);
      }
      expect(direction).toMatch(/never leave it to the picture/);
      /* The vague phrase a writer filed fangs under is gone from the one-person rule. */
      expect(specifics).not.toMatch(/a precise facial feature/);
    });

    it("every way it is written passes the one-person refusal and comes back as the brief", async () => {
      for (const entry of BODY_LOOK_ANATOMY) {
        for (const written of entry.writtenAs) {
          const rewrite = brief.replace("a black velvet gown", `a black velvet gown and ${written}`);
          expect(introducedOnePersonSpecific(brief, rewrite), written).toBeNull();
          expect(
            await writeFollowBrief(
              engineSaying(rewrite),
              { brief, description: `A pale nightclub singer with ${written}.`, asks: [`give them ${written}`] },
              4000,
            ),
            written,
          ).toMatchObject({ ok: true, brief: rewrite });
        }
      }
    });

    it("⚠ CONTROL — a plain eye colour and a tattoo on the lips are still one face's, and still refused", async () => {
      for (const invented of ["amber eyes", "a pale blue-eyed stare", "a small tattoo on the lower lip", "luminous hazel eyes"]) {
        const rewrite = brief.replace("a black velvet gown", `a black velvet gown and ${invented}`);
        expect(introducedOnePersonSpecific(brief, rewrite), invented).not.toBeNull();
        expect(
          await writeFollowBrief(
            engineSaying(rewrite),
            { brief, description: "A pale nightclub singer with vampire fangs.", asks: ["give them vampire fangs"] },
            4000,
          ),
          invented,
        ).toMatchObject({ ok: false, reason: "one_person_specific" });
      }
    });
  });

  /*
    ⚠ ONE DEADLINE FROM THE PRESS, AND IT COVERS THE QUEUE WAIT (#2582 item 4).
    `timeoutMs` is per ATTEMPT and begins only once `openrouter-text` has a
    slot, and `ProviderQueue.run` takes no signal — so before this the roll
    could be held for as long as four interpreter calls of up to 120 s took.
  */
  describe("the deadline", () => {
    it("⚠ sends the box's words when the press's own deadline passes, queue wait included", async () => {
      vi.useFakeTimers();
      try {
        /* An engine that never answers — the queue holding the slot, which is
           the shape no per-attempt timeout can see. */
        const neverAnswers: TextEngine = {
          id: "test:follow-queued",
          complete: () => new Promise(() => undefined),
        };
        const pending = writeFollowBrief(neverAnswers, { brief: BRIEF, description: "A cyberpunk operative.", asks: [] }, 4000);
        await vi.advanceTimersByTimeAsync(FOLLOW_BRIEF_DEADLINE_MS + 1);
        expect(await pending).toMatchObject({ ok: false, reason: "deadline" });
      } finally {
        vi.useRealTimers();
      }
    });

    it("⚠ CONTROL — it does NOT fire before the deadline, and the budget is the attempts' own", async () => {
      vi.useFakeTimers();
      try {
        const neverAnswers: TextEngine = { id: "test:follow-queued", complete: () => new Promise(() => undefined) };
        let settled = false;
        const pending = writeFollowBrief(neverAnswers, { brief: BRIEF, description: "A cyberpunk operative.", asks: [] }, 4000)
          .then((result) => { settled = true; return result; });
        await vi.advanceTimersByTimeAsync(FOLLOW_BRIEF_DEADLINE_MS - 100);
        expect(settled, "it gave up early").toBe(false);
        await vi.advanceTimersByTimeAsync(200);
        expect(await pending).toMatchObject({ ok: false, reason: "deadline" });
      } finally {
        vi.useRealTimers();
      }
      /* The number is the attempt budget the design already accepted — two
         attempts and the retry's own backoff — so the ceiling did not grow,
         it started covering the wait it already claimed to bound. */
      expect(FOLLOW_BRIEF_DEADLINE_MS).toBe(FOLLOW_BRIEF_TIMEOUT_MS * (FOLLOW_BRIEF_RETRIES + 1) + 500);
    });

    it("the deadline reaches the engine as a signal too, so a retry cannot dispatch after it", async () => {
      const sent: TextRequest[] = [];
      await writeFollowBrief(engineSaying(REWRITTEN, sent), { brief: BRIEF, description: "A cyberpunk operative.", asks: [] }, 4000);
      expect(sent[0]!.signal).toBeInstanceOf(AbortSignal);
      expect(sent[0]!.signal!.aborted).toBe(false);
    });
  });

  it("falls back to the ask chain when the version has no description", () => {
    const turn = followBriefUserTurn({ brief: BRIEF, description: null, asks: ["make the hair platinum blonde", "add a nose ring"] });
    expect(turn).toContain("- make the hair platinum blonde\n- add a nose ring");
    expect(turn).not.toContain("Who the edited cast is");
  });

  it("refuses without calling the engine when there is nothing to fold in", async () => {
    const sent: TextRequest[] = [];
    await expect(writeFollowBrief(engineSaying(REWRITTEN, sent), { brief: BRIEF, description: null, asks: [] }, 4000))
      .resolves.toMatchObject({ ok: false, reason: "no_edits" });
    expect(sent).toHaveLength(0);
  });

  it("answers every failure as a value, never a throw", async () => {
    const input = { brief: BRIEF, description: "x", asks: [] };
    await expect(writeFollowBrief(null, input, 4000)).resolves.toMatchObject({ ok: false, reason: "no_engine" });
    await expect(writeFollowBrief(engineThrowing(), input, 4000)).resolves.toMatchObject({ ok: false, reason: "failed" });
    await expect(writeFollowBrief(engineSaying("   "), input, 4000)).resolves.toMatchObject({ ok: false, reason: "blank" });
    await expect(writeFollowBrief(engineSaying("a".repeat(41)), input, 40)).resolves.toMatchObject({ ok: false, reason: "too_long" });
    await expect(writeFollowBrief(engineSaying("- platinum blonde hair\n- scar"), input, 4000))
      .resolves.toMatchObject({ ok: false, reason: "edit_list" });
    /* Positive control for the list refusal: a one-paragraph answer passes. */
    await expect(writeFollowBrief(engineSaying(REWRITTEN), input, 4000)).resolves.toMatchObject({ ok: true });
  });
});

describe("resolveFollowBrief — the box's words unless every condition holds", () => {
  const on = { enabled: () => true };

  it("rewrites an edited version's Follow when the box still holds that face's brief", async () => {
    const sent: TextRequest[] = [];
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: BRIEF },
      { ...on, readSource: async () => editedSource(), engine: () => engineSaying(REWRITTEN, sent) },
    );
    expect(result).toEqual({ briefText: REWRITTEN, outcome: "rewritten" });
    expect(sent).toHaveLength(1);
  });

  it("hands back the very string it was given, and calls no engine, on every other arm", async () => {
    const box = `${BRIEF}`;
    const arms: Array<[string, Parameters<typeof resolveFollowBrief>[1], string]> = [
      ["off", { enabled: () => false, readSource: async () => editedSource() }, "off"],
      ["never edited", { ...on, readSource: async () => editedSource({ edited: false }) }, "unedited"],
      ["unknown face", { ...on, readSource: async () => null }, "unread"],
      ["reader throws", { ...on, readSource: async () => { throw new Error("db down"); } }, "unread"],
    ];
    for (const [name, deps, outcome] of arms) {
      const sent: TextRequest[] = [];
      const result = await resolveFollowBrief(
        { userId: 7, candidatePublicId: "c1", boxText: box },
        { ...deps, engine: () => engineSaying(REWRITTEN, sent) },
      );
      expect(result.briefText, name).toBe(box);
      expect(result.outcome, name).toBe(outcome);
      expect(sent, name).toHaveLength(0);
    }
  });

  it("sends the customer's own different typing unrewritten", async () => {
    const sent: TextRequest[] = [];
    const typed = "An operative like this one but older, with a shaved head.";
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: typed },
      { ...on, readSource: async () => editedSource(), engine: () => engineSaying(REWRITTEN, sent) },
    );
    expect(result).toEqual({ briefText: typed, outcome: "typed" });
    expect(sent).toHaveLength(0);
  });

  it("falls back to the box when the writer does not answer", async () => {
    const result = await resolveFollowBrief(
      { userId: 7, candidatePublicId: "c1", boxText: BRIEF },
      { ...on, readSource: async () => editedSource(), engine: () => engineThrowing() },
    );
    expect(result).toEqual({ briefText: BRIEF, outcome: "writer_failed" });
  });
});

describe("the follow procedure's wire — what reaches createRoll", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    wire.createRollInputs.length = 0;
    wire.source = null;
    wire.engine = null;
    process.env.CASTING_V2_SCOPE = "all";
    process.env.CASTING_CURRENT_DESCRIPTION_SCOPE = "users:5101,5102,5103";
  });

  afterEach(() => {
    for (const name of ["CASTING_V2_SCOPE", "CASTING_CURRENT_DESCRIPTION_SCOPE"]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  async function pressFollow(
    userId: number,
    briefText: string,
  ): Promise<{ briefText: string; followCandidatePublicId?: string | null }> {
    const { appRouter } = await import("../routers");
    const user = {
      id: userId, openId: `follow-${userId}`, email: "f@example.com", name: "F", role: "user",
      approved: true, approvedAt: new Date(), suspendedAt: null, frozenAt: null, lockedUntil: null,
      failedLoginAttempts: 0, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as never;
    const caller = appRouter.createCaller({
      user,
      correlationId: `follow-${userId}`,
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => undefined },
    } as never);
    await expect(caller.castingV2.follow({
      clientRequestId: globalThis.crypto.randomUUID(),
      sessionId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
      briefText,
    })).rejects.toThrow("wire-stop");
    expect(wire.createRollInputs).toHaveLength(1);
    const handed = wire.createRollInputs[0]!;
    wire.createRollInputs.length = 0;
    return handed;
  }

  /*
    ⚠ **WHAT THIS BLOCK PROVES MOVED WITH THE REWRITE (#2582 items 1 and 3).**
    These arms used to assert that the rewritten brief reached `createRoll`,
    because the route chose it. It does not any more: the route hands over the
    CUSTOMER'S OWN WORDS and `createRoll` decides what to cast from, below its
    free refusals and beside the claim that must not be keyed on a
    nondeterministic string.

    So the contract proven here is the route's half — the box's words and the
    followed candidate, at the wire (law 5) — and the half that moved is proven
    where it now lives, in `rollService.test.ts` › *"a Follow's rewritten
    brief"*: the claim keyed on the box, two presses of one id claiming
    identically, no text call on a free refusal, and the rewrite reaching the
    compile and the roll row. Asserting the old sentence here would have been a
    green arm over a defect.
  */
  it("hands over the customer's own words, and the followed candidate beside them", async () => {
    const sent: TextRequest[] = [];
    wire.source = editedSource();
    wire.engine = engineSaying(REWRITTEN, sent);
    const handed = await pressFollow(5102, BRIEF);
    expect(handed.briefText).toBe(BRIEF);
    expect(handed.followCandidatePublicId).toBe("22222222-2222-4222-8222-222222222222");
    /* And the route itself asks no writer — the rewrite is not its act now. */
    expect(sent).toHaveLength(0);
  });

  it("⚠ the route does not read the flag either — one place decides, and it is not here", async () => {
    /*
      Driven on both sides of the flag with everything else held equal: the
      route's own output must not move, because a second reader of this flag at
      the route is how the two halves of one request come to disagree.
    */
    wire.source = editedSource();
    wire.engine = engineSaying(REWRITTEN);
    expect((await pressFollow(5103, BRIEF)).briefText).toBe(BRIEF);
    expect((await pressFollow(5999, BRIEF)).briefText).toBe(BRIEF);
  });
});
