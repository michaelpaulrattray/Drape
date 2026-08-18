/**
 * THE DOORS THE INK STUDIO'S UPLOAD ASKS — every rule that can be answered
 * without a database, in one place, so each of them can be driven.
 *
 * The procedure in `routes/castingV2.ts` is the wire: it validates, calls these,
 * stores bytes and writes a row. What may be attached, WHERE, and what a design
 * is allowed to BE are decisions, and decisions live here where a test can hand
 * them the input they must refuse.
 *
 * # THE DOOR THAT IS DELIBERATELY NOT HERE
 *
 * **Release.** `isInkTupleReleased` answers *has ink actually held there in a
 * paid drive*, and the table is correctly EMPTY. A release gate on the UPLOAD
 * would therefore refuse everybody, so nothing could be driven, so no tuple
 * could ever be earned — and the only escape would be a bench that goes around
 * the procedure, which is this program's own `bench-skips-the-gate` failure
 * written in advance.
 *
 * So: **release gates the RENDER; the upload records intent** (ruled
 * fable-932 §2). `INK_PLACEMENT_NOT_RELEASED`'s own sentence — *"Nothing was
 * charged"* — belongs to the before-dispatch door, and stays there.
 *
 * # AND THE ONE THAT CANNOT FIRE TODAY, DECLARED RATHER THAN DISCOVERED
 *
 * The framing gate refuses NOTHING on `master`, because all three measured
 * placements sit in regions the master frame shows — the vocabulary module says
 * so in its own header, and this module inherits the fact rather than restating
 * it. It is driven where a refusal IS reachable (`frontClose`: her neck is in a
 * head-and-shoulders portrait, her upper arm is not), because a gate that
 * cannot fail on today's data is how a control quietly stops being one.
 */
import { randomUUID } from "node:crypto";

import type { AnchorFraming } from "../../shared/bodyAnchorRegions";
import {
  inkPlacementAvailability,
  type InkPlacement,
} from "../../shared/inkPlacementVocabulary";
import {
  sidesForInkPlacement,
  type InkSide,
} from "../../shared/inkReleasedPlacements";
import {
  referenceIntentIsOpen,
  referenceIntentNotOpen,
  type ReferenceIntent,
} from "../../shared/referenceIntents";

/**
 * How many designs one Cast may hold.
 *
 * Bytes we keep, on a road with no charge path to pace them (fable-921 §3b), so
 * something has to. Eight is small on purpose: the alternative is discovering
 * the number after a cast holds four hundred objects, and the vocabulary can
 * express four tuples today — two designs per place is already generous.
 */
export const INK_DESIGNS_PER_CANDIDATE = 8;

/** Eight megabytes: a phone photograph of a flash sheet, comfortably. */
export const INK_DESIGN_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The shortest edge a design may have.
 *
 * A design is destined to be a CROP carried into a repaint recipe, and a
 * reference smaller than this cannot describe a tattoo — it can only describe
 * that there was one. Refusing at the door beats delivering a blur.
 */
export const INK_DESIGN_MIN_EDGE = 256;

/** What the bytes may actually BE. Judged after decoding, never from a name. */
export const INK_DESIGN_FORMATS = ["png", "jpeg", "webp"] as const;
export type InkDesignFormat = (typeof INK_DESIGN_FORMATS)[number];

/** One prefix, so an operator can see every uploaded design in one place. */
export const INK_KEY_PREFIX = "casting-v2/ink";

export type InkUploadRefusalCode =
  | "intentMissing"
  | "intentRepeated"
  | "intentNotOpen"
  | "sideNotOnPlacement"
  | "outOfFrame"
  | "unreadable"
  | "unsupportedFormat"
  | "tooLarge"
  | "tooSmall";

/** A refusal carries the customer's sentence, not a code the client re-words. */
export type InkUploadRefusal = {
  readonly code: InkUploadRefusalCode;
  readonly message: string;
};

/**
 * Whether this design may be attached HERE, on this frame.
 *
 * Two questions in one, in the order the vocabulary answers them: the side is a
 * fact about the placement, and the frame is a fact about the photograph.
 */
export function inkPlacementRefusal(input: {
  placement: InkPlacement;
  side: InkSide;
  framing: AnchorFraming;
}): InkUploadRefusal | null {
  /*
    THE SIDE IS DERIVED FROM THE VOCABULARY, never from a second list (law 4).
    A paired placement has a left and a right and no middle; a single placement
    has a middle and no sides. `upperArm:centre` and `neck:left` are both
    nonsense, and laterality is this road's proven killer twice over — so it is
    refused at the door rather than stored and puzzled over later.
  */
  const sides = sidesForInkPlacement(input.placement);
  if (!sides.includes(input.side)) {
    return {
      code: "sideNotOnPlacement",
      message: sides.length === 1
        ? "That part of her is one place, not a left and a right."
        : "That part of her comes as a pair — say which one.",
    };
  }

  const availability = inkPlacementAvailability(input.placement, input.framing);
  if (availability.kind === "outOfFrame") {
    return {
      code: "outOfFrame",
      message: `${availability.what} is not in this photograph — only a different shot shows it.`,
    };
  }
  /*
    `mayBeCovered` ADMITS (ruled fable-932 §3). The design is a fact about the
    CAST and the garment is a fact about a FRAME: at upload nobody knows what
    she is wearing in the render this design is eventually carried into. The
    occlusion door (D-226) answers it there, per frame, where the garment is
    visible. Refusing here would refuse the scoop-neck case the placement
    reading measured as available.
  */
  return null;
}

