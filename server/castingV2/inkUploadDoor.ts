/**
 * WHAT A DESIGN'S BYTES MAY BE, AND WHERE THEY ARE KEPT — the rules that can
 * be answered without a database, in one place, so each of them can be driven.
 *
 * ⚠ **THE INK STUDIO'S UPLOAD IS GONE AND THIS FILE IS NOT** (#1158 slice 4e).
 * His ruling of 2026-09-24 — *"It retires with N2"* — retired the
 * upload-a-design road, and the three doors that belonged to it ALONE left in
 * this slice: `inkPlacementRefusal` (side and framing), `inkIntentRefusal`
 * (what this picture is being taken for) and `INK_DESIGNS_PER_CANDIDATE_REFUSAL`
 * (the cap sentence). Their six refusal codes went with them, because a code no
 * surviving function can produce is a sentence with no site — the exact defect
 * this file's own header used to record about `INK_PLACEMENT_NOT_RELEASED`.
 *
 * **What is left is live, and it is the REFERENCE road's**, which he HELD
 * rather than retired (Crew reply #213). Every surviving export has a caller
 * outside this file: `inkDesignBytesRefusal` and `InkDesignDecoded` are
 * `referenceAttachDoor`'s; `inkDesignKey` and `INK_DESIGN_MAX_BYTES` are
 * `inkReferenceMint`'s (and the route's input cap); `INK_DESIGN_MIN_EDGE` is
 * the floor the cutter, the crop, the upscale and the ride floor all import
 * from here rather than restating (law 4), and `INK_DESIGNS_PER_CANDIDATE` is
 * the cap `referenceAttachDoor` derives the picture cap from.
 *
 * So the file's subject narrowed rather than died: it is the door about BYTES,
 * and the doors about PLACEMENT and INTENT were the studio's.
 *
 * # The format vocabulary is re-exported, not re-declared
 *
 * See the note above the re-export below — one declaration in `shared/`, so the
 * client's file pickers cannot mirror it, and the Atlas counts re-export edges.
 */
import { randomUUID } from "node:crypto";

import { BYTES_NOT_AN_IMAGE_MESSAGE } from "./uploadRefusalCopy";

/*
  THE FORMAT VOCABULARY MOVED TO `shared/` AND IS RE-EXPORTED FROM HERE (#27).

  It was declared in this file, which meant the client's file pickers could only
  MIRROR it — a server module is not importable from `client/src`. A re-export
  is not a second copy: one declaration, one binding, and nothing that can
  drift; what it buys is that six server call sites and the door's own docblocks
  keep the import path they have always had, on a money- and flag-adjacent file
  where the smallest diff is worth more than import-path purity. The Atlas has
  counted re-export edges since `d614320f`, so this does not go invisible to the
  retirement view.
*/
import { isInkDesignFormat, type InkDesignFormat } from "../../shared/pictureFormats";

export {
  INK_DESIGN_FORMATS,
  isInkDesignFormat,
  inkDesignContentType,
  inkDesignFormatOfContentType,
  type InkDesignFormat,
} from "../../shared/pictureFormats";

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

/* What the bytes may actually BE — `INK_DESIGN_FORMATS` and its type, guard and
   mime mapping now live in `shared/pictureFormats.ts` and are re-exported at
   the top of this file, because the client's pickers offer the same list. */

/** One prefix, so an operator can see every uploaded design in one place. */
export const INK_KEY_PREFIX = "casting-v2/ink";

type InkUploadRefusalCode =
  | "unreadable"
  | "unsupportedFormat"
  | "tooLarge"
  | "tooSmall"
  /*
    THE CUTTER'S OWN CODES, carried here rather than mapped onto the four above
    (build 3a.2's upload wire). A map would have to collapse them — every one of
    these means something different to the person reading the sentence, and
    `personWithoutDesign` in particular is the row the whole fence rests on.

    `unreadable` is NOT repeated: the cutter's decode failure and this door's
    are the same fact about the same bytes, and two codes for one fact is the
    drift law 4 names.
  */
  | "couldNotRead"
  | "wrongSpace"
  | "personWithoutDesign"
  | "cutTooSmall"
  /* The region road's own door: a photographed person whose ink is not on the
     surface she picked. Carried rather than mapped, like its four siblings —
     collapsing it into `personWithoutDesign` would tell her the design cannot
     be taken from a model when the truth is that she chose the wrong spot. */
  | "inkNotOnThatSurface";

/** A refusal carries the customer's sentence, not a code the client re-words. */
export type InkUploadRefusal = {
  readonly code: InkUploadRefusalCode;
  readonly message: string;
};

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
    return { code: "unreadable", message: BYTES_NOT_AN_IMAGE_MESSAGE };
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

/*
  `isInkDesignFormat`, `inkDesignContentType` and `inkDesignFormatOfContentType`
  moved to `shared/pictureFormats.ts` with the list they read, and are
  re-exported at the top of this file. They went together on purpose: the two
  mime directions are one decision, and a guard split from the list it tests is
  the second author of a vocabulary (law 4).
*/

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

