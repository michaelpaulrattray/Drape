/**
 * THE DOORS THE PLATE MINT ASKS — every refusal that can be decided without a
 * transport, in one place, so each of them can be driven directly.
 *
 * The mint takes a design a customer attached (a photograph of a tattoo, on
 * skin, possibly on a person) and produces the PLATE: that design re-drawn onto
 * a blank ghost mannequin. **The plate is the only ink artifact an engine is
 * ever shown** (D-138, ruled fable-684 §2) — which is how the real-person fence
 * is met by construction rather than by a filter.
 *
 * # WHY THE DOORS ARE A MODULE AND NOT A SEQUENCE OF `if`s IN THE SERVICE
 *
 * The same reason `inkUploadDoor` is: a mint costs a paid image call, and a
 * refusal that only exists inside the call path can only be tested by making
 * the call. Every rule here is a pure function over its inputs, so the suite
 * can hand each one the input it must refuse without a database, a bucket or a
 * provider.
 *
 * # THE REFUSAL THAT IS NOT HERE, AND WHERE IT LIVES INSTEAD
 *
 * **Person content in the produced plate.** That cannot be decided from inputs
 * — it is a judgement about pixels that do not exist until the engine has
 * drawn them, and law 9 says no vision reader closes it. It is the FENCE COURT
 * (fable-919 §3): a face-bearing reference must produce a plate with zero
 * person content, proven at the frames in front of the founder's eyes before
 * the class opens. A door here would be the comfortable lie that the problem is
 * handled.
 *
 * # AND THE ONE THAT LOOKS LIKE PARANOIA AND IS NOT
 *
 * {@link inkPlateTemplateRefusal}. A plate is a design drawn onto a SPECIFIC
 * blank form the founder approved by looking at it — near-white, matte, four
 * rotations, the whole limb (fable-942/943, amended fable-955). If the file on
 * disk is not that file, every plate minted from it is a different artwork than
 * the one he ruled on, and nothing downstream can tell. So the template's bytes
 * are checked against the digest his ruling landed on, and a mismatch refuses
 * rather than plating onto a form nobody has seen. It is the reference
 * library's own `bytes have moved` refusal, one road along.
 */
import { randomUUID } from "node:crypto";

import { inkPlacementEntry, type InkPlacement } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import { inkTemplateFor } from "./inkTemplates";
import { INK_KEY_PREFIX } from "./inkUploadDoor";

/**
 * Where a plate's bytes live.
 *
 * Under the designs' own prefix and one level in, so an operator sees the whole
 * ink tree in one place and can still tell what a customer GAVE us from what we
 * DREW — the two have different provenance and one of them is the only artifact
 * an engine ever sees.
 *
 * `randomUUID`, never `Math.random`: every object this product writes sits at a
 * permanently public URL and the name is the only thing between it and a
 * stranger (the repository guard on storage writers says the same thing).
 */
export const INK_PLATE_KEY_PREFIX = `${INK_KEY_PREFIX}/plates`;

export function inkPlateKey(): string {
  /* Always PNG: the engines are asked for PNG and a plate is a flat drawing on
     a near-white ground, which is the one thing lossy compression is worst at. */
  return `${INK_PLATE_KEY_PREFIX}/${randomUUID()}.png`;
}

/**
 * Every way a mint can refuse before it spends, as a LIST rather than a type
 * alone — a demand record has to hold a value for each one, and a type cannot
 * be iterated.
 */
export const INK_PLATE_REFUSAL_CODES = [
  "noTransport",
  "designMissing",
  "designMoved",
  "templateMissing",
  "templateMoved",
  "alreadyPlated",
] as const;

export type InkPlateRefusalCode = (typeof INK_PLATE_REFUSAL_CODES)[number];

export type InkPlateRefusal = {
  readonly code: InkPlateRefusalCode;
  /** The customer's sentence, not a code a client re-words. */
  readonly message: string;
};