/** What a decoder said about the bytes. `null` is "these are not a picture". */
export type InkDesignDecoded = {
  format?: string;
  width?: number;
  height?: number;
} | null;

/**
 * Whether these bytes may be kept as a design.
 *
 * **The format is what the BYTES are.** This function is given no declared mime
 * and no filename on purpose — there is no field here for a claim to arrive in,
 * so a `.png` name over a PDF is a PDF at this door.
 */
export function inkDesignBytesRefusal(input: {
  byteSize: number;
  decoded: InkDesignDecoded;
}): InkUploadRefusal | null {
  if (input.byteSize > INK_DESIGN_MAX_BYTES) {
    return {
      code: "tooLarge",
      message: `That file is larger than ${Math.round(INK_DESIGN_MAX_BYTES / (1024 * 1024))}MB.`,
    };
  }
  if (!input.decoded) {
    return { code: "unreadable", message: "That file isn't an image we can read." };
  }
  if (!isInkDesignFormat(input.decoded.format)) {
    return {
      code: "unsupportedFormat",
      message: "Designs come as PNG, JPEG or WebP.",
    };
  }
  const shortest = Math.min(input.decoded.width ?? 0, input.decoded.height ?? 0);
  if (shortest < INK_DESIGN_MIN_EDGE) {
    return {
      code: "tooSmall",
      message: `That image is too small to draw from — ${INK_DESIGN_MIN_EDGE}px on the shortest side, at least.`,
    };
  }
  return null;
}

export function isInkDesignFormat(value: string | undefined): value is InkDesignFormat {
  return value !== undefined && (INK_DESIGN_FORMATS as readonly string[]).includes(value);
}

export function inkDesignContentType(format: InkDesignFormat): string {
  return `image/${format}`;
}

/**
 * Where our copy of the bytes lives.
 *
 * `randomUUID`, never `Math.random` — every object this product writes sits at a
 * permanently public URL, and the name is the only thing between it and a
 * stranger (the repository guard on storage writers says the same thing).
 */
export function inkDesignKey(format: InkDesignFormat): string {
  const extension = format === "jpeg" ? "jpg" : format;
  return `${INK_KEY_PREFIX}/${randomUUID()}.${extension}`;
}

/**
 * WHAT THIS REFERENCE IS BEING TAKEN FOR — the declaration, ruled fable-937.
 *
 * His catch is the whole reason: a customer may upload a picture for the HAIR,
 * and the person in it may happen to have tattoos. Extracting what was not
 * asked for spends money on nobody's behalf, so nothing is taken from a
 * reference that was not declared.
 *
 * Three refusals, and the middle one is the one that keeps this honest:
 *
 *   intentMissing   nothing declared, or nothing this door can serve — the row
 *                   it would file carries a placement and a side, which are
 *                   facts about a TATTOO
 *   intentRepeated  a set, not a list; a doubled member would be counted twice
 *                   by the demand tally this field exists to feed
 *   intentNotOpen   the form is RULED and not BUILT — named, with the money
 *                   promised, instead of accepted and silently ignored
 *
 * A declaration is only as open as its least-open member: `[tattoo, hair]` is
 * refused on the hair, because "we took part of it" must never be a silent
 * outcome.
 */
export function inkIntentRefusal(
  intents: readonly ReferenceIntent[],
): InkUploadRefusal | null {
  if (new Set(intents).size !== intents.length) {
    return {
      code: "intentRepeated",
      message: "That feature is listed twice — say each one once.",
    };
  }
  const closed = intents.find((intent) => !referenceIntentIsOpen(intent));
  if (closed) return { code: "intentNotOpen", message: referenceIntentNotOpen(closed) };
  /*
    LAST, and deliberately after the closed check: a hair-only declaration is
    turned down for the reason a customer can act on ("that one opens later"),
    not for an internal one about which door they reached. Only a declaration
    with nothing recognisable in it falls through to here.
  */
  if (!intents.includes("tattoo")) {
    return {
      code: "intentMissing",
      message: "Say what you're taking from this picture.",
    };
  }
  return null;
}

/** What a customer is told when this Cast already holds as many as it may. */
export const INK_DESIGNS_PER_CANDIDATE_REFUSAL =
  `This Cast is holding ${INK_DESIGNS_PER_CANDIDATE} designs already — remove one to add another.`;
