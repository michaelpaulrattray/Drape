/**
 * WHERE THE DESIGN IN HER PICTURE GOES, AND ON WHICH SIDE OF HER — the tattoo
 * take (designed opus-822 §4/§5, ruled fable-1115 §3, mechanism ruled
 * fable-1120 §3).
 *
 * The gate's reference arm decided ONE thing: that a photograph she pointed at
 * documents this design, so the ask is not walled. It decided nothing about
 * where the design goes. That is this module.
 *
 * # WHY A READER AND NOT A CONTRACT FIELD ON THE MAIN PROMPT
 *
 * The placement has to come out of her sentence — *"on my left sleeve"*,
 * *"round my forearm"*, *"where my watch sits"* — and code must not parse that:
 * D-163 outlaws the phrasing list as a class. So a model reads it. The choice
 * was WHICH model call, and it is a narrow one of its own rather than two lines
 * added to `refineParseSystemPrompt`:
 *
 *   - `context-is-not-additive` is a measured law here, not a worry. The main
 *     prompt is read for EVERY ask on the account — hair, eyes, makeup — and a
 *     sentence added to it moves routing for asks that have nothing to do with
 *     tattoos. A call that only ever sees a sentence already classified as a
 *     reference-documented tattoo cannot move anything else.
 *   - it costs nothing on any other ask, because it does not happen on one.
 *   - it is drivable: an injected engine on the real function, rather than a
 *     hand-built delta reply standing in for a model.
 *
 * The cost is real and stated: this is a SECOND read of the same sentence, and
 * `model-read-is-the-unstable-thing`. Both answers are therefore VALIDATED
 * rather than trusted — see the two rules below, which are the whole file.
 *
 * # RULE ONE — THE PLACEMENT IS RESOLVED, NEVER BELIEVED
 *
 * Whatever the model hands back goes through `resolveInkPlacement`: closed
 * vocabulary first, her own word as the open last resort, and the two questions
 * (`absent`, `tooLong`) that are questions rather than refusals. A word the
 * vocabulary knows comes back as the vocabulary's key however she spelled it; a
 * word it does not know is kept as hers. This module cannot mint a placement.
 *
 * # RULE TWO — A SIDE COMES FROM AN EXPLICIT WORD OF HERS, OR FROM NOWHERE
 *
 * Ruled fable-1115 §3, and it is this road's proven killer being kept dead: per
 * side paint already costs frames (her right eye 3/6), and a WRONG arm is a
 * refund and an apology while an UNSTATED side is a question. So there is no
 * *sleeve implies arm implies pick one* anywhere in this file.
 *
 * And the model saying she said it is not the same as her having said it. The
 * side it reports is only accepted when the WORD IS IN HER SENTENCE — source
 * containment, D-79's mechanism, pointed at the one field where a confident
 * guess would be indistinguishable from a reading. The model resolves which
 * side the sentence means; the code proves the word is hers.
 *
 * # A MEASURED PLACEMENT KEEPS THE VOCABULARY'S OWN ANSWER
 *
 * `sidesForInkPlacement` already says which surfaces come in pairs, derived
 * from the vocabulary entry. `neck` is one place, so *"on her left neck"* is
 * `centre` — that is a vocabulary fact and it did not move. Only an OPEN
 * placement, which has no entry, takes her stated side.
 *
 * # `null` MEANS UNREADABLE, AND NEVER A DEFAULT
 *
 * A transport that fails, or a reply this contract does not recognise, returns
 * `null`. It does not fall back to a placement, because falling back is the
 * defect the containment rule above exists to close: the caller answers with
 * the road's existing unreadable outcome rather than a guess minted here.
 */
import { createModuleLogger } from "../logging/logger";
import { interpreterEngine } from "./interpreter";
import type { TextEngine } from "../providers/types";
import {
  resolveInkPlacement,
  type ResolvedPlacement,
} from "./inkPlacementResolve";
import { sidesForInkPlacement, type InkSide } from "../../shared/inkReleasedPlacements";
import { inkPlacementBareNoun } from "../../shared/inkPlacementVocabulary";
import type { CastPronouns } from "./castPronouns";
import { namesDesign } from "./inkPlacement";
import type { InkAskAddress } from "./inkDesignForAsk";
import { itemsOf, type RefineDelta } from "./refineDelta";
import type { ReferenceIntent } from "../../shared/referenceIntents";

const log = createModuleLogger("castingV2/inkReferenceTake");

/**
 * The sides a SENTENCE can state.
 *
 * `centre` is not among them and that is deliberate: it is what the VOCABULARY
 * says about a surface that is one place, and — when the question lands with
 * the cutter — what *"it's one place"* answers. Nobody types it about a tattoo.
 */
