/**
 * READING HER HAIR COLOUR OFF A REFERENCE — the `colour` take's WORDS road
 * (founder ruling 2026-08-19, relayed fable-1047 §3; the take map is
 * `hairReferenceTake.ts`; the constraint below is `fable-1079 §2`).
 *
 * # THE CONSTRAINT THIS MODULE IS SHAPED BY, and it arrived before a line of it
 *
 * The founder's own colour specimen was read at the frame before this reader
 * was written (`UNIVERSAL_REFERENCE_ROAD_DESIGN.md` §9.2). One photograph, one
 * person — and the colour is not a blend and is not one tone. It is **blocked
 * by section**: a bright orange-copper fringe panel, a platinum-blonde panel
 * beside it, near-black roots and lengths behind, a silver-white section on the
 * far side.
 *
 * So the bar everybody reaches for first — *does the reader flatten it to one
 * word* — **is a bar a completely wrong answer passes.** *"Copper, blonde and
 * black"* names every tone in that frame and describes an ombré, a balayage,
 * any head at all. The words have to carry **WHERE EACH TONE SITS** or they are
 * not a description of this reference.
 *
 * # WHY THAT IS A FIELD AND NOT A SENTENCE IN THE PROMPT
 *
 * This family's own idiom, and it is written down twice already:
 * `referenceClassGate` — handed a cyborg, the makeup reader *"had no field in
 * which 'these are prosthetics' could arrive"*; `inkUploadDoor` — the byte
 * check is handed no filename *"because there is no field here for a claim to
 * arrive in."* **Structure is the fence.**
 *
 * Pointed at this constraint it means: there is **no field a tone can arrive in
 * without a place.** The reader answers a LIST OF SECTIONS, each one a pair —
 *
 *     { tone: "orange-copper", where: "at the fringe" }
 *     { tone: "platinum",      where: "beside it" }
 *     { tone: "near-black",    where: "at the roots and lengths" }
 *     { tone: "silver-white",  where: "down one side" }
 *
 * — and a flattened *"copper, blonde and black"* has nowhere to go. It is
 * either one section claiming to be all over, which is visibly false and is a
 * READABLE failure, or it is a section with no `where` and is dropped. The
 * instructed version of this rule (*"say where each tone sits"* in the prose)
 * is the thing `refineDelta` says is not a rule at all: **a rule enforced only
 * by asking nicely.**
 *
 * # THE ORDINARY HEAD IS THE SAME SHAPE, WITH NO SPECIAL PATH
 *
 * One colour all over is ONE section, `where: "all over"`, composing to
 * *"chestnut brown all over"*. `where` carries its own preposition, which is
 * what lets a single join serve both — and a reader that answers a bare
 * `"fringe"` degrades to *"copper fringe"*, which is still English and still
 * carries the place. **The failure mode of this shape is graceful; the failure
 * mode of a `colour` string is silent.**
 *
 * # THE BUDGET IS THE DESTINATION'S, and the section list is UNBOUNDED
 *
 * These words end up as a free `hairShade` value, and `refineDelta` caps a free
 * value at {@link MAX_FREE_LENGTH}. That number is IMPORTED rather than
 * retyped: a composer judging its own budget by a copy of the destination's cap
 * is the drift law 4 forbids, and it is exactly the defect `makeupSlots.ts` was
 * written to close — four legal answers needing 121 characters of an
 * 80-character budget, with the founder asking where the blusher went.
 *
 * **But makeup's derivation cannot be borrowed here, and the reason is worth
 * stating rather than quietly working around.** Makeup has FOUR fixed surfaces,
 * so a budget can be derived that promises all four. A head's colour blocks are
 * unbounded — four here, two on the next customer, eight on a streaked one —
 * and no budget can promise an unbounded list. So:
 *
 *   - sections are spoken for IN THE READER'S OWN ORDER until the budget is
 *     spent. **That order is the stated rule** (fable-1080 §2 reserved it, and
 *     it is not improvised): the ask instructs *"work from the most obvious
 *     block to the least"*, so the order is the reader's answer to a question
 *     we asked rather than our judgement about her hair;
 *   - **and everything not spoken for is RETURNED**, so she can see it and type
 *     it herself. Nothing is silently cut. A cap nobody is told about reads as
 *     *"that is everything we saw"*, which is a quieter lie than a refusal.
 *
 * **AND THE FALLBACK FIRES ON HIS OWN HEAD — MEASURED, 4 RUNS OUT OF 4.**
 * Written down here rather than left to be discovered, because the arithmetic
 * that made this design look comfortable was mine and the real reader disagreed
 * with it. `court-hair-colour-words-disposable.mts`, run 1's own answers:
 *
 * ```
 *   "copper orange at the fringe"          27
 *   "pale platinum blonde down one side"   33
 *   "dark brown down the other side"       29
 *   "ash grey at the ends on one side"     31
 *   separators (3 x ", ")                   6
 *                                         ---
 *                                         126   against a 120 budget
 * ```
 *
 * Six characters, and a block of his hair goes back to her as text instead of
 * riding in the sentence. Every run dropped at least one. The alternative was
 * narrowing the field caps so four always fit, and it was refused for the
 * reason directly above: an announced cap is a BRIEF, so buying the fourth
 * block that way costs *pale*, *orange* and *at the ends* on all four. **A
 * dropped block is returned and she can type it; a flattened one is gone and
 * nobody is told.**
 *
 * # ONE DOOR, AND IT IS THE ONE THAT WAS MEASURED
 *
 * The presence gate — *is there hair on the head* — refused the cyborg 2/2 and
 * a golden retriever 2/2 on the very bytes that made the makeup reader call
 * prosthetic circuitry a look (`probe-hair-class-words-disposable.mts`). **A
 * presence question anchored on a body part is a gate; one anchored on a
 * judgement is a prompt.** Hair's out-of-class negatives are caught by it.
 *
 * There is deliberately **no class question here**, and that is fable-1075's
 * ruling rather than an omission: hair's own defect is that a salon
 * illustration reads as a real head, and that answer **routes rather than
 * refuses** — it may narrow away the CROP takes and never the WORDS one,
 * because a colour read off a drawing is honest. This module IS the words one.
 * The drawn detector ships with the crop, behind its own false-positive court.
 *
 * # AND THE SENTENCE IS SHOWN BEFORE IT IS SPENT
 *
 * Same road as makeup, and legal for the same structural reason: what comes
 * back is a suggestion she adopts or edits, and it travels as HER instruction.
 * `refineDelta` requires a free value to appear in the customer's own sentence,
 * so a reading routed silently around her would be refused by a guard that has
 * stood there since D-171.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { scrubBrands } from "./brandScrub";
import { freeSubjectMaxLength } from "./refineDelta";
import { pictureSideAskLines, pictureSideClause, type PictureHalf } from "./sidePhrasing";

const log = createModuleLogger("castingV2/hairColourFromReference");

/**
 * The longest a TONE may be before it has stopped obeying the ask.
 *
 * Priced off the specimen rather than chosen: `orange-copper` is 13,
 * `silver-white` is 12, `platinum blonde` is 15. Set above the measured need
 * for `makeupSlots`' reason — **a cap the ask announces is a BRIEF, not a
 * filter** (`announced-cap-is-a-brief`): the model composes down to whatever
 * number it is given and pays for the fit by dropping a word. A tone that lost
 * *orange-* would lose the thing that makes his fringe that fringe.
 */
