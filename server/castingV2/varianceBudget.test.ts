import { describe, expect, it } from "vitest";

import {
  SIGNATURE_CAP,
  breakSignatureClusters,
  distinctSignatures,
  excessPositions,
  signatureOf,
} from "./varianceBudget";
import { castingBriefCompiler } from "./briefCompiler";
import type { TextEngine } from "../providers/types";

/**
 * A paid sheet where the pick doesn't matter carries no information.
 *
 * THE SHEET THAT FORCED IT: a follow of a blonde candidate under "a females 23
 * high fashion editorial casting for Versace" came back an eight-way tie. Four
 * rules, each individually correct, whose intersection left nothing alive that
 * separates two tiles at arm's length.
 *
 * THE SHEET THAT CONVICTED THE FIRST FIX: the re-roll cleared an axis-count
 * floor with five live axes and still showed five identical low buns. "Cut has
 * at least two distinct values" is true of a sheet that is seven-to-one. Axes
 * were a proxy for what the eye measures; the founder's ruling replaced them
 * with the tile SIGNATURE and made it a CAP — no more than two tiles may share
 * one. A pair reads as family; three reads as a wall.
 */

function identity(over: Record<string, unknown> = {}) {
  return {
    sex: "female",
    ageBand: "20s",
    heritage: [{ heritage: "Nordic", pct: 100 }],
    hair: { family: "long", colour: "blonde" },
    realized: {
      eyeColour: "blue",
      hairStyle: { name: "low bun", family: "long", worn: "worn up" },
      facialHair: null,
      hairTexture: "straight",
      hairModifiers: null,
      wornState: "worn up",
      browStyle: "feathered",
      skinCharacter: "plain",
      ...((over.realized as object) ?? {}),
    },
    ...over,
  } as never;
}

const context = { rollSeed: "cap", hairStated: false, facialHairStated: false };

