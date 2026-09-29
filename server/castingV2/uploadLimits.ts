/**
 * WHAT AN UPLOADED PICTURE MAY BE — the three numbers the upload entrance's
 * doors quote back to a customer (#209 item 1).
 *
 * # Why these left `inkUploadDoor.ts`
 *
 * They did not leave it in any sense a caller can see: that module RE-EXPORTS
 * all three, so its fifteen importers are untouched and there is still exactly
 * one `export const` per number. What moved is the DECLARATION, and it moved
 * for one reason — `uploadRefusalCopy.ts` must be able to state the sentences
 * that quote these numbers, and that module's one structural rule is that it
 * imports a LEAF and nothing else.
 *
 * Without this file the copy module's only roads were both bad: import
 * `inkUploadDoor.ts` (a cycle, since that module reads the copy) or write `8MB`
 * and `256px` out a second time beside the numbers that produce them (working
 * law 4, in the module whose whole subject is one sentence having one author).
 *
 * This is `@shared/briefLength`'s relationship to `briefRefusalCopy.ts`, clause
 * for clause, and it is copied on purpose rather than re-invented.
 *
 * # The one structural rule
 *
 * **This file imports nothing**, and `uploadRefusalCopy.test.ts` pins that as
 * well as its own — a leaf that stops being a leaf takes the module above it
 * with it, and the whole point of the shape is that the capability atlas can
 * import the copy table without ever running app code.
 */

/**
 * How many pictures one Cast may hold.
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