export const HAIR_TONE_MAX_LENGTH = 20;

/**
 * The longest a PLACE may be.
 *
 * Priced the same way: `at the roots and lengths` is 24, `down one side` is 13,
 * `all over` is 8. Wider than the tone because a place is where the sentence
 * does its work — *"at the fringe"* and *"at the front section under the
 * fringe"* are different heads.
 */
export const HAIR_WHERE_MAX_LENGTH = 28;

/** What the composer puts between two sections. */
export const HAIR_SECTION_SEPARATOR = ", ";

/**
 * THE SENTENCE BUDGET — asked of the destination that enforces it, never a copy.
 *
 * `hairShade` is the drawer these words land in, so the budget is that
 * subject's own cap read out of `refineDelta` rather than a number kept here.
 * The derivation of the number itself lives beside the cap, which is where its
 * arithmetic can be checked against the thing it governs.
 *
 * There is deliberately no derivation from the FIELD caps: an unbounded list
 * cannot be promised in full by any budget, so this is the one number that
 * governs and what does not fit comes back to her instead.
 */
export const MAX_HAIR_COLOUR_LENGTH = freeSubjectMaxLength("hairShade");

/**
 * Every way this read can end badly.
 *
 * A LIST rather than only a type, for `makeupFromReference`'s reason: the
 * demand record has to hold a column value for each one, and a type alone
 * cannot be walked against a migration's enum.
 */
