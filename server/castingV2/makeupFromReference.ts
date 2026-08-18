/**
 * READING A CUSTOMER'S MAKEUP REFERENCE — M12 row 15's first form that carries
 * no plate at all (founder ruling, relayed fable-933; shape ruled fable-941).
 *
 * His own words: *"everything else either runs as descriptive words such as
 * copy her makeup the image is looked at it describes her makeup in words."*
 *
 * # WHAT THIS MODULE KEEPS: nothing
 *
 * The reference is READ AND DISCARDED. No object, no row, no digest, no
 * manifest, no purge path — the bytes arrive in a request, are looked at once,
 * and are dropped. The only durable artifact is a SENTENCE, and the sentence's
 * home already exists per version: `delta.makeup`.
 *
 * That is not a storage decision anybody made here; it is the ruling taken at
 * its word, and it is what makes the real-person fence an ABSENCE rather than a
 * court. The tattoo road's fence survives as a court (fable-919 §3) precisely
 * because its plate PERSISTS and can therefore be wrong. Here there is no
 * artifact to prove person-free, because there is no artifact.
 *
 * # WHY THE ANSWER COMES BACK IN NAMED COSMETIC SLOTS
 *
 * A describer asked to "describe her makeup" in free prose can hand back *"a
 * blonde woman in her twenties with green eyes wearing a soft brown shadow"* —
 * and that sentence, riding into a paid prompt, is D-183's crime with better
 * manners: a reader's claim about a PERSON, pinned to a render.
 *
 * So the ask has no field for a person to arrive in. It asks four cosmetic
 * surfaces — eyes, lips, brows, complexion — each capped to a phrase, and the
 * sentence is COMPOSED here from those answers rather than written by the
 * model. That is this repository's own idiom, borrowed deliberately from
 * `inkUploadDoor.inkDesignBytesRefusal`, which is handed no filename and no
 * declared mime *because there is no field for a claim to arrive in.*
 *
 * Structure is the fence. The word guard below is only a backstop, and it is
 * the PROVEN one rather than a second list (`namesHairColour`, D-176/D-177).
 *
 * # THE CAP IS THE DESTINATION'S, NOT A NUMBER CHOSEN HERE
 *
 * `MAX_MAKEUP_LENGTH` is imported from `refineDelta`, where the value is judged.
 * A compose longer than the slot it is destined for would be refused down there
 * and her ask would die for a reason she could not see. Nothing is silently
 * truncated: slots are added in a declared order until the next will not fit,
 * and the ones left out are RETURNED so she can see what was dropped and type
 * it herself if she wants it.
 *
 * # AND IT IS SHOWN BEFORE IT IS SPENT — which is also what makes it legal
 *
 * The sentence goes back to the customer as words she adopts or edits before
 * anything is charged (fable-940 bound 3/4). That is a product promise, and it
 * turns out to be a structural requirement too: `refineDelta` already guards
 * this slot with a CONTAINMENT check — a makeup value must appear in the
 * customer's own instruction, or it files as `wall_unfileable`. A sentence
 * routed silently around her would be refused by a guard that has been standing
 * there since D-172. Adopted or amended, the words are hers by the time they
 * ride, and containment passes for the honest reason.
 */
import { createModuleLogger } from "../logging/logger";
import type { TextEngine } from "../providers/types";
import { interpreterEngine } from "./interpreter";
import { scrubBrands } from "./brandScrub";
import { MAX_MAKEUP_LENGTH, namesHairColour } from "./refineDelta";

const log = createModuleLogger("castingV2/makeupFromReference");

/**
 * The cosmetic surfaces this reader may ask about, in the order they compose.
 *
 * The order is a makeup artist's, not an alphabet's: the eye is what a look is
 * usually named for, the lip is what changes it most, and complexion is the
 * one a casting note drops first when it runs out of room.
 */
export const MAKEUP_SLOTS = ["eyes", "lips", "brows", "complexion"] as const;
export type MakeupSlot = (typeof MAKEUP_SLOTS)[number];

/**
 * The shortest a slot answer may be to mean anything, and the longest it may be
 * before it has stopped obeying the instruction it was given.
 *
 * Four slots have to fit inside {@link MAX_MAKEUP_LENGTH} with their
 * connectives, so a slot that spends the whole budget alone has misunderstood
 * the ask — the same reasoning `faceDescribe.readLine` uses at 120 for a row
 * built for one line.
 */