/**
 * No image transport, no plate — and it says so rather than queueing.
 *
 * A mint with no engine cannot be retried into existence by the caller, and a
 * silent no-op would leave a design that looks attached and can never ride.
 */
export function inkPlateTransportRefusal(hasEngine: boolean): InkPlateRefusal | null {
  return hasEngine ? null : {
    code: "noTransport",
    message: "We can't prepare that design just now — try again in a moment.",
  };
}

/**
 * THE DESIGN'S BYTES ARE THE BYTES WE RECORDED, or nothing is minted.
 *
 * `digest` was taken over the object at upload and means byte identity. If what
 * comes back from storage hashes to something else — or does not come back at
 * all — the plate would carry a design the customer never attached — and because a plate PERSISTS and is
 * shown to an engine on every later render, that is a wrong tattoo on every
 * frame rather than one bad picture.
 *
 * The repaint road already refuses a reference whose bytes have moved since the
 * library minted them; this is the same refusal at the ink door.
 */
export function inkPlateDesignRefusal(input: {
  recordedDigest: string;
  /** `null` is *the object is not there* — a different fact from a wrong one. */
  fetchedDigest: string | null;
}): InkPlateRefusal | null {
  if (input.fetchedDigest === null) {
    /*
      THE SPLIT THE TEMPLATE PAIR ALREADY MAKES, on the other picture.

      *The bytes are gone* and *the bytes are different* have different causes
      and different fixes — an object collected out from under a live row versus
      a design that was replaced — and one word for both would make a purge bug
      indistinguishable from a swap. She reads the same sentence either way; the
      code is for us.
    */
    return {
      code: "designMissing",
      message: "That design isn't there any more — attach it again and we'll prepare it.",
    };
  }
  return input.recordedDigest === input.fetchedDigest ? null : {
    code: "designMoved",
    message: "That design has changed since you attached it — attach it again and we'll prepare it.",
  };
}

/**
 * THE TEMPLATE IS THE ONE HE APPROVED, or nothing is minted.
 *
 * Two refusals rather than one, because *the file is not there* and *the file is
 * not the file* are different facts with different fixes — a deploy that lost an
 * asset versus an asset somebody edited. One word for both would make a missing
 * file indistinguishable from a swapped one, which is the two-meanings-of-none
 * shape this program keeps splitting.
 */
export function inkPlateTemplateRefusal(input: {
  present: boolean;
  approvedDigest: string;
  fetchedDigest: string | null;
}): InkPlateRefusal | null {
  if (!input.present || input.fetchedDigest === null) {
    return {
      code: "templateMissing",
      message: "We can't prepare that design just now — try again in a moment.",
    };
  }
  return input.approvedDigest === input.fetchedDigest ? null : {
    code: "templateMoved",
    message: "We can't prepare that design just now — try again in a moment.",
  };
}

/**
 * A DESIGN IS PLATED ONCE, and a second ask is not an error.
 *
 * The whole cost argument of minting at intent-declaration (fable-936 §2) is
 * that the plate is made once per design and reused by every later render. So a
 * repeat ask returns the plate that exists rather than buying another, and the
 * refusal code is the honest name for what happened rather than a failure the
 * caller has to interpret.
 */
export function inkPlateAlreadyMintedRefusal(hasPlate: boolean): InkPlateRefusal | null {
  return hasPlate ? {
    code: "alreadyPlated",
    message: "That design is already prepared.",
  } : null;
}

/**
 * WHAT THE ENGINE IS TOLD, and every line of it is load-bearing.
 *
 * The ask is a TRANSFER, not a description: the design is handed over as a
 * picture rather than described in words, because a described tattoo is a
 * different tattoo (the whole reason D-138 puts ink on a plate instead of into
 * prose).
 *
 * Three things it says on purpose:
 *
 * - **the person is not the subject and must not appear** — the fence stated as
 *   an instruction as well as met by construction, because a rule enforced only
 *   by the shape of the inputs is a rule the next model revision may not notice;
 * - **the placement is NAMED** — fable-955 §3 made this an explicit question of
 *   the plate court when the founder ruled the template back to the whole limb.
 *   With full-length canvas nothing in the asset stops an engine putting an
 *   upper-arm design on the forearm, so the words have to;
 * - **nothing else changes** — the blank form is the founder's approved artwork
 *   and the plate is that artwork plus one design, never a redrawn mannequin.
 */