export const HAIR_COLOUR_READ_REFUSAL_CODES = [
  "noTransport",
  "unreadable",
  /* The presence gate said no: there is no hair on this head. */
  "noHairVisible",
  /*
    AND THIS IS A DIFFERENT FACT FROM THE ONE ABOVE, kept apart on purpose.
    *"There is hair here and I could not put words to it"* is not *"there is no
    hair here"* — telling a customer her photograph has no hair in it because a
    reply came back shaped wrong is a claim about her picture that no reader
    made. One sentinel meaning two things is a defect this campaign has already
    paid for twice (`negative-arm-cannot-find-yes-defects`).
  */
  "noColourReadable",
] as const;

export type HairColourReadRefusalCode = (typeof HAIR_COLOUR_READ_REFUSAL_CODES)[number];

export type HairColourReadRefusal = {
  readonly code: HairColourReadRefusalCode;
  /** Her sentence, not a code a client re-words. */
  readonly message: string;
};

/**
 * One block of colour: a tone, where on the head it sits, and — when it is a
 * side — WHICH HALF OF THE PICTURE that is (ruled fable-1084 §2).
 *
 * The side is an ENUM the reader answers, never prose it writes. Left to phrase
 * it, the first court's reader produced *"down one side"* and *"down the other
 * side"* on the same head: true of the frame, useless to a repaint that paints
 * by position, and a visible contradiction when two tones both land on *"one
 * side"*. The half is spelled by `sidePhrasing`, which is the one place that
 * knows how to say a side safely.
 *
 * `null` is the ordinary answer and not a failure — *all over*, *at the roots*,
 * *at the ends* are not sides, and a reader pressed to pick one for them would
 * be inventing.
 */
export type HairColourSection = {
  readonly tone: string;
  readonly where: string;
  /** Which half of the SOURCE picture, or `null` when the block is not a side. */
  readonly side: PictureHalf | null;
};

export type HairColourReadOutcome =
  | {
      ok: true;
      /** What she is shown, adopts or edits. Already inside the destination's cap. */
      sentence: string;
      /** The sections the sentence speaks for, in the order it speaks for them. */
      used: readonly HairColourSection[];
      /** Read, and left out for room. Returned so she can type them — never silent. */
      dropped: readonly HairColourSection[];
    }
  | { ok: false; refusal: HairColourReadRefusal };

/**
 * THE ASK.
 *
 * Three things it says on purpose:
 *
 * - **the hair on the head, and nothing else about the person** — the same
 *   structural fence makeup keeps, stated as a rule too, because a rule kept
 *   only by the shape of the reply is one the next model revision may not
 *   notice;
 * - **no brand names** — every free-text field in this program is scrubbed, and
 *   a brand shown to her and stripped later is worse than one never offered;
 * - **one section per block of colour** — which is the whole contract, and the
 *   examples carry a one-tone head as well as a blocked one so the ordinary
 *   case is not read as a failure to find sections.
 */
