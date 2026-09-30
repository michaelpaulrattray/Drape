/**
 * What a customer is told when a virtual try-on fails, and whether the
 * failure is worth one silent retry first.
 *
 * Lifted out of `useWardrobeGeneration`'s catch block BYTE-PRESERVING
 * (2026-08-25, 3g). The hook is its first and production reader.
 *
 * ⚠ WHY: `server/wardrobe.test.ts` carried a private `shouldAutoRetry` and
 * `getFinalErrorMessage`, commented "Simulate the retry decision logic from
 * generateVTO catch block", and eight arms asserted the copy — including two
 * that hand-typed the customer-facing sentences themselves. The TOAST
 * sentences, which are DIFFERENT strings from the inline ones, were absent
 * from the copy entirely, so nothing in the suite had ever described them.
 * Working law 4: derive, never mirror.
 */
import { WARDROBE_TRY_ON_CLOSED, WARDROBE_TRY_ON_CLOSED_CODE } from "@shared/wardrobeTryOnDoor";

/** A safety block is worth exactly one silent retry — the server sanitizes on re-fetch. */
export function shouldAutoRetryVto(errorMessage: string, isRetry: boolean): boolean {
  return errorMessage.includes("SAFETY_BLOCK") && !isRetry;
}

export interface VtoErrorCopy {
  /** Shown inline, beside the result. */
  inline: string;
  /** Shown as a toast. Deliberately shorter, and NOT the same sentence. */
  toast: string;
}

/** The two sentences a failed try-on shows, chosen from the error it failed with. */
export function resolveVtoErrorCopy(errorMessage: string): VtoErrorCopy {
  /*
    ⚠ **THE DOOR IS NOT A FAILURE, AND THIS BRANCH IS THE WHOLE DIFFERENCE**
    (#1537, his word 2026-09-30: *"SWITCH IT OFF"*, and the instruction as it
    reached the card: *the door's copy says the feature is not available rather
    than failing*).

    Without this branch a closed door falls through to the bottom return, which
    shows the server's sentence inline and the toast **"VTO generation failed"**
    — telling a customer their try-on broke when in fact we switched it off.
    Both sentences are the door's own, and the inline one is
    `WARDROBE_TRY_ON_CLOSED` itself rather than a copy of it (working law 4:
    this file's own docblock records what hand-typed copies of customer
    sentences already cost this feature once).
  */
  if (errorMessage.includes(WARDROBE_TRY_ON_CLOSED_CODE) || errorMessage.includes(WARDROBE_TRY_ON_CLOSED)) {
    return {
      inline: WARDROBE_TRY_ON_CLOSED,
      toast: "Virtual try-on is unavailable",
    };
  }
  if (errorMessage.includes("SAFETY_BLOCK")) {
    return {
      inline: "Generation blocked by safety filters — try different garments",
      toast: "Safety filter triggered — try different garments",
    };
  }
  if (errorMessage.includes("TOO_MANY_REQUESTS")) {
    return {
      inline: "Rate limit reached. Please wait a moment.",
      toast: "Too many requests — please wait",
    };
  }
  return { inline: errorMessage, toast: "VTO generation failed" };
}
