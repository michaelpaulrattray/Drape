import { describe, expect, it } from "vitest";

import {
  AXIS_KEYS,
  AXIS_REGISTRY,
  CROSS_AXIS_IMPLICATIONS,
  REALIZED_SHELF,
  TASTE_WRITABLE_AXES,
  applyTasteWrite,
  axesOnShelf,
  lockStateOf,
  sweepComposedPrompt,
  suppressorsFor,
  type AxisContext,
  type AxisKey,
  type RollTreatments,
} from "./axisRegistry";
import { castingBriefCompiler } from "./briefCompiler";
import { ARCHETYPES, LOOK_KEYS, type ResolvedIdentity } from "./castingIntent";
import { REALIZED_AXIS_KEYS } from "../../shared/castingRealization";
import { briefStatesHair, statedAxis } from "./cohortPhotorealHuman";
import type { TextEngine } from "../providers/types";

/**
 * Slice zero's two mechanical guarantees.
 *
 * The first is that the registry is COMPLETE — every axis in the identity space
 * is registered, and the union is checked from every direction the registry
 * cannot fake. Most of that work happens at compile time in the module itself;
 * what remains here is the half a type cannot state (the registry inventing an
 * axis nothing produces) and the pinning of the sets that are policy rather
 * than derivation.
 *
 * The second is the SWEEP, which is the whole reason the registry exists: for
 * every axis, in every tier, a persisted value must leave a footprint in the
 * composed prompt or be excused for a named reason. Five founder-caught
 * defects are the argument that this cannot stay a discipline.
 */

function engine(intent: Record<string, unknown>): TextEngine {
  return {
    id: "stub",
    complete: async () => ({
      text: JSON.stringify({ cohort: "photoreal_human", ...intent }),
      latencyMs: 1,
      provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
    }),
  } as unknown as TextEngine;
}

/* ----------------------------------------------------------- completeness */

describe("the registry is complete", () => {
  it("registers every realized axis, and invents none", () => {
    for (const key of REALIZED_AXIS_KEYS) {
      expect(AXIS_KEYS, `${key} must be registered`).toContain(key);
      expect(AXIS_REGISTRY[key].shelf).toBe("realized");
    }
    /*
      The direction a type cannot check: the registry claiming a realized axis
      that `RealizedAxes` does not produce. `hairColour` is the one deliberate
      member of the realized SHELF that lives outside the object — registered
      there because that is what it behaviourally is, and named here so the
      exception is visible rather than assumed.
    */
    const realizedShelf = axesOnShelf("realized").sort();
    expect(realizedShelf).toEqual([...REALIZED_SHELF].sort());
  });

  it("puts every axis on exactly one shelf, and every shelf is populated", () => {
    const shelves = (["resolver", "realized", "treatment"] as const).map((shelf) =>
      axesOnShelf(shelf),
    );
    expect(shelves.flat().sort()).toEqual([...AXIS_KEYS].sort());
    for (const shelf of shelves) expect(shelf.length).toBeGreaterThan(0);
  });

  it("keeps every declaration executable — no row can be inert", () => {
    for (const key of AXIS_KEYS) {
      const decl = AXIS_REGISTRY[key];
      expect(typeof decl.read, key).toBe("function");
      expect(typeof decl.footprint, key).toBe("function");
      expect(decl.key, key).toBe(key);
    }
  });

  /*
    PINNED POLICY, not derivation. Each of these is a judgment that somebody
    made, so changing it should surface in a diff and ask for a reason rather
    than sliding through as a tweak.
  */
  it("pins the silent values — the axes that hold a value and say nothing", () => {
    const silent = Object.fromEntries(
      AXIS_KEYS.map((key) => [key, [...AXIS_REGISTRY[key].silent]]).filter(
        ([, values]) => (values as string[]).length > 0,
      ),
    );
    expect(silent).toEqual({
      // Most faces. Saying so would crowd the lines that carry a real feature.
      skinCharacter: ["plain"],
      // The commonest answer, and the one the prompt leaves unsaid.
      wornState: ["loose"],
    });
  });

  it("pins the ONE selector — every other axis must describe something", () => {
    const selectors = AXIS_KEYS.filter((key) => AXIS_REGISTRY[key].kind === "selector");
    expect(selectors).toEqual(["variationAxis"]);
  });

  it("pins the suppressor list — the sweep's only escape hatch", () => {
    const used = new Set(AXIS_KEYS.flatMap((key) => [...AXIS_REGISTRY[key].suppressors]));
    expect([...used].sort()).toEqual([
      "cut-names-its-worn-state",
      "stated-brows",
      "stated-eyes",
      "stated-skin",
      "varying-look",
    ]);
  });

  it("registers the shipped cross-axis implication, and marks it hard", () => {
    const hard = CROSS_AXIS_IMPLICATIONS.filter((rule) => rule.strength === "hard");
    expect(hard).toHaveLength(1);
    expect(hard[0].to).toBe("sex");
    // Soft implications (poolTendencies) are held; when one lands it lands here.
    expect(CROSS_AXIS_IMPLICATIONS.filter((rule) => rule.strength === "soft")).toHaveLength(0);
  });
});

