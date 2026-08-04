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
import { composeDeltas, type RefineDelta } from "./refineDelta";
import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import { FREE_SUBJECT_KEYS, type FreeSubject } from "./refineSubjects";
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

function facetOf(subject: FreeSubject | RefinableAxis): Facet {
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
    if (value) facets.add(facetOfSubject(subject as FreeSubject));
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
    if (value) parts.push(value);
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
export function matchSteps(
  chain: readonly ChainStep[],
  target: { subject: FreeSubject | RefinableAxis | null; match: string | null },
): number[] {
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
  if (words.length === 0) return byFacet.map(({ index }) => index);

  const narrowed = byFacet.filter(({ step }) => {
    const have = wordsOfStep(step);
    return words.every((word) => have.has(word));
  });
  return narrowed.map(({ index }) => index);
}

/** The chain with those steps gone — what the face becomes. */
export function chainWithout(
  chain: readonly ChainStep[],
  removed: readonly number[],
): ChainStep[] {
  const drop = new Set(removed);
  return chain.filter((_, index) => !drop.has(index));
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
    if (value) flat.push([`free.${subject}`, value]);
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