const ASK = [
  "You are a hair colourist writing a short note for a photographer.",
  "",
  "Look at this photograph.",
  "",
  /*
    THE GATE FIRST, and it is anchored on the BODY PART rather than on a
    judgement — measured (probe-hair-class-words): a bald cyborg with a full
    beard and a golden retriever both answered "no" 2/2, where the makeup
    reader's judgement-anchored gate invented a look on the same bytes.
  */
  'First: is there hair growing on this person\'s head? Answer "yes" or "no".',
  'Answer "no" if there is no person, or the head is bare, or the only hair in',
  "the picture is a beard, a wig on a stand, or an animal's coat.",
  "",
  "THEN describe the COLOUR of that hair, one entry for each block of colour",
  "you can see. A head with one colour all over is a single entry. A head with",
  "panels, streaks, dark roots or a bleached fringe has one entry for each.",
  "",
  "Rules:",
  '- Every entry has BOTH a tone and where it sits. Never a tone on its own.',
  '- "where" is a short phrase that names the place and reads as English after',
  '  the tone: "at the fringe", "at the roots", "at the ends", "all over".',
  /*
    AND NEVER A SIDE IN THOSE WORDS — the side has its own field below, because
    the first court's reader put *"down one side"* and *"down the other side"*
    in this one. Both were true of the frame and neither is a place anything can
    act on.
  */
  '- Do NOT put a side in "where" — no "one side", no "the other side", no "her',
  '  left". A side goes in its own field.',
  "- Work from the most obvious block to the least.",
  "- Describe the hair only. Never describe the person: not their face, not",
  "  their age, not their skin tone, not their ethnicity, not their identity.",
  "- Never name a brand or a product line.",
  `- A tone is at most ${HAIR_TONE_MAX_LENGTH} characters; a place is at most ${HAIR_WHERE_MAX_LENGTH}.`,
  "",
  /* THE SIDE'S OWN LINES, composed by the owner that spells it — so the ask
     and the phrase cannot drift apart (law 4). */
  ...pictureSideAskLines(),
  "",
  'Reply with JSON: {"hair": "yes" or "no", "sections": [{"tone": "...",',
  '"where": "...", "side": "left" or "right" or null}]} and nothing else.',
  "Use an empty list if there is hair but you cannot tell what colour it is.",
].join("\n");

