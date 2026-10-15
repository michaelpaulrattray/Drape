/**
 * WHAT THE REFINE BOX ACCEPTS — the two caps, and the derivation between them.
 *
 * They live here rather than as literals in `routes/castingV2.ts` for one
 * reason: the second is DERIVED from the first, and a derivation written into a
 * schema literal is a second copy of a decision (law 4). Here they can also be
 * read by a suite without importing the router, which boots the world.
 *
 * ⚠ **The FIRST of the two now lives in `shared/` and is re-exported here**
 * (2026-08-25, ruled fable-1613). The client held two hand-typed copies of it
 * and the row that raises it would have been invisible to every customer; the
 * reasoning is in `shared/refineLimits.ts`'s own header. This module keeps the
 * DERIVED cap, because the handle length it is built from is server-only — and
 * it keeps the re-export so nothing here has two names for one number.
 */
import { REFINE_INSTRUCTION_MAX_LENGTH } from "../../shared/refineLimits";
import { REASK_HANDLE_MAX_LENGTH, REFINE_REQUEST_TEXT_MAX_LENGTH } from "./refineReask";

export { REFINE_INSTRUCTION_MAX_LENGTH };

/**
 * AND THE FIELD THE ANSWER IS STORED IN, re-exported so the three numbers can
 * be read against each other in one place (#1126).
 *
 * It is declared in `refineReask`, which composes the echo and cannot import
 * this module without a cycle. The arithmetic worth seeing together:
 *
 * | number | value | what it governs |
 * |---|---|---|
 * | {@link REFINE_INSTRUCTION_MAX_LENGTH} | 2000 | what the refine box accepts |
 * | {@link REFINE_ANSWERING_MAX_LENGTH} | 2109 | what an ANSWER may carry (+ the 109-character handle) |
 * | {@link REFINE_REQUEST_TEXT_MAX_LENGTH} | 2400 | what the column STORES |
 *
 * The longest thing the product composes onto an answer is 2,141 characters
 * (2,109 plus the studio's own 32-character clause), so the third holds the
 * second whole and nothing typed is thrown away. `server/refineEchoWidth.test.ts`
 * measures that rather than this table, which is a reading aid and goes stale.
 *
 * ⚠ **This table read 200 / 309 / 220 until card #26 (2026-10-15), and the
 * third figure had been wrong since migration 0066 widened the column to 400
 * on 2026-09-25** — the warning beneath it described #1126's defect as still
 * open three weeks after it closed. The box went to 2,000 on his word, *"yes
 * raise the refine limit to 2000"*, and the column to 2,400 by migration 0085,
 * whose ceremony must run on a world before code declaring 2,400 reaches it.
 */
export { REFINE_REQUEST_TEXT_MAX_LENGTH };

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
