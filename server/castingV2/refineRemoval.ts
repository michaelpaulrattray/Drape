/**
 * Typed removal — resolving "take the earrings off" against the recipe (D-163).
 *
 * # Memory surgery, not a counter-instruction
 *
 * The tempting shape is to append "no earrings" and let the model sort it out.
 * That leaves the original ask in the record arguing with its own retraction —
 * the contradiction class D-159 closed one layer down, rebuilt by hand. So a
 * removal DELETES the matching steps from the chain and recomposes what is
 * left. The chips are the receipt: the removed chip disappears, because the
 * record now says what the person has rather than what they once asked for.
 *
 * # The code owns the matching. Always.
 *
 * The model reads INTENT — "is this a removal, and of what" — and nothing else.
 * Everything after that is mechanical, because three phrasing-list failures in
 * one week (D-158's eighteen literal strings, D-157's `tie`/`tied`, D-152's
 * apostrophe) make "the code owns the vocabulary" a law rather than a
 * preference. A list of surface forms is a guard that proves the implementation
 * matches itself.
 */
import { composeDeltas, itemsOf, type RefineDelta } from "./refineDelta";
import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import { FREE_SUBJECT_KEYS, isPluralSubject, type FreeSubject } from "./refineSubjects";
import { REFINABLE_AXES, type RefinableAxis } from "./refineDelta";

/** One step of a variant's history — a sentence and the delta it produced. */
export type ChainStep = {
  instruction: string;
  delta: RefineDelta;
};

/**
 * A chain is only usable when the two denormalized lists AGREE.
 *
 * `stepDeltas` arrived after this table shipped, so older rows have none — and a
 * row whose lists are different lengths has lost the correspondence that makes
 * index i mean anything. Both cases refuse. An honest "not on this one" beats a
 * reconstruction that is right most of the time and silently drops an edit the
 * rest.
 */
export function readChain(
  instructions: readonly string[],
  stepDeltas: readonly RefineDelta[],
): ChainStep[] | null {
  if (stepDeltas.length !== instructions.length) return null;
  return instructions.map((instruction, index) => ({
    instruction,
    delta: stepDeltas[index]!,
  }));
}

/** The subject a removal named, validated against the code's own vocabulary. */
export function readRemovalSubject(value: unknown): FreeSubject | RefinableAxis | null {
  if (typeof value !== "string") return null;
  if (FREE_SUBJECT_KEYS.includes(value as FreeSubject)) return value as FreeSubject;
  if ((REFINABLE_AXES as readonly string[]).includes(value)) return value as RefinableAxis;
  return null;
}

export function facetOf(subject: FreeSubject | RefinableAxis): Facet {
  return (REFINABLE_AXES as readonly string[]).includes(subject)
    ? facetOfAxis(subject as RefinableAxis)
    : facetOfSubject(subject as FreeSubject);
}

/** Every facet a step writes — the same table composition supersedes on. */
function facetsOfStep(step: ChainStep): Set<Facet> {
  const facets = new Set<Facet>();
  for (const axis of REFINABLE_AXES) {
    if (step.delta[axis] != null) facets.add(facetOfAxis(axis));
  }
  for (const [subject, value] of Object.entries(step.delta.free ?? {})) {
    /* `[]` is truthy, so an emptied plural subject would otherwise still claim
       its facet and keep matching forever (D-171). */
    if (itemsOf(value).length > 0) facets.add(facetOfSubject(subject as FreeSubject));
  }
  return facets;
}

/**
 * The words a step is ABOUT — its own sentence and every value it filed.
 *
 * Both halves are needed. "Make it greener" stores a sentence that never
 * contains the word the delta holds, and a filed value can carry words the
 * sentence phrased differently. Matching one and not the other misses cases in
 * both directions.
 */
function wordsOfStep(step: ChainStep): Set<string> {
  const parts: string[] = [step.instruction];
  for (const axis of REFINABLE_AXES) {
    const value = step.delta[axis];
    if (typeof value === "string") parts.push(value);
  }
  for (const value of Object.values(step.delta.free ?? {})) {
    parts.push(...itemsOf(value));
  }
  return new Set(parts.join(" ").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean).map(stem));
}

/**
 * Crude stemming, deliberately — the same tolerance source containment learned.
 *
 * It has cost this program three regressions to discover that a guard which
 * treats a morphological variant of the user's own word as a different word is
 * a guard doing the opposite of its job. Comparatives are included because
 * "greener" is how people say it and "green" is what gets filed.
 */
function stem(word: string): string {
  return word
    .replace(/(ing|ed|es|er|s)$/i, "")
    .replace(/e$/i, "");
}

