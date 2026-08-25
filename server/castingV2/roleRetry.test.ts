import { describe, expect, it, vi } from "vitest";

import { interpretBrief, interpreterRoleStats } from "./interpreter";
import { NOTES_MAX } from "./castingIntent";
import type { TextEngine } from "../providers/types";

/**
 * THE ROLE RE-ASK — a category the model found and did not name.
 *
 * `role` is the ONLY field that produces the `CASTING CATEGORY (ABSOLUTE)`
 * block, so a null one costs the sheet the instruction telling the engine what
 * it is casting. **The founder has reported that outcome twice, five months
 * apart** — "generic women" on a high-fashion editorial brief, and identical
 * cybernetics on his 553-character augmented-man brief ("the augments and
 * cybernetics delivered were underwhelming, all the casts look very similar").
 * Each time it was found by someone tripping over it. Nothing counted it.
 *
 * Same shape as `aestheticRetry`: one more sample of the SAME interpretation,
 * never a differently-worded second question, so it cannot invent a category
 * the model does not see.
 *
 * ⚠ THE ARM THAT MATTERS MOST IS THE ONE THAT PROVES IT DOES **NOT** FIRE.
 * A null role is usually correct — "a redhead in her 30s" names no category —
 * and re-asking those invites exactly the bug `promoteStatedRole` was narrowed
 * to stop. Measured across 213 real production rolls: 26 have a null role, and
 * 25 of them have raw character notes of 62 characters or fewer. The 26th is
 * the cyborg brief at 448. The trigger is that gap, expressed against the
 * product's own `NOTES_MAX` rather than a number chosen to fit.
 */

function engineSequence(replies: Record<string, unknown>[]): { engine: TextEngine; calls: () => number } {
  let call = 0;
  const engine = {
    id: "sequence",
    complete: vi.fn(async () => {
      const reply = replies[Math.min(call, replies.length - 1)];
      call += 1;
      return {
        text: JSON.stringify({ cohort: "photoreal_human", ...reply }),
        latencyMs: 1,
        provenance: { provider: "openrouter" as const, model: "t", servedModel: "t" },
      };
    }),
  } as unknown as TextEngine;
  return { engine, calls: () => call };
}

/** Longer than NOTES_MAX — a model that wrote this much found a specific person. */
const RICH_NOTES =
  "Severe bone structure with pronounced brow ridge, deep-set eyes, hard jawline and gaunt cheeks; "
  + "matte-black implant ports above the right temple, fine metal seams across the scalp, a dark "
  + "mechanical plate along the jawline, a stud below each ear, right eye glowing amber-red.";

/** Shorter than NOTES_MAX — the honest-silence population, 25 of 26 in production. */
const THIN_NOTES = "Freckles across the nose.";

const RICH_BRIEF = "Bald male, mid-40s, with cybernetic augmentation integrated into his skin.";
const THIN_BRIEF = "a redhead in her 30s";

/*
 * ⚠ THE ARMS BELOW DRIVE UNDER `fidelity: true`, AND THAT IS A DELIBERATE
 * ISOLATION RATHER THAN A CONVENIENCE.
 *
 * Outside the fidelity bound `notesMax` is 180, so RICH_NOTES overflows it and
 * the EXISTING notes-compression re-ask fires as well — a second extra call
 * that has nothing to do with this repair. Written without this flag the arms
 * counted three calls and read as "the re-ask ran twice", which is a false
 * accusation against the subject. Isolated here; the interaction itself gets
 * its own arm at the bottom, where it is asserted rather than avoided.
 */
const RICH = { briefText: RICH_BRIEF, fidelity: true } as const;

/*
 * The counters are module-scoped and cumulative across a file, so every arm
 * reads a DELTA rather than an absolute. An arm asserting `nullOnCompile === 1`
 * would pass alone and fail the moment another arm ran before it — which is a
 * flake that looks like a defect in the subject.
 */