export const MAKEUP_SLOT_MAX_LENGTH = 32;

/**
 * Every way a read can end badly — as a LIST, because the demand record has to
 * hold a column value for each one and a type alone cannot be iterated.
 *
 * `referenceReadDemand.test.ts` walks this array against the migration's enum,
 * so a fifth refusal added without a migration reddens the suite instead of
 * writing a value MySQL truncates to the empty string.
 */
export const MAKEUP_READ_REFUSAL_CODES = [
  "noTransport",
  "unreadable",
  "noMakeupVisible",
  "namesHair",
] as const;

export type MakeupReadRefusalCode = (typeof MAKEUP_READ_REFUSAL_CODES)[number];

export type MakeupReadRefusal = {
  readonly code: MakeupReadRefusalCode;
  /** The customer's sentence, not a code a client re-words. */
  readonly message: string;
};

export type MakeupReadOutcome =
  | {
      ok: true;
      /** What she is shown, adopts or edits. Already inside the destination's cap. */
      sentence: string;
      /** Which surfaces the sentence speaks for. */
      used: readonly MakeupSlot[];
      /** Read, but left out because the sentence ran out of room. Never silent. */
      dropped: readonly MakeupSlot[];
    }
  | { ok: false; refusal: MakeupReadRefusal };

/**
 * THE ASK.
 *
 * Three things it says on purpose, and each of them is somebody's scar:
 *
 * - **cosmetics only, never the person** — the structural fence stated as a
 *   rule too, because a rule enforced only by the shape of the reply is a rule
 *   the next model revision may not notice (`refineDelta`'s own line: *a rule
 *   enforced only by asking nicely is not a rule*, and its converse holds —
 *   a rule enforced only by structure is worth saying as well);
 * - **no brand names** — every free-text field in this program is scrubbed, and
 *   a brand shown to her and then silently stripped later is a worse experience
 *   than one never offered;
 * - **a phrase, not a sentence** — the budget is real and it is small.
 */
const ASK = [
  "You are a makeup artist writing a short note for a photographer.",
  "",
  "Look at this photograph and describe ONLY the makeup being worn.",
  "",
  "Rules:",
  "- Describe cosmetics only. Never describe the person: not their hair, not",
  "  their age, not their skin tone, not their ethnicity, not their identity.",
  "- Never name a brand or a product line.",
  "- Each answer is a short phrase of a few words, never a sentence.",
  `- Each answer is at most ${MAKEUP_SLOT_MAX_LENGTH} characters.`,
  "- If a surface carries no makeup, or you cannot see it, answer null for it.",
  "",
  "eyes: the eye makeup — shadow, liner, lashes",
  "lips: the lip — colour and finish",
  "brows: how the brows are groomed or filled",
  "complexion: the base — finish, blush, contour, highlight",
  "",
  'Reply with JSON: {"eyes": "...", "lips": "...", "brows": "...", "complexion": "..."}',
  "and nothing else. Use null for any surface with no makeup on it.",
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
 * One slot answer, cleaned — or `null`, which means the surface carries nothing
 * this reader can honestly report.
 *
 * The null vocabulary is `faceDescribe.readLine`'s, and it is wider than it
 * looks: a model asked for null often writes the word instead, and "none" for a
 * bare lip is a correct observation that must not become the string "none" in a
 * paid prompt. That exact bug is on the record — `makeup: "none — a bare face"`
 * reached the slot once and nothing stopped it (D-172, `refineDelta`).
 */
export function readMakeupSlot(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const plain = value.trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "");
  if (!plain) return null;
  if (/^(null|none|n\/?a|unknown|unclear|nothing|bare)\b/i.test(plain)) return null;
  const scrubbed = scrubBrands(plain)?.trim() ?? "";
  if (!scrubbed) return null;
  if (scrubbed.length > MAKEUP_SLOT_MAX_LENGTH) return null;
  return scrubbed.toLowerCase();
}

/**
 * Compose the note, in the declared order, stopping before the cap rather than
 * cutting through it.
 *
 * Returns what it used and what it had to leave — a cap nobody is told about
 * reads as "that is everything we saw", which is a quieter lie than a refusal.
 */