export function inkPlatePrompt(input: {
  placement: InkPlacement;
  side: InkSide;
}): string {
  /*
    THE SURFACE'S OWN WORD, taken from the vocabulary rather than passed in.

    `readerWord` is the one the placement reading MEASURED as cutting this
    surface — "upper arm", never a bone and never `upperArm`. `noun` is the
    customer's copy and carries "her", which is wrong for a bare mannequin form
    and would put a person into the sentence whose whole job is keeping one out.

    Derived so a caller cannot supply a word the vocabulary disagrees with
    (law 4): one surface, one name, in the file that measured it.
  */
  const surface = inkPlacementEntry(input.placement).readerWord;
  const where = input.side === "centre"
    ? `the ${surface}`
    : `the ${input.side} ${surface}`;
  /*
    HOW MANY VIEWS THE SHEET HOLDS, and what they are — read from the template
    rather than assumed to be one (the wrap court's finding, 2026-08-18).

    Every committed template is a turnaround: the arm sheet is side / middle /
    back, the body sheet is front / back. The first version of this prompt said
    "a plain, featureless mannequin form" and then "leave every other part of
    the form completely bare", and the engine did precisely that — one serpent
    on the side view, two bare arms beside it. The sheet had three views and the
    words had one.
  */
  const template = inkTemplateFor(input.placement);
  const views = template.views;
  const count = NUMBER_WORDS[views.length] ?? `${views.length} times`;
  const named = views.length > 1
    ? `${views.slice(0, -1).join(", ")} and ${views[views.length - 1]}`
    : views[0] ?? "";
  return [
    "You are given two pictures.",
    "",
    "PICTURE 1 is a blank template: THE SAME plain, featureless mannequin form",
    `shown ${count} on one near-white sheet — ${named}, left to right. They are`,
    "one body seen from several angles, not several different bodies. It has no",
    "tattoo on it.",
    "",
    "PICTURE 2 is a photograph containing a tattoo design.",
    "",
    `Draw the tattoo design from PICTURE 2 onto PICTURE 1, at ${where}, IN EVERY`,
    "ONE OF THOSE VIEWS.",
    "",
    "RULES:",
    "- Reproduce the DESIGN faithfully: its shapes, its line weight, its shading",
    "  and any lettering exactly as they appear. Do not restyle it, do not",
    "  simplify it, and do not add to it.",
    "- It is ONE tattoo, drawn once on one body, and each view shows that same",
    "  tattoo from that view's angle. Where the design continues around the",
    `  surface it must MEET correctly between the ${named} views: what leaves one`,
    "  side of the form arrives on the next. Never draw a second copy of the",
    "  design, and never leave a view bare because the design is elsewhere.",
    "- Follow the form underneath, so the design sits on the surface as ink on",
    "  skin rather than as a flat sticker.",
    `- Put it at ${where} and nowhere else. Leave every other part of the form`,
    "  completely bare, in every view.",
    "- The PERSON in PICTURE 2 is not the subject and must not appear: no face,",
    "  no hair, no eyes, no skin tone, no jewellery, no clothing, no background",
    "  from that photograph.",
    "- Change nothing else about PICTURE 1: same pose, same tone, same lighting,",
    "  same near-white background, same soft fades where the form ends, and the",
    "  same number of views in the same order.",
    "- No text of your own, no labels, no watermark, no border.",
  ].join("\n");
}

/** Small words for small counts — a sheet has two or three views, never forty. */
const NUMBER_WORDS: Readonly<Record<number, string>> = Object.freeze({
  1: "once", 2: "twice", 3: "three times", 4: "four times",
});