/* --------------------------------------------------------- the taste law */

describe("only realized values are writable by the taste pass", () => {
  it("names the taste-writable axes, all of them on the realized shelf", () => {
    for (const key of TASTE_WRITABLE_AXES) {
      expect(AXIS_REGISTRY[key as AxisKey].shelf, key).toBe("realized");
    }
    /*
      The other half of the law is a COMPILE error, not an assertion: adding
      `sex` to TASTE_WRITABLE_AXES fails `OnlyRealizedIsTasteWritable` in the
      module itself. This test pins the current membership so that a widening
      is a deliberate diff.
    */
    expect([...TASTE_WRITABLE_AXES].sort()).toEqual([
      "facialHair",
      "hairColour",
      "hairModifiers",
      "hairStyle",
      "hairTexture",
      "wornState",
    ]);
  });

  it("routes a write to wherever the axis is actually stored", () => {
    const candidate = {
      hair: { family: "long", colour: "brown" as const },
      realized: {
        eyeColour: "blue",
        hairStyle: { name: "low bun", family: "long" },
        facialHair: null,
        hairTexture: "straight",
        hairModifiers: null,
        wornState: "loose",
        browStyle: "full",
        skinCharacter: "plain",
      },
    } as never as { hair: { family: string; colour: "brown" }; realized: Record<string, unknown> };

    const written = applyTasteWrite(candidate as never, {
      hairColour: "auburn",
      wornState: "in a ponytail",
    });

    // hairColour lives at identity.hair.colour; the rest live under realized.
    expect((written as never as { hair: { colour: string } }).hair.colour).toBe("auburn");
    expect((written as never as { realized: { wornState: string } }).realized.wornState).toBe(
      "in a ponytail",
    );
    // And nothing it was not asked to touch moved.
    expect((written as never as { realized: { eyeColour: string } }).realized.eyeColour).toBe("blue");
  });

  it("will not invent a hair record for a candidate whose hair was suppressed", () => {
    const suppressed = { hair: null, realized: {} } as never;
    const written = applyTasteWrite(suppressed, { hairColour: "auburn" });
    expect((written as never as { hair: unknown }).hair).toBeNull();
  });
});

/* ------------------------------------------------------ tagged lock-states */

