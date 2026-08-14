/**
 * ONE REGISTRY PER REFUSAL — copy, charge and report class in one place
 * (fable-486 §f, folded per fable-508 §3).
 *
 * # The shape this replaces
 *
 * A refusal reason lived in a union type, its sentence in a `switch`, its
 * charge behaviour in whichever caller happened to return it, and its
 * countability nowhere at all. Nothing held the three together, so a new
 * refusal could ship with a sentence and no answer to *does this cost her
 * anything* — which is the question a customer asks first and the one a refusal
 * must never leave to inference.
 *
 * It is the same registry shape `CANNOT_SAY_COPY` and `GUARD_REFUSALS` already
 * use, applied to the third family, and for the same reason: **silence becomes
 * a written decision.**
 *
 * # What each entry answers
 *
 * `say` — the customer's sentence. A function of the refusal rather than a
 * constant, because half of these carry the thing she asked about and a
 * refusal that cannot name it is a dead end wearing polite words.
 *
 * `charge` — what it costs her. Every one of these is `free` today and the
 * field exists so that the day one is not, saying so is unavoidable rather than
 * remembered. The sentences say it too; this is what a test can read.
 *
 * `report` — which class the reliability report counts it under. `wall` is the
 * product declining something it does not do; `gate` names what does work and
 * what is coming; `absorbed` is an ask that was already true; `unread` is a
 * sentence that did not come through.
 */
import type { RefineRefusal } from "./refineDelta";
import { INK_NEEDS_DOCUMENT_MESSAGE } from "./inkPlacement";

export type RefusalCharge = "free" | "charged";
export type RefusalReportClass = "wall" | "gate" | "absorbed" | "unread";

export type RefusalEntry = {
  /** What the customer reads. */
  readonly say: (refusal: RefineRefusal) => string;
  readonly charge: RefusalCharge;
  readonly report: RefusalReportClass;
};

/** Narrow a refusal to the variant that carries `asked`. */
const askedIn = (refusal: RefineRefusal): string =>
  ("asked" in refusal && typeof refusal.asked === "string" ? refusal.asked : "that");

export const REFINE_REFUSALS = {
  wall_likeness: {
    say: () => "Refining can't make someone look like a specific real person. Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_stage: {
    /*
      TWO SENTENCES UNDER ONE WALL, and the split is measured.

      BACKED — the stage lexicon matched a word in her sentence, so we know what
      she asked for and can say so, and can name what DOES work: "wardrobe or
      set" as a whole sentence read as a product that does not do jewellery,
      when jewellery is exactly what Refine is the stated channel for (D-160).

      UNBACKED — the model claimed the wall, took its re-look, and the lexicon
      still finds no stage word. Measured, that is where fantastical anatomy
      lands: *"give her antlers"* re-claims 3/3. Telling somebody that antlers
      are "a garment, a prop or the set" is a FALSE sentence, and a false
      refusal is worse than a vague one. So the unbacked half claims nothing
      about what the thing IS.
    */
    say: (refusal) => (
      "backed" in refusal && refusal.backed === false
        ? `Refining can't do ${askedIn(refusal)} yet — it isn't one of the things this can `
          + "name. Faces, hair, skin, build and anything worn do work here. Nothing was charged."
        : `Refining changes the person, not the shoot — ${askedIn(refusal)} is a garment, a `
          + "prop or the set, which comes after Sign. Jewellery, glasses and piercings do work "
          + "here. Nothing was charged."
    ),
    charge: "free",
    report: "wall",
  },
  wall_content: {
    say: () => "That one can't be rendered. Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  wall_unfileable: {
    /* The honest version of wall (d): we will not render what we cannot write
       down, and the reason it could not be written down is that the words were
       not the user's own. */
    say: () => "That came back with more detail than you asked for, so it wasn't recorded — "
      + "and nothing is rendered that isn't recorded. Try saying it in your own words. "
      + "Nothing was charged.",
    charge: "free",
    report: "wall",
  },
  gate_ink_document: {
    say: () => INK_NEEDS_DOCUMENT_MESSAGE,
    charge: "free",
    report: "gate",
  },
  absorbed: {
    /*
      HER ONTOLOGY, NOT OURS (law 8). What she can see is that she asked for
      something the face already has; the model losing her sentence into a
      restatement is our business and not a sentence anybody wants to read.
    */
    say: (refusal) => `She already has ${askedIn(refusal)} — this would have changed nothing, `
      + "so nothing was charged. Ask for more of it, or say it another way.",
    charge: "free",
    report: "absorbed",
  },
  absorbed_departure: {
    /* The same fact about the other direction, in her words rather than ours:
       the thing is already off her, so there is nothing to take off. */
    say: (refusal) => `${askedIn(refusal)} — that's already off her, so this would have `
      + "changed nothing and nothing was charged. Say what you'd like instead and "
      + "I'll put it on.",
    charge: "free",
    report: "absorbed",
  },
  empty: {
    say: () => "Say what you'd like changed — anything about the person themselves.",
    charge: "free",
    report: "unread",
  },
  unreadable: {
    say: () => "That one didn't come through clearly. Try naming what you want changed about "
      + "them. Nothing was charged.",
    charge: "free",
    report: "unread",
  },
} as const satisfies Record<RefineRefusal["reason"], RefusalEntry>;

/** Every refusal reason the product can return — derived, never a second list. */
export const REFUSAL_REASONS = Object.keys(REFINE_REFUSALS) as Array<RefineRefusal["reason"]>;

/** What this refusal costs her. */
export function refusalCharge(reason: RefineRefusal["reason"]): RefusalCharge {
  return REFINE_REFUSALS[reason].charge;
}

/** Which class the reliability report counts it under. */
export function refusalReportClass(reason: RefineRefusal["reason"]): RefusalReportClass {
  return REFINE_REFUSALS[reason].report;
}
