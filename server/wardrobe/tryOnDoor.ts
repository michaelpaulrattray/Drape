/**
 * THE WARDROBE TRY-ON DOOR'S SERVER HALF — the refusal, and where it is thrown.
 *
 * His word, #1537, 2026-09-30, verbatim and entire: ***"SWITCH IT OFF"***. The
 * customer-facing sentence and the closed list live in
 * `shared/wardrobeTryOnDoor.ts` so the client cannot drift from them; this file
 * is only how the server says no.
 *
 * # It is thrown in TWO places on purpose, and they answer different questions
 *
 * 1. **At the procedure's mouth**, first statement in the handler — before the
 *    rate limiter, before the daily quota, before `createGeneration` writes a
 *    row and before `withAtomicCredits` holds a customer's credits. That is
 *    what makes the refusal FREE. `wardrobe.vto.generate` charges
 *    `WARDROBE_CREDIT_COSTS.vtoGeneration` around a call that can no longer
 *    succeed, so a door placed after the hold would be a door that bills.
 *
 * 2. **Inside each pipeline function that reaches a shut-down id**, as the
 *    structural backstop. The mouth gate is a list a future caller can miss;
 *    this one cannot be missed, because it stands between any caller and the
 *    dead model. Invariant 7's shape — *a control that is not invoked does not
 *    exist* — read forwards: a control only at the entrance stops existing the
 *    moment somebody builds a second entrance.
 *
 * Neither is a flag. His word was the flip, there is no scope to widen, and a
 * flag here would be a switch nobody is ever going to turn back on in this
 * shape — the road returns on N8 re-pointed or retired, which is a build, not
 * a variable.
 *
 * # What it does NOT close
 *
 * Reading, listing, renaming, saving and deleting garments, looks, outfits,
 * sessions and models. A customer's existing work stays visible and removable.
 * The only asks refused are the ones that would reach
 * `gemini-3-pro-image-preview` or `gemini-3.1-flash-image-preview` — both
 * shut down by Google on 2026-06-25, both still enumerated in
 * `WIRED_DESPITE_SHUTDOWN` with this card's number, because the ids remain in
 * the registry until the road is re-pointed or retired on N8.
 */
import { TRPCError } from "@trpc/server";

import {
  WARDROBE_TRY_ON_CLOSED,
  WARDROBE_TRY_ON_CLOSED_CODE,
  WARDROBE_TRY_ON_OPEN,
} from "@shared/wardrobeTryOnDoor";

/**
 * The one refusal this door throws.
 *
 * `PRECONDITION_FAILED` rather than `FORBIDDEN`: nothing about the customer or
 * their permissions is wrong, and `FORBIDDEN` is the code this product's
 * approval gate uses, so reusing it here would make a closed feature
 * indistinguishable from an unapproved account in any log that reads codes.
 */
export function wardrobeTryOnClosed(): TRPCError {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: WARDROBE_TRY_ON_CLOSED,
    cause: new Error(WARDROBE_TRY_ON_CLOSED_CODE),
  });
}

/**
 * Throws the refusal. Called first in every closed procedure, and again inside
 * every pipeline function that would otherwise reach a shut-down engine.
 *
 * It takes no argument and reads no configuration: the one fact it consults is
 * {@link WARDROBE_TRY_ON_OPEN}, a compiled constant rather than a flag, and it
 * is the same fact the client's surface reads — so the button a customer sees
 * and the refusal a request meets cannot disagree (working law 4).
 *
 * ⚠ **`void`, NOT `never`, AND THE REASON IS THE RE-OPEN.** `never` is the more
 * honest signature for a function that cannot return, and it was written that
 * way first — TypeScript then proves every statement after the call
 * unreachable and narrows the locals below to `never`, which produced **16
 * errors across two files** on the first typecheck, all of them in the road
 * this card is closing rather than deleting. The road below has to stay
 * compiled and type-checked so that re-opening it on N8 is the deletion of
 * these calls and nothing else; a door that rots the code behind it is a
 * retirement pretending to be a door. Measured, not assumed: run
 * `pnpm check` with `never` here and read the 16.
 */
export function assertWardrobeTryOnOpen(): void {
  if (WARDROBE_TRY_ON_OPEN) return;
  throw wardrobeTryOnClosed();
}
