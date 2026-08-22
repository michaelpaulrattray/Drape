/**
 * THE CAP ON THE ONE SENTENCE THAT REACHES THE IMAGE MODEL.
 *
 * `characterNotes` and `role` are, in the interpreter prompt's own words, *"the
 * only text that reaches the image model"*. The cap on the first was enforced
 * by a bare `.slice(0, 180)` — a cut at whatever character 180 happened to be,
 * mid-word, with no signal of any kind.
 *
 * Found at the wire on 2026-08-22 rather than by reading: two rolls of one
 * brief (identical sha256, same interpreter model) delivered 3-of-8 and 8-of-8
 * visibly tattooed masters, and the one that lost its ink had a paid prompt
 * reading *"…closely shaved sides, extensive b. LOOK: …"* with no instruction
 * anywhere in it to draw a tattoo. Production census: 2 of 96 rolls with notes
 * were cut, and they were the only two that named ink — rare in general,
 * universal on the population that matters, because ink came last in both.
 *
 * Ruled fable-1415: (a) never cut a word in half, (b) make the cut countable,
 * (c) ask once for a shorter line rather than guillotining the fact.
 */
import { describe, expect, it } from "vitest";

import {
  NOTES_MAX,
  cleanCharacterNotes,
  freeTextOverflow,
  parseCastingIntent,
} from "./castingIntent";
import { compressCharacterNotes } from "./interpreter";
import type { TextEngine } from "../providers/types";