describe("the cap, not a floor", () => {
  it("names the third and later members of a cluster as excess", () => {
    const sheet = Array.from({ length: 8 }, () => identity());
    expect(excessPositions(sheet)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(SIGNATURE_CAP).toBe(2);
  });

  it("leaves a matching PAIR alone — that reads as family", () => {
    const sheet = [
      identity(),
      identity(),
      identity({ realized: { wornState: "loose", hairStyle: { name: "simple long hair", family: "long" } } }),
      identity({ realized: { hairTexture: "wavy", hairStyle: { name: "simple long hair", family: "long" } } }),
    ];
    expect(excessPositions(sheet)).toEqual([]);
    const { report } = breakSignatureClusters(sheet, context);
    expect(report.released).toEqual([]);
    expect(report.confess).toBe(false);
  });

  it("would have PASSED the old axis metric on the sheet that convicted it", () => {
    /*
      The regression that matters most. Five identical low buns plus three
      varied tiles: cut, texture and worn state each carry two or more values,
      so the axis count read "varied" — and the founder looked at it and could
      not choose between the middle five.
    */
    const sheet = [
      identity({ realized: { hairStyle: { name: "half-up", family: "long", worn: "half-up" }, wornState: "half-up" } }),
      identity({ realized: { hairStyle: { name: "bun", family: "long", worn: "worn up" }, hairTexture: "wavy" } }),
      identity(),
      identity(),
      identity(),
      identity(),
      identity(),
      identity({ realized: { hairStyle: { name: "half-up", family: "long", worn: "half-up" }, wornState: "half-up", hairTexture: "wavy" } }),
    ];
    // Axis-wise this looks fine: three distinct cuts, two textures, three worn
    // states. Signature-wise it is a wall of five.
    expect(excessPositions(sheet).length).toBe(3);
  });
});

describe("the release is least-authoritative-first", () => {
  it("breaks a cluster with WORN STATE, leaving the cut alone", () => {
    /*
      The whole reason this does not fight the drift ruling: a low bun and the
      same hair worn loose are the same cut, worn differently. Five tiles
      holding the anchor's cut is the ruling working.
    */
    const sheet = Array.from({ length: 8 }, () =>
      identity({ realized: { hairStyle: { name: "simple long hair", family: "long" }, wornState: "loose" } }),
    );
    const { sheet: freed, report } = breakSignatureClusters(sheet, context);
    expect(report.released[0]).toBe("worn-state");
    // Every cut is untouched — the ladder started at the cheapest rung.
    for (const candidate of freed) {
      expect((candidate as never as { realized: { hairStyle: { name: string } } }).realized.hairStyle.name).toBe(
        "simple long hair",
      );
    }
    expect(excessPositions(freed)).toEqual([]);
  });

  it("does not re-wear a cut whose own name says how it is worn", () => {
    // "a ponytail, worn loose" must stay unsayable. Those tiles fall through
    // to texture rather than contradicting their own name.
    const sheet = Array.from({ length: 8 }, () =>
      identity({ realized: { hairStyle: { name: "ponytail", family: "long", worn: "in a ponytail" }, wornState: "in a ponytail" } }),
    );
    const { sheet: freed } = breakSignatureClusters(sheet, context);
    for (const candidate of freed) {
      const realized = (candidate as never as { realized: { hairStyle: { name: string }; wornState: string } }).realized;
      if (realized.hairStyle.name === "ponytail") expect(realized.wornState).toBe("in a ponytail");
    }
  });

  it("gets a sheet of eight identical tiles under the cap", () => {
    const sheet = Array.from({ length: 8 }, () => identity());
    const { sheet: freed, report } = breakSignatureClusters(sheet, context);
    expect(excessPositions(freed)).toEqual([]);
    expect(distinctSignatures(freed)).toBeGreaterThanOrEqual(4);
    expect(report.confess).toBe(false);
  });
});

describe("a stated lock is never touched", () => {
  it("changes nothing when the brief stated its own hair, and confesses instead", () => {
    /*
      Deference outranks the cap. None of the authored hair reaches the prompt
      when the brief states it, so freeing it would edit a record the image
      never saw — the record-vs-prompt lie this codebase has now fixed three
      times. The honest move is to say the sheet is held.
    */
    const sheet = Array.from({ length: 8 }, () => identity());
    const before = sheet.map(signatureOf);
    const { sheet: freed, report } = breakSignatureClusters(sheet, {
      ...context,
      hairStated: true,
    });
    expect(freed.map(signatureOf)).toEqual(before);
    expect(report.released).toEqual([]);
    expect(report.confess).toBe(true);
  });
});

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

/** The founder's exact stack: follow + stated age + captured direction. */
async function versaceFollow(rollSeed: string) {
  return castingBriefCompiler({
    briefText: "a females 23 high fashion editorial casting for versace",
    candidateCount: 8,
    rollSeed,
    followIdentity: {
      sex: "female",
      ageBand: "20s",
      agePhase: "early",
      heritage: [{ heritage: "Nordic", pct: 100 }],
      energy: "cool",
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
    engine: engine({
      role: "high fashion editorial model",
      sex: "female",
      ageBand: "20s",
      look: "severe minimal",
      composedDirection: { thesis: "Severe, architectural faces.", avoid: "Soft polish." },
    }),
  } as never);
}

/**
 * FOR M7 SLICE ZERO — the sweep that would close this class for good.
 *
 * The unowned-axis collapse has now been found five times, every time by the
 * founder's eye rather than by a test. But its tell is mechanizable, and the
 * founder named it: **a resolved value that is persisted but never composed
 * into a prompt in the tier it was resolved in.**
 *
 * Worn state was that. Texture at bias tier was that — resolved, persisted,
 * never rendered, so the editorial prior answered it and the record described
 * hair the prompt had never asked for.
 *
 * The sweep: for every axis in `REALIZED_AXIS_KEYS`, in every styling tier,
 * assert that a non-null persisted value leaves a footprint in the composed
 * prompt — or that the axis persists NULL in that tier. Today it would have to
 * be hand-written per axis, which is exactly the discipline invariant that
 * keeps failing. Once slice zero's registry enumerates the axes with their
 * tier-legality, the sweep is a loop over the registry and the class closes.
 *
 * Recorded here rather than in a doc because this file is where the next
 * person adding an axis will already be looking.
 */
describe("the Versace stack, reproduced", () => {
  it("puts no three tiles under one signature, across many rolls", async () => {
    for (let i = 0; i < 8; i += 1) {
      const compiled = (await versaceFollow(`cap-versace-${i}`)) as unknown as {
        variance: { stillClustered: number; confess: boolean };
      };
      expect(compiled.variance.stillClustered, `roll ${i}`).toBe(0);
      expect(compiled.variance.confess).toBe(false);
    }
  });

  it("no longer sends five identical hair lines", async () => {
    const compiled = (await versaceFollow("cap-versace-lines")) as unknown as {
      candidates: Array<{ prompt: string }>;
    };
    const lines = compiled.candidates.map((c) => c.prompt.match(/ HAIR: [^.]*\./)?.[0] ?? "");
    const worst = Math.max(...[...new Set(lines)].map((l) => lines.filter((x) => x === l).length));
    // A pair is family; three is a wall.
    expect(worst).toBeLessThanOrEqual(SIGNATURE_CAP);
  });
});
