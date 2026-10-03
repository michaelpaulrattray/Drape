/**
 * THE CANVAS CASTING DOOR'S SERVER HALF — the refusal, and where it is thrown.
 *
 * His word, #1785, 2026-10-03, verbatim and entire: ***"1758) seal."*** The
 * customer-facing sentence and the closed list live in
 * `shared/canvasCastDoor.ts` so the canvas cannot drift from them; this file is
 * only how the server says no.
 *
 * # It is thrown in TWO places on purpose, and they answer different questions
 *
 * 1. **At the procedure's mouth**, first statement in the handler — before
 *    ownership resolution, before `executeCanvasOperation` opens an operation
 *    row, and above all before `deductCredits` holds a customer's credits. That
 *    is what makes the refusal FREE. All three of these procedures declare
 *    `plannedCredits: CREDIT_COSTS.castingImage`, so a door placed after the
 *    hold would be a door that bills and then gives it back — which is the
 *    exact defect #1785 measured, not a fix for it.
 *
 * 2. **Inside each pipeline function that reaches a shut-down id**, as the
 *    structural backstop. The mouth gate is a list a future caller can miss;
 *    this one cannot be missed, because it stands between any caller and the
 *    dead model. Invariant 7's shape — *a control that is not invoked does not
 *    exist* — read forwards: a control only at the entrance stops existing the
 *    moment somebody builds a second entrance. #1785 is itself the proof that
 *    this happens here: #1654 sealed one road and a SECOND live canvas road on
 *    the same ids went unnoticed for two days.
 *
 * Neither is a flag. His word was the flip, there is no scope to widen, and a
 * flag here would be a switch nobody is ever going to turn back on in this
 * shape — the road returns when the canvas is rebuilt, which is a build.
 *
 * # What it does NOT close
 *
 * Reading a board, moving and pinning nodes, filling a node from the Library,
 * popping a view out, collapsing one, labels, edges, deletes and undo. None of
 * those reaches an engine and none of them spends a credit. The `plan` queries
 * that quote a price stay open too, for #1654's own stated reason. The only
 * asks refused are the three that would spend a customer's credits reaching
 * `gemini-3-pro-image-preview` or `gemini-3.1-flash-image-preview` — both shut
 * down by Google on 2026-06-25, both still enumerated in
 * `WIRED_DESPITE_SHUTDOWN` with this card's number, because the ids remain in
 * the registry until the road is re-pointed or retired.
 */
import { TRPCError } from "@trpc/server";

import {
  CANVAS_CAST_CLOSED,
  CANVAS_CAST_CLOSED_CODE,
  CANVAS_CAST_OPEN,
} from "@shared/canvasCastDoor";

/**
 * The one refusal this door throws.
 *
 * `PRECONDITION_FAILED` rather than `FORBIDDEN`, for the wardrobe door's
 * reason and one more of this road's own. Nothing about the customer or their
 * permissions is wrong, and `FORBIDDEN` is the code this product's approval
 * gate uses, so reusing it would make a closed feature indistinguishable from
 * an unapproved account in any log that reads codes. The road's own reason:
 * `PRECONDITION_FAILED` is in `readableFailure`'s `OURS` set
 * (`client/src/lib/failureSentence.ts`), so this sentence reaches the customer
 * as written instead of being swapped for a caller's fallback.
 */
export function canvasCastClosed(): TRPCError {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: CANVAS_CAST_CLOSED,
    cause: new Error(CANVAS_CAST_CLOSED_CODE),
  });
}

/**
 * Throws the refusal. Called first in every closed procedure, and again inside
 * every pipeline function that would otherwise reach a shut-down engine.
 *
 * It takes no argument and reads no configuration: the one fact it consults is
 * {@link CANVAS_CAST_OPEN}, a compiled constant rather than a flag, and it is
 * the same fact the canvas reads — so the button a customer sees and the
 * refusal a request meets cannot disagree (working law 4).
 *
 * ⚠ **`void`, NOT `never`.** `never` is the more honest signature for a
 * function that cannot return, and the wardrobe door records what it costs:
 * TypeScript then proves every statement after the call unreachable and narrows
 * the locals below to `never`. The road below has to stay compiled and
 * type-checked so that re-opening it is the deletion of these calls and nothing
 * else; a door that rots the code behind it is a retirement pretending to be
 * one.
 */
export function assertCanvasCastOpen(): void {
  if (CANVAS_CAST_OPEN) return;
  throw canvasCastClosed();
}
