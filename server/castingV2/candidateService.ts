/**
 * Candidate service — keep, discard, undo (plan §E, §F).
 *
 * These are the cheap mutations, and they are the ones most exposed to
 * double-clicks, two open tabs and flaky connections. Every one of them is a
 * CAS in a single owner-scoped statement, so the second press of a button is
 * *idempotent* rather than a second effect, and a stale tab loses cleanly.
 *
 * None of them charges, generates, or teaches the next roll anything. In
 * particular there is deliberately no write path from discard to compilation:
 * discarding is not negative feedback, and the absence of that path is the
 * enforcement (§F).
 */
import { TRPCError } from "@trpc/server";

import {
  discardCandidate,
  setCandidateKept,
  undoDiscardCandidate,
} from "../db/castingV2";

export type CandidateMutationResult = { candidateId: string; changed: boolean };

/**
 * Keep or unkeep. The client sends the state it wants — never "toggle" — so
 * two tabs pressing Keep converge on kept instead of racing to opposite
 * answers (§F Keep).
 */
export async function setKept(input: {
  userId: number;
  candidatePublicId: string;
  kept: boolean;
}): Promise<CandidateMutationResult> {
  const result = await setCandidateKept(input);
  if (!result.found) {
    // Also the answer for a foreign candidate: the ownership predicate is in
    // the statement, so "not yours" and "not there" are indistinguishable
    // from outside — which is the point.
    throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
  }
  return { candidateId: input.candidatePublicId, changed: result.changed };
}

/** Discard: removes from the sheet and clears kept. Double-click safe. */
export async function discard(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<CandidateMutationResult> {
  const result = await discardCandidate(input);
  if (!result.found) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });
  return { candidateId: input.candidatePublicId, changed: result.changed };
}

/**
 * Undo a discard — one step, id-keyed, and only on the active roll.
 *
 * The refusal below is what "the undo stack clears on the next roll" means
 * server-side. It is not a client convention: the statement itself refuses to
 * restore a candidate from an earlier roll, so a tab left open across a roll
 * cannot resurrect one.
 */
export async function undo(input: {
  userId: number;
  candidatePublicId: string;
}): Promise<CandidateMutationResult> {
  const restored = await undoDiscardCandidate(input);
  if (!restored) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "That can no longer be undone.",
    });
  }
  return { candidateId: input.candidatePublicId, changed: true };
}