/**
 * Which steps a removal takes out — by facet, narrowed by content (D-163).
 *
 * "Remove the makeup" names a facet and takes every step on it. "Remove the
 * smokey eye" names a facet AND particular words, and takes only the step those
 * words identify.
 *
 * **A content match that finds nothing returns nothing**, and that is the
 * ruling's letter: rule 3 fires on "no matching step", and words that match no
 * step ARE no matching step. Taking every makeup step because the person named
 * one that is not there would destroy something they never asked to remove.
 */
export type StepMatch = {
  index: number;
  /**
   * Items to KEEP, or null to delete the whole step (D-171).
   *
   * A plural subject holds several facts in one step, so "remove the hoops"
   * against "small gold hoops and thin wire glasses" must prune rather than
   * delete — the glasses were never named.
   */
  keep: string[] | null;
};

export function matchSteps(
  chain: readonly ChainStep[],
  target: {
    subject: FreeSubject | RefinableAxis | null;
    match: string | null;
    /** Stored items this removal means, already proved verbatim (D-173). */
    items?: readonly string[];
  },
): StepMatch[] {
  /*
    IDENTITY FIRST, WORDS ONLY AS A FALLBACK (D-173).

    The word matcher required every query word to appear in the step's own
    words, so "remove the earrings" could not find "small gold hoops" —
    "earrings" is nowhere in it. Only the machine's own tag worked, which meant
    a user had to speak the label to reach their own edit.

    The parser has already resolved the referent and echoed the stored text
    back, and the code has already proved that echo IS a stored item. So when
    echoes are present the match is by identity, and language never has to be
    guessed at by comparing strings.
  */
  if (target.items && target.items.length > 0) {
    const wanted = new Set(target.items.map((item) => item.toLowerCase()));
    const matches: StepMatch[] = [];
    chain.forEach((step, index) => {
      for (const [subject, value] of Object.entries(step.delta.free ?? {})) {
        const items = itemsOf(value);
        const survivors = items.filter((item) => !wanted.has(item.toLowerCase()));
        if (survivors.length === items.length) continue;
        matches.push({
          index,
          keep: survivors.length > 0 && isPluralSubject(subject as FreeSubject)
            ? survivors
            : null,
        });
        return;
      }
      /* A guaranteed-lane step is one value, so an echo of it deletes it. */
      for (const axis of REFINABLE_AXES) {
        const value = step.delta[axis];
        if (typeof value === "string" && wanted.has(value.toLowerCase())) {
          matches.push({ index, keep: null });
          return;
        }
      }
    });
    /*
      AN ECHO THAT MATCHED NOTHING IS "NO MATCHING STEP" — never "take the lot".

      Falling through to the word path here was the second half of the same
      defect: with no narrowing words, that path deletes every step on the
      facet. So a resolution that identified something and then failed to find
      it would remove more than a resolution that identified nothing. Rule 3 is
      the correct answer, and D-167's confession is behind it.
    */
    return matches;
  }

  const facet = target.subject ? facetOf(target.subject) : null;
  const byFacet = chain
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => !facet || facetsOfStep(step).has(facet));
  if (byFacet.length === 0) return [];

  const words = (target.match ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map(stem);
  if (words.length === 0) return byFacet.map(({ index }) => ({ index, keep: null }));

  const subject = target.subject as FreeSubject;
  const plural = target.subject != null
    && !(REFINABLE_AXES as readonly string[]).includes(target.subject)
    && isPluralSubject(subject);

  const matches: StepMatch[] = [];
  for (const { step, index } of byFacet) {
    if (plural) {
      /*
        MATCHED ON ITEMS, NEVER ON THE SENTENCE (D-171).

        The stored sentence still reads "hoops and glasses" after the hoops are
        pruned, so matching it would make the step match "remove the hoops"
        forever — and each later attempt would find no items and delete the
        whole step, taking the glasses after all. The items are the truth; the
        sentence is provenance.
      */
      const items = itemsOf(step.delta.free?.[subject]);
      const survivors = items.filter((item) => !itemMatches(item, words));
      if (survivors.length === items.length) continue;
      matches.push({ index, keep: survivors.length > 0 ? survivors : null });
      continue;
    }
    const have = wordsOfStep(step);
    if (words.every((word) => have.has(word))) matches.push({ index, keep: null });
  }
  return matches;
}

/** One item answers to the words they named, with the usual ending tolerance. */
function itemMatches(item: string, words: readonly string[]): boolean {
  const have = new Set(
    item.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean).map(stem),
  );
  return words.every((word) => have.has(word));
}