const STATEABLE_SIDES = ["left", "right"] as const;

export type InkReferenceTake = {
  /** Her word for where it goes, resolved against the vocabulary. */
  readonly placement: ResolvedPlacement;
  /**
   * Which of her — `null` when she named no side, which is a question and never
   * an invented arm.
   */
  readonly side: InkSide | null;
};

/**
 * THE TAKE, or `null` for unreadable.
 *
 * One call, no word-test fast path in front of it. The hair take has one
 * because *"copy this hair"* is answerable from three nouns; there is no set of
 * nouns that answers *where does this go* without being the phrasing list D-163
 * forbids.
 */
export async function resolveInkReferenceTake(input: {
  instruction: string;
  /** Test seam and dependency injection; `undefined` takes the shipped engine. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
}): Promise<InkReferenceTake | null> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) {
    log.warn({}, "[inkReferenceTake] no text engine — the take is unreadable rather than guessed");
    return null;
  }

  let raw: string;
  try {
    const reply = await engine.complete({
      about: "interpret",
      system: "You read one sentence and answer with two short fields.",
      user: TAKE_ASK(input.instruction),
      json: true,
      temperature: 0,
      maxOutputTokens: 200,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    raw = reply.text ?? "";
  } catch (error) {
    log.warn({ err: error }, "[inkReferenceTake] the take could not be read");
    return null;
  }
  return readInkReferenceTake(raw, input.instruction);
}

/**
 * The ask.
 *
 * It says the two things the validations below cannot say for themselves: that
 * the placement is HER WORDS rather than one of ours, and that a side is only
 * ever reported when she used the word. The second is stated even though the
 * code enforces it, because a model told to guess and then overruled produces a
 * worse first field as well as a rejected second one.
 */
function TAKE_ASK(instruction: string): string {
  return [
    "A customer attached a photograph of a tattoo design and wrote this instruction:",
    "",
    `"${instruction.trim()}"`,
    "",
    "Answer two things about it:",
    "",
    '  "placement" — WHERE ON HER BODY she wants it, in HER OWN WORDS, copied from',
    "    the sentence. Not a body part you think she means: if she wrote \"sleeve\",",
    '    answer "sleeve". Empty string if the sentence names no place at all.',
    "",
    '  "side" — "left" or "right" ONLY if she used that word about where it goes.',
    "    Null otherwise. Never work it out from the body part, and never pick one",
    "    because a body part comes in a pair.",
    "",
    'Reply with JSON: {"placement": "...", "side": "left"|"right"|null} and nothing else.',
  ].join("\n");
}

/**
 * Read the reply — and prove the side against her own sentence.
 *
 * Exported so the suite drives the validation itself rather than a
 * re-implementation of its rule, and so the containment arm can be fired
 * without a transport (working law 3).
 */
export function readInkReferenceTake(raw: string, instruction: string): InkReferenceTake | null {
  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(
      raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }

  const rawPlacement = parsed.placement;
  /*
    A MISSING FIELD IS UNREADABLE; AN EMPTY ONE IS "SHE NAMED NO PLACE".

    They are different facts and the resolver already spells the second
    (`absent`, which routes to a question). Collapsing them would turn a
    transport hiccup into a question about her sentence.
  */
  if (typeof rawPlacement !== "string") return null;
  const stated = statedSideIn(parsed.side, instruction);
  const placement = resolveInkPlacement(rawPlacement, stated);

  return { placement, side: sideFor(placement, parsed.side, instruction) };
}

/**
 * The side, decided by the vocabulary where the vocabulary knows, and by HER
 * WORD where it does not.
 */
function sideFor(
  placement: ResolvedPlacement,
  claimed: unknown,
  instruction: string,
): InkSide | null {
  /*
    THE VOCABULARY FIRST, for a surface it has measured. `neck` is one place and
    `upperChest` is one place, whatever the sentence says about sides; `upperArm`
    is a pair and falls through to her word below. Derived from the entry rather
    than listed here — a fourth measured placement arrives with its sides already
    decided (law 4).
  */
  if (placement.kind === "measured") {
    const sides = sidesForInkPlacement(placement.placement);
    if (sides.length === 1) return sides[0]!;
  }

  return statedSideIn(claimed, instruction);
}

/**
 * THE SIDE SHE TYPED — the model's claim, admitted only if her sentence carries
 * the word.
 *
 * Hoisted out of {@link sideFor} when decomposition landed (fable-1163 §3),
 * because the resolver needs this answer BEFORE the placement is resolved and
 * `sideFor` cannot give it — that function's first question is about the
 * placement. One owner rather than two readings: the containment rule is what
 * this road's refunds were bought with, and a second copy of it beside the
 * first is how two callers come to disagree about what she said.
 *
 * A model reporting a side is a reading; a model reporting a side she never
 * typed is an invention, and the two look identical in a reply. So the word
 * itself must appear in her sentence — source containment (D-79) on the one
 * field where a wrong answer is a refund and an apology rather than a question.
 * `\b` because "left" hides inside nothing useful, and because the guard must
 * not fire on "sleeve" for containing no side at all.
 */
function statedSideIn(claimed: unknown, instruction: string): InkSide | null {
  const said = typeof claimed === "string" ? claimed.trim().toLowerCase() : null;
  const side = STATEABLE_SIDES.find((value) => value === said) ?? null;
  if (side === null) return null;
  return new RegExp(`\\b${side}\\b`, "i").test(instruction) ? side : null;
}

/**
 * IS THIS DELTA A TATTOO ASK — asked of the reading, and DERIVED from the
 * gate's own rule rather than restated beside it.
 *
 * The gate lets a value through on `subject === "ink"` OR a MARK that names a
 * design, and the second half is not optional: *"a small star behind her ear"*
 * carries no word "tattoo", files as a mark, and is a design wherever it is
 * filed (D-158). A predicate that only asked about `ink` would let a
 * reference-documented star fall through to the hair lane, be confessed as an
 * unused picture, and then be RENDERED FROM WORDS — the star's own scar,
 * arriving through the back door.
 *
 * `namesDesign` is the gate's function, imported rather than reimplemented: one
 * definition of what counts as a design, or the two drift and the drift is
 * silent (law 4).
 */
export function namesInkFromReference(delta: RefineDelta | null | undefined): boolean {
  const free = delta?.free;
  if (!free) return false;
  if (itemsOf(free.ink).length > 0) return true;
  return itemsOf(free.marks).some((item) => namesDesign(item));
}

/**
 * WHAT THIS PICTURE IS BEING TAKEN FOR, DERIVED FROM THE ASK ITSELF (ruled
 * fable-1151 §1).
 *
 * A design row records `intents` — the declaration fable-937 was built on, so
 * that nothing is extracted from a reference nobody asked to take from. The
 * ink STUDIO door collects it as a field, and the ATTACH door deliberately does
 * not: it is reached before she has typed anything, so *"there is no ask yet
 * for an intent to authorise, and a NOT NULL guess about one is what the fence
 * cannot carry"* (that door's own words).
 *
 * On this road the ask arrives later and IS the declaration — her own sentence,
 * about this picture, naming a design. That is a stronger statement than a
 * checkbox, because it is contemporaneous with the use rather than a prediction
 * of it.
 *
 * **It is derived rather than written down beside the predicate, and that is
 * the whole reason this is a function.** The value comes out of
 * {@link namesInkFromReference} — the same predicate that decides whether the
 * tattoo branch is entered at all — so a delta that is not a tattoo ask cannot
 * produce a row claiming it was. A constant `["tattoo"]` at the call site would
 * be true today and would go on being written the day the branch's condition
 * moved.
 */
export function inkAskIntents(delta: RefineDelta | null | undefined): readonly ReferenceIntent[] {
  return namesInkFromReference(delta) ? ["tattoo"] : [];
}

/**
 * WHAT SHE IS TOLD, and the shape of it is the whole point.
 *
 * It names what was READ — her own word for the place, and the side only if she
 * gave one — and then says plainly what cannot happen yet. Both halves matter:
 *
 *   - the first is what makes the read observable at all. Without it the take is
 *     a dark control, exercised by nobody and visible in nothing;
 *   - the second is the sentence today's wall gets wrong. `INK_NEEDS_DOCUMENT_
 *     MESSAGE` tells her the ask *"needs a design document first"* — said to
 *     somebody who has just attached one.
 *
 * No apology and no promise with a date on it. Nothing was charged, and the
 * sentence says so, because a free outcome that does not say it is free reads as
 * a silent 25 credits.
 */
export function inkReferenceNote(take: InkReferenceTake | null): string {
  const cannot = "I can't put it on her yet — the step that cuts a design out of a photograph "
    + "isn't open. Nothing was charged.";
  if (take === null) {
    /* Unreadable is its own answer and never a guessed placement: she is told
       the picture landed and the sentence did not, which is the one thing she
       can act on. */
    return `I've got the design from your picture, but I couldn't tell where on her you meant. ${cannot}`;
  }
  const place = placeIn(take);
  return place === null
    ? `I've got the design from your picture. ${cannot}`
    : `I've got the design from your picture, for ${place}. ${cannot}`;
}

/**
 * Her place, in ordinary words — the vocabulary's own noun for a surface it has
 * measured, and her exact phrase for one it has not.
 *
 * `null` for the two answers that are questions: there is nothing to name about
 * a place nobody stated, and nothing safe to repeat back out of a sentence long
 * enough to be about a person.
 */
function placeIn(take: InkReferenceTake): string | null {
  const sided = (noun: string) => (
    take.side === "left" || take.side === "right" ? `her ${take.side} ${noun}` : `her ${noun}`
  );
  switch (take.placement.kind) {
    case "measured":
      /* Through the vocabulary's own owner: the entry's noun reads "her neck"
         already, and a sided phrase needs the bare word rather than a sentence
         somebody else composed with a possessive on the front. The slot
         catalogue's display noun wants the identical string, and two hands
         stripping the same prefix is the parallel copy law 4 refuses. */
      return sided(inkPlacementBareNoun(take.placement.placement));
    case "open":
      return sided(take.placement.phrase);
    case "absent":
    case "tooLong":
      return null;
    default: {
      const unhandled: never = take.placement;
      throw new Error(`unhandled placement resolution: ${JSON.stringify(unhandled)}`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * WHAT THE PICTURE MAY GIVE HER — the sentence that rides with it     *
 * ------------------------------------------------------------------ */

/**
 * WHAT A DESIGN REFERENCE IS ALLOWED TO GIVE HER (the hair road's discipline,
 * transplanted — shape (e), countersigned fable-1137 §2).
 *
 * `RecipeSource.scope` is required for a reason this road inherits rather than
 * re-learns: a crop cannot scope itself. A picture of a haircut is a picture of
 * a haircut in SOME colour whether anybody asked for the colour or not, and the
 * words are the only scoping instrument there is — the founder's fable-1048
 * amendment lives or dies on the sentence being written.
 *
 * # What ink's version has to hold off, and it is not a colour
 *
 * A design reference's hazard is the SURFACE UNDER IT. Even after the cutter,
 * an artwork carries the tone and grain of the skin it was photographed on at
 * its own edges, and a `rideWhole` design was never cut at all. So the sentence
 * claims the artwork and disclaims her body: skin, skin tone, and the light
 * falling on it stay hers, which is the difference between putting a design on
 * a person and pasting a stranger's arm onto her.
 *
 * # It says WHAT, and deliberately not WHERE
 *
 * The place and the side are the ask clause's job, and the side has one owner
 * already — `sidePhrasing.imageHalfClause`, reached through the slot's own
 * `instance` in `recipeAssembler`'s `whereItIs`. A second speller of "which
 * side as you look at it" is the drift that phrase exists to prevent, so this
 * sentence does not name a side at all.
 *
 * # "keep her own", never "keep hers"
 *
 * The hair sentence's own hard-won wording, and the reason transfers verbatim:
 * `CastPronouns` has no independent possessive (his · hers · theirs), so the
 * clause is worded to need only the one it has. *Keep his own*, *keep her own*
 * and *keep their own* are all English; *keep theirs* would have forced a
 * fourth word into that type for one sentence's sake.
 */
export function inkTakeSentence(pronouns: CastPronouns): string {
  return "Take the tattoo design from the reference: the artwork itself — its shapes, its lines "
    + "and its colours. Do not take skin, skin tone, body shape, pose or lighting from the "
    + `reference — keep ${pronouns.possessive} own.`;
}

/**
 * THE TAKE AS AN ADDRESS, or `null` when it is still a question.
 *
 * Two of `ResolvedPlacement`'s four answers are places and two are questions,
 * and the split is the whole content of this function: `measured` and `open`
 * name somewhere on her, while `absent` and `tooLong` name nothing that can be
 * looked up. An unreadable take is the third question and takes the same road.
 *
 * **It converts and never guesses.** There is no branch here that supplies a
 * placement, a side, or a default of any kind — a guessed place on this road is
 * a design on the wrong part of a person, and a guessed SIDE is the failure
 * that refunded 300 credits twice (DECISION_LOG R7-7G). Everything it returns
 * was said by the customer and validated by the resolver.
 *
 * It lives beside the take rather than beside the resolver that consumes it,
 * because what it knows is the TAKE'S shape — which of its answers are answers.
 */
export function inkAskAddressOf(take: InkReferenceTake | null): InkAskAddress | null {
  if (take === null) return null;
  switch (take.placement.kind) {
    case "measured":
      return { placement: take.placement.placement, side: take.side };
    case "open":
      return { placement: take.placement.phrase, side: take.side };
    case "absent":
    case "tooLong":
      return null;
    default: {
      const unhandled: never = take.placement;
      throw new Error(`unhandled placement resolution: ${JSON.stringify(unhandled)}`);
    }
  }
}
