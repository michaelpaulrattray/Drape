import { errorIsSpoken } from "@shared/spokenError";
import { failureIsOurs, readableFailure } from "@/lib/failureSentence";

import type { DispatchFailure, DispatchFailureKind } from "./sheetState";

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
    BAD_REQUEST is the brief compiler's refusal about the WORDS: too little to
    cast from, a named person or character, or something that is not a being.
    A reader that did not answer is not one of these (see below). The server's
    own sentence is already written for a person, so it is used verbatim
    rather than replaced by something vaguer.
  */
  if (code === "BAD_REQUEST") {
    return { kind: "refused", message: serverMessage || "That brief could not be cast." };
  }

  /*
    SERVICE_UNAVAILABLE is the studio, not the brief (#2386). The brief reader
    did not answer, so nothing was read, claimed or charged — the same words
    will roll once it does. It used to arrive as BAD_REQUEST and the sheet
    titled it "That brief can't be cast" with "Edit the brief" under a sentence
    saying to try again. It is the busy kind's twin: the roll didn't start,
    through no fault of the words, and the server's own sentence says so.
  */
  if (code === "SERVICE_UNAVAILABLE") {
    return {
      kind: "busy",
      message: serverMessage || "The studio couldn't start that roll just now. Try again in a moment — you were not charged.",
    };
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

    ⚠ UNTIL #2387 A SHORT BALANCE NEVER REACHED THIS BRANCH. Every paid road
    threw `BAD_REQUEST` with the ledger's bare "Insufficient credits", so a
    customer short of credits read "That brief can't be cast" with an "Edit
    the brief" button above it. The server now refuses a short balance with
    `PRECONDITION_FAILED` and its own sentence with the price
    (`server/lib/chargeRefusal.ts`), which lands here and offers "Back to
    casting" instead.
  */
  if (code === "FORBIDDEN" || code === "PRECONDITION_FAILED") {
    return { kind: "credits", message: serverMessage || "This account cannot cast right now." };
  }

  /*
    ANY OTHER SENTENCE OUR SERVER WROTE FOR A PERSON IS SHOWN AS WRITTEN (#2387).

    A charge the ledger could not take is refused as a SPOKEN
    INTERNAL_SERVER_ERROR ("We couldn't take payment for that just now…",
    `server/lib/chargeRefusal.ts`). Without this branch it fell to the
    transport fallback below and the customer read "We lost contact while your
    roll was starting" — untrue: we heard the server, and it told us why.
    `failureIsOurs` is the one rule for "the server spoke" (`spoken` marker or
    an authored code), so this does not keep a second list. The kind is
    money-neutral: the sentence carries whatever money truth the server
    stated, and the copy adds none.

    An UNMARKED NOT_FOUND is held back on purpose: outside a flag's scope the
    server answers "No such thing.", a probe answer never written for a screen
    (`readableGatedFailure`'s reason, `failureCopy.ts`).
  */
  if (failureIsOurs(error) && (code !== "NOT_FOUND" || errorIsSpoken(error))) {
    return { kind: "declined", message: readableFailure(error, serverMessage) };
  }

  /*
    The fallback shows OUR sentence, never the error's.

    The founder was shown: `Unexpected token 'u', "upstream error" is not valid
    JSON`. That is a JSON parser talking about a gateway's plain-text 502 —
    three layers of implementation detail, in the place where a person is
    trying to find out whether they were charged.

    The earlier branches use `serverMessage` deliberately: those are tRPC codes
    our own server raised, and the sentence attached to them was written for a
    reader. Anything reaching here was not — it is a transport or parse failure
    whose text comes from a library or a proxy.

    The REFINE panel had the identical hole and kept it until run-9 put the
    same string on screen — `refineFailure.ts` is its half. Naming a class here
    and fixing one consumer is what law 7 is about.

    AND IT NO LONGER PROMISES THE MONEY IS SAFE. It used to say "Nothing was
    charged", which the earlier branches can say truthfully because the server
    refused before claiming. This branch cannot: a transport failure means we
    never heard the answer, and `createRoll` commits rows and charges while the
    request is still open. The roll may be running right now — the founder saw
    exactly that, a "didn't start" banner above eight tiles casting normally.
    So the copy stops asserting an outcome it does not know, and the sheet
    clears it the moment the poll proves a roll exists.
  */
  return {
    kind: "unavailable",
    message: "We lost contact while your roll was starting. Checking — if it did start, it will appear here in a moment.",
  };
}

/** The action a failure state offers. Refusals send you back to the words. */
export function failureActionLabel(kind: DispatchFailureKind): string {
  return kind === "refused" ? "Edit the brief" : "Back to casting";
}

/**
 * THE BANNER IS DEFINITIONALLY STALE ONCE A NEWER ROLL RENDERS — except a short
 * balance.
 *
 * `createRoll` commits its rows and charges while the request is still open, so
 * a transport failure means we never heard the answer, not that nothing
 * happened. If the roll the sheet is RENDERING is not the one the failed
 * dispatch fired on top of, a roll arrived after that failure, and the failure
 * describes a world that no longer exists (`DispatchFailure.afterRollId`).
 *
 * ⚠ **A credits refusal is the exception (#2387's sheet half).** A charge that
 * fails writes the roll's rows first and then fails them as `unpaid`, so a newer
 * roll DOES appear — eight "Didn't start · not charged" tiles — and the rule
 * above dismissed the one notice saying why within a poll. That roll is the
 * failure, not news after it, and nothing can be running behind a refusal about
 * the account. So it stands until the next dispatch clears it
 * (`rollDispatched`) or the customer leaves by its own button.
 */
export function failureIsStale(failure: DispatchFailure | null, activeRollId: string | null): boolean {
  return failure !== null
    && failure.kind !== "credits"
    && activeRollId !== null
    && activeRollId !== failure.afterRollId;
}