export function composeMakeupSentence(
  slots: Readonly<Partial<Record<MakeupSlot, string | null>>>,
): { sentence: string; used: MakeupSlot[]; dropped: MakeupSlot[] } {
  const used: MakeupSlot[] = [];
  const dropped: MakeupSlot[] = [];
  let sentence = "";
  for (const slot of MAKEUP_SLOTS) {
    const value = slots[slot];
    if (!value) continue;
    const candidate = sentence ? `${sentence}, ${value}` : value;
    if (candidate.length > MAX_MAKEUP_LENGTH) {
      dropped.push(slot);
      continue;
    }
    sentence = candidate;
    used.push(slot);
  }
  return { sentence, used, dropped };
}

export type MakeupReadInput = {
  bytes: Buffer;
  contentType: string;
  /** Test seam and dependency injection; `undefined` takes the shipped engine. */
  engine?: TextEngine | null;
  signal?: AbortSignal;
};

/**
 * Read one reference. One call, house money, and nothing is kept.
 *
 * Degrades to a REFUSAL rather than to a guess — a reader that invents a look
 * when it cannot see one would put words she never chose in front of her with
 * our name on them.
 */
export async function readMakeupFromReference(
  input: MakeupReadInput,
): Promise<MakeupReadOutcome> {
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
      system: "You describe cosmetics. You never describe people.",
      user: ASK,
      images: [{ bytes: input.bytes, contentType: input.contentType }],
      json: true,
      temperature: 0,
      /* faceDescribe's measured ceiling for a small JSON object on this
         transport: it spends output tokens before the object, and an empty
         completion would read as "no makeup" — which is a different fact. */
      maxOutputTokens: 600,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    raw = reply.text ?? "";
  } catch (error) {
    log.warn({ err: error }, "[makeupFromReference] the reference could not be read");
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

  const slots: Partial<Record<MakeupSlot, string | null>> = {};
  for (const slot of MAKEUP_SLOTS) slots[slot] = readMakeupSlot(parsed[slot]);

  /*
    THE BACKSTOP, AND IT IS THE PROVEN GUARD RATHER THAN A SECOND LIST.

    D-176/D-177: the word *hair*, or a dye word, IS an owner declaration — the
    value belongs in the hair drawer, and this road has no hair drawer to put it
    in (hair's own ingestion form is a segmented crop and it is not built). So a
    slot naming hair is refused rather than routed, and it is refused BY NAME so
    that "we took part of it" is never a silent outcome — the upload door's own
    rule for a mixed declaration, applied to a mixed reading.

    `namesHairColour` already knows that "bleached brows" and "tinted
    moisturiser" are cosmetics whatever verb sits beside them, which is exactly
    the discrimination a hand-written list here would have got wrong.
  */
  for (const slot of MAKEUP_SLOTS) {
    const value = slots[slot];
    if (value && namesHairColour(value)) {
      return {
        ok: false,
        refusal: {
          code: "namesHair",
          message:
            "That read came back describing her hair, and hair from a reference isn't built yet. Nothing was charged.",
        },
      };
    }
  }

  const { sentence, used, dropped } = composeMakeupSentence(slots);
  if (!sentence) {
    return {
      ok: false,
      refusal: {
        code: "noMakeupVisible",
        message: "We couldn't see any makeup in that picture to take.",
      },
    };
  }

  if (dropped.length > 0) {
    /* No silent caps: what was read and left out is logged as well as returned. */
    log.info({ used, dropped }, "[makeupFromReference] the note did not fit every surface");
  }

  return { ok: true, sentence, used, dropped };
}

/**
 * The demand record's value for a finished read — DERIVED from the outcome
 * rather than mapped beside it (law 4).
 *
 * The refusal codes are camelCase because they are TypeScript; the column's
 * values are snake_case because it is SQL. That is a spelling difference and
 * nothing more, so it is spelled mechanically. A hand-written map of four pairs
 * is a second list, and a second list shadowing a source of truth always drifts
 * from it — usually on the fifth entry, which nobody adds to both.
 */
export function referenceReadOutcomeFor(outcome: MakeupReadOutcome): string {
  if (outcome.ok) return "delivered";
  return outcome.refusal.code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