describe("the role re-ask", () => {
  it("⚠ FIRES when a rich brief comes back with no category, and the rescue lands", async () => {
    const before = interpreterRoleStats();
    const { engine, calls } = engineSequence([
      { role: null, characterNotes: RICH_NOTES },
      { role: "cybernetically augmented man", characterNotes: RICH_NOTES },
    ]);

    const outcome = await interpretBrief({ ...RICH, engine });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls(), "it must have asked a second time").toBe(2);
    expect(outcome.intent.role).toBe("cybernetically augmented man");

    const after = interpreterRoleStats();
    expect(after.nullOnCompile - before.nullOnCompile).toBe(1);
    expect(after.rescued - before.rescued).toBe(1);
  });

  it("⚠ DOES NOT FIRE on an honest silence — a short brief that names no category", async () => {
    /*
     * The population control, and the reason this repair is safe. Twenty-five
     * of production's twenty-six null-role rolls look like this one. Firing
     * here would ask a model to name a category for "a redhead in her 30s",
     * and whatever it answered would be installed as an ABSOLUTE casting
     * instruction the customer never wrote.
     */
    const before = interpreterRoleStats();
    const { engine, calls } = engineSequence([
      { role: null, characterNotes: THIN_NOTES },
      { role: "fashion model", characterNotes: THIN_NOTES },
    ]);

    const outcome = await interpretBrief({ briefText: THIN_BRIEF, engine });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls(), "one call only — the re-ask must not have run").toBe(1);
    expect(outcome.intent.role, "and no category may be invented").toBeNull();
    expect(interpreterRoleStats().nullOnCompile - before.nullOnCompile).toBe(0);
  });

  it("does not fire when the model DID name a category", async () => {
    const { engine, calls } = engineSequence([
      { role: "cybernetically augmented man", characterNotes: RICH_NOTES },
    ]);

    const outcome = await interpretBrief({ ...RICH, engine });

    expect(outcome.ok).toBe(true);
    expect(calls()).toBe(1);
  });

  it("a still-null re-ask COMPILES rather than walling or looping", async () => {
    // A rich brief that genuinely names no category is possible, and it must
    // cost one extra call and then behave exactly as it would have.
    const before = interpreterRoleStats();
    const { engine, calls } = engineSequence([
      { role: null, characterNotes: RICH_NOTES },
      { role: null, characterNotes: RICH_NOTES },
      { role: "invented too late", characterNotes: RICH_NOTES },
    ]);

    const outcome = await interpretBrief({ ...RICH, engine });

    expect(outcome.ok, "it must still compile").toBe(true);
    if (!outcome.ok) return;
    expect(calls(), "ONCE — a bad day at the provider is not unbounded spend").toBe(2);
    expect(outcome.intent.role).toBeNull();

    const after = interpreterRoleStats();
    expect(after.nullOnCompile - before.nullOnCompile).toBe(1);
    expect(after.rescued - before.rescued, "nothing was rescued").toBe(0);
  });

  it("adopts ONLY the role — the first parse's other facts are not replaced", async () => {
    /*
     * The narrow-adoption rule, and it is the difference between recovering a
     * category and risking a brief. On a rich brief the first parse holds many
     * stated facts; the second sample is a fresh interpretation and may hold
     * fewer. Taking the whole thing to recover one field would put all of them
     * at risk. Here the second reply drops the sex the first captured.
     */
    const { engine } = engineSequence([
      { role: null, sex: "male", characterNotes: RICH_NOTES },
      { role: "cybernetically augmented man", sex: null, characterNotes: null },
    ]);

    const outcome = await interpretBrief({ ...RICH, engine });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.intent.role).toBe("cybernetically augmented man");
    expect(outcome.intent.sex, "the first parse's fact must survive").toBe("male");
    expect(outcome.intent.characterNotes, "and so must its notes").not.toBeNull();
  });

  it("⚠ OUTSIDE the fidelity bound a rich brief costs TWO extra calls, not one — the interaction, asserted", async () => {
    /*
     * The cost fact, pinned rather than discovered later. On today's road
     * `notesMax` is 180, so notes this rich ALSO overflow it and the existing
     * compression re-ask fires — one call for the notes, one for the role.
     *
     * It is bounded and rare: it needs a brief rich enough to overflow AND a
     * null role, which is 1 of 213 real production rolls. But two extra text
     * calls on one compile is the kind of number that should be written down by
     * the person who added the second one, not found by whoever next reads a
     * bill. This arm reddens if either re-ask stops firing or a third appears.
     */
    const { engine, calls } = engineSequence([
      { role: null, characterNotes: RICH_NOTES },
      { role: "cybernetically augmented man", characterNotes: RICH_NOTES },
    ]);

    // No `fidelity` flag: this is the road every unflagged account is on.
    const outcome = await interpretBrief({ briefText: RICH_BRIEF, engine });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(calls(), "initial + notes compression + role re-ask").toBe(3);
    expect(outcome.intent.role, "and the role is still recovered on this road").toBe(
      "cybernetically augmented man",
    );
  });

  it("the trigger is the RAW notes against NOTES_MAX, so it behaves the same on both roads", async () => {
    /*
     * Read at the constant rather than at a literal: the stored notes are
     * capped at 180 outside the fidelity lane and could never exceed it, so a
     * trigger reading the STORED value would have been silently lane-only.
     * This asserts the fixture actually straddles the bound, which is what
     * makes the two arms above mean opposite things.
     */
    expect(RICH_NOTES.length).toBeGreaterThan(NOTES_MAX);
    expect(THIN_NOTES.length).toBeLessThan(NOTES_MAX);
  });
});