describe("lock states", () => {
  const intent = {
    cohort: "photoreal_human",
    role: null,
    characterNotes: null,
    sex: "female",
    ageBand: null,
    agePhase: null,
    heritage: [],
    build: null,
    energy: null,
    archetype: null,
    variationAxis: null,
    look: null,
    reads: [],
    composedDirection: null,
  } as never;

  it("reads a stated fact as locked and an unstated one as open", () => {
    expect(lockStateOf(intent, "sex")).toEqual({ kind: "locked", value: "female" });
    expect(lockStateOf(intent, "ageBand")).toEqual({ kind: "open" });
  });

  it("understands heritage's empty-array absence, which is not a null", () => {
    expect(lockStateOf(intent, "heritage")).toEqual({ kind: "open" });
    const blended = { ...(intent as object), heritage: [{ heritage: "Nordic", pct: 100 }] } as never;
    expect(lockStateOf(blended, "heritage")).toEqual({
      kind: "locked",
      value: [{ heritage: "Nordic", pct: 100 }],
    });
  });
});

/* ---------------------------------------------------------------- the sweep */

/**
 * Build the sweep's context for one compiled candidate.
 *
 * Deliberately assembled from the PERSISTED record and the user's own words,
 * never from anything the composer computed — the whole assertion is that the
 * record and the prompt agree, and reusing the composer's own decisions on both
 * sides would prove only that it agrees with itself.
 */
function contextFor(input: {
  identity: ResolvedIdentity;
  treatments: RollTreatments;
  statedText: string;
  lookLocked: boolean;
}): AxisContext {
  const identity = input.identity;
  const tier = identity.stylingResolution ?? "prescribe";
  return {
    identity,
    treatments: input.treatments,
    tier,
    suppressed: suppressorsFor({
      tier,
      lookVaries: identity.look != null && !input.lookLocked,
      statedEyes: statedAxis("eyes", input.statedText),
      statedBrows: statedAxis("brows", input.statedText),
      statedSkin: statedAxis("skin", input.statedText),
      cutNamesWornState: identity.realized.hairStyle?.worn != null,
    }),
  };
}

type CompiledSheet = {
  candidates: Array<{ prompt: string; resolvedIdentity: ResolvedIdentity }>;
  compiledBrief: { archetype: string; intent: { look: string | null } };
};

async function sweepBrief(input: {
  briefText: string;
  rollSeed: string;
  intent: Record<string, unknown>;
  followIdentity?: unknown;
}) {
  const compiled = (await castingBriefCompiler({
    briefText: input.briefText,
    candidateCount: 8,
    rollSeed: input.rollSeed,
    followIdentity: input.followIdentity,
    engine: engine(input.intent),
  } as never)) as unknown as CompiledSheet;

  const archetype = compiled.compiledBrief.archetype as keyof typeof ARCHETYPES;
  const treatments: RollTreatments = {
    archetype,
    skinFinish: ARCHETYPES[archetype].finish,
    variationAxis: null,
  };
  const statedText = [
    input.briefText,
    (input.intent.role as string) ?? "",
    (input.intent.characterNotes as string) ?? "",
  ].join(" ");

  return compiled.candidates.flatMap((candidate) =>
    sweepComposedPrompt(
      candidate.prompt,
      contextFor({
        identity: candidate.resolvedIdentity,
        treatments,
        statedText,
        lookLocked: compiled.compiledBrief.intent.look != null,
      }),
    ),
  );
}

