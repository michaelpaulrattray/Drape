import type { DispatchFailureKind } from "./sheetState";

/**
 * Turn a failed roll dispatch into something a person can act on.
 *
 * Written because of a silent failure the founder hit: an anime brief was
 * refused server-side — correctly, and for free, before anything was claimed —
 * and the sheet showed eight skeletons that waited forever. The refusal was
 * real and nothing rendered it.
 *
 * Every kind here answers three questions in the copy itself: what happened,
 * whether it cost anything, and what to do next. A refusal is about the brief
 * and is always free, because compilation runs before the claim; the others
 * are about the system and say so.
 */
export type ClassifiedFailure = {
  kind: DispatchFailureKind;
  /** Plain copy. No error codes, no provider names, no apology. */
  message: string;
};

type Trpcish = { message?: string; data?: { code?: string } };

export function classifyDispatchFailure(error: unknown): ClassifiedFailure {
  const err = error as Trpcish;
  const code = err?.data?.code;
  const serverMessage = typeof err?.message === "string" ? err.message : "";

  /*
    BAD_REQUEST is the brief compiler's refusal: it could not read the brief,
    or the brief asks for a cohort no adapter is certified for. The server's
    own sentence is already written for a person, so it is used verbatim
    rather than replaced by something vaguer.
  */
  if (code === "BAD_REQUEST") {
    return { kind: "refused", message: serverMessage || "That brief could not be cast." };
  }

  if (code === "TOO_MANY_REQUESTS") {
    return {
      kind: "busy",
      message: serverMessage || "The studio is busy right now. Try again in a moment — you were not charged.",
    };
  }

  /*
    FORBIDDEN covers a frozen account; PRECONDITION_FAILED covers the flag and
    insufficient credits. Both are about the account rather than the sentence.
  */
  if (code === "FORBIDDEN" || code === "PRECONDITION_FAILED") {
    return { kind: "credits", message: serverMessage || "This account cannot cast right now." };
  }

  return {
    kind: "unavailable",
    message:
      serverMessage
      || "Casting could not start. Nothing was charged — try that again in a moment.",
  };
}

/** The action a failure state offers. Refusals send you back to the words. */
export function failureActionLabel(kind: DispatchFailureKind): string {
  return kind === "refused" ? "Edit the brief" : "Back to casting";
}
