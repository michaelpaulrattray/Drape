/**
 * WHAT A PICTURE MAY BE — the format vocabulary, declared once for both sides.
 *
 * # Why this file exists
 *
 * A file picker's `accept="image/png,image/jpeg,image/webp"` is a second copy
 * of a list the server's door owns. The client cannot import a server module,
 * so for as long as the vocabulary lived in `server/castingV2/inkUploadDoor.ts`
 * the client's copy could only ever be a MIRROR — its own docblock said so and
 * filed it on #27 ("the client types its own copy of every server cap"), which
 * is the same class as the sixteen `maxLength` caps `shared/inputLimits.ts`
 * closed.
 *
 * The failure mode is the quiet one, and it is why this is worth a file. A
 * fourth format added at the door and missed on the client does NOT error: the
 * picker simply filters the customer's file away, nothing anywhere says why,
 * and she concludes the product will not take her picture.
 *
 * # Why its own module rather than `shared/inputLimits.ts`
 *
 * That file's own docblock draws the line at plain numbers across unrelated
 * domains — its whole value is being able to see every cap at once. This is a
 * list, a type, a guard and a mapping read in both directions: behaviour, not
 * an entry in a list. `shared/refineLimits.ts` set that precedent for exactly
 * the same reason.
 *
 * # ⚠ The name is narrower than the thing, and that is declared, not hidden
 *
 * `INK_DESIGN_FORMATS` was named at the ink studio's door, which was the first
 * door to have one. It is now the vocabulary for every picture this product
 * takes from a customer — the reference attach door (`referenceAttachService`),
 * the refine panel's attach input, and #185's concept upload. Renaming it would
 * touch fifteen call sites across a money- and flag-adjacent path (the ink
 * studio's widening tripwire lives in those files) for no behavioural gain, so
 * the name is kept and its true scope is written here instead of being derived
 * by the next reader. Recorded on #27.
 *
 * # Nothing here may reach for node
 *
 * The client imports this module. `inkDesignKey` stays at the door because it
 * calls `randomUUID`; every export below is pure.
 */

/** What the bytes may actually BE. Judged after decoding, never from a name. */
export const INK_DESIGN_FORMATS = ["png", "jpeg", "webp"] as const;
export type InkDesignFormat = (typeof INK_DESIGN_FORMATS)[number];

export function isInkDesignFormat(value: string | undefined): value is InkDesignFormat {
  return value !== undefined && (INK_DESIGN_FORMATS as readonly string[]).includes(value);
}

export function inkDesignContentType(format: InkDesignFormat): string {
  return `image/${format}`;
}

/**
 * THE SAME MAPPING READ BACKWARDS — a stored design's format from the mime its
 * row records.
 *
 * It lives beside {@link inkDesignContentType} rather than at the one call site
 * that needs it, because the two directions are one decision: change the
 * spelling above and this follows, and a caller stripping `image/` by hand
 * would be the second author of a mapping (law 4).
 *
 * `null` for anything the vocabulary does not know, which includes the mime of
 * a row written by some future door — a format this product cannot name is not
 * a format it should be inventing a key extension for.
 */
export function inkDesignFormatOfContentType(mime: string): InkDesignFormat | null {
  const format = mime.trim().toLowerCase().replace(/^image\//, "");
  return isInkDesignFormat(format) ? format : null;
}