describe("the unowned-axis sweep", () => {
  /*
    THE CLASS, restated because it is the reason this file exists: an axis
    nobody owns is not free — it is decided by whichever prior is loudest,
    identically on every tile. Found five times, every time by the founder's
    eye. The tell is mechanical: a value persisted but never composed in the
    tier it was resolved in.
  */

  it("finds nothing on an open brief (prescribe tier)", async () => {
    const findings = await sweepBrief({
      briefText: "someone in their 30s",
      rollSeed: "sweep-open",
      intent: { ageBand: "30s" },
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing on a category brief (bias tier)", async () => {
    const findings = await sweepBrief({
      briefText: "a 30 year old heavy metal bogan",
      rollSeed: "sweep-bias",
      intent: { role: "heavy metal bogan", ageBand: "30s" },
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing when the brief states its own hair (stated tier)", async () => {
    const findings = await sweepBrief({
      briefText: "runway model, early 20s, shaved head",
      rollSeed: "sweep-stated",
      intent: { role: "runway model", ageBand: "20s", agePhase: "early" },
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing when the brief speaks to eyes, brows and skin", async () => {
    const findings = await sweepBrief({
      briefText: "a freckled woman in her 40s with green eyes and heavy brows",
      rollSeed: "sweep-deference",
      intent: { sex: "female", ageBand: "40s" },
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing on a locked-look sheet, where presence must still speak", async () => {
    const findings = await sweepBrief({
      briefText: "an editorial model in her 20s",
      rollSeed: "sweep-locked-look",
      intent: { role: "editorial model", sex: "female", ageBand: "20s", look: LOOK_KEYS[1] },
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing on a follow, where styling renders at full fidelity", async () => {
    const findings = await sweepBrief({
      briefText: "a females 23 high fashion editorial casting",
      rollSeed: "sweep-follow",
      intent: { role: "high fashion editorial model", sex: "female", ageBand: "20s" },
      followIdentity: {
        sex: "female",
        ageBand: "20s",
        agePhase: "early",
        heritage: [{ heritage: "Nordic", pct: 100 }],
        energy: "warm",
        hair: { family: "long", colour: "blonde" },
        look: "severe minimal",
        realized: {
          eyeColour: "blue",
          hairStyle: { name: "low bun", family: "long", worn: "worn up" },
          facialHair: null,
          hairTexture: "straight",
          hairModifiers: null,
          wornState: "worn up",
          browStyle: "feathered",
          skinCharacter: "plain",
        },
      },
    });
    expect(findings).toEqual([]);
  });

  /**
   * SIX SHEETS IS NOT AN INSTRUMENT.
   *
   * Every defect this sweep exists to catch was a rare draw somebody eventually
   * saw on a real roll — a shaved family at prescribe tier, a cut that dictates
   * its own texture, a heritage whose palette holds one colour. A handful of
   * seeds exercises a handful of draws and reports a clean bill of health for
   * everything it never sampled, which is exactly how a graded eye sheet passed
   * while drawing zero amber tiles (D-84).
   *
   * So the sweep runs wide, over brief shapes chosen to reach every tier and
   * every branch of the hair vocabulary, and the count of sheets is asserted so
   * that a future edit cannot quietly shrink the instrument while keeping the
   * green tick.
   */
  it("finds nothing across a wide draw — many seeds, every tier", async () => {
    const shapes = [
      { briefText: "someone in their 30s", intent: { ageBand: "30s" } },
      { briefText: "a person", intent: {} },
      { briefText: "a 30 year old heavy metal bogan", intent: { role: "heavy metal bogan", ageBand: "30s" } },
      { briefText: "a corporate lawyer in his 50s", intent: { role: "corporate lawyer", sex: "male", ageBand: "50s" } },
      { briefText: "a West African woman in her 20s", intent: { sex: "female", ageBand: "20s", heritage: [{ heritage: "West African", pct: 100 }] } },
      { briefText: "an East Asian man in his 60s", intent: { sex: "male", ageBand: "60s", heritage: [{ heritage: "East Asian", pct: 100 }] } },
      { briefText: "a teenager", intent: { ageBand: "teens" } },
      { briefText: "someone in their seventies", intent: { ageBand: "70s+" } },
      { briefText: "a redhead in her 30s", intent: { sex: "female", ageBand: "30s" } },
      { briefText: "a beauty creator in her late 20s, bleached brows", intent: { role: "beauty creator", sex: "female", ageBand: "20s", agePhase: "late" } },
    ];

    const findings = [];
    let sheets = 0;
    for (const shape of shapes) {
      for (let seed = 0; seed < 12; seed += 1) {
        sheets += 1;
        findings.push(
          ...(await sweepBrief({ ...shape, rollSeed: `wide-${shape.briefText}-${seed}` })),
        );
      }
    }

    expect(sheets).toBe(120);

    /*
      ZERO, and it was not zero when this was written.

      The wide draw found thirty real hits on its first run: a shaved-family cut
      persisted a `hairTexture` the prompt never carried, because the composer's
      shaved branch says "a buzz cut, dark brown where it is grown out" and
      stops — a shaved head has no grain to show. About three candidates in a
      hundred wore a wave no image would ever have.

      That gap was pinned here exactly rather than excused into the registry as
      a fake exemption, then closed by `resolveTexture` in the following commit,
      and only then was this tightened to zero. The order matters: a sweep that
      is written green has never proved it can go red.
    */
    expect(findings).toEqual([]);
  }, 60_000);

  /*
    The two record-truth repairs the sweep found, pinned at the record rather
    than through the sweep — a sweep assertion proves the prompt and the record
    agree, and these are claims about what the record must SAY.
  */
  it("gives a shaved head no grain, and no second silhouette (D-87)", async () => {
    /*
      Many seeds, because a shaved cut is a 5%-weighted draw and a single sheet
      routinely contains none — the first version of this test asserted over one
      sheet, drew no shaved candidate, and was saved only by its own vacuity
      guard. That guard is the reason the count is asserted at the end rather
      than assumed.
    */
    let shaved = 0;
    let checked = 0;

    for (let seed = 0; seed < 20; seed += 1) {
      const compiled = (await castingBriefCompiler({
        briefText: "a person",
        candidateCount: 8,
        rollSeed: `record-truth-${seed}`,
        engine: engine({}),
      } as never)) as unknown as CompiledSheet;

      for (const candidate of compiled.candidates) {
        const identity = candidate.resolvedIdentity;
        const style = identity.realized.hairStyle;
        if (!style) continue;
        checked += 1;

        /*
          D-87: one silhouette per candidate. `hair.family` used to be drawn
          from its own weighted list, so real sheets persisted "buzz cut /
          shaved" beside `hair: { family: "long" }` — a record claiming a person
          has long hair and a buzz cut at once, which a follow then inherited.
        */
        expect(identity.hair?.family, `${style.name} @ seed ${seed}`).toBe(style.family);

        if (style.family === "shaved") {
          shaved += 1;
          // No grain on a shaved head, in the record or in the prompt.
          expect(identity.realized.hairTexture, `${style.name} @ seed ${seed}`).toBeNull();
          expect(candidate.prompt).toContain(style.name);
        }
      }
    }

    expect(checked).toBeGreaterThan(100);
    expect(shaved).toBeGreaterThan(0);
  }, 30_000);

  it("would CATCH a value persisted but never composed — the sweep has teeth", () => {
    /*
      A negative control. Without it, every assertion above passes just as well
      when the sweep silently stops looking at anything — which is precisely how
      four instruments failed in one session (D-84).
    */
    const identity = {
      stylingResolution: "prescribe",
      sex: "female",
      ageBand: "30s",
      agePhase: "mid",
      heritage: [{ heritage: "Nordic", pct: 100 }],
      build: null,
      hair: { family: "long", colour: "auburn" },
      energy: "warm",
      look: null,
      realized: {
        eyeColour: "amber",
        hairStyle: { name: "low bun", family: "long" },
        facialHair: null,
        hairTexture: "straight",
        hairModifiers: null,
        wornState: "in a ponytail",
        browStyle: "full",
        skinCharacter: "freckled",
      },
    } as never as ResolvedIdentity;

    const findings = sweepComposedPrompt("a prompt that mentions none of it", {
      identity,
      treatments: { archetype: "raw editorial", skinFinish: "matte", variationAxis: null },
      tier: "prescribe",
      suppressed: new Set(),
    });

    const caught = findings.map((finding) => finding.axis).sort();
    expect(caught).toContain("eyeColour");
    expect(caught).toContain("hairColour");
    expect(caught).toContain("wornState");
    expect(caught).toContain("skinCharacter");
    expect(caught).toContain("heritage");
  });
});
