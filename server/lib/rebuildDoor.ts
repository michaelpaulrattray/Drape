/**
 * THE REBUILD DOOR'S SERVER HALF — the refusal, and where it is thrown (#2315
 * step 1). The sentence, the code and the closed list live in
 * `shared/rebuildDoor.ts` so the client cannot drift from them.
 *
 * Thrown in two places, as the two doors before it are:
 *
 * 1. **At each listed procedure's mouth**, first statement in the handler —
 *    before the rate limiter, the daily quota, the operation row and above all
 *    any credit hold. That is what makes the refusal free.
 * 2. **Inside `getAiClient()`** (`server/casting/geminiClient.ts`), the single
 *    place the server reads the key and constructs the client. Every road to
 *    the provider passes through it, so a caller the mouth list misses still
 *    sends nothing.
 *
 * `PRECONDITION_FAILED`, not `FORBIDDEN`: nothing about the customer is wrong,
 * `FORBIDDEN` is the approval gate's code, and `PRECONDITION_FAILED` is in the
 * client's `readableFailure` OURS set, so the sentence reaches them as written.
 */
import { TRPCError } from "@trpc/server";

import {
  REBUILD_DOOR_CLOSED,
  REBUILD_DOOR_CLOSED_CODE,
  REBUILD_DOOR_OPEN,
} from "@shared/rebuildDoor";

export function rebuildDoorClosed(): TRPCError {
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message: REBUILD_DOOR_CLOSED,
    cause: new Error(REBUILD_DOOR_CLOSED_CODE),
  });
}

/**
 * Throws the refusal while the door is shut. `void`, not `never`, for the
 * wardrobe door's recorded reason: `never` narrows everything after the call to
 * unreachable and rots the code behind the door. ⚠ **That reason got STRONGER on
 * 2026-10-13, not weaker**: his word on #2315 is KEEP, so there is no step 2 and
 * the code behind this door stays compiled indefinitely rather than until a
 * deletion — so it has to keep typechecking for longer than this line assumed.
 */
export function assertRebuildDoorOpen(): void {
  if (REBUILD_DOOR_OPEN) return;
  throw rebuildDoorClosed();
}
