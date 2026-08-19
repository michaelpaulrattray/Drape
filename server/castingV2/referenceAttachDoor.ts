/**
 * THE DOORS THE ATTACH ASKS — every rule that can be answered without a
 * database, in one place, so each of them can be driven (build two §2,
 * countersigned fable-1063 §1).
 *
 * The procedure in `routes/castingV2.ts` is the wire; `referenceAttachService`
 * owns the ORDER; the statements live in `db/castingV2ReferenceAttachments.ts`.
 * What is HERE is what may be attached and what a picture is allowed to BE.
 *
 * # WHAT THIS DOOR DELIBERATELY DOES NOT ASK
 *
 * **What she is taking.** The ink door asks, because it is reached by somebody
 * who has already said where on her body a design goes. This one is reached
 * before she has typed a word: she attaches, the chip appears, and then she
 * writes the sentence the interpreter reads. fable-937's *no extraction without
 * intent* is honoured at the extraction — nothing is read, cut or charged here.
 *
 * **Who is in the picture.** No face detector, no reader verdict, no rectangle
 * crop. All three were scoped and refused (fable-1052 §1–§3): a detector cannot
 * separate a portrait tattoo from a photograph of a person, law 9 forbids asking
 * a vision reader to settle it, and a rectangle crop is the fidelity violation
 * in the one place the founder said "cropped" means the design. **The fence on
 * this road is the FORM a feature travels in** — a segmented cut, a sentence —
 * and it is met downstream by construction. What this door holds is the
 * PROVENANCE claim, which is a constraint on what a reference may BE rather
 * than a guess about what it contains.
 */
import { randomUUID } from "node:crypto";

import {
  INK_DESIGNS_PER_CANDIDATE,
  inkDesignBytesRefusal,
  type InkDesignDecoded,
  type InkDesignFormat,
} from "./inkUploadDoor";

/**
 * How many pictures one Cast may hold — **the ink designs and the attachments
 * TOGETHER**, and it is the ink door's own number rather than a second one
 * beside it (fable-1063 §2's rider: shared, not 8 + 8).
 *
 * Derived rather than retyped for law 4's reason, and the derivation is the
 * point: raising the ink cap raises this, and nobody can raise one and forget
 * the other. Bytes we keep on a road with no charge path to pace them, so
 * something has to — and here the bytes are a photograph of a person, which is
 * the strongest argument the cap has.
 */
export const REFERENCE_PICTURES_PER_CANDIDATE = INK_DESIGNS_PER_CANDIDATE;

/** One prefix, so an operator can see every attached picture in one place. */
export const REFERENCE_ATTACHMENT_KEY_PREFIX = "casting-v2/reference";

export type ReferenceAttachRefusalCode =
  | "unreadable"
  | "unsupportedFormat"
  | "tooLarge"
  | "tooSmall";

/** A refusal carries the customer's sentence, not a code the client re-words. */
export type ReferenceAttachRefusal = {
  readonly code: ReferenceAttachRefusalCode;
  readonly message: string;
};

/**
 * Whether these bytes may be kept as an attached reference.
 *
 * **This is the ink door's own judgement, called rather than copied.** The four
 * questions are identical and so are the reasons: eight megabytes is a phone
 * photograph comfortably; the format is what the BYTES are, judged after
 * decoding and never from a name, because there is no parameter here for a
 * claim to arrive in; and 256px on the shortest side is the floor below which a
 * picture destined to become a CROP in a repaint recipe can only describe that
 * there was something rather than what it was.
 *
 * A second copy of those four rules would drift from this one — usually on the
 * fifth rule, which nobody adds to both.
 */
export function referenceAttachBytesRefusal(input: {
  byteSize: number;
  decoded: InkDesignDecoded;
}): ReferenceAttachRefusal | null {
  const refusal = inkDesignBytesRefusal(input);
  if (!refusal) return null;
  /*
    The ink door's codes are a superset of this door's — it also refuses on
    placement, side and intent, none of which exist here. The four it can return
    for BYTES are exactly this door's four, and the narrowing is asserted rather
    than assumed so a fifth byte-refusal added there cannot arrive here as an
    unhandled string.
  */
  switch (refusal.code) {
    case "unreadable":
    case "unsupportedFormat":
    case "tooLarge":
    case "tooSmall":
      return { code: refusal.code, message: refusal.message };
    default:
      throw new Error(`the byte door returned a refusal this door cannot carry: ${refusal.code}`);
  }
}

/**
 * Where our copy of the picture lives.
 *
 * `randomUUID`, never `Math.random` — every object this product writes sits at
 * a permanently public URL, and the name is the only thing between it and a
 * stranger. On this road that stranger would be looking at a photograph of a
 * person, so the repository-wide guard on storage writers is doing more work
 * here than anywhere else it applies.
 */
export function referenceAttachmentKey(format: InkDesignFormat): string {
  const extension = format === "jpeg" ? "jpg" : format;
  return `${REFERENCE_ATTACHMENT_KEY_PREFIX}/${randomUUID()}.${extension}`;
}

/** What a customer is told when this Cast already holds as many as it may. */
export const REFERENCE_PICTURES_PER_CANDIDATE_REFUSAL =
  `This Cast is holding ${REFERENCE_PICTURES_PER_CANDIDATE} pictures already — remove one to add another.`;
