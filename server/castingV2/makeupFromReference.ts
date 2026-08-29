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
 * # NEITHER CAP IS A NUMBER CHOSEN HERE
 *
 * Both live in `makeupSlots.ts`, and the sentence budget is DERIVED from the
 * slot contract — every slot at its maximum, joined the way this composes. So
 * a surface can never be dropped for room the contract had already promised it,
 * which is what was happening until 2026-08-18: four legal answers needed 121
 * characters of an 80-character budget and the last two surfaces were lost on
 * every full-face read. The founder found it by looking at a specimen and
 * asking where the blusher went.
 *
 * Dropping still exists and is still reported — it is the emergency path for a
 * reading that broke its own contract, never the routine fate of surfaces three
 * and four. Nothing is silently truncated: what was left out is RETURNED so she
 * can see it and type it herself if she wants it.
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
import { readReferenceClass, referenceClassAskLines } from "./referenceClassGate";
import { namesHairColour } from "./refineDelta";
import {
  MAKEUP_SLOTS,
  MAKEUP_SLOT_MAX_LENGTH,
  MAKEUP_SLOT_SEPARATOR,
  MAX_MAKEUP_LENGTH,
  type MakeupSlot,
} from "./makeupSlots";

export { MAKEUP_SLOTS, MAKEUP_SLOT_MAX_LENGTH, type MakeupSlot } from "./makeupSlots";

const log = createModuleLogger("castingV2/makeupFromReference");

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
  /* The class door (ordered fable-1068 §4). Its column value arrives in
     migration 0042 — the walk in `referenceReadDemand.test.ts` is what makes
     that ordering enforceable rather than remembered. */
  "outOfClass",
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
  "Look at this photograph.",
  "",
  /*
    THE CLASS QUESTION COMES FIRST, and it is composed from the vocabulary
    rather than typed here (law 4) — see `referenceClassGate.ts` for the cyborg
    that bought it. The short version: this ask had four cosmetic surfaces and a
    presence flag, and NO FIELD in which "these are prosthetics" could arrive,
    so a reader handed one reached for the nearest word it had been given.
  */
  ...referenceClassAskLines("makeup"),
  "",
  "THEN decide one thing: is this face wearing makeup that was APPLIED to it?",
  "Many faces are bare. A bare face still has a lip colour, brow hair and skin",
  "texture of its own — those are the PERSON, not makeup. Do not describe them.",
  "",
  "Rules:",
  "- Describe only COSMETICS THAT WERE APPLIED. If a surface shows nothing but",
  "  her own colouring, answer null for it — never describe what is absent.",
  "- Describe cosmetics only. Never describe the person: not their hair, not",
  "  their age, not their skin tone, not their ethnicity, not their identity.",
  "- Never name a brand or a product line.",
  "- Each answer is a short phrase of a few words, never a sentence.",
  `- Each answer is at most ${MAKEUP_SLOT_MAX_LENGTH} characters.`,
  "",
  'wearing: "yes" if applied makeup is visible anywhere, "no" if the face is bare',
  "eyes: applied eye makeup — shadow, liner, lashes",
  "lips: applied lip product — colour and finish",
  "brows: how the brows have been filled, tinted or set",
  /* His own vocabulary, and it is the closing check he set: *"did it get the
     blusher/highlight and bronzer?"* (fable-950 §1). Naming what the slot
     COVERS is not asking the reader to assert it — the presence gate and the
     absence tells still govern whether anything is said at all. */
  "complexion: applied base — foundation, blush, bronzer, contour, highlight",
  "",
  'Reply with JSON: {"subject": "...", "wearing": "yes" or "no", "eyes": "...",',
  '"lips": "...", "brows": "...", "complexion": "..."} and nothing else.',
  "Use null for any surface with nothing applied to it.",
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
 * What one slot answer turned out to be.
 *
 * `absent` and `tooLong` are DIFFERENT FACTS, and this type exists to stop them
 * being the same one. Before it, an over-length answer returned `null` — which
 * this module already spells *"nothing was applied here"* — so the loudest
 * makeup in a frame could vanish and read as a bare surface, with nobody told.
 * That is the no-silent-caps law broken one level below where it was being kept.
 *
 * Found by the first positive control (opus-694): on a frame whose most obvious
 * feature was a black winged smoky eye, the reader answered
 * `"smoky shadow, winged liner, lashes"` — 34 characters against a cap of 32 —
 * and the eye simply disappeared from the sentence.
 */
