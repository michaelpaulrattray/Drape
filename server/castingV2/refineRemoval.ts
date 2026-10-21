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
import { REFINABLE_AXES, type OpenKindAsk, type RefinableAxis } from "./refineDelta";
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
  /*
    THE OPEN LANE IS READ HERE TOO (#2638).

    It was missed when that lane arrived, and the miss was HIDDEN: a step's own
    sentence is the first thing in `parts`, and "give her vampire fangs"
    happens to contain the noun — so an open kind looked findable while nothing
    was reading the lane at all. This function's own argument applies to it
    unchanged: "make them longer" stores a sentence that never names the
    feature, and the kind's noun and filed words are the only place that word
    lives.
  */
  for (const [kind, ask] of Object.entries(step.delta.open ?? {})) {
    parts.push(kind, ask.noun, ask.words);
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
 * Which steps a removal takes out — by facet, narrowed by content (D-163),
 * and by NAME for a feature that has no facet (#2638).
 *
 * "Remove the makeup" names a facet and takes every step on it. "Remove the
 * smokey eye" names a facet AND particular words, and takes only the step those
 * words identify.
 *
 * ⚠ **A third road exists and this summary said "by facet" without it for as
 * long as the open lane has.** An open kind deliberately carries no facet, so
 * a removal that named any subject at all filtered every open-kind step out
 * before comparing a single word — fangs a refine had ADDED could not be taken
 * off. Those steps now join the WORD-NARROWED path, and only that path: width
 * is claimed against a subject and an open kind sits outside every subject, so
 * `whole` must never reach them. The branches below read `byFacet` for that
 * reason, and a facet-matched step is untouched by any of it.
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
  /**
   * The OPEN KINDS this removal takes out of the step, when the step holds
   * more than them (#2638 follow-up). Absent means the whole step goes (or
   * `keep` prunes its items); present means only these kinds leave and the
   * rest of the step (horns, makeup, anything else filed beside them) stays.
   *
   * "Remove the fangs" against one step that also added horns used to delete
   * the whole step, so the horns went too. The matcher only ever names the
   * kinds the customer's words named, and sets this only when something else
   * would be left; a step holding nothing but the named kinds still goes whole.
   */
  dropOpen?: string[];
};

/**
 * Does a step's delta still ask for anything? (#2638 follow-up.)
 *
 * Read over every lane that carries a request: the guaranteed axes, the free
 * lane's items, the departures, the ink records and the open kinds.
 * `fromPicture` is not a request — it says where a free value's words came
 * from — so a delta holding only that holds nothing.
 */
export function deltaAsksForAnything(delta: RefineDelta): boolean {
  for (const axis of REFINABLE_AXES) {
    if (typeof delta[axis] === "string" && delta[axis] !== "") return true;
  }
  for (const value of Object.values(delta.free ?? {})) {
    if (itemsOf(value).length > 0) return true;
  }
  for (const items of Object.values(delta.absent ?? {})) {
    if ((items ?? []).length > 0) return true;
  }
  for (const ink of [delta.inkApplied, delta.inkDelivered, delta.inkAsked]) {
    if (ink && Object.keys(ink).length > 0) return true;
  }
  return Object.keys(delta.open ?? {}).length > 0;
}

/** A step's delta with the named open kinds taken out of it. */
function withoutOpenKinds(delta: RefineDelta, kinds: readonly string[]): RefineDelta {
  const open = { ...(delta.open ?? {}) };
  for (const kind of kinds) delete open[kind];
  const next: RefineDelta = { ...delta, open };
  if (Object.keys(open).length === 0) delete next.open;
  return next;
}

/**
 * WHAT A MATCH TAKES OUT OF ITS STEP, as a delta (#2638 follow-up).
 *
 * The caller reads the struck step's facets and slots to decide what the
 * render is taking back. For a whole-step match that is the step itself; for
 * an open-kind prune it is ONLY the named kinds, or the horns and the makeup
 * beside the fangs would be told to the painter and the verifier as removed.
 * An item prune (`keep`) keeps its existing behaviour: the whole step's delta.
 */
export function struckPartOf(step: ChainStep, match: StepMatch): RefineDelta {
  if (!match.dropOpen) return step.delta;
  const open: Record<string, OpenKindAsk> = {};
  for (const kind of match.dropOpen) {
    const ask = step.delta.open?.[kind];
    if (ask) open[kind] = ask;
  }
  return { open };
}

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
  const indexed = chain.map((step, index) => ({ step, index }));
  const byFacet = indexed.filter(({ step }) => !facet || facetsOfStep(step).has(facet));
  /*
    AN OPEN KIND HAS NO FACET, SO IT NEEDED ITS OWN WAY IN (#2638).

    `refineDelta` says it out loud — *"an open kind has no facet, and that is
    what makes it CARRY"* — and `facetsWrittenBy` reads the axes, the free lane
    and `absent`, never `open`. That is deliberate and load-bearing: a facet is
    what `composeDeltas` CLEARS, so giving an open kind one would stop it
    surviving the next render.

    The cost landed here. A removal that named any subject at all was filtered
    down to that subject's facet, and every open-kind step was dropped before a
    single word was compared — so fangs a refine had ADDED could not be taken
    off by name. Found on dev through the live interpreter, which files
    *"remove her fangs"* under the nearest closed subject it owns, `teeth`.

    ⚠ **THEY JOIN THE WORD-NARROWED PATH ONLY, NEVER THE `whole` BRANCH**, and
    the two branches below still read `byFacet` for exactly that reason. Width
    is claimed against a SUBJECT, and an open kind sits outside every subject —
    so admitting them to `whole` would make *"remove her teeth"* take her
    horns, her wings and every other open kind on the face. That is run-7's
    earrings rebuilt on a new lane, the one outcome this file exists to refuse.
  */
  const carriesOpenKind = (step: ChainStep) => Object.keys(step.delta.open ?? {}).length > 0;
  const facetMatched = new Set(byFacet.map(({ index }) => index));
  const narrowable = indexed.filter(
    ({ step, index }) => facetMatched.has(index) || carriesOpenKind(step),
  );
  if (narrowable.length === 0) return [];

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
  for (const { step, index } of narrowable) {
    /*
      AN OPEN KIND IS JUDGED ON ITS OWN ROW, per KIND (#2638).

      Tested per kind rather than across the step: a step carrying fangs and
      horns must answer "fangs" with the fangs row, never because its neighbour
      contributed the missing word.

      ONLY THE NAMED KINDS LEAVE (#2638 follow-up). One step can file fangs
      beside horns, or beside a lip colour, and "remove the fangs" never named
      those — deleting the step took them too. The step goes whole only when
      the named kinds were all it asked for. This runs for a facet-matched step
      as well: there, the word path below would have found the same kind in
      `wordsOfStep` and deleted the whole step for it.

      A step the FACET filter dropped is here on its open kinds alone, so when
      none of them is named it is skipped — the widening reaches nothing the old
      filter did not discard outright.
    */
    const namedOpen = Object.entries(step.delta.open ?? {})
      .filter(([kind, ask]) => {
        const have = new Set(
          [kind, ask.noun, ask.words]
            .join(" ")
            .toLowerCase()
            .replace(/['’]/g, "")
            .split(/[^a-z0-9]+/)
            .filter(Boolean)
            .map(stem),
        );
        return words.every((word) => have.has(word));
      })
      .map(([kind]) => kind);
    if (namedOpen.length > 0) {
      matches.push(
        deltaAsksForAnything(withoutOpenKinds(step.delta, namedOpen))
          ? { index, keep: null, dropOpen: namedOpen }
          : { index, keep: null },
      );
      continue;
    }
    if (!facetMatched.has(index)) continue;
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
    if (match.dropOpen) {
      /* Only the named open kinds leave; the sentence stays, as on an item
         prune, because it is provenance (D-171). */
      next.push({
        instruction: step.instruction,
        delta: withoutOpenKinds(step.delta, match.dropOpen),
        provenance: step.provenance,
      });
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
      disagreed on order would charge 500 credits for a picture they already
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
  /*
    AND THE OPEN KINDS (#2638 follow-up). Until a removal could take one kind
    out of a step and leave the step's sentence standing, two chains with the
    same sentences always had the same open kinds, so leaving them out cost
    nothing. Now "remove the fangs" on a step that also added horns keeps that
    step's sentence, and without this line the recipe minus the fangs
    fingerprints the same as the picture WITH them — rule 4 would hand back the
    fanged picture, free, as the answer to taking them off.
  */
  for (const [kind, ask] of Object.entries(delta.open ?? {})) {
    flat.push([`open.${kind}`, JSON.stringify([ask.noun, ask.words])]);
  }
  flat.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return flat.map(([key, value]) => `${key}=${value}`).join("\u0001");
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
 * WHAT A KEPT SENTENCE ONCE ASKED FOR AND NO LONGER DOES (#2665).
 *
 * A pruned step KEEPS ITS SENTENCE (D-171, `chainAfterRemoval`): "remove the
 * fangs" against "add fangs and horns" takes the fangs out of the step's delta
 * and leaves "add fangs and horns" in the record, because it is what the
 * customer typed. That is right for the record and wrong for any reader that
 * takes the sentence as a description of who the cast is NOW — the description
 * writer's seed road hands it over verbatim as a change "already made", and
 * nothing beside it says half of it was taken back. Every render after that
 * paints from the paragraph, so the fangs come back.
 *
 * Nothing stored says what a prune took: the step's delta is simply smaller.
 * So it is read off the LINEAGE — an ancestor that holds a step with the same
 * sentence held what that sentence asked for before the prune — and the
 * difference is the answer. Two shapes can shrink a kept step and both are
 * read: an open kind (`dropOpen`, by key, answered with its `noun`) and an item
 * of a plural free subject (`keep`, answered with the item, verbatim).
 *
 * ⚠ **MINUS ANYTHING THE RECIPE STILL HOLDS (`now`).** Fangs taken off and
 * asked for again by a later step are on the cast, and naming them here would
 * have the writer told to remove them and its backstop refuse a correct
 * paragraph. `now` is the composed recipe of the render being described.
 *
 * What it does NOT see, named: a lineage whose pre-prune version is gone (a
 * deleted or unreadable row). That is a miss — the seed reads as before this
 * card — never a false entry, because every entry it returns was held by a
 * same-sentence step and is held by nothing now.
 */
export function takenFromKeptSentences(
  steps: readonly ChainStep[],
  lineage: readonly (readonly ChainStep[])[],
  now: RefineDelta,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (words: string) => {
    const key = words.trim().toLowerCase();
    if (key === "" || seen.has(key)) return;
    seen.add(key);
    out.push(words.trim());
  };
  const nowItems = (subject: string) => new Set(
    itemsOf(now.free?.[subject as FreeSubject]).map((item) => item.trim().toLowerCase()),
  );
  for (const step of steps) {
    const sentence = step.instruction.trim();
    for (const chain of lineage) {
      for (const earlier of chain) {
        if (earlier.instruction.trim() !== sentence) continue;
        for (const [kind, ask] of Object.entries(earlier.delta.open ?? {})) {
          if (step.delta.open?.[kind] || now.open?.[kind]) continue;
          add(ask.noun);
        }
        for (const [subject, value] of Object.entries(earlier.delta.free ?? {})) {
          const kept = new Set(
            itemsOf(step.delta.free?.[subject as FreeSubject]).map((item) => item.trim().toLowerCase()),
          );
          const held = nowItems(subject);
          for (const item of itemsOf(value)) {
            const key = item.trim().toLowerCase();
            if (kept.has(key) || held.has(key)) continue;
            add(item);
          }
        }
      }
    }
  }
  return out;
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
 *
 * # ⚠ AND IT WAS BLIND TO THE OPEN LANE (fifth instance of the
 * # enumeration-point class, swept out by fable-1378's order, driven at this
 * # door before the fix)
 *
 * `valuesFiledBy` and `facetsAnsweredBy` both walk `FREE_SUBJECT_KEYS` and the
 * labelled axes and stop, so a re-read that came back as an OPEN KIND — *"large
 * feathered wings"* — answered `false` here: named nothing, removal stands, the
 * open ask dropped. Driven before touching it:
 *
 * ```
 * open kind only, no subject named      false   ← the defect
 * open kind, subject NAMED              false   ← correct, see below
 * closed value, subject named           true
 * the departure restated                false
 * ```
 *
 * **Only the first line was wrong, and the second one matters as much.** The
 * rule this function states is that the re-read must ANSWER THE FACET the
 * removal named; an open kind has no facet and is about something else, so when
 * she named a subject an open kind does not answer it and the removal rightly
 * stands. The blindness bites exactly where the removal named NOTHING, and the
 * question collapses to *did the re-read name anything to have at all* — where
 * an open kind plainly does.
 *
 * The negation guard learns the lane too: an open kind whose words are the
 * departure restated (*"no wings"*) is not a thing to have either, and reading
 * it as one would cancel a real removal on the one lane that had no guard.
 */
export function reReadNamesAThingToHave(input: {
  delta: RefineDelta;
  /** The subject the removal claimed, or null when it named none. */
  subject: FreeSubject | RefinableAxis | null;
  /** The noun it claimed, for telling a restated departure from a look. */
  match: string;
}): boolean {
  /* Both lanes' words, because both can restate a departure — see the header. */
  const openAsks = Object.values(input.delta.open ?? {})
    .map((ask) => (typeof ask?.words === "string" ? ask.words : ""))
    .filter((words) => words.trim() !== "");
  const filed = [...valuesFiledBy(input.delta), ...openAsks];
  if (filed.length > 0 && filed.every((value) => readsAsNegation(value, input.match))) return false;
  const answered = facetsAnsweredBy(input.delta);
  /*
    A NAMED SUBJECT IS STILL ASKED ABOUT ITS OWN FACET, and an open kind cannot
    answer one — that is not blindness, it is the rule. Only the unnamed case
    collapses to *did it name anything to have*, and there an open kind counts.
  */
  return input.subject
    ? answered.has(facetOf(input.subject))
    : answered.size > 0 || openAsks.length > 0;
}
