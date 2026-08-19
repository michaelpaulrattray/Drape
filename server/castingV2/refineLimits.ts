/**
 * WHAT THE REFINE BOX ACCEPTS — the two caps, and the derivation between them.
 *
 * They live here rather than as literals in `routes/castingV2.ts` for one
 * reason: the second is DERIVED from the first, and a derivation written into a
 * schema literal is a second copy of a decision (law 4). Here they can also be
 * read by a suite without importing the router, which boots the world.
 */
import { REASK_HANDLE_MAX_LENGTH } from "./refineReask";

/**
 * ONE ADJUSTMENT, NOT A BRIEF.
 *
 * The founder's own framing of the box: the brief box is where a paragraph
 * belongs, and a long instruction here is somebody trying to re-cast rather
 * than refine.
 */
export const REFINE_INSTRUCTION_MAX_LENGTH = 200;

/**
 * AND THE FIELD AN ANSWER TRAVELS IN, which has to be WIDER.
 *
 * `answering` carries the question's `about`, and `about` defaults to the
 * sentence they typed — so at the same number as the instruction it is exactly
 * enough, and not one character more. The moment a question puts its own HANDLE
 * in front of that sentence ({@link REASK_HANDLE_MAX_LENGTH}), a full-length ask
 * overflows the field the client echoes it in and the ANSWER is refused by the
 * schema.
 *
 * **That would be a worse dead end than the one the handle closes**, and a
 * quieter one: it fires only on the longest sentences, so it would look like a
 * flaky question rather than a cap.
 */
export const REFINE_ANSWERING_MAX_LENGTH =
  REFINE_INSTRUCTION_MAX_LENGTH + REASK_HANDLE_MAX_LENGTH;