export type MakeupSlotReading =
  | { kind: "value"; value: string }
  | { kind: "absent" }
  | { kind: "tooLong"; length: number };

/**
 * One slot answer, cleaned — or absent, which means the surface carries nothing
 * this reader can honestly report.
 *
 * The null vocabulary is `faceDescribe.readLine`'s, and it is wider than it
 * looks: a model asked for null often writes the word instead, and "none" for a
 * bare lip is a correct observation that must not become the string "none" in a
 * paid prompt. That exact bug is on the record — `makeup: "none — a bare face"`
 * reached the slot once and nothing stopped it (D-172, `refineDelta`).
 */
export function readMakeupSlot(value: unknown): MakeupSlotReading {
  if (typeof value !== "string") return { kind: "absent" };
  const plain = value.trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "");
  if (!plain) return { kind: "absent" };
  if (/^(null|none|n\/?a|unknown|unclear|nothing|bare)\b/i.test(plain)) return { kind: "absent" };
  /*
    AND THE ABSENCE DESCRIBED AS A PRESENCE — the tells, MEASURED rather than
    imagined (opus-693 §4).

    The first real specimen came back with `brows: "naturally groomed,
    unfilled"` on a bare face. The reader was not wrong about the face; it
    reported the ABSENCE in a slot contracted to answer null, and that sentence
    would have ridden into a render as an instruction describing her own brows
    as a look she chose.

    Every word here is one this reader has actually produced or is the direct
    negation of one. **`natural` is deliberately NOT in this list** — "a natural
    look" is a real thing a person wears and a real thing a customer asks to
    copy, so banning it would be the guard banning the carve-out it exists to
    protect, which is a mistake this repository has already made once.
  */
  if (/\b(unfilled|untinted|unlined|no makeup|not wearing|without makeup|free of makeup|absent)\b/i.test(plain)) {
    return { kind: "absent" };
  }
  const scrubbed = scrubBrands(plain)?.trim() ?? "";
  if (!scrubbed) return { kind: "absent" };
  /*
    NOT ABSENT — READ AND UNUSABLE, and the caller has to be able to say which.

    This returned `null` until the first positive control, and `null` is the
    same word this function uses for "nothing was applied here". So a 34-char
    answer describing the loudest makeup in the frame vanished into a value
    meaning the opposite, and nothing anywhere reported it.
  */
  if (scrubbed.length > MAKEUP_SLOT_MAX_LENGTH) {
    return { kind: "tooLong", length: scrubbed.length };
  }
  return { kind: "value", value: scrubbed.toLowerCase() };
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
    const candidate = sentence ? `${sentence}${MAKEUP_SLOT_SEPARATOR}${value}` : value;
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
    /*
      NOTHING CAME BACK — ours, not her picture (the #126 class swept onto this
      road, foreman-111). The parse failure below keeps *"try another one"*,
      which is real advice for a reply we could not read; this branch is the
      transport throwing, the deadline passing, or the text account being
      overdrawn, and telling her to swap photographs then is advice she cannot
      act on — she changes the picture, it fails again, and we blame her twice.

      Its words are the hair/ink cutters' `couldNotRead`, which already say this
      honestly on the sibling picture roads, rather than a new sentence.
    */
    log.warn({ err: error }, "[makeupFromReference] the reader did not answer");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "I couldn't read that picture just now — try again in a moment. Nothing was charged.",
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
    THE CLASS DOOR — FIRST, AND AHEAD OF THE PRESENCE GATE (ordered fable-1068
    §4).

    It sits here for the presence gate's own reason, one class wider: the
    failure both doors exist for is a reader that finds something to say about
    every picture, so the place to stop it is BEFORE its prose is consulted at
    all. Four fluent surfaces must not outvote *"this is not makeup"* — and if
    they were read first, the loudest ones would compose into a sentence and
    only then be thrown away, which is a tiebreak rather than a door.

    Ahead of the presence gate specifically, because *"there is no makeup on
    this face"* and *"this is not a face wearing makeup at all"* are different
    answers, and the wider one is the one a customer needs.

    AND THE THREE ARMS ARE THREE DIFFERENT SENTENCES, on purpose:

      outOfClass   the reader NAMED something else — refuse with this door's own
                   sentence, and record it as its own outcome
      nothing      the class is simply absent — the road's existing empty
                   answer, the same one the presence gate spends
      unanswered   the reply never addressed the question. NOT this door's
                   sentence: telling somebody *"what's on that face isn't
                   makeup"* because a transport hiccupped would be a claim about
                   a real person's photograph that no reader made. It takes
                   `unreadable`, which is what actually happened.
  */
  const subject = readReferenceClass("makeup", parsed.subject);
  if (subject.kind === "outOfClass") {
    /* Logged with the word the reader chose, because that word is the whole
       mechanism under test and the demand row deliberately cannot carry it. */
    log.info({ named: subject.named }, "[makeupFromReference] the subject is not cosmetics — refused");
    return {
      ok: false,
      refusal: {
        code: "outOfClass",
        message:
          "What's on that face isn't makeup we can take — try a picture of the look you want. Nothing was charged.",
      },
    };
  }
  if (subject.kind === "nothing") {
    return {
      ok: false,
      refusal: {
        code: "noMakeupVisible",
        message: "We couldn't see any makeup in that picture to take.",
      },
    };
  }
  if (subject.kind === "unanswered") {
    log.warn({ subject: parsed.subject }, "[makeupFromReference] the class question came back unanswered");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "We couldn't read that picture — try another one.",
      },
    };
  }

  /*
    THE PRESENCE GATE — ASKED, AND CONSULTED HERE (ruled fable-946 §4).

    A gate nobody reads is not a gate, and this program has the scars to prove
    it. The reader is asked one question before the surfaces — *is this face
    wearing makeup that was APPLIED to it* — and a `no` ends the read, whatever
    the surface answers say.

    It is the FIRST door rather than a tiebreak on purpose: the failure it
    exists for is a reader that finds something to say about every face, so the
    place to stop it is before its prose is consulted at all.

    `undefined` is not `no`. A reply that omits the field is a reply this door
    cannot judge, and refusing on it would turn every malformed answer into
    "she is bare" — a different claim about a real person. So only an explicit
    negative closes it.
  */
  if (typeof parsed.wearing === "string" && /^\s*(no|false|none)\b/i.test(parsed.wearing)) {
    return {
      ok: false,
      refusal: {
        code: "noMakeupVisible",
        message: "We couldn't see any makeup in that picture to take.",
      },
    };
  }

  const slots: Partial<Record<MakeupSlot, string | null>> = {};
  /* Read but unusable, kept apart from read-as-nothing so neither can wear the
     other's meaning. These join `dropped`, because both are surfaces we saw and
     did not speak for — and a surface we cannot speak for is one she can type
     herself, which she cannot do if nobody tells her. */
  const overCap: MakeupSlot[] = [];
  for (const slot of MAKEUP_SLOTS) {
    const reading = readMakeupSlot(parsed[slot]);
    if (reading.kind === "value") slots[slot] = reading.value;
    else if (reading.kind === "tooLong") {
      slots[slot] = null;
      overCap.push(slot);
      log.info(
        { slot, length: reading.length, cap: MAKEUP_SLOT_MAX_LENGTH },
        "[makeupFromReference] a surface answered longer than the ask allows — reported, never silent",
      );
    } else slots[slot] = null;
  }

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

  /* Both kinds of "we saw it and did not say it" reach her in one list, in the
     slots' own order so it reads as a list of surfaces rather than a log. */
  const leftOut = MAKEUP_SLOTS.filter(
    (slot) => dropped.includes(slot) || overCap.includes(slot),
  );
  if (leftOut.length > 0) {
    /* No silent caps: what was read and left out is logged as well as returned. */
    log.info({ used, dropped, overCap }, "[makeupFromReference] the note did not speak for every surface");
  }

  return { ok: true, sentence, used, dropped: leftOut };
}