/**
 * Does this recorded value mention what they named? (D-167.)
 *
 * The third resolution step needs to ask the RECORD the same question
 * `matchSteps` asks the recipe, with the same tolerance for word endings —
 * "freckles" must find "lightly freckled". A stricter comparison here would
 * confess "she doesn't have freckles" about a visibly freckled face, which is
 * the one outcome worse than the over-edit this step exists to prevent.
 */
export function textMentions(text: string | null, words: string | null): boolean {
  if (!text) return false;
  if (!words) return true;
  const have = new Set(
    text.toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean).map(stem),
  );
  const wanted = words
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map(stem);
  if (wanted.length === 0) return true;
  return wanted.every((word) => have.has(word));
}

/**
 * The chain after surgery — steps deleted, or pruned to their survivors (D-171).
 *
 * A pruned step KEEPS ITS SENTENCE. That is provenance: they typed "small gold
 * hoops and thin wire glasses" and they did, and rewriting history to match the
 * outcome is the record drifting from the person. The chip reads back from the
 * surviving ITEMS instead, which are also their own words.
 */
export function chainAfterRemoval(
  chain: readonly ChainStep[],
  matches: readonly StepMatch[],
  subject: FreeSubject | null,
): ChainStep[] {
  const byIndex = new Map(matches.map((match) => [match.index, match]));
  const next: ChainStep[] = [];
  chain.forEach((step, index) => {
    const match = byIndex.get(index);
    if (!match) {
      next.push(step);
      return;
    }
    if (match.keep === null || !subject) return;
    next.push({
      instruction: step.instruction,
      delta: { ...step.delta, free: { ...step.delta.free, [subject]: match.keep } },
    });
  });
  return next;
}

/** What a step should SAY it did, after items were taken out of it (D-171). */
export function stepLabel(step: ChainStep, subject?: FreeSubject | null): string {
  if (!subject) return step.instruction;
  const items = itemsOf(step.delta.free?.[subject]);
  return items.length > 0 ? items.join(", ") : step.instruction;
}

/**
 * A stable, order-independent fingerprint of a composed delta.
 *
 * **This is the money-critical part**, and `JSON.stringify` is wrong for it:
 * key order depends on insertion, so two identical recipes built in different
 * orders would fingerprint differently, and the user would be charged 25 for a
 * picture that already exists. Rule 4 says only a genuinely new combination
 * renders.
 */
export function fingerprintDelta(delta: RefineDelta): string {
  const flat: Array<[string, string]> = [];
  for (const axis of REFINABLE_AXES) {
    const value = delta[axis];
    if (typeof value === "string") flat.push([axis, value]);
  }
  for (const [subject, value] of Object.entries(delta.free ?? {})) {
    const items = itemsOf(value);
    if (items.length === 0) continue;
    /*
      ITEMS SORTED, and serialized as JSON rather than joined (D-171).

      Sorted because "hoops, glasses" and "glasses, hoops" are the same recipe,
      and rule 4 says an existing recipe is SELECTED free — a fingerprint that
      disagreed on order would charge 25 credits for a picture they already
      have. Sorted HERE ONLY: the prompt keeps their own order, because
      reordering somebody's words to suit a comparison is the record drifting
      from the person.

      JSON rather than a join because items can contain commas, and `"a,b"`
      plus `"c"` colliding with `"a"` plus `"b,c"` is a free-select of a recipe
      that is not theirs.
    */
    flat.push([`free.${subject}`, JSON.stringify([...items].sort())]);
  }
  flat.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return flat.map(([key, value]) => `${key}=${value}`).join("");
}

/**
 * Does an existing variant already BE this chain? (D-163 rule 4.)
 *
 * Both halves are required, and each one alone is a real defect. Instructions
 * alone would free-select a variant whose relative steps ("greener still")
 * resolved against a different starting point — the same words, a different
 * picture. Deltas alone would collapse two genuinely different histories whose
 * ends happen to agree, which is a record that lies about how it got there.
 */
export function sameChain(
  a: { instructions: readonly string[]; delta: RefineDelta },
  b: { instructions: readonly string[]; delta: RefineDelta },
): boolean {
  if (a.instructions.length !== b.instructions.length) return false;
  if (!a.instructions.every((line, index) => line === b.instructions[index])) return false;
  return fingerprintDelta(a.delta) === fingerprintDelta(b.delta);
}

/** Recompose what survives — the ordinary composition rule, nothing special. */
export function composeChain(chain: readonly ChainStep[]): RefineDelta {
  return composeDeltas(chain.map((step) => step.delta));
}