/** A model's JSON is input, not a promise. */
function parse(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(
      raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim(),
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * One field of one section, cleaned — or `null`, which means this section
 * cannot be spoken for.
 *
 * The null vocabulary is `makeupFromReference.readMakeupSlot`'s, deliberately
 * reused rather than re-invented: a model asked for a value often writes the
 * word "none" instead, and "none" reaching a paid prompt as a colour is a bug
 * this repository has already shipped once (D-172).
 *
 * **Over-length is `null` here and NOT a separate reading**, which is the
 * opposite of makeup's answer and the difference is structural. Makeup's
 * over-length was catastrophic because the slot was one of four fixed surfaces
 * and losing it lost the loudest thing in the frame with nobody told. A section
 * is one of an unbounded list, it is dropped rather than lost, and the caller
 * REPORTS every section it did not speak for — so the fact still reaches her by
 * the path that already exists.
 */
export function readHairColourField(value: unknown, cap: number): string | null {
  if (typeof value !== "string") return null;
  const plain = value.trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "");
  if (!plain) return null;
  if (/^(null|none|n\/?a|unknown|unclear|nothing)\b/i.test(plain)) return null;
  const scrubbed = scrubBrands(plain)?.trim() ?? "";
  if (!scrubbed) return null;
  if (scrubbed.length > cap) return null;
  return scrubbed.toLowerCase();
}

/**
 * The sections in a reply, in the reader's own order.
 *
 * **A section missing either half is dropped rather than repaired**, and that is
 * the fence doing its job rather than a harshness: a tone with no place is the
 * flattened answer §9.2 exists to catch, and inventing *"all over"* for it would
 * be this module quietly telling her that a four-block head is one colour.
 */
/**
 * The picture half a section named, or `null`.
 *
 * **Positive admission, and a strict one**: only the two words count. Anything
 * else — a phrase, a hedge, an anatomical side, an absent field — is `null`,
 * which composes to the honest degraded form (the block still names its place,
 * it simply does not claim a half). **A half is never inferred from the
 * `where` text**: guessing which side *"down one side"* meant is precisely the
 * invention this field was added to stop.
 */
export function readPictureSide(value: unknown): PictureHalf | null {
  if (typeof value !== "string") return null;
  const plain = value.trim().toLowerCase().replace(/[.!]+$/, "");
  if (plain === "left") return "left";
  if (plain === "right") return "right";
  return null;
}

export function readHairColourSections(value: unknown): HairColourSection[] {
  if (!Array.isArray(value)) return [];
  const sections: HairColourSection[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const tone = readHairColourField(row.tone, HAIR_TONE_MAX_LENGTH);
    const where = readHairColourField(row.where, HAIR_WHERE_MAX_LENGTH);
    if (!tone || !where) continue;
    sections.push({ tone, where, side: readPictureSide(row.side) });
  }
  return sections;
}

/**
 * Compose the note, stopping BEFORE the budget rather than cutting through it,
 * and returning what it could not carry.
 *
 * One join for both shapes — see the header: `where` carries its own
 * preposition, so *"chestnut brown all over"* and *"orange-copper at the
 * fringe, platinum beside it"* come out of the same line.
 */
export function composeHairColourSentence(
  sections: readonly HairColourSection[],
): { sentence: string; used: HairColourSection[]; dropped: HairColourSection[] } {
  const used: HairColourSection[] = [];
  const dropped: HairColourSection[] = [];
  let sentence = "";
  for (const section of sections) {
    /* The side rides through its owner, never spelled here — and it is a
       bracket rather than a comma so two sided blocks in one sentence stay
       distinguishable from each other and from the separator. */
    const phrase = `${section.tone} ${section.where}`
      + (section.side ? pictureSideClause(section.side) : "");
    const candidate = sentence ? `${sentence}${HAIR_SECTION_SEPARATOR}${phrase}` : phrase;
    if (candidate.length > MAX_HAIR_COLOUR_LENGTH) {
      dropped.push(section);
      continue;
    }
    sentence = candidate;
    used.push(section);
  }
  return { sentence, used, dropped };
}

export type HairColourReadInput = {
  bytes: Buffer;
  contentType: string;
  /** Test seam and dependency injection; `undefined` takes the shipped engine. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

/**
 * Read one reference's hair colour. One call, house money, and nothing is kept.
 *
 * Degrades to a REFUSAL rather than to a guess, for `makeupFromReference`'s
 * reason: a reader that invents a colour when it cannot see one puts words she
 * never chose in front of her with our name on them.
 */
export async function readHairColourFromReference(
  input: HairColourReadInput,
): Promise<HairColourReadOutcome> {
  const engine = input.engine === undefined ? interpreterEngine() : input.engine;
  if (!engine) {
    return {
      ok: false,
      refusal: {
        code: "noTransport",
        message: "We can't read a reference just now — try again in a moment.",
      },
    };
  }

  let raw: string;
  try {
    const reply = await engine.complete({
      about: "describe",
      system: "You describe hair. You never describe people.",
      user: ASK,
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      /* `faceDescribe`'s measured ceiling for a small JSON object on this
         transport, and a section list is longer than makeup's four scalars —
         an empty completion would read as "no colour", which is a different
         fact from "the reply did not arrive". */
      maxOutputTokens: 800,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    raw = reply.text ?? "";
  } catch (error) {
    log.warn({ err: error }, "[hairColourFromReference] the reference could not be read");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "We couldn't read that picture — try another one.",
      },
    };
  }

  const parsed = parse(raw);
  if (!parsed) {
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "We couldn't read that picture — try another one.",
      },
    };
  }

  /*
    THE PRESENCE GATE — asked FIRST and consulted FIRST.

    It is the first door for the reason makeup's is: the failure both doors
    exist for is a reader that finds something to say about every picture, so
    the place to stop it is before its prose is consulted at all. Four fluent
    sections must not outvote *"there is no hair on this head"*.

    **`undefined` is not `no`.** A reply that omits the field is one this door
    cannot judge, and refusing on it would turn every malformed answer into
    "there is no hair in your picture" — a different claim about her photograph.
    So only an explicit negative closes it, and a missing field falls through to
    the sections, which have their own empty answer.
  */
  if (typeof parsed.hair === "string" && /^\s*(no|false|none)\b/i.test(parsed.hair)) {
    return {
      ok: false,
      refusal: {
        code: "noHairVisible",
        message: "We couldn't see any hair on a head in that picture to take.",
      },
    };
  }

  const sections = readHairColourSections(parsed.sections);

  /*
    THE FENCE'S OWN WORK, MADE VISIBLE — and it is here because a court could
    not see it.

    A section the fence drops for having no place never reaches the outcome, so
    the first court over this reader could say what arrived in the sentence and
    could NOT say whether the reader had ever written a placeless tone. That is
    an instrument gap rather than a bug: the fence was the thing on trial and
    its firings were invisible to the only thing watching.

    Logged rather than returned, because it is a fact about the READER and not
    about her picture — nothing a customer sees changes, and the count is what a
    later reading of the rate is built from.
  */
  const offered = Array.isArray(parsed.sections) ? parsed.sections.length : 0;
  if (offered > sections.length) {
    log.info(
      { offered, kept: sections.length, raw: parsed.sections },
      "[hairColourFromReference] the fence refused a section — a tone with no place, or a field over its cap",
    );
  }

  if (sections.length === 0) {
    /* The reader's own words are logged because they are the whole mechanism
       under test, and the demand row deliberately cannot carry them. */
    log.info(
      { sections: parsed.sections },
      "[hairColourFromReference] hair was present and no section could be spoken for",
    );
    return {
      ok: false,
      refusal: {
        code: "noColourReadable",
        message: "We could see the hair but couldn't pin down its colour — try a clearer picture.",
      },
    };
  }

  const { sentence, used, dropped } = composeHairColourSentence(sections);
  if (!sentence) {
    /* A single section longer than the whole budget. Not "no colour here" — it
       is a reading we could not carry, and it takes the same sentence as the
       shape above rather than the presence gate's. */
    log.info({ sections }, "[hairColourFromReference] the first section alone overran the budget");
    return {
      ok: false,
      refusal: {
        code: "noColourReadable",
        message: "We could see the hair but couldn't pin down its colour — try a clearer picture.",
      },
    };
  }

  if (dropped.length > 0) {
    /* No silent caps: what was read and left out is logged as well as returned. */
    log.info(
      { used: used.length, dropped: dropped.length },
      "[hairColourFromReference] the note did not speak for every block of colour",
    );
  }

  return { ok: true, sentence, used, dropped };
}

/**
 * The demand record's value for a finished read — DERIVED from the outcome
 * rather than mapped beside it (law 4), exactly as makeup's is.
 *
 * The codes are camelCase because they are TypeScript and the column's values
 * are snake_case because it is SQL. That is a spelling difference and nothing
 * more, so it is spelled mechanically; a hand-written map of four pairs is a
 * second list, and a second list drifts on the fifth entry nobody adds to both.
 */
export function hairColourReadOutcomeFor(outcome: HairColourReadOutcome): string {
  if (outcome.ok) return "delivered";
  return outcome.refusal.code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
