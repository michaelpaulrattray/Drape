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
import {
  composeDeltas,
  facetsAnsweredBy,
  facetsWrittenBy,
  itemsOf,
  valuesFiledBy,
  type RefineDelta,
} from "./refineDelta";
import { readsAsNegation } from "./removalWords";
import { facetOfAxis, facetOfSubject, type Facet } from "./refineFacets";
import { FREE_SUBJECT_KEYS, isPluralSubject, type FreeSubject } from "./refineSubjects";
import { REFINABLE_AXES, type RefinableAxis } from "./refineDelta";
import type { StepProvenance } from "./referenceProvenance";

/**
 * One step of a variant's history — a sentence, the delta it produced, and
 * where its words came from.
 *
 * `provenance` joins the pair rather than living beside it (ruled fable-968
 * §3a) so that a REMOVAL reindexes it for free: the pruned chain is what the
 * new row's three arrays are built from, and a fourth list walked separately
 * would drift from this one at exactly the moment it mattered.
 */
export type ChainStep = {
  instruction: string;
  delta: RefineDelta;
  provenance: StepProvenance | null;
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
  stepProvenance: readonly (StepProvenance | null)[] | null = null,
): ChainStep[] | null {
  if (stepDeltas.length !== instructions.length) return null;
  /*
    PROVENANCE IS OPTIONAL AND ITS ABSENCE IS NOT A BROKEN CHAIN.

    Every row written before that column existed has none, and a chain that
    refused without it would break removal on all of them. So a missing or
    disagreeing list reads as "not on this one" per step — the same refusal
    `readStepProvenance` performs, carried here rather than re-decided.
  */
  const provenance = stepProvenance?.length === instructions.length ? stepProvenance : null;
  return instructions.map((instruction, index) => ({
    instruction,
    delta: stepDeltas[index]!,
    provenance: provenance?.[index] ?? null,
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

/**
 * Every facet a step writes — the same table composition supersedes on.
 *
 * **This was `facetsWrittenBy` copied out by hand, and the copies had drifted**
 * (law 4). The copy knew that `[]` is truthy and that an emptied plural subject
 * must stop claiming its facet (D-171); the original did not, so the two
 * disagreed about a shape that reaches the money path. One derivation now, the
 * stricter reading kept, and a step that only says something DEPARTED claims its
 * facet here too — otherwise a departure is invisible to the matcher and the
 * removal it recorded can never itself be undone.
 */
const facetsOfStep = (step: ChainStep): Set<Facet> => facetsWrittenBy(step.delta);

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
    /**
     * Did they mean the WHOLE subject? Reported by the parser, never inferred.
     *
     * This used to be read off an empty `match`, and that inference is run-7's
     * root cause: "remove her glasses" arrived with its words missing, was read
     * as "she named the whole subject", and took every `statedAccessories` step
     * — including the gold hoops she had paid for. Missing words are missing
     * words; they are not a claim about width.
     */
    whole?: boolean;
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
  /*
    THE WHOLE FACET GOES ONLY WHEN THEY SAID THE WHOLE FACET.

    This was `if (words.length === 0)` — no narrowing words, take the lot — and
    it is the widest, most destructive branch in the file: it deletes whole
    steps rather than pruning items. Reaching it by ACCIDENT is what cost run-7
    its earrings, and there were two ways in: a parser that reported width by
    omission, and an authority filter that drops an echo it cannot verify,
    turning "they named a thing" into "they named nothing". Width is now a
    claim the parser makes out loud, so neither road leads here.

    Words with nothing to narrow are rule 3's case — no matching step — which
    the caller sends to her face. That is the same answer this function already
    gives an echo that matched nothing, for the same reason.
  */
  if (words.length === 0) {
    return target.whole ? byFacet.map(({ index }) => ({ index, keep: null })) : [];
  }
  if (target.whole) return byFacet.map(({ index }) => ({ index, keep: null }));

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
      /* The step SURVIVES with fewer items in it; its sentence is untouched, so
         where those words came from is untouched too. */
      provenance: step.provenance,
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
  /*
    AND THE DEPARTURES, or two different recipes fingerprint the same.

    "Her, wearing her glasses" and "her, with the glasses taken off" differ by
    nothing else — same instructions minus one, same positive facts — so leaving
    `absent` out would make rule 4 hand back the bespectacled picture as though
    it were the recipe just described. A free selection of a face they did not
    ask for is worse than the double charge this function exists to prevent.
  */
  for (const [subject, items] of Object.entries(delta.absent ?? {})) {
    if ((items ?? []).length === 0) continue;
    flat.push([`absent.${subject}`, JSON.stringify([...items].sort())]);
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

/**
 * DID THE EDIT RE-READ NAME A THING TO HAVE — the ambiguous-word decision
 * (fable-481 §2), in one place because two copies of it would disagree.
 *
 * `removalEvidence` says whether the user's sentence stated subtraction
 * plainly, said nothing, or leaned on a word that also describes a look
 * ("clear rims", "drop earrings"). On that last kind the model proposes both
 * readings and this decides between them:
 *
 *   - the re-read must ANSWER the facet the removal named — anything else is
 *     about something other than the thing being taken off;
 *   - and its words must not be the departure restated. A positive lane can
 *     hold "no earrings", which answers the facet while saying the thing is
 *     gone; reading that as a thing to have would cancel a real removal.
 *
 * Exported so the corpus bench decides with the SHIPPED rule rather than a
 * second copy of it — the class is measured, not asserted.
 */
export function reReadNamesAThingToHave(input: {
  delta: RefineDelta;
  /** The subject the removal claimed, or null when it named none. */
  subject: FreeSubject | RefinableAxis | null;
  /** The noun it claimed, for telling a restated departure from a look. */
  match: string;
}): boolean {
  const filed = valuesFiledBy(input.delta);
  if (filed.length > 0 && filed.every((value) => readsAsNegation(value, input.match))) return false;
  const answered = facetsAnsweredBy(input.delta);
  return input.subject ? answered.has(facetOf(input.subject)) : answered.size > 0;
}
