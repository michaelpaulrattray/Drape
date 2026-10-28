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
  type AxisKey,
} from "./axisRegistry";
import { REALIZED_AXIS_KEYS } from "../../shared/castingRealization";

/**
 * Slice zero's mechanical guarantees — and the one this file stopped proving.
 *
 * The first is that the registry is COMPLETE — every axis in the identity space
 * is registered, and the union is checked from every direction the registry
 * cannot fake. Most of that work happens at compile time in the module itself;
 * what remains here is the half a type cannot state (the registry inventing an
 * axis nothing produces) and the pinning of the sets that are policy rather
 * than derivation.
 *
 * ⚠ The second WAS the SWEEP — for every axis, in every tier, a persisted
 * value must leave a footprint in the composed prompt or be excused for a
 * named reason, with five founder-caught defects as the argument that it could
 * not stay a discipline — and THIS FILE HAS NOT PROVED IT SINCE #1490 act 1,
 * which took the house road that composed the per-slice prompts it swept. The
 * record at the foot of this file is where that loss is written down and where
 * the class now sits (#1125, #30); read it before believing anything here
 * sweeps. What this file proves today is the first guarantee, the shelves, the
 * taste writes and the lock states.
 */

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
    /*
      Two, not five. D-88 retired the three `stated-*` excuses by making the
      biology tier nullable, so eye, brow and skin deference is covered by the
      sweep's null arm rather than by an exemption. What remains is the honest
      kind: a real value that legitimately composes nothing.
    */
    expect([...used].sort()).toEqual(["cut-names-its-worn-state", "varying-look"]);
  });

  it("registers the shipped cross-axis implication, and marks it hard", () => {
    const hard = CROSS_AXIS_IMPLICATIONS.filter((rule) => rule.strength === "hard");
    expect(hard).toHaveLength(1);
    expect(hard[0].to).toBe("sex");
    /*
      The soft slot the registry reserved is now occupied — poolTendencies
      landed as two entries, and they landed HERE rather than as loose logic in
      the resolver, which is what "cross-axis implications are registry
      citizens" was supposed to mean.
    */
    const soft = CROSS_AXIS_IMPLICATIONS.filter((rule) => rule.strength === "soft");
    expect(soft.map((rule) => rule.to).sort()).toEqual(["ageBand", "facialHair"]);
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

/*
  ⚠ `describe("the unowned-axis sweep")` STOOD HERE — TEN ARMS — AND IT IS
  DELETED WITH THE HOUSE ROAD (#1490 act 1). It is NOT re-pointed, and the
  reason is that it CANNOT be: every arm swept a PER-SLICE COMPOSED PROMPT,
  and the author road composes none. One authored prompt paints all eight and
  the per-slice records are marked `unsent` (#176), so there is no per-tier
  footprint to look for and nothing for the sweep to be right or wrong about.

  ⚠ **THIS IS A FLOOR DROP AND IT IS SAID OUT LOUD RATHER THAN ABSORBED:
  `sweepComposedPrompt` now has NO driver anywhere in the tree.** Nine of the
  ten arms were "finds nothing" assertions about a road that is gone; the
  tenth was the suite's POSITIVE CONTROL — *"catches an axis surgically
  removed from a REAL composed prompt"* — and its own comment records why it
  had to use a real composed prompt rather than a made-up sentence. Nothing
  outside the retired road can hand it one, so it goes with the others instead
  of being weakened back into the version its author already rejected.

  ⚠ **THE CLASS IS NOT ABANDONED — IT IS ALREADY CARDED, AND FOLDING IT THERE
  IS THIS CARD'S OWN INSTRUCTION.** #1125 (`debt`, `rung:N3`) is exactly this
  loss, found by the #180 ghost audit before the arms fell over: *"the lock
  check and the unowned-axis sweep have no author-road equivalent — the
  verification does not travel with the road."* Its ruling is that the
  question — did the delivered picture carry what she asked for — is #30's, a
  detector reading a FRAME rather than a prompt string. The five founder-caught
  defects that argued for the sweep are on that card, not lost here.

  ⚠ **THE ARMS' SCAFFOLDING IS GONE TOO, AND IT TOOK A SECOND EXPORT DARK
  WITH IT (#2766).** The arms fell in #1490 act 1 and their helpers did not:
  `sweepBrief`, `contextFor`, `followedCandidates`, `FOLLOWED_WITH_SHAPE`,
  `CompiledSheet`, the `engine` stub and eleven imports all survived with no
  caller — so `grep sweepComposedPrompt` answered with a call inside a
  `.test.ts` file and read as *"the suite still drives it"*. It did not, and
  #1125's own body had already carried that mis-reading once.

  ⚠ **SO BOTH `sweepComposedPrompt` AND `suppressorsFor` NOW HAVE ZERO
  IMPORTERS ANYWHERE IN THE TREE, AND THAT IS THE INTENDED STATE RATHER THAN
  TWO DEATHS TO REPAIR.** `suppressorsFor` was reached only from the deleted
  `contextFor`, and neither export has an internal caller in `axisRegistry.ts`
  (read at `:454` and `:1132`, 2026-10-28). Both are kept on exactly the
  reasoning above — the class is #30's, and deleting either would fold a
  capability decision into a cleanup, which his ruling of 2026-09-24 forbids.
  An uncalled-export sweep or an importer-count differ that flags them is
  reading this file correctly; this paragraph is the answer to it.

  The registry's own guarantees — completeness, the shelves, the taste writes,
  the lock states — are untouched above and are what this file still proves.
*/