/*
  ⚠ THE GUILLOTINE — the cap that silently ate two production rolls' tattoos
  (found at the wire, ruled fable-1415).

  `characterNotes` is one of the two fields the interpreter's own prompt calls
  *"the only text that reaches the image model"*, and its 180-character cap was
  a bare `.slice`. What that put on a paid prompt, eight times, on rolls 128 and
  129 — the ONLY two production rolls that named tattoos:

      Character detail: … closely shaved sides, extensive b. LOOK: …

  Half a word, with the template's full stop welded on, and every word of
  "extensive black-and-grey ornamental tattoos covering most of his chest" gone.
  Two rolls of that brief, same sha256 and same interpreter model, delivered
  3-of-8 and 8-of-8 visibly tattooed masters; the one that lost its ink had no
  instruction anywhere in its prompt to draw any.
*/
describe("a cap that does not cut a word in half", () => {
  const LONG = "Long angular face, prominent cheekbones, sharp jawline, straight nose, subtly "
    + "full lips, pale blue-grey hooded eyes, extremely light brows/lashes, closely shaved "
    + "sides, extensive black-and-grey ornamental tattoos across the chest";

  it("ends on a whole word, never mid-word", () => {
    const fitted = cleanCharacterNotes(LONG)!;
    expect(fitted.length).toBeLessThanOrEqual(NOTES_MAX);
    /* The reading that matters: the last word is a word. `extensive b` passes a
       length assertion and fails a person. */
    expect(LONG.startsWith(fitted), "it is a prefix of what the model said").toBe(true);
    const nextChar = LONG.charAt(fitted.length);
    expect(
      nextChar === "" || /[\s,;:]/.test(nextChar),
      `cut mid-word: …${JSON.stringify(fitted.slice(-14))} then ${JSON.stringify(nextChar)}`,
    ).toBe(true);
  });

  it("leaves no dangling separator, because the sentence ends there now", () => {
    /* "…closely shaved sides," reads as a promise of a clause that is not
       coming, and the prompt template adds its own full stop after it. */
    expect(cleanCharacterNotes(LONG)!).not.toMatch(/[\s,;:\-–—]$/);
  });

  it("keeps the hard cut for the one case with no boundary to find", () => {
    /* A single token longer than the whole budget. Returning nothing would drop
       a fact rather than shorten it. */
    const oneWord = "a".repeat(NOTES_MAX + 40);
    expect(cleanCharacterNotes(oneWord)).toHaveLength(NOTES_MAX);
  });

  it("does not touch a line that already fits", () => {
    const fits = "Pale cool skin, sharp jawline, geometric tattoos across chest and arms.";
    expect(cleanCharacterNotes(fits)).toBe(fits);
    expect(freeTextOverflow(fits, NOTES_MAX)).toBe(0);
  });

  it("SAYS how much it took, so the cut can be counted", () => {
    /* Silence is what let this hide through a founder-visible contact sheet and
       a whole sign court. */
    expect(freeTextOverflow(LONG, NOTES_MAX)).toBe(LONG.length - NOTES_MAX);
    expect(freeTextOverflow(null, NOTES_MAX), "no notes is not an overflow").toBe(0);
  });

  it("reports the overflow and the UNCUT line on the parse, from one reader", () => {
    /*
      The raw line rides on the parse result rather than being re-read from the
      reply by the caller: a second reader of the same JSON is a second answer
      to the same question waiting to disagree (working law 4).
    */
    const parsed = parseCastingIntent(JSON.stringify({
      cohort: "photoreal_human", characterNotes: LONG,
    }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.notes.raw).toBe(LONG);
    expect(parsed.notes.overflow).toBe(LONG.length - NOTES_MAX);
    /* And the intent still carries the FITTED line, so a caller that ignores
       all of this behaves exactly as it did before, only readably. */
    expect(parsed.intent.characterNotes).toBe(cleanCharacterNotes(LONG));
  });

  it("reports ZERO overflow for the ordinary roll, which is almost all of them", () => {
    const parsed = parseCastingIntent(JSON.stringify({
      cohort: "photoreal_human", characterNotes: "Sharp jawline, copper hair.",
    }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.notes.overflow).toBe(0);
  });
});

/*
  THE RE-ASK — one attempt, on the ~2% that overflow, and NOT TRUSTED.

  A compression that quietly returns something longer would be the original
  defect with an extra call billed for it, so every arm here is about what the
  caller REFUSES to adopt.
*/
describe("the compression re-ask", () => {
  const LONG = "Long angular face, prominent cheekbones, sharp jawline, straight nose, subtly "
    + "full lips, pale blue-grey hooded eyes, extremely light brows/lashes, closely shaved "
    + "sides, extensive black-and-grey ornamental tattoos across the chest";

  const engineSaying = (text: string, seen: { system?: string; user?: string } = {}): TextEngine => ({
    id: "double",
    complete: async (call: any) => {
      seen.system = call.system;
      seen.user = call.user;
      return { text, latencyMs: 1, provenance: { provider: "double", model: "double" } };
    },
  } as unknown as TextEngine);

  it("hands the model ITS OWN SENTENCE and the bound — never the brief", () => {
    /* Re-reading the brief would be a second interpretation and would need the
       whole containment apparatus the first one has. */
    const seen: { system?: string; user?: string } = {};
    return compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: engineSaying("short", seen) })
      .then(() => {
        expect(seen.user).toContain(LONG);
        expect(seen.user).toContain(String(NOTES_MAX));
        expect(seen.system).toContain("KEEP EVERY CONCRETE, VISIBLE FACT");
      });
  });

  it("takes a genuinely shorter line", async () => {
    const said = "Angular face, pale blue-grey eyes, shaved sides, black-and-grey tattoos on chest.";
    await expect(compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: engineSaying(said) }))
      .resolves.toBe(said);
  });

  it("REFUSES an answer that is not shorter — it has done the opposite of the job", async () => {
    const longer = `${LONG} and more besides`;
    await expect(compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: engineSaying(longer) }))
      .resolves.toBeNull();
  });

  it("refuses an empty answer, and never throws a roll away over one", async () => {
    await expect(compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: engineSaying("   ") }))
      .resolves.toBeNull();
    const dead = { id: "dead", complete: async () => { throw new Error("provider down"); } } as unknown as TextEngine;
    await expect(compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: dead }))
      .resolves.toBeNull();
  });

  it("strips the quotes a model wraps a line in, without touching the words", async () => {
    const said = "Angular face, shaved sides, tattoos on chest.";
    await expect(compressCharacterNotes({ notes: LONG, max: NOTES_MAX, engine: engineSaying(`"${said}"`) }))
      .resolves.toBe(said);
  });

  it("⚠ its answer still goes through the SAME fitter — one owner for the cap", async () => {
    /*
      A compressed line that is still over the bound is cut like any other, at a
      word boundary, and the counter says so. Two call sites applying their own
      cap is how the compressed line and the original come to obey different
      rules.
    */
    const stillLong = `${"word ".repeat(60)}tattoos`;
    const answer = await compressCharacterNotes({
      notes: `${stillLong} and then some more words to make it longer still`,
      max: NOTES_MAX,
      engine: engineSaying(stillLong),
    });
    expect(answer).toBe(stillLong);
    expect(freeTextOverflow(answer, NOTES_MAX)).toBeGreaterThan(0);
    expect(cleanCharacterNotes(answer)!.length).toBeLessThanOrEqual(NOTES_MAX);
  });
});
